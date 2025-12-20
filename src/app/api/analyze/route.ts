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
                html
            });
        }

        // 1.5 Guidance Counselor (Fetch expert Q&A)
        const guidance = await runGuidanceCounselor(text);

        // 2. Auditor
        const auditorResults = await runAuditor(gatekeeperResult.category, text, guidance);

        // --- Debate Agents Loop (Parallelized for Performance) ---
        console.log('[Debate] Starting debate loop for', auditorResults.length, 'risks');

        // Process all risks in parallel instead of sequentially
        const debateResults = await Promise.all(
            auditorResults.map(async (risk) => {
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
                        relatedCase: r.reference
                    }))
                }
            }
        });

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
            auditor: finalRisks,
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
