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

/**
 * Deduplicate risks based on location text similarity
 * Merges risks that refer to the same clause/paragraph
 */
function deduplicateRisks(risks: any[]): any[] {
    if (risks.length <= 1) return risks;

    // Normalize text for comparison (remove whitespace, punctuation, lowercase)
    const normalize = (text: string) => {
        return text
            .replace(/[\s\u3000]/g, '')
            .replace(/[,，.。、;；:：!！?？"""''()[\\]【】《》<>]/g, '')
            .toLowerCase();
    };

    // Calculate similarity between two strings
    const similarity = (a: string, b: string): number => {
        const normA = normalize(a);
        const normB = normalize(b);

        if (!normA || !normB) return 0;

        // Use Jaccard similarity for short texts
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

        // Find all similar risks (similarity > 60%)
        const similarRisks = [risk];
        for (let j = i + 1; j < risks.length; j++) {
            if (processed.has(j)) continue;

            const sim = similarity(risk.location || '', risks[j].location || '');

            // If similarity > 60%, consider them duplicates
            if (sim > 0.6) {
                console.log(`[Deduplication] Found similar risks (${(sim * 100).toFixed(1)}%):`,
                    `\n  Risk ${i + 1}: ${risk.location?.substring(0, 50)}...`,
                    `\n  Risk ${j + 1}: ${risks[j].location?.substring(0, 50)}...`);
                similarRisks.push(risks[j]);
                processed.add(j);
            }
        }

        // Merge similar risks - keep the one with higher risk level
        const riskLevelPriority: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
        const merged = similarRisks.reduce((best, current) => {
            const bestLevel = riskLevelPriority[best.risk_level] || 0;
            const currentLevel = riskLevelPriority[current.risk_level] || 0;

            if (currentLevel > bestLevel) {
                // Keep the higher-level risk
                // Merge descriptions if they differ
                if (current.description !== best.description) {
                    current.description = `${current.description}\n\n【相关风险】${best.description}`;
                }
                // Keep the shorter location for better highlighting (usually more precise)
                if (best.location && (!current.location || best.location.length < current.location.length)) {
                    current.location = best.location;
                }
                return current;
            } else {
                // Keep the best risk
                // Append current description to best if different
                if (current.description !== best.description) {
                    best.description = `${best.description}\n\n【相关风险】${current.description}`;
                }
                // Keep the shorter location for better highlighting
                if (current.location && (!best.location || current.location.length < best.location.length)) {
                    best.location = current.location;
                }
                return best;
            }
        });

        deduplicated.push(merged);
        processed.add(i);
    });

    return deduplicated;
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

        // Apply rate limiting (LLM Level)
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

        // Get file name early
        fileName = file.name;

        // File size limit: 10MB (防止内存溢出和过长的处理时间)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > MAX_FILE_SIZE) {
            await logFailure('upload_file', '文件过大', userId, fileName, {
                fileSize: file.size,
                maxSize: MAX_FILE_SIZE
            }, req);

            return NextResponse.json({
                error: '文件过大',
                message: `文件大小不能超过 10MB`,
                suggestion: `当前文件大小为 ${(file.size / 1024 / 1024).toFixed(2)}MB，请精简文件内容后重新上传。`
            }, { status: 400 });
        }

        // Actual text extraction
        let parsedDoc;
        try {
            parsedDoc = await extractTextFromFile(file);
            const { text, html } = parsedDoc;
            console.log(`Extracted ${text.length} characters from ${fileName}`);

            // 记录文件上传成功
            await logSuccess('upload_file', userId, fileName, {
                fileSize: file.size,
                textLength: text.length
            }, req);

        } catch (error: any) {
            console.error('Text extraction failed:', error);

            // 记录文件解析失败
            await logFailure('analyze_file', '文件解析失败', userId, fileName, {
                error: error.message
            }, req);

            // Return user-friendly error message
            return NextResponse.json(
                createErrorResponse(error, '文件解析'),
                { status: 400 }
            );
        }

        const { text, html } = parsedDoc;

        // 1. Gatekeeper
        const gatekeeperChunk = TextChunker.getChunkForAgent(text, 'gatekeeper');
        const gatekeeperResult = await runGatekeeper(fileName, gatekeeperChunk, {});

        // Save ignored record
        if (!gatekeeperResult.needs_review) {
            const savedRecord = await prisma.reviewRecord.create({
                data: {
                    fileName: fileName,
                    fileSize: file.size,
                    status: 'ignored',
                    summary: `【无需审查】${gatekeeperResult.reason}`,
                    riskCount: 0,
                    userId: userId
                }
            });

            return NextResponse.json({
                id: savedRecord.id,
                gatekeeper: gatekeeperResult,
                auditor: [],
                radar: null,
                text,
                html,
                originalText: text,
                originalHtml: html
            });
        }

        // 1.5 Guidance Counselor (Fetch expert Q&A)
        const guidance = await runGuidanceCounselor(text, gatekeeperResult.category);

        // 2. Auditor
        const auditorResults = await runAuditor(gatekeeperResult.category, text, guidance);

        // 2.5 Deduplicate similar risks based on location text similarity
        const deduplicatedRisks = deduplicateRisks(auditorResults);
        console.log(`[Deduplication] Reduced ${auditorResults.length} risks to ${deduplicatedRisks.length} unique risks`);

        // --- Debate Agents Loop (Parallelized for Performance) ---
        console.log('[Debate] Starting debate loop for', deduplicatedRisks.length, 'risks');

        // Process all risks in parallel instead of sequentially
        const debateResults = await Promise.all(
            deduplicatedRisks.map(async (risk) => {
                try {
                    console.log(`[Debate] Defending risk: ${risk.description.substring(0, 30)}...`);

                    // Step 1: Defender
                    const defenseArgs = await runDefender(risk, text);
                    console.log(`[Debate] Defense: ${defenseArgs.substring(0, 50)}...`);

                    // Step 2: Judge
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
                    // If debate fails, keep the original risk
                    return risk;
                }
            })
        );

        // Filter out dismissed risks (null values)
        const finalRisks = debateResults.filter(risk => risk !== null);

        // 3. Risk Radar (only if High risk in Bidding)
        let radarAlert = null;
        const hasHighRisk = finalRisks.some(r => r.risk_level === 'High');
        if (gatekeeperResult.category === 'BIDDING' && hasHighRisk) {
            radarAlert = await runRiskRadar(fileName, finalRisks);
        }

        // Save completed record
        const savedRecord = await prisma.reviewRecord.create({
            data: {
                fileName: fileName,
                fileSize: file.size,
                status: 'completed',
                summary: `文件类型：${gatekeeperResult.category}。AI 判定理由：${gatekeeperResult.reason}`,
                originalText: text,
                originalHtml: html,
                riskCount: finalRisks.length,
                userId: userId,
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
            },
            // 同时获取创建的风险点ID
            include: {
                risks: {
                    select: {
                        id: true,
                        description: true
                    }
                }
            }
        });

        // 将数据库ID合并到返回结果中
        const risksWithDbId = finalRisks.map((r, index) => ({
            ...r,
            id: savedRecord.risks[index]?.id || r.id // 使用数据库ID
        }));

        // 记录分析成功
        await logSuccess('analyze_file', userId, fileName, {
            reviewId: savedRecord.id,
            category: gatekeeperResult.category,
            riskCount: finalRisks.length,
            hasHighRisk: finalRisks.some(r => r.risk_level === 'High')
        }, req);

        return NextResponse.json({
            id: savedRecord.id,
            gatekeeper: gatekeeperResult,
            auditor: risksWithDbId, // 返回带有数据库ID的风险点
            radar: radarAlert,
            text: text, // Return the extracted text for AI
            html: html  // Return the HTML for frontend display
        });

    } catch (error: any) {
        console.error('Analysis failed:', error);

        // 记录分析失败
        await logFailure('analyze_file', '系统错误', userId, fileName, {
            error: String(error)
        }, req);

        return NextResponse.json(
            createErrorResponse(error, '文件分析'),
            { status: 500 }
        );
    }
}
