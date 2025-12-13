
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Find the report "江西公布一批..."
    const report = await prisma.report.findFirst({
        where: {
            department: { contains: '江西省市场监督管理局' }
        }
    });

    if (!report) {
        console.error('Report not found!');
        return;
    }

    console.log(`Found Report: ${report.title} (ID: ${report.id})`);

    // 2. Find cases that likely belong to this report but have no reportId
    // Based on the scraped data, these are the titles:
    const keywords = [
        '某市财政局《某市推进服务业高质量发展若干措施重点推进会计服务实施细则》案',
        '某区人民政府《关于优化调整加快推进企业上市“映山红行动”若干政策措施的通知》案',
        '某市科学技术局《新一轮科技新政配套实施细则和工作方案》案',
        '某县人民政府《关于支持现代服务业高质量发展若干政策措施意见的通知》案',
        '某区人民政府办公室《某市某区支持专精特新中小企业高质量发展若干措施（试行）》案',
        '某县人民政府办公室《关于加强某县户用屋顶光伏建设管理的实施意见（试行）》案',
        '某县人民政府办公室《某县“四上”企业培育及项目入规入库工作方案》案',
        '某县人民政府《某县人民政府关于推进装配式建筑发展的实施意见（修订）》案',
        '某区人民政府办公室《某区中心城区开放式居民区围合管理工作实施方案》案'
    ];

    // Note: The previous scrape might have used shorter titles or slightly different ones.
    // Let's search broadly first.

    // Actually, looking at the user's screenshot, the titles are "某县人民政府以落户本地为条件给予奖励案" etc.
    // These match the FIRST scrape result (Step 187).

    const titlesFromFirstScrape = [
        '某市财政局对全国百强会计师事务所实施财政奖励案',
        '某区人民政府鼓励外地上市公司迁入实施奖励案',
        '某市科学技术局对市内外企业实施差异化补助案',
        '某县人民政府以落户本地为条件给予奖励案', // Specific one in screenshot
        '某区人民政府限制企业自主迁移案',         // Specific one in screenshot
        '某县人民政府设置不合理光伏建设准入条件案', // Specific one in screenshot
        '某县人民政府变相强制外地经营者在本地设立分支机构案', // Specific one in screenshot
        '某县人民政府限定使用本县企业部品部件给予补贴案',   // Specific one in screenshot
        '某区人民政府直接发包特定公司施工案'
    ];

    for (const title of titlesFromFirstScrape) {
        // Find cases with this title (fuzzy match?)
        const cases = await prisma.case.findMany({
            where: {
                title: { contains: title.substring(0, 10) } // Match first 10 chars to be safe
            }
        });

        for (const c of cases) {
            console.log(`Checking case: ${c.title} (Current ReportId: ${c.reportId})`);

            if (!c.reportId) {
                console.log(`  -> Linking to Report ID ${report.id}`);
                await prisma.case.update({
                    where: { id: c.id },
                    data: { reportId: report.id }
                });
            } else {
                console.log(`  -> Already linked to Report ID ${c.reportId}`);
            }
        }
    }

    // Also check if we have duplicates (one with report, one without) and delete the ones without?
    // The user saw them in the list, implying they exist.
    // If the "new" script created NEW cases with slightly different titles (Step 237), we might have duplicates now.
    // Step 237 titles: "某市财政局《某市推进...》案" (Much longer)
    // Step 187 titles: "某市财政局对全国百强...案" (Shorter)

    // We should probably DELETE the short-title ones if the long-title ones exist and are linked?
    // Or just link the short ones too? The user screenshot shows SHORT titles.
    // So the user is looking at the OLD records.

    // Let's just LINK the short ones for now so the UI looks consistent immediately.

}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
