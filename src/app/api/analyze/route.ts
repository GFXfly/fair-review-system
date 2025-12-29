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
import { getCurrentUser, requireAuth } from '@/lib/auth';
import { applyRateLimit, llmAnalysisRateLimiter, getClientId } from '@/lib/rate-limit';

// ⚡ Next.js API Route Timeout Configuration
export const maxDuration = 300; // 300秒 = 5分钟

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
 * Deduplicate risks based on location text similarity
 */
function deduplicateRisks(risks: any[]): any[] {
    if (risks.length <= 1) return risks;

    const normalize = (text: string) => {
        return text
            .replace(/[\s\u3000]/g, '')
            .replace(/[,，.。、;；:：!！?？""\"''()[\]【】《》<>]/g, '')
            .toLowerCase();
    };

    const similarity = (a: string, b: string): number => {
        const normA = normalize(a);
        const normB = normalize(b);
        if (!normA || !normB) return 0;
        const setA = new Set(normA.split(''));
        const setB = new Set(normB.split(''));
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        return intersection.size / union.size;
    };

    const deduplicated: any[] = [];
    const processed = new Set<number>();

    risks.forEach((risk, i) => {
        if (processed.has(i)) return;

        const similarRisks = [risk];
        for (let j = i + 1; j < risks.length; j++) {
            if (processed.has(j)) continue;
            const sim = similarity(risk.location || '', risks[j].location || '');
            if (sim > 0.95) {
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

        const debateResults = await Promise.all(
            deduplicatedRisks.map(async (risk, index) => {
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
            })
        );

        const finalRisks = debateResults.filter(risk => risk !== null);

        // Step 5: Risk Radar (85%)
        await updateProgress(recordId, 85, '正在生成风险预警...');
        let radarAlert = null;
        const hasHighRisk = finalRisks.some(r => r.risk_level === 'High');
        if (gatekeeperResult.category === 'BIDDING' && hasHighRisk) {
            radarAlert = await runRiskRadar(fileName, finalRisks);
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
                    create: finalRisks.map(r => ({
                        level: r.risk_level,
                        type: '合规风险',
                        title: r.description.substring(0, 50),
                        description: r.description,
                        location: r.location,
                        suggestion: r.suggestion,
                        law: r.violated_law,
                        relatedCase: r.reference,
                        defense: r.defense || null,
                        rulingReason: r.rulingReason || null,
                        confidence: r.confidence || null
                    }))
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
        const formData = await req.formData();
        const file = formData.get('file') as File;

        // Require authentication
        const user = await requireAuth(req);
        userId = user.id;

        // Apply rate limiting
        const clientId = getClientId(req);
        const rateLimitResult = await applyRateLimit(llmAnalysisRateLimiter, user.username || clientId);
        if (!rateLimitResult.success) {
            await logFailure('analyze_file', '分析尝试次数过多', userId, undefined, { clientId }, req);
            return rateLimitResult.response!;
        }

        if (!file) {
            await logFailure('upload_file', '未提供文件', userId, undefined, undefined, req);
            return NextResponse.json({ error: '未提供文件' }, { status: 400 });
        }

        fileName = file.name;

        // File size limit: 10MB
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            await logFailure('upload_file', '文件过大', userId, fileName, { fileSize: file.size }, req);
            return NextResponse.json({
                error: '文件过大',
                message: `文件大小不能超过 10MB`,
                suggestion: `当前文件大小为 ${(file.size / 1024 / 1024).toFixed(2)}MB`
            }, { status: 400 });
        }

        // Extract text from file
        let parsedDoc;
        try {
            parsedDoc = await extractTextFromFile(file);
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

        // Get client IP for logging
        const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

        // 🔥 Start async processing (fire and forget)
        // Using setImmediate/setTimeout to not block the response
        setImmediate(() => {
            processAnalysisAsync(record.id, fileName, file.size, text, html, userId!, clientIp)
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
        console.error('Analysis failed:', error);
        await logFailure('analyze_file', '系统错误', userId, fileName, { error: String(error) }, req);
        return NextResponse.json(createErrorResponse(error, '文件分析'), { status: 500 });
    }
}
