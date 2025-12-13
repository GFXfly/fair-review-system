import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('开始添加益阳市公平竞争审查典型案例（二）...');

    // 1. 创建通报
    const reportData = {
        title: '益阳市公平竞争审查典型案例（二）',
        department: '益阳市市场监督管理局',
        publishDate: '2025-12-09', // 根据图片顶部的日期
        province: '湖南省'
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

    // 2. 添加案例
    const cases = [
        {
            title: '某市场监督管理局在政策措施中规定要求市内企业采购本地产品，变相设置市场准入壁垒',
            content: `某市场监督管理局在政策措施中规定，要求市内企业在采购时优先采购本地产品，对采购外地产品的企业不予支持或减少支持力度。该规定变相设置了市场准入壁垒，限制了外地商品进入本地市场，违反了公平竞争审查标准。

处理结果：该市场监督管理局已废止相关文件。`,
            violationType: '限制商品要素自由流动',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '某市场监督管理局',
            violationClause: `《公平竞争审查条例》
第九条 起草单位起草的政策措施，不得含有下列限制商品、要素自由流动的内容：
（一）限制外地或者进口商品、要素进入本地市场，或者阻碍本地经营者迁出，商品、要素输出。`,
            violationDetail: '要求市内企业优先采购本地产品，对采购外地产品的企业不予支持或减少支持力度，变相设置市场准入壁垒，限制外地商品进入本地市场。',
        },
        {
            title: '某县人民政府在政策措施中规定对本地企业给予财政补贴，对外地企业不予补贴',
            content: `某县人民政府在政策措施中规定，对在本县注册的企业给予财政补贴，对外地企业不予补贴。该规定给予特定经营者选择性、差异化的财政补贴，影响经营主体公平竞争。

处理结果：该县人民政府已修订相关政策措施。`,
            violationType: '影响生产经营成本',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '某县人民政府',
            violationClause: `《公平竞争审查条例》
第十条 起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：
（二）给予特定经营者选择性、差异化的财政奖励或者补贴。`,
            violationDetail: '对在本县注册的企业给予财政补贴，对外地企业不予补贴，给予特定经营者选择性、差异化的财政补贴。',
        },
        {
            title: '某区发展和改革局在政策措施中规定将企业注册地迁入本地作为享受优惠政策的前置条件',
            content: `某区发展和改革局在政策措施中规定，企业需将注册地迁入本区才能享受相关优惠政策。该规定将企业迁入本地作为享受优惠政策的前置条件，给予特定经营者选择性、差异化的财政奖励。

处理结果：该区发展和改革局已废止相关文件。`,
            violationType: '影响生产经营成本',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '某区发展和改革局',
            violationClause: `《公平竞争审查条例》
第十条 起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：
（二）给予特定经营者选择性、差异化的财政奖励或者补贴。`,
            violationDetail: '规定企业需将注册地迁入本区才能享受相关优惠政策，将企业迁入本地作为享受优惠政策的前置条件。',
        },
        {
            title: '某县住房和城乡建设局在政策措施中规定限定使用本地建材产品，排斥外地产品',
            content: `某县住房和城乡建设局在政策措施中规定，本县建设项目必须使用本地生产的建材产品，不得使用外地产品。该规定限定使用特定经营者提供的商品，排斥外地产品进入本地市场。

处理结果：该县住房和城乡建设局已修订相关政策措施。`,
            violationType: '限制市场准入和退出',
            result: '已整改',
            documentName: '相关政策文件',
            documentOrg: '某县住房和城乡建设局',
            violationClause: `《公平竞争审查条例》
第八条 起草单位起草的政策措施，不得含有下列限制或者变相限制市场准入和退出的内容：
（三）限定经营、购买或者使用特定经营者提供的商品或者服务（以下统称商品）。`,
            violationDetail: '规定本县建设项目必须使用本地生产的建材产品，不得使用外地产品，限定使用特定经营者提供的商品，排斥外地产品。',
        },
    ];

    let count = 0;
    for (const caseData of cases) {
        await prisma.case.create({
            data: {
                ...caseData,
                province: '湖南省',
                publishDate: reportData.publishDate,
                legalScope: '公平竞争审查',
                reportId: report.id
            }
        });
        console.log(`✅ 已添加案例 ${count + 1}:`, caseData.title.substring(0, 50));
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
