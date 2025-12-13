import dotenv from 'dotenv';
dotenv.config({ override: true });
import { PrismaClient } from '@prisma/client';
import { callLLM } from '../src/lib/llm';

const prisma = new PrismaClient();

// Basic HTML cleanup to avoid sending too much noise to LLM
function htmlToText(html: string): string {
    return html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
        .replace(/<[^>]+>/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
}

async function fetchUrl(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    return await res.text();
}

async function processUrl(url: string) {
    console.log(`\nFetching ${url}...`);
    const html = await fetchUrl(url);
    const text = htmlToText(html);

    // Try to extract date from URL or HTML (Simple Regex for YYYY-MM-DD or YYYY/MM/DD)
    const urlDateMatch = url.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    const defaultDate = urlDateMatch ? `${urlDateMatch[1]}-${urlDateMatch[2].padStart(2, '0')}-${urlDateMatch[3].padStart(2, '0')}` : new Date().toISOString().split('T')[0];

    // Truncate to avoid context limit if page is huge
    const safeText = text.substring(0, 10000);

    console.log(`Extracted ${safeText.length} characters. Sending to AI...`);
    console.log(`Default Date inferred from URL: ${defaultDate}`);

    const systemPrompt = `
You are a legal data extraction assistant. 
Your goal is to extract "Fair Competition Review Typical Cases" (公平竞争审查典型案例) from the provided text.
The text usually starts with a "Report Title" and is issued by a "Department".

CRITICAL INSTRUCTION: 
The text often groups cases by "Violation Type" (e.g. "I. Policy A... Case 1... Case 2...").
You MUST extract **EACH INDIVIDUAL CASE** as a separate object. 
**DO NOT** combine multiple cases into one summary. 
**DO NOT** use the Category Header as the case title.
Use the specific case name (e.g. "某市财政局...案") as the title.

Return a STRICT JSON object with the following structure:
{
  "reportTitle": string (The main title of the announcement),
  "reportDepartment": string (The agency that issued the *Announcement*),
  "reportDate": string (The date of the announcement, format YYYY-MM-DD),
  "cases": [
    {
      "title": string (The specific title of the case, e.g. "某县政府...案"),
      "content": string (The FULL, VERBATIM text content of the case including all details. Do NOT summarize! Extracts must be as complete as possible.),
      "violationType": string (The category this case belongs to),
      "result": string,
      "province": string,
      "documentOrg": string (The specific agency that committed the violation in this case),
      "documentName": string
    }
  ]
}

If no cases are found, return { "cases": [] }.
`;
    // Use plain text mode for better compatibility and speed with DeepSeek
    const response = await callLLM(systemPrompt, safeText, false);

    if (!response) {
        console.error("No response from AI.");
        return;
    }

    try {
        // Attempt to find JSON in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : response;

        const data = JSON.parse(jsonStr);
        const cases = data.cases;

        console.log(`AI found ${cases.length} cases.`);
        console.log(`Report Metadata: ${data.reportTitle} / ${data.reportDepartment}`);

        if (cases.length === 0) return;

        // 1. Create or Find the Report
        let reportId: number | null = null;
        if (data.reportTitle) {
            // Fallback date if AI missed it
            const finalReportDate = (data.reportDate && data.reportDate.length > 5) ? data.reportDate : defaultDate;

            const report = await prisma.report.upsert({
                where: {
                    // We don't have a unique constraint on title, so findFirst/create pattern is safer if schema differs,
                    // but assuming we want to avoid dups based on title for now.
                    // Wait, Prisma upsert requires unique where. Let's use findFirst then create.
                    id: -1 // Dummy, we won't use upsert fully if no unique key
                },
                update: {}, // Won't happen
                create: {
                    title: data.reportTitle,
                    department: data.reportDepartment || "未知发布机构",
                    publishDate: finalReportDate,
                    province: cases[0]?.province // Guess province from first case if needed, or leave null
                }
            });
            // Actually, can't use upsert on non-unique. Let's do findFirst.
        }

        // Correct Logic for Report
        let report;
        const finalReportDate = (data.reportDate && data.reportDate.length > 5) ? data.reportDate : defaultDate;
        const reportDept = data.reportDepartment || "未知发布机构";
        const reportTitle = data.reportTitle || `关于公平竞争审查的通报 (${finalReportDate})`;

        const existingReport = await prisma.report.findFirst({
            where: { title: reportTitle }
        });

        if (existingReport) {
            report = existingReport;
            console.log(`Found existing report: ${report.id}`);
        } else {
            report = await prisma.report.create({
                data: {
                    title: reportTitle,
                    department: reportDept,
                    publishDate: finalReportDate,
                    province: cases[0]?.province
                }
            });
            console.log(`Created new report: ${report.id}`);
        }
        reportId = report.id;


        for (const c of cases) {
            // Check for duplicates based on title
            const existing = await prisma.case.findFirst({
                where: { title: c.title }
            });

            if (existing) {
                console.log(`  - Skipped (Duplicate): ${c.title}`);
                // Optional: Link existing case to this report if missing?
                if (!existing.reportId && reportId) {
                    await prisma.case.update({ where: { id: existing.id }, data: { reportId: reportId } });
                    console.log(`    -> Linked to Report ${reportId}`);
                }
                continue;
            }

            // Use Report Date as fallback for Case Date if case doesn't have specific date (cases usually share report date)
            const finalCaseDate = finalReportDate;

            await prisma.case.create({
                data: {
                    title: c.title,
                    content: c.content,
                    violationType: c.violationType || "未分类",
                    result: c.result || "已纠正",
                    publishDate: finalCaseDate,
                    province: c.province,
                    documentOrg: c.documentOrg,
                    documentName: c.documentName,
                    reportId: reportId
                }
            });
            console.log(`  + Saved: ${c.title} (Org: ${c.documentOrg || 'N/A'}, Report: ${reportId})`);
        }

    } catch (e) {
        console.error("Failed to parse AI response:", e);
        console.error("Raw Response:", response);
    }
}

// Example usage: allow running with a URL argument
async function main() {
    const args = process.argv.slice(2);
    const url = args[0];

    if (!url) {
        console.log("Usage: npx tsx scripts/scrape_cases_ai.ts <URL>");
        console.log("Example: npx tsx scripts/scrape_cases_ai.ts https://www.samr.gov.cn/...");
        return;
    }

    await processUrl(url);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
