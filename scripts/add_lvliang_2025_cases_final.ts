import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. 创建或者查找通报记录
    // Check if report exists first to avoid duplicates if run multiple times
    let report = await prisma.report.findFirst({
        where: { title: '对三起违反公平竞争审查典型案例的分析' }
    });

    if (!report) {
        report = await prisma.report.create({
            data: {
                title: '对三起违反公平竞争审查典型案例的分析',
                department: '吕梁市市场监督管理局',
                publishDate: '2025-12-08',
                province: '山西省'
            }
        });
        console.log(`创建通报记录，ID: ${report.id}`);
    } else {
        console.log(`找到已有通报记录，ID: ${report.id}`);
        // Ensure date is correct
        if (report.publishDate !== '2025-12-08') {
            await prisma.report.update({
                where: { id: report.id },
                data: { publishDate: '2025-12-08' }
            });
            console.log('更新通报日期为 2025-12-08');
        }
    }

    // 2. 添加3个案例
    const cases = [
        {
            title: '汾阳市人民政府对参加本市“晋放活力汾享杏福”消费促进活动的商家以依法在本市登记注册、具有独立法人资格并达到一定规模的销售实体单位作为报名参与资格',
            content: '《汾阳市人民政府办公室关于印发汾阳市“晋放活力汾享杏福”消费促进活动工作方案的通知》（汾政办发[2024]14号）中：“（三）报名条件—1.依法在本市登记注册、具有独立法人资格并达到一定规模的销售实体单位”作为参加该项活动的报名条件。该条款违反了《公平竞争审查条例实施办法》第十二条起草涉及经营者经济活动的政策措施，不得含有下列设置不合理或者歧视性的准入、退出条件的内容：（二）根据经营者所有制形式、注册地、组织形式、规模等设置歧视性的市场准入、退出条件的审查标准。',
            violationType: '设置不合理或者歧视性的准入条件',
            result: '2025年5月15日，汾阳市人民政府在政府网站公示废止该政策文件。通过对该方案的废止，汾阳市人民政府公平竞争意识显著提升，加大对类似政策文件的梳理排查，同时进一步规范公平竞争审查流程、细化公平竞争审查标准，有效维护了公平竞争的市场秩序。',
            violationClause: '《公平竞争审查条例实施办法》第十二条',
            documentName: '汾阳市“晋放活力汾享杏福”消费促进活动工作方案',
            documentOrg: '汾阳市人民政府办公室',
            province: '山西省吕梁市汾阳市',
            violationDetail: '将活动报名条件限定为“在本市登记注册、具有独立法人资格”，排除了未在本地注册或不具备独立法人资格的分工司、合伙企业、个人独资企业等。',
            reportId: report.id,
            publishDate: '2025-12-08'
        },
        {
            title: '中阳县人民政府对链主企业这种不合理入选条件的名录库实施进档奖励的财政补贴',
            content: '中阳县人民政府关于印发《中阳县重点产业链及产业链链长工作机制实施方案》的通知（中政办发〔2022〕55号）中：（一）实施产业链企业培育壮大行动。开展骨干龙头“链主”企业领航计划，支持“链主”企业强创新、优品牌、促转型，加快进行数字化、智能化、绿色化改造，加速成长为掌握全产业链和关键核心技术的产业生态主导型企业。充分发挥技术改造、数字经济发展等专项资金引领示范作用，加大对“链主”企业进档奖励，“真金白银”支持“链主”企业不断壮大，増强产业链整体稳定性、安全性、竞争力。开展“专精特新”中小企业培育计划，支持产业链上下企业技术创新、管理提升、市场开拓，推动更多中小企业掌握“独门绝技”。\n\n该条款违反了《公平竞争审查条例实施办法》第十九条起草涉及经营者经济活动的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列给予特定经营者选择性、差异化的财政奖励或者补贴的内容：（一）以直接确定受益经营者或者设置不明确、不合理入选条件的名录库、企业库等方式，实施财政奖励或者补贴的影响生产经营成本的审查标准。',
            violationType: '给予特定经营者选择性、差异化的财政奖励或者补贴',
            result: '2025年6月11日，中阳县人民政府在政府网站公示进行修改该政策文件。通过对该方案的修改，中阳县人民政府公平竞争意识显著提升，加大对类似政策文件的梳理排查，同时进一步规范公平竞争审查流程、细化公平竞争审查标准，有效维护了公平竞争的市场秩序。',
            violationClause: '《公平竞争审查条例实施办法》第十九条',
            documentName: '中阳县重点产业链及产业链链长工作机制实施方案',
            documentOrg: '中阳县人民政府',
            province: '山西省吕梁市中阳县',
            violationDetail: '主推链主企业做优做强，加强链主企业的市场地位，“真金白银”支持链主企业不断壮大，对非链主企业而言无法享受相关支持，进一步加大链主与非链主企业的发展差距，具有影响生产经营成本的效果。',
            reportId: report.id,
            publishDate: '2025-12-08'
        },
        {
            title: '吕梁市规划和自然资源局要求的“多测合一”测绘服务机构要求在吕梁市有注册登记的办事机构',
            content: '吕梁市规划和自然资源局关于印发《吕梁市工程建设项目“多测合一”管理暂行办法》的通知（吕自然资发〔2023〕82号）中第十条 具备以下条件的测绘服务机构即可完成注册登记，并纳入吕梁市“多测合一”测绘服务机构名录库(以下简称名录库):(一)具有独立法人资格的测绘机构且在本市有市场监督管理部门注册登记的常设办事机构。\n\n该条款违反了《公平竞争审查条例实施办法》第十四条起草涉及经营者经济活动的政策措施，不得含有下列排斥、限制、强制或者变相强制外地经营者在本地投资经营或者设立分支机构的内容：（四）其他排斥、限制、强制或者变相强制外地经营者在本地投资经营或者设立分支机构的内容的审查标准。',
            violationType: '排斥、限制、强制外地经营者在本地投资经营',
            result: '吕梁市规划和自然资源局针对该文件存在问题，重新起草印发了吕梁市规划和自然资源局 吕梁市住房和城乡建设局 吕梁市行政审批服务管理局 吕梁市人民政府国防动员办公室关于印发《吕梁市工程建设项目“多测合一”管理办法》的通知，该管理办法中明确吕自然资发〔2023〕82号文件自行废止。通过对该方案的废止，吕梁市规划和自然资源局公平竞争意识显著提升，加大对类似政策文件的梳理排查，同时进一步规范公平竞争审查流程、细化公平竞争审查标准，有效维护了公平竞争的市场秩序。',
            violationClause: '《公平竞争审查条例实施办法》第十四条',
            documentName: '吕梁市工程建设项目“多测合一”管理暂行办法',
            documentOrg: '吕梁市规划和自然资源局',
            province: '山西省吕梁市',
            violationDetail: '该条款规定纳入吕梁市“多测合一”测绘服务机构名录库的测绘机构需要在吕梁市有注册登记的办事机构，变相强制外地经营者在本地设置分支机构。',
            reportId: report.id,
            publishDate: '2025-12-08'
        }
    ];

    // 批量创建案例 (check for duplicates based on title)
    for (const c of cases) {
        const existing = await prisma.case.findFirst({
            where: { title: c.title }
        });

        if (!existing) {
            const newCase = await prisma.case.create({ data: c });
            console.log(`✓ 添加案例: ${newCase.title.substring(0, 30)}...`);
        } else {
            console.log(`! 案例已存在: ${c.title.substring(0, 30)}... (Skip)`);
            // Optional: update if needed
            await prisma.case.update({
                where: { id: existing.id },
                data: { publishDate: '2025-12-08' }
            });
        }
    }

    console.log(`\n✅ 吕梁案例同步完成`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
