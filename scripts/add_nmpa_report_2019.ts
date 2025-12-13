import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const reportData = {
    title: "五省区积极整改2018年公平竞争审查重点督查发现的典型问题",
    department: "国家市场监督管理总局",
    publishDate: "2019-01-25",
    province: "全国"
};

const summaryCase = {
    title: "五省区（辽宁、黑龙江、广东、广西、新疆）在2018年公平竞争审查重点督查中发现30份违规文件",
    content: "2018年6月至10月，市场监管总局会同有关部门，随机选择辽宁、黑龙江、广东、广西、新疆等5省区开展重点督查，抽查了相关单位2017年以来出台的175份文件，发现其中30份存在违反公平竞争审查标准或者程序的问题。涉及社会反映强烈的地域保护、限制准入、指定交易、选择性补贴等突出问题。目前，8份文件已整改完毕，22份文件正在按程序进行整改。",
    violationType: "综合（地域保护、限制准入、指定交易等）",
    result: "部分整改完毕，部分整改中",
    documentName: "《关于促进XX行业发展的通知》等30份文件", // Placeholder as specific names are in attachment
    documentOrg: "辽宁、黑龙江、广东、广西、新疆等5省区及其下属单位",
    violationClause: "违反公平竞争审查标准",
    violationDetail: "相关文件规定损害了市场主体的合法权益，破坏了公平竞争的市场环境，包括地域保护、限制准入、指定交易、选择性补贴等。",
    province: "全国"
};

async function main() {
    console.log('开始处理2018年重点督查通报...');

    // 1. 创建或获取 Report
    let report = await prisma.report.findFirst({
        where: { title: reportData.title }
    });

    if (!report) {
        console.log(`创建新通报: ${reportData.title}`);
        report = await prisma.report.create({
            data: reportData
        });
    } else {
        console.log(`使用已有通报: ${reportData.title} (ID: ${report.id})`);
    }

    // 2. 添加汇总案例关联到 Report
    // 检查是否已存在
    const existingCase = await prisma.case.findFirst({
        where: {
            title: summaryCase.title,
            reportId: report.id
        }
    });

    if (!existingCase) {
        await prisma.case.create({
            data: {
                ...summaryCase,
                reportId: report.id
            }
        });
        console.log(`已添加汇总案例: ${summaryCase.title}`);
    } else {
        console.log(`汇总案例已存在: ${summaryCase.title}`);
    }

    console.log(`\n处理完成。由于详情在附件文档中，当前仅添加了通报概要。`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
