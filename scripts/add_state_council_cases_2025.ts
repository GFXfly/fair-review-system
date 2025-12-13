import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('开始添加国务院“互联网+督查”平台通报的典型案例...');

    // 1. 创建通报
    const reportData = {
        title: '有企业反映一些地方存在地方保护妨碍公平竞争，核查结果来了',
        department: '国务院办公厅', // 源自国办督查室/中国政府网
        publishDate: '2025-01-05',
        province: '全国'
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

    // 2. 添加3个案例
    const cases = [
        {
            title: '江西省赣州市石城县妨碍新能源汽车充电桩投资建设平等准入案',
            content: `【违规情况】部分企业反映，江西省赣州市石城县以特许建设经营方式，确定县城投公司作为充电基础设施建设投资主体，妨碍其他经营主体平等准入。
【核查情况】国办派员赴实地会同当地有关部门核查发现，群众反映问题属实。石城县的做法违反了公平竞争原则，不当限制了市场准入。
【处理结果】经督查推动，石城县立行立改，公开发布关于鼓励社会资本积极参与新能源电动汽车充电基础设施建设的公告，组织召开企业恳谈会，介绍备案申请工作。部分公司已向石城县行政审批局提出了充电桩项目备案申请并成功备案。`,
            violationType: '限制市场准入和退出',
            result: '已整改',
            documentName: '相关特许经营文件/政策',
            documentOrg: '江西省赣州市石城县政府',
            violationClause: `《公平竞争审查条例》
第八条 起草单位起草的政策措施，不得含有下列限制或者变相限制市场准入和退出的内容：
（二）违法设置或者授予特许经营权。`,
            violationDetail: '以特许建设经营方式确定县城投公司作为唯一投资主体，妨碍其他经营主体平等准入。',
            province: '江西省'
        },
        {
            title: '湖北省5个市违规设置市场准入门槛限制保险公司开展业务案',
            content: `【违规情况】部分保险公司反映，仅因公司未在黄冈市设立分支机构，便无法开展农民工工资保证金业务。
【核查情况】国办派员赴实地核查发现，湖北省黄石、襄阳、荆州、黄冈、仙桃等5个市出台的农民工工资保证金管理文件均要求经办机构须在本地设立分支机构，不符合《中共中央 国务院关于加快建设全国统一大市场的意见》精神。
【处理结果】经协调推动，湖北省人力资源社会保障厅指导5个市取消了文件中关于设立分支机构的规定。`,
            violationType: '限制商品要素自由流动',
            result: '已整改',
            documentName: '农民工工资保证金管理相关文件',
            documentOrg: '湖北省黄石、襄阳、荆州、黄冈、仙桃市政府/人社部门',
            violationClause: `《公平竞争审查条例》
第九条 起草单位起草的政策措施，不得含有下列限制商品、要素自由流动的内容：
（二）排斥、限制、强制或者变相强制外地经营者在本地投资经营或者设立分支机构。`,
            violationDetail: '要求经办机构须在本地设立分支机构，否则无法开展业务。',
            province: '湖北省'
        },
        {
            title: '广东省中山市坦洲镇限制企业自主迁移及指定交易案',
            content: `【违规情况】部分企业反映，中山市坦洲镇同胜社区部分招投标项目指定交易对象，涉嫌违反公平竞争原则；坦洲镇政府限制企业自主迁移。
【核查情况】国办派员赴实地会同当地有关方面核查发现，该社区2024年6月招采的清淤项目等未按照规定对招标文件进行公平竞争审查。深入调研发现，坦洲镇政府在制定本地上市公司专项资金工作方案中规定了限制企业自主迁移的政策措施。
【处理结果】经督查推动，同胜社区立即对相关招投标项目补做公平竞争审查，坦洲镇有关部门立即废止相关文件。`,
            violationType: '限制商品要素自由流动',
            result: '已整改',
            documentName: '本地上市公司专项资金工作方案/招投标相关文件',
            documentOrg: '广东省中山市坦洲镇政府',
            violationClause: `《公平竞争审查条例》
第九条 起草单位起草的政策措施，不得含有下列限制商品、要素自由流动的内容：
（一）限制外地或者进口商品、要素进入本地市场，或者阻碍本地经营者迁出，商品、要素输出。
第八条 ...（三）限定经营、购买或者使用特定经营者提供的商品或者服务。`,
            violationDetail: '在制定本地上市公司专项资金工作方案中规定限制企业自主迁移的政策措施；招投标项目指定交易对象。',
            province: '广东省'
        },
    ];

    let count = 0;
    for (const caseData of cases) {
        await prisma.case.create({
            data: {
                ...caseData,
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
