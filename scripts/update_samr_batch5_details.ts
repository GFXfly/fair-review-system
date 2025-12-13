
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reportTitle = '2022年制止滥用行政权力排除、限制竞争执法专项行动案件（第五批）';

    const report = await prisma.report.findFirst({
        where: { title: reportTitle }
    });

    if (!report) {
        console.log('Report not found');
        return;
    }

    const updates = [
        {
            title: '浙江省市场监管局纠正金华市武义县交通运输局滥用行政权力排除、限制竞争行为',
            violationDetail: '规定建筑垃圾运输企业必须在本地注册，排除外地企业竞争。'
        },
        {
            title: '浙江省市场监管局纠正丽水生态产业集聚区（丽水经济技术开发区）管理委员会滥用行政权力排除、限制竞争行为',
            violationDetail: '要求运输企业在开发区注册公司，车辆必须悬挂本地号牌。'
        },
        {
            title: '陕西省市场监管局纠正安康市汉阴县人民政府滥用行政权力排除、限制竞争行为',
            violationDetail: '规定政府投资项目在同质同价条件下优先使用本地产品。'
        },
        {
            title: '江西省市场监管局纠正吉安市城市管理局滥用行政权力排除、限制竞争行为',
            violationDetail: '确定一家公司为共享单车独家经营企业，排除其他市场主体。'
        },
        {
            title: '黑龙江省市场监管局纠正牡丹江市城市管理综合执法局滥用行政权力排除、限制竞争行为',
            violationDetail: '与企业签订排他协议，约定只由该企业提供共享单车服务。'
        },
        {
            title: '福建省市场监管局纠正厦门市翔安区建设与交通局滥用行政权力排除、限制竞争行为',
            violationDetail: '规定同等条件下优先选择本区企业，设定须在本地注册等歧视性资质条件。'
        },
        {
            title: '四川省市场监管局依法调查处理凉山彝族自治州金阳县自然资源局滥用行政权力排除、限制竞争行为',
            violationDetail: '违规要求外地砂石企业到运入地办理准运证，限制外地商品进入。'
        },
        {
            title: '黑龙江省市场监管局纠正佳木斯市城市管理综合执法局滥用行政权力排除、限制竞争行为',
            violationDetail: '通过竞争性磋商确定一家中标企业独家经营共享单车服务。'
        },
        {
            title: '西藏自治区市场监管局纠正林芝市巴宜区人民政府滥用行政权力排除、限制竞争行为',
            violationDetail: '规定未在本地注册的企业不具有商品混凝土经营权竞买资格。'
        },
        {
            title: '贵州省市场监管局纠正遵义市综合行政执法局滥用行政权力排除、限制竞争行为',
            violationDetail: '强制整合燃气经营网点，指定特定公司统一进行钢瓶检测。'
        },
        {
            title: '贵州省市场监管局纠正遵义市正安县综合行政执法局滥用行政权力排除、限制竞争行为',
            violationDetail: '强制全县燃气经营网点必须挂靠特定公司经营。'
        },
        {
            title: '辽宁省市场监管局纠正葫芦岛市自然资源局滥用行政权力排除、限制竞争行为',
            violationDetail: '违规设置“多测合一”测绘中介服务机构名录库，限定建设单位从中选择。'
        },
        {
            title: '江苏省市场监管局纠正常州市住房和城乡建设局滥用行政权力排除、限制竞争行为',
            violationDetail: '限定新开工建筑施工企业必须向指定的共保体投保安全生产责任险。'
        },
        {
            title: '辽宁省市场监管局纠正沈阳市自然资源局滥用行政权力排除、限制竞争行为',
            violationDetail: '设置测绘机构名录库，限定建设单位只能在名录库中选择测绘单位。'
        },
        {
            title: '辽宁省市场监管局纠正大连市自然资源局滥用行政权力排除、限制竞争行为',
            violationDetail: '建立中介服务机构名录，强制建设单位从中选定测绘单位。'
        }
    ];

    for (const update of updates) {
        await prisma.case.updateMany({
            where: {
                title: update.title,
                reportId: report.id
            },
            data: {
                violationDetail: update.violationDetail
            }
        });
        console.log(`Updated details for: ${update.title}`);
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
