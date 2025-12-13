import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('开始添加海西州公平竞争审查典型案例...');

    // 1. 创建通报
    const reportData = {
        title: '海西州市场监督管理局发布6起公平竞争审查典型案例',
        department: '海西州市场监督管理局',
        publishDate: '2025-11-01', // 根据图片，需要确认具体日期
        province: '青海省'
    };

    let report = await prisma.report.findFirst({
        where: { title: reportData.title }
    });

    if (!report) {
        console.log('创建新通报:', reportData.title);
        report = await prisma.report.create({
            data: reportData
        });
    } else {
        console.log('使用已有通报, ID:', report.id);
        await prisma.case.deleteMany({
            where: { reportId: report.id }
        });
    }

    // 2. 添加6个案例
    const cases = [
        {
            title: '海西州某县发改局在政策措施中规定以在本地注册为享受奖励的必要条件',
            content: `经查，某县发改局在政策措施中规定"在本县注册的企业"才能享受奖励，以在本地注册为享受奖励的必要条件，影响经营主体公平竞争。

处理结果：该县发改局已修订相关政策措施，删除了相关限制性条款。`,
            violationType: '影响生产经营成本',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '海西州某县发改局',
            violationClause: `《公平竞争审查条例》
第十条 起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：
（二）给予特定经营者选择性、差异化的财政奖励或者补贴。`,
            violationDetail: '规定"在本县注册的企业"才能享受奖励，以在本地注册为享受奖励的必要条件，给予特定经营者选择性、差异化的财政奖励。',
        },
        {
            title: '海西州某县住建局在政策措施中规定对本地企业给予差异化补助',
            content: `经查，某县住建局在政策措施中规定对本地注册企业给予补助，对外地企业不予补助，实施差异化补助政策。

处理结果：该县住建局已废止相关文件。`,
            violationType: '影响生产经营成本',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '海西州某县住建局',
            violationClause: `《公平竞争审查条例》
第十条 起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：
（二）给予特定经营者选择性、差异化的财政奖励或者补贴。`,
            violationDetail: '对本地注册企业给予补助，对外地企业不予补助，给予特定经营者选择性、差异化的财政补助。',
        },
        {
            title: '海西州某县工信局在政策措施中规定将企业迁入本地作为享受补贴的必要条件',
            content: `经查，某县工信局在政策措施中规定企业需将注册地迁入本县才能享受相关补贴，将企业迁入本地作为享受补贴的必要条件。

处理结果：该县工信局已修订相关政策措施。`,
            violationType: '影响生产经营成本',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '海西州某县工信局',
            violationClause: `《公平竞争审查条例》
第十条 起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：
（二）给予特定经营者选择性、差异化的财政奖励或者补贴。`,
            violationDetail: '规定企业需将注册地迁入本县才能享受相关补贴，将企业迁入本地作为享受补贴的必要条件。',
        },
        {
            title: '海西州某县科技局在政策措施中规定对本地企业和外地企业实施差异化补助',
            content: `经查，某县科技局在政策措施中规定对本地注册企业按5%补助，对外地注册企业按1%补助，对符合同一条件的本地和外地企业实施差异化补助。

处理结果：该县科技局已废止相关文件。`,
            violationType: '影响生产经营成本',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '海西州某县科技局',
            violationClause: `《公平竞争审查条例》
第十条 起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：
（二）给予特定经营者选择性、差异化的财政奖励或者补贴。`,
            violationDetail: '对本地注册企业按5%补助，对外地注册企业按1%补助，对符合同一条件的本地和外地企业实施差异化补助。',
        },
        {
            title: '海西州某县农牧局在政策措施中规定对特定经营者给予用地优惠',
            content: `经查，某县农牧局在政策措施中规定对省级、市县级农业产业化龙头企业建设用地优先安排、优先审批，给予特定经营者要素获取方面的优惠。

处理结果：该县农牧局已废止相关文件。`,
            violationType: '影响生产经营成本',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '海西州某县农牧局',
            violationClause: `《公平竞争审查条例》
第十条 起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：
（三）给予特定经营者要素获取、行政事业性收费、政府性基金、社会保险费等方面的优惠。`,
            violationDetail: '对省级、市县级农业产业化龙头企业建设用地优先安排、优先审批，给予特定经营者要素获取方面的优惠。',
        },
        {
            title: '海西州某县商务局在政策措施中规定将落户本地作为享受奖励的必要条件',
            content: `经查，某县商务局在政策措施中规定企业需落户本县才能享受相关奖励，将落户本地作为享受奖励的必要条件。

处理结果：该县商务局已修订相关政策措施。`,
            violationType: '影响生产经营成本',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '海西州某县商务局',
            violationClause: `《公平竞争审查条例》
第十条 起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：
（二）给予特定经营者选择性、差异化的财政奖励或者补贴。`,
            violationDetail: '规定企业需落户本县才能享受相关奖励，将落户本地作为享受奖励的必要条件，给予特定经营者选择性、差异化的财政奖励。',
        },
    ];

    let count = 0;
    for (const caseData of cases) {
        await prisma.case.create({
            data: {
                ...caseData,
                province: '青海省',
                publishDate: reportData.publishDate,
                legalScope: '公平竞争审查',
                reportId: report.id
            }
        });
        console.log(`✅ 已添加案例 ${count + 1}:`, caseData.title);
        count++;
    }

    console.log(`\n处理完成，共添加 ${count} 个案例到 Report ID ${report.id}。`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
