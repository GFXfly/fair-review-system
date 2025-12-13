
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
            documentName: '《武义县建筑垃圾运输服务企业管理实施办法》（武交〔2020〕67号）、《武义县建筑垃圾运输服务企业准入报名公告》'
        },
        {
            title: '浙江省市场监管局纠正丽水生态产业集聚区（丽水经济技术开发区）管理委员会滥用行政权力排除、限制竞争行为',
            documentName: '《丽水经济技术开发区工程渣土、建筑垃圾、混凝土、砂石料运输管理实施方案（试行）》（丽经开〔2021〕39号）'
        },
        {
            title: '陕西省市场监管局纠正安康市汉阴县人民政府滥用行政权力排除、限制竞争行为',
            documentName: '《汉阴县2022年工业稳增长十条措施》（汉政办发〔2022〕44号）'
        },
        {
            title: '江西省市场监管局纠正吉安市城市管理局滥用行政权力排除、限制竞争行为',
            documentName: '《吉安市中心城区有桩人力和助力共享单车系统建设及运营项目合同书》'
        },
        {
            title: '黑龙江省市场监管局纠正牡丹江市城市管理综合执法局滥用行政权力排除、限制竞争行为',
            documentName: '《共享单车规范停放管理协议》'
        },
        {
            title: '福建省市场监管局纠正厦门市翔安区建设与交通局滥用行政权力排除、限制竞争行为',
            documentName: '《关于印发翔安区必须招标限额以下工程项目招投标管理办法的通知》（厦翔建〔2019〕45号）'
        },
        {
            title: '四川省市场监管局依法调查处理凉山彝族自治州金阳县自然资源局滥用行政权力排除、限制竞争行为',
            documentName: '“问政四川”平台公开回复（关于办理准运证的要求）'
        },
        {
            title: '黑龙江省市场监管局纠正佳木斯市城市管理综合执法局滥用行政权力排除、限制竞争行为',
            documentName: '《佳木斯市城区共享单车运营服务项目合同》'
        },
        {
            title: '西藏自治区市场监管局纠正林芝市巴宜区人民政府滥用行政权力排除、限制竞争行为',
            documentName: '《林芝市巴宜区经营商品混凝土管理（暂行）办法》、《林芝市巴宜商品混凝土经营权出让合同》'
        },
        {
            title: '贵州省市场监管局纠正遵义市综合行政执法局滥用行政权力排除、限制竞争行为',
            documentName: '《关于做好中心城区液化石油气规范管理和经营活动的通知》、《关于对中心城区各液化气经营网点进行整合相关问题进行明确的通知》'
        },
        {
            title: '贵州省市场监管局纠正遵义市正安县综合行政执法局滥用行政权力排除、限制竞争行为',
            documentName: '《关于进一步落实城镇燃气安全生产企业主体责任制的通知》、《关于成立“正安瓶装燃气配送中心”的批复》'
        },
        {
            title: '辽宁省市场监管局纠正葫芦岛市自然资源局滥用行政权力排除、限制竞争行为',
            documentName: '《葫芦岛市“多测合一”测绘中介服务机构名录库管理规定（试行）》（葫自然资〔2020〕121号）、《葫芦岛市“多测合一”测绘中介服务机构名录库管理暂行规定》（葫自然资办〔2021〕72号）'
        },
        {
            title: '江苏省市场监管局纠正常州市住房和城乡建设局滥用行政权力排除、限制竞争行为',
            documentName: '《关于在我市建筑施工安全生产责任保险的通知》（常住建〔2020〕78号）'
        },
        {
            title: '辽宁省市场监管局纠正沈阳市自然资源局滥用行政权力排除、限制竞争行为',
            documentName: '《关于发布沈阳市“多测合一”名录库的通知》（沈自然资发〔2020〕31号）、《沈阳市工程建设项目“多测合一”改革工作实施方案》（沈自然资发〔2020〕143号）'
        },
        {
            title: '辽宁省市场监管局纠正大连市自然资源局滥用行政权力排除、限制竞争行为',
            documentName: '《关于建立大连市“多测合一”中介服务机构名录的通知》（大规发〔2018〕55号）、《关于推进“多测合一”相关工作的通知》（大自然资便笺〔2021〕175号）'
        }
    ];

    for (const update of updates) {
        await prisma.case.updateMany({
            where: {
                title: update.title,
                reportId: report.id
            },
            data: {
                documentName: update.documentName
            }
        });
        console.log(`Updated documentName for: ${update.title}`);
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
