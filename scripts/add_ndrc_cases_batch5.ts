
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { callLLM } from '../src/lib/llm';
import * as dotenv from 'dotenv';
dotenv.config({ override: true });

const prisma = new PrismaClient();

async function parseAndAddCases() {
    console.log('Reading text file...');
    const rawText = fs.readFileSync('ndrc_cases_5.txt', 'utf-8');

    // Basic cleaning: remove separating lines like "—\n1\n—"
    const cleanText = rawText.replace(/—\n\d+\n—/g, '');

    // Split by "案例" followed by a number
    const caseChunks = cleanText.split(/案例\s*\d+\s*[：:]/);
    // The first chunk is usually intro text, so skip it.

    console.log(`Found ${caseChunks.length - 1} potential cases.`);

    for (let i = 1; i < caseChunks.length; i++) {
        const chunk = caseChunks[i];
        if (chunk.trim().length < 50) continue; // Skip empty or too short chunks

        console.log(`Processing Case ${i}...`);

        const systemPrompt = `
        你是一个数据提取助手。请从以下文本中提取公平竞争审查违规案例的关键信息。
        
        文本：
        ${chunk}

        请提取以下字段并以 JSON 格式返回：
        {
            "title": "案例标题（通常是第一句话，去掉'案例X：'）",
            "content": "案情摘要（描述发生了什么违规行为，200字以内）",
            "violationType": "违规类型（如：准入障碍、歧视性条款、指定交易、违规收费等）",
            "result": "处理结果（如：已整改、正在整改）",
            "province": "涉案省份（如：福建省、湖北省）",
            "department": "涉案部门（如：某市城市管理局）",
            "publishDate": "案例发生或通报的大致日期（格式 YYYY-MM-DD，如果文中没有具体日期，默认为 '2023-03-16'）",
             "documentName": "涉及的具体文件名称（如果提到）",
             "documentOrg": "发文机关（如果提到）"
        }
        `;

        try {
            const resultStr = await callLLM(systemPrompt, "请提取信息", true);
            if (resultStr) {
                const caseData = JSON.parse(resultStr);

                // Add default publish date if missing or invalid
                if (!caseData.publishDate || !caseData.publishDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    caseData.publishDate = '2023-03-16';
                }

                // Insert into DB
                await prisma.case.create({
                    data: {
                        title: caseData.title || `案例 ${i}`,
                        content: caseData.content || chunk.substring(0, 200),
                        violationType: caseData.violationType || '其他',
                        result: caseData.result || '已整改',
                        publishDate: caseData.publishDate,
                        province: caseData.province,
                        // department field does not exist in Case model, map to documentOrg
                        documentName: caseData.documentName,
                        documentOrg: caseData.documentOrg || caseData.department,
                        reportId: 5, // Associate with a report ID if we had one for this batch, or leave null. 
                        // Actually, let's check if we want to create a Report record first? 
                        // The user just dropped a URL. I'll just leave reportId null or create a dummy report.
                        // Previous scripts might have used reportId.
                        // Let's create a Report for this URL first?
                    }
                });
                console.log(`Saved: ${caseData.title}`);
            }
        } catch (e) {
            console.error(`Failed to process case ${i}:`, e);
        }

        // Small delay to avoid rate limits if any
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// First, ensure we have a Report entry for this batch "第五批"
async function main() {
    try {
        const report = await prisma.report.upsert({
            where: { id: 5 }, // Assuming ID 5 for simplicity or we can findBy title
            update: {},
            create: {
                id: 5,
                title: '关于违背市场准入负面清单典型案例的通报(第五批)',
                department: '国家发展和改革委员会',
                publishDate: '2023-03-16',
                province: '全国'
            }
        });
        console.log('Report record ensured:', report.title);

        await parseAndAddCases();
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
