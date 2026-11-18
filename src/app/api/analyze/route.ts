import { NextRequest, NextResponse } from 'next/server';
import { runGatekeeper } from '@/lib/agents/gatekeeper';
import { runAuditor } from '@/lib/agents/auditor';
import { runRiskRadar } from '@/lib/agents/radar';
import { runDefender, runJudge } from '@/lib/agents/debate';
import { runGuidanceCounselor } from '@/lib/agents/guidance_counselor';
import { extractTextFromFile } from '@/lib/file-parser';
import { prisma } from '@/lib/prisma';
import { TextChunker } from '@/lib/text-utils';
import { logSuccess, logFailure } from '@/lib/audit-logger';
import { createErrorResponse } from '@/lib/error-handler';
import { AuthError, getCurrentUser, handleAuthError, requireAuth } from '@/lib/auth';
import { applyRateLimit, llmAnalysisRateLimiter, getTrustedClientIp } from '@/lib/rate-limit';
import { encodeRelatedCaseWithCaliber, extractInternalCaliberFromText, sanitizePublicText } from '@/lib/caliber-sanitizer';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// ⚡ Next.js API Route Timeout Configuration
export const maxDuration = 300; // 300秒 = 5分钟

// 辩论环节并发上限：每个风险点要串行跑 Defender + Judge（Pro 思考模式，单次较慢）。
// 裸 Promise.all 会让所有风险同时打 LLM，风险点一多就触发 API 限流。这里限流并发。
const DEBATE_CONCURRENCY = Math.max(1, parseInt(process.env.DEBATE_CONCURRENCY || '3'));

async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = cursor++;
            if (i >= items.length) return;
            results[i] = await fn(items[i], i);
        }
    });
    await Promise.all(workers);
    return results;
}

/**
 * 更新审查进度
 */
async function updateProgress(recordId: string, progress: number, message: string) {
    try {
        await prisma.reviewRecord.update({
            where: { id: recordId },
            data: {
                progress,
                progressMessage: message
            }
        });
    } catch (e) {
        console.error('[Progress] Failed to update progress:', e);
    }
}

/**
 * Deduplicate risks. A pair is considered duplicate when EITHER:
 *   (a) one normalized location is a substring of the other (with length ratio >= 0.5), OR
 *   (b) Jaccard char-set similarity >= 0.9 AND length ratio >= 0.6
 *   (c) descriptions nearly identical (>= 0.9 char-set Jaccard)
 * Char-set Jaccard alone is too lenient for Chinese policy text because
 * natural char overlap is high even between unrelated clauses.
 */
function deduplicateRisks(risks: any[]): any[] {
    if (risks.length <= 1) return risks;

    const normalize = (text: string) =>
        (text || '')
            .replace(/[\s\u3000]/g, '')
            .replace(/[,，.。、;；:：!！?？""\"''()[\]【】《》<>「」]/g, '')
            .toLowerCase();

    const jaccard = (normA: string, normB: string): number => {
        if (!normA || !normB) return 0;
        const setA = new Set(normA.split(''));
        const setB = new Set(normB.split(''));
        let intersection = 0;
        setA.forEach(c => { if (setB.has(c)) intersection++; });
        const union = setA.size + setB.size - intersection;
        return union === 0 ? 0 : intersection / union;
    };

    const isDuplicate = (a: any, b: any): boolean => {
        const locA = normalize(a.location || '');
        const locB = normalize(b.location || '');
        if (!locA || !locB) return false;

        const lenRatio = Math.min(locA.length, locB.length) / Math.max(locA.length, locB.length);

        // (a) substring containment with reasonable length ratio
        if (lenRatio >= 0.5 && (locA.includes(locB) || locB.includes(locA))) return true;

        // (b) high char-set overlap + similar length
        if (lenRatio >= 0.6 && jaccard(locA, locB) >= 0.9) return true;

        // (c) near-identical descriptions
        const descA = normalize(a.description || '');
        const descB = normalize(b.description || '');
        if (descA.length >= 30 && descB.length >= 30 && jaccard(descA, descB) >= 0.9) return true;

        return false;
    };

    const deduplicated: any[] = [];
    const processed = new Set<number>();

    risks.forEach((risk, i) => {
        if (processed.has(i)) return;

        const similarRisks = [risk];
        for (let j = i + 1; j < risks.length; j++) {
            if (processed.has(j)) continue;
            if (isDuplicate(risk, risks[j])) {
                similarRisks.push(risks[j]);
                processed.add(j);
            }
        }

        const riskLevelPriority: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
        const merged = similarRisks.reduce((best, current) => {
            const bestLevel = riskLevelPriority[best.risk_level] || 0;
            const currentLevel = riskLevelPriority[current.risk_level] || 0;
            return currentLevel > bestLevel ? current : best;
        });

        deduplicated.push(merged);
        processed.add(i);
    });

    console.log(`[Deduplication] Reduced ${risks.length} risks to ${deduplicated.length} unique risks`);
    return deduplicated;
}

/**
 * 异步执行审查流程（在后台运行）
 */
async function processAnalysisAsync(
    recordId: string,
    fileName: string,
    fileSize: number,
    text: string,
    html: string,
    userId: number,
    clientIp: string
) {
    try {
        // Step 1: Gatekeeper (10%)
        await updateProgress(recordId, 10, 'Gatekeeper 正在进行文档语义解析...');
        const gatekeeperChunk = TextChunker.getChunkForAgent(text, 'gatekeeper');
        const gatekeeperResult = await runGatekeeper(fileName, gatekeeperChunk, {});

        // If no review needed, mark as ignored
        if (!gatekeeperResult.needs_review) {
            await prisma.reviewRecord.update({
                where: { id: recordId },
                data: {
                    status: 'ignored',
                    progress: 100,
                    progressMessage: '审查完成（无需审查）',
                    summary: `【无需审查】${gatekeeperResult.reason}`,
                    riskCount: 0
                }
            });
            return;
        }

        // Step 2: Guidance Counselor (20%)
        await updateProgress(recordId, 20, '正在检索专家知识库...');
        const guidance = await runGuidanceCounselor(text, gatekeeperResult.category);

        // Step 3: Auditor (40%)
        await updateProgress(recordId, 30, '正在全库检索法规、典型违规案例...');
        const auditorResults = await runAuditor(gatekeeperResult.category, text, guidance);

        await updateProgress(recordId, 40, `Auditor 发现 ${auditorResults.length} 个潜在风险点...`);
        const deduplicatedRisks = deduplicateRisks(auditorResults);

        // Step 4: Debate (40% -> 80%)
        const totalRisks = deduplicatedRisks.length;
        console.log('[Debate] Starting debate loop for', totalRisks, 'risks');

        const debateResults = await mapWithConcurrency(
            deduplicatedRisks,
            DEBATE_CONCURRENCY,
            async (risk, index) => {
                try {
                    const progressPercent = 40 + Math.round((index / totalRisks) * 40);
                    await updateProgress(recordId, progressPercent,
                        `辩论验证中 (${index + 1}/${totalRisks})：${risk.description.substring(0, 20)}...`);

                    const defenseArgs = await runDefender(risk, text);
                    const finalVerdict = await runJudge(risk, defenseArgs);

                    if (finalVerdict) {
                        console.log(`[Debate] Judge Verdict: MAINTAIN/DOWNGRADE`);
                        return finalVerdict;
                    } else {
                        console.log(`[Debate] Judge Verdict: DISMISS`);
                        return null;
                    }
                } catch (error) {
                    console.error('[Debate] Error processing risk:', error);
                    return risk;
                }
            }
        );

        const finalRisks = debateResults.filter(risk => risk !== null);

        // Step 5: Risk Radar (85%)
        // 预警结果暂未设计落库字段，默认跳过以节省耗时与 LLM 调用成本；
        // 如需在日志中验证预警模型输出，可通过 ENABLE_RISK_RADAR=true 显式开启。
        if (process.env.ENABLE_RISK_RADAR === 'true') {
            await updateProgress(recordId, 85, '正在生成风险预警...');
            const hasHighRisk = finalRisks.some(r => r.risk_level === 'High');
            if (hasHighRisk) {
                await runRiskRadar(fileName, finalRisks);
            }
        }

        // Step 6: Save results (95%)
        await updateProgress(recordId, 95, '正在保存审查结果...');

        // Update the record with final results
        await prisma.reviewRecord.update({
            where: { id: recordId },
            data: {
                status: 'completed',
                progress: 100,
                progressMessage: '审查完成',
                summary: `文件类型：${gatekeeperResult.category}。AI 判定理由：${gatekeeperResult.reason}`,
                originalText: text,
                originalHtml: html,
                riskCount: finalRisks.length,
                risks: {
                    create: finalRisks.map(r => {
                        const cleanDesc = sanitizePublicText(r.description);
                        const caliberRef = r.internal_caliber_ref?.trim()
                            || extractInternalCaliberFromText(r.reference, r.violated_law, r.description, r.rulingReason);
                        return {
                            level: r.risk_level,
                            type: '合规风险',
                            title: cleanDesc.substring(0, 50),
                            description: cleanDesc,
                            location: sanitizePublicText(r.location),
                            suggestion: sanitizePublicText(r.suggestion),
                            law: sanitizePublicText(r.violated_law, '《公平竞争审查条例》及相关招投标公平竞争审查规定'),
                            relatedCase: encodeRelatedCaseWithCaliber(r.reference, caliberRef),
                            defense: r.defense ? sanitizePublicText(r.defense) || null : null,
                            rulingReason: r.rulingReason ? sanitizePublicText(r.rulingReason) || null : null,
                            confidence: r.confidence || null
                        };
                    })
                }
            }
        });

        console.log(`[Analyze] Completed analysis for ${fileName}, found ${finalRisks.length} risks`);

    } catch (error: any) {
        console.error('[Analyze] Async processing failed:', error);
        await prisma.reviewRecord.update({
            where: { id: recordId },
            data: {
                status: 'failed',
                progress: 0,
                progressMessage: `审查失败: ${error.message || '未知错误'}`
            }
        });
    }
}

export async function POST(req: NextRequest) {
    let userId: number | null = null;
    let fileName: string = '';

    try {
        // 1. 前置鉴权：必须在读取请求体/formData 之前完成认证
        const user = await requireAuth(req);
        userId = user.id;

        // 2. 前置限流：基于用户名或可信客户端 IP
        const clientIp = getTrustedClientIp(req);
        const rateLimitResult = await applyRateLimit(llmAnalysisRateLimiter, user.username || clientIp);
        if (!rateLimitResult.success) {
            await logFailure('analyze_file', '分析尝试次数过多', userId, undefined, { clientId: clientIp }, req);
            return rateLimitResult.response!;
        }

        // 3. 在读取 formData 前快速校验 Content-Length 上限，防止超大请求体打满内存
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const contentLengthHeader = req.headers.get('content-length');
        if (contentLengthHeader) {
            const contentLength = Number(contentLengthHeader);
            if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 256 * 1024) {
                await logFailure('upload_file', '请求体过大', userId, undefined, { contentLength }, req);
                return NextResponse.json({
                    error: '文件过大',
                    message: '文件大小不能超过 10MB',
                }, { status: 413 });
            }
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            await logFailure('upload_file', '未提供文件', userId, undefined, undefined, req);
            return NextResponse.json({ error: '未提供文件' }, { status: 400 });
        }

        fileName = file.name;

        // File size limit: 10MB
        if (file.size > MAX_FILE_SIZE) {
            await logFailure('upload_file', '文件过大', userId, fileName, { fileSize: file.size }, req);
            return NextResponse.json({
                error: '文件过大',
                message: `文件大小不能超过 10MB`,
                suggestion: `当前文件大小为 ${(file.size / 1024 / 1024).toFixed(2)}MB`
            }, { status: 400 });
        }

        // 一次性读取文件 Buffer，避免请求流二次消费导致原始 .docx 落盘失败
        let fileBuffer: Buffer;
        let parsedDoc;
        try {
            fileBuffer = Buffer.from(await file.arrayBuffer());
            parsedDoc = await extractTextFromFile(file, fileBuffer);
            console.log(`Extracted ${parsedDoc.text.length} characters from ${fileName}`);
            await logSuccess('upload_file', userId, fileName, { fileSize: file.size, textLength: parsedDoc.text.length }, req);
        } catch (error: any) {
            console.error('Text extraction failed:', error);
            await logFailure('analyze_file', '文件解析失败', userId, fileName, { error: error.message }, req);
            return NextResponse.json(createErrorResponse(error, '文件解析'), { status: 400 });
        }

        const { text, html } = parsedDoc;

        // ============================================
        // 🚀 异步模式：立即创建记录并返回
        // ============================================

        // Create a "processing" record immediately
        const record = await prisma.reviewRecord.create({
            data: {
                fileName: fileName,
                fileSize: file.size,
                status: 'processing',
                progress: 5,
                progressMessage: '正在初始化审查流程...',
                riskCount: 0,
                userId: userId,
                originalText: text,
                originalHtml: html
            }
        });

        console.log(`[Analyze] Created processing record: ${record.id} for ${fileName}`);

        // 存原始 docx 供前端 docx-preview 高保真还原（仅 docx/wps；失败不阻断审查）。
        // data 目录是持久化挂载卷，与数据库同位置。
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.docx') || lowerName.endsWith('.wps')) {
            try {
                const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
                await mkdir(uploadsDir, { recursive: true });
                await writeFile(
                    path.join(uploadsDir, `${record.id}.docx`),
                    fileBuffer
                );
            } catch (e) {
                console.error('[Analyze] 存储原始文档失败（不影响审查）:', e);
            }
        }

        // Get trusted client IP for logging
        const trustedClientIp = getTrustedClientIp(req);

        // 🔥 Start async processing (fire and forget)
        // Using setImmediate/setTimeout to not block the response
        setImmediate(() => {
            processAnalysisAsync(record.id, fileName, file.size, text, html, userId!, trustedClientIp)
                .then(() => {
                    console.log(`[Analyze] Async processing completed for ${record.id}`);
                })
                .catch((err) => {
                    console.error(`[Analyze] Async processing failed for ${record.id}:`, err);
                });
        });

        // Return immediately with the record ID
        return NextResponse.json({
            id: record.id,
            status: 'processing',
            progress: 5,
            progressMessage: '正在初始化审查流程...',
            message: '审查已开始，请等待完成'
        });

    } catch (error: any) {
        if (error instanceof AuthError || (error && typeof error === 'object' && error.name === 'AuthError')) {
            return handleAuthError(error);
        }
        console.error('Analysis failed:', error);
        await logFailure('analyze_file', '系统错误', userId, fileName, { error: String(error) }, req);
        return NextResponse.json(createErrorResponse(error, '文件分析'), { status: 500 });
    }
}
