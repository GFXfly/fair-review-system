import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const reportData = {
    title: "北京市市场监督管理局关于2022年公平竞争审查抽查存在问题文件的通报",
    department: "北京市市场监督管理局",
    publishDate: "2023-12-13",
    province: "北京市"
};

const cases = [
    {
        title: "某单位出台《关于下达2020年第二批高精尖产业发展资金计划的通知》对企业自主迁移设置障碍",
        content: "某单位2021年出台《关于下达2020年第二批高精尖产业发展资金计划的通知》，规定“按照财政资金绩效评价的有关要求，发现问题及时上报，积极协调解决，同时做好跟踪，服务企业立足北京长期稳定发展，监督经营主体5年内不迁出北京”，对企业自主迁移设置障碍。",
        violationType: "影响市场准入和退出",
        result: "已整改",
        documentName: "《关于下达2020年第二批高精尖产业发展资金计划的通知》",
        documentOrg: "某单位",
        violationClause: "《实施细则》第十三条第（一）项",
        violationDetail: "监督经营主体5年内不迁出北京，对企业自主迁移设置障碍"
    },
    {
        title: "某单位出台《北京市人工智能算力布局方案（2021-2023年）》实施不合理的差别化待遇及限制特定企业参与",
        content: "某单位2021年出台《关于印发<北京市人工智能算力布局方案（2021-2023年）>的通知》，规定“本市公共算力中心应符合多元化建设和运营要求，并实施准入和退出监管。准入条件包括......优先国产、......经济贡献等方面”，优先国产和有经济贡献的企业准入；同时规定“加大政策支持......公共算力中心建设原则上采用PPP模式，由各区按照相关政策组织实施，建设或参建单位应为在京落地的行业骨干企事业单位”。",
        violationType: "影响市场准入和退出",
        result: "已整改",
        documentName: "《北京市人工智能算力布局方案（2021-2023年）》",
        documentOrg: "某单位",
        violationClause: "《实施细则》第十三条第（一）项、第（三）项",
        violationDetail: "设置优先国产、经济贡献等准入条件；限定建设或参建单位应为在京落地的行业骨干企事业单位"
    },
    {
        title: "某单位出台《北京市高精尖产业发展资金管理办法》给予特定经营者财政奖励和补贴",
        content: "某单位2021年联合有关部门出台《关于印发<北京市高精尖产业发展资金管理办法>的通知》，规定“固定资产投资类项目实行项目库管理，根据实施指南优先从北京市高精尖产业项目库中遴选项目，项目承担单位应及时将项目信息入库”，优先遴选北京市高精尖产业参与固定资产投资类项目。",
        violationType: "影响生产经营成本",
        result: "已整改",
        documentName: "《北京市高精尖产业发展资金管理办法》",
        documentOrg: "某单位",
        violationClause: "《实施细则》第十五条第（一）项",
        violationDetail: "在没有相关依据的情况下给予特定经营者财政奖励和补贴"
    },
    {
        title: "某单位出台《金融支持北京市制造业转型升级的指导意见》支持特定企业开展供应链金融业务",
        content: "某单位会同3部门2021年出台《关于印发<金融支持北京市制造业转型升级的指导意见>的通知》，规定“发展供应链金融。……支持信用良好、产业链成熟的制造业龙头企业开展供应链金融业务”，为特定的制造业企业提供优惠政策。",
        violationType: "影响生产经营成本",
        result: "已整改",
        documentName: "《金融支持北京市制造业转型升级的指导意见》",
        documentOrg: "某单位会同3部门",
        violationClause: "《实施细则》第十五条第（一）项",
        violationDetail: "为特定的制造业企业提供优惠政策"
    },
    {
        title: "某区出台文件将某公司作为区级项目管理公司，限定使用特定经营者提供的服务",
        content: "某区2021年出台《某区人民政府办公室关于印发本区2021年改善农村人居环境推进美丽乡村建设工作方案的通知》，规定“发挥专业公司的力量，将某公司作为区级项目管理公司，由其对美丽乡村建设进行全过程管理，所需项目管理费由区财政局评审确定”，限定使用某公司提供的服务。",
        violationType: "影响生产经营行为",
        result: "已整改",
        documentName: "《本区2021年改善农村人居环境推进美丽乡村建设工作方案的通知》",
        documentOrg: "某区人民政府办公室",
        violationClause: "《实施细则》第十三条第（三）项",
        violationDetail: "限定使用某公司提供的服务"
    },
    {
        title: "某区政府出台意见设置经营性机构红黑名单制度，排斥外地经营者",
        content: "某区政府2021年出台《关于某区促进人力资源市场发展的意见》，规定“建立经营性机构红黑名单制度。根据经营性机构等级评定、诚信状况、社会影响等，建立红黑名单制度，每年定期公布。对于列入红名单的经营性机构，在政府购买人力资源服务、社会保险办理、劳动关系处理、就业政策扶持、人事人才服务等方面给予优先考虑”，对红黑名单上的经营性机构予以区别对待。",
        violationType: "影响市场准入和退出",
        result: "已整改",
        documentName: "《关于某区促进人力资源市场发展的意见》",
        documentOrg: "某区政府",
        violationClause: "《实施细则》第十四条第（三）项",
        violationDetail: "对列入红名单的经营性机构给予优先考虑，排斥或者限制外地经营者"
    },
    {
        title: "某区出台办法限定使用区属公司提供的绿化造林服务",
        content: "某区2021年出台《关于印发<某区拆除腾退地块复绿管理办法>的通知》，规定“规划性质为城镇建设用地、村庄建设用地、战略留白用地、有条件建设区，且近年内无实施计划的拆除腾退地块，原则上纳入“战略留白”临时绿化建设任务，由区园林绿化局组织属地镇（街道）或区属公司进行临时绿化造林”，限定使用区属公司提供的服务。",
        violationType: "影响生产经营行为",
        result: "已整改",
        documentName: "《某区拆除腾退地块复绿管理办法》",
        documentOrg: "某区",
        violationClause: "《实施细则》第十三条第（三）项",
        violationDetail: "限定使用区属公司提供的服务"
    },
    {
        title: "某区出台办法将财政支出与税收挂钩，并限制企业迁出",
        content: "某区2021年出台《某区人民政府办公室关于印发<中国（北京）自贸试验区科技创新片区某组团支持医药健康产业发展暂行办法>的通知》，规定“对于区内尚不具备生产条件的药品和医疗器械企业，通过上市许可持有人制度委托生产的，按照该企业年度区级贡献增量部分的20%给予奖励”；同时规定“获得本办法资金支持的企业需承诺自获得支持起未来8年内注册及办公地址不迁离本区...若违反相关承诺，企业应退回本办法对其支持的全部资金”。",
        violationType: "影响生产经营成本",
        result: "已整改",
        documentName: "《中国（北京）自贸试验区科技创新片区某组团支持医药健康产业发展暂行办法》",
        documentOrg: "某区人民政府办公室",
        violationClause: "《实施细则》第十五条第（二）项、第十三条第（一）项",
        violationDetail: "将财政支出与税收挂钩；对企业自主迁移设置障碍"
    },
    {
        title: "某区出台办法将资金支持与区域综合贡献挂钩，并限制企业迁出",
        content: "某区2021年出台《某区人民政府关于印发<某区支持企业发展办法（试行）>的通知》，规定“同一企业在同一年度内享受多项资金支持的，支持总额原则上不超过其当年区域综合贡献的60%”；同时规定“享受支持资金的企业，自最后一次兑现之日起，如五年内迁出我区，应退还在我区所享受的全部支持资金”。",
        violationType: "影响生产经营成本",
        result: "已整改",
        documentName: "《某区支持企业发展办法（试行）》",
        documentOrg: "某区人民政府",
        violationClause: "《实施细则》第十五条第（二）项、第十三条第（一）项",
        violationDetail: "资金支持与区域综合贡献挂钩；对企业自主迁移设置障碍"
    }
];

async function main() {
    console.log('开始处理北京市2022年公平竞争审查抽查问题案例...');

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

        // 清理该Report下的旧案例
        console.log('清理该通报下的旧案例...');
        await prisma.case.deleteMany({
            where: { reportId: report.id }
        });
    }

    // 2. 添加案例并关联 Report
    let count = 0;
    for (const data of cases) {
        await prisma.case.create({
            data: {
                title: data.title,
                content: data.content,
                province: reportData.province,
                publishDate: reportData.publishDate,
                violationType: data.violationType,
                result: data.result,

                // 详细字段
                documentName: data.documentName,
                documentOrg: data.documentOrg,
                violationClause: data.violationClause,
                violationDetail: data.violationDetail,

                // 关联 Report
                reportId: report.id
            }
        });
        console.log(`已添加并关联: ${data.title}`);
        count++;
    }

    console.log(`\n处理完成，共处理 ${count} 个案例到 Report ID ${report.id}。`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
