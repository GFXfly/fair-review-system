
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Create Report
    const reportTitle = '宁夏回族自治区市场监督管理厅纠正平罗县财政局滥用行政权力排除限制竞争行为';
    let report = await prisma.report.findFirst({
        where: { title: reportTitle }
    });

    if (!report) {
        report = await prisma.report.create({
            data: {
                title: reportTitle,
                department: '国家市场监督管理总局',
                publishDate: '2023-08-04',
                province: '宁夏回族自治区',
            }
        });
        console.log(`Created Report: ${report.title} (ID: ${report.id})`);
    } else {
        console.log(`Report already exists: ${report.title} (ID: ${report.id})`);
    }

    // 2. Create Case
    const caseData = {
        title: '宁夏回族自治区市场监督管理厅纠正平罗县财政局滥用行政权力排除限制竞争行为',
        content: `2023年3月29日，宁夏回族自治区市场监督管理厅依法对平罗县财政局涉嫌滥用行政权力排除、限制竞争行为立案调查。
经查，2017年8月29日，当事人印发《关于为在职公职人员办理国寿交通意外保险的通知》（平财发〔2017〕207号）规定“政府统一为在职公职人员购买交通意外保险，统一办理某保险公司提供的交通意外保险，由各行政事业单位按100元/每人保险标准，自主办理保险，单位可在公用经费中列支此项费用。办理交通意外保险后，干部职工因公外出不再办理各种涉及交通类保险手续”。截止调查前，该文件依然在执行。
宁夏回族自治区市场监管厅认为，交通意外保险市场属于竞争性市场，当事人印发文件指定某保险公司作为各行政事业单位办理交通意外险的承保单位，排除了其他具备承保交通意外险资质和能力的保险公司，限制了相关保险市场公平竞争，违反了《中华人民共和国反垄断法》第三十九条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品”的规定，构成滥用行政权力排除、限制竞争行为。
调查期间，当事人认识到上述行为的违法性，及时废止了相关文件，停止违法行为，消除相关竞争限制，并在平罗县人民政府网站向社会公示。同时，当事人进一步优化内部公平竞争审查工作机制，加强公平竞争审查业务学习培训，持续开展涉及市场主体政策性文件存量清理和增量文件公平竞争审查工作，防止此类情况再次发生。`,
        violationType: '指定交易/滥用行政权力',
        violationClause: '《中华人民共和国反垄断法》第三十九条（不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品）',
        documentName: '《关于为在职公职人员办理国寿交通意外保险的通知》（平财发〔2017〕207号）',
        documentOrg: '平罗县财政局',
        province: '宁夏回族自治区石嘴山市平罗县',
        violationDetail: '规定政府统一为在职公职人员购买交通意外保险，并指定某保险公司作为承保单位。',
        result: '废止相关文件，停止违法行为，向社会公示。',
        publishDate: '2023-08-04',
        reportId: report.id
    };

    const existingCase = await prisma.case.findFirst({
        where: {
            title: caseData.title,
            reportId: report.id
        }
    });

    if (!existingCase) {
        await prisma.case.create({
            data: caseData
        });
        console.log(`Created Case: ${caseData.title}`);
    } else {
        console.log(`Case already exists: ${caseData.title}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
