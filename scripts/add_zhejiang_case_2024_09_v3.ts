import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('开始更新浙江省宁波市镇海区案例数据（补全违反条款详情）...');

    // 1. 获取通报
    const reportData = {
        title: '浙江省市场监管局纠正宁波市镇海区住房和建设交通局滥用行政权力排除、限制竞争行为',
    };

    let report = await prisma.report.findFirst({
        where: { title: reportData.title }
    });

    if (!report) {
        console.error("未找到对应通报，请先运行上一步脚本。");
        return;
    }

    // 2. 更新案例数据
    const caseContent = `2023年9月27日，浙江省市场监管局依法对宁波市镇海区住房和建设交通局涉嫌滥用行政权力排除、限制竞争行为立案调查。

经查，2021年7月21日，当事人与当地某国有企业签订《战略合作框架协议》，约定当事人及局属单位(含政府性公司)牵头实施的项目中所涉绿化迁移工程，全权委托该公司管理的园林绿化养护中心进行施工，合作期限为期三年。2023年2月20日，当事人下发《关于印发<局工程建设项目采购管理办法（修订）>的通知》（镇建交〔2023〕10号），明确“属于自主采购的工程以及与工程建设有关的货物和服务项目，有下列情形之一的，经局工程建设领导小组讨论，审议通过的可以直接发包：（十）区直机关、事业单位或区属国有企业与我局签订战略合作协议的”。截至2023年9月，当事人及局属单位(含政府性公司)累计将8个工程项目按照框架协议约定，直接发包给该公司，合同金额共计1730769元。

浙江省市场监管局认为，当事人在没有法律法规和国家政策依据情况下，通过与特定经营主体签订《战略合作框架协议》，指定特定经营者实施相关绿化迁移工程项目，排除、限制了其他经营主体参与相关市场竞争，违反了《中华人民共和国反垄断法》第四十条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，通过与经营者签订合作协议、备忘录等方式，妨碍其他经营者进入相关市场或者对其他经营者实行不平等待遇，排除、限制竞争”的规定，构成滥用行政权力排除、限制竞争行为。

调查期间,当事人积极整改，主动与该公司终止合作协议，废止有关政策措施，在政府网站进行公布，并向浙江省市场监管局提交了整改报告,全面落实公平竞争审查制度，防止出现排除、限制竞争的情况。`;

    const caseData = {
        title: '宁波市镇海区住房和建设交通局滥用行政权力排除、限制竞争行为',
        // 补全违反条款的具体内容，包含引用
        violationClause: '《中华人民共和国反垄断法》第四十条 “行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，通过与经营者签订合作协议、备忘录等方式，妨碍其他经营者进入相关市场或者对其他经营者实行不平等待遇，排除、限制竞争。”',
        violationDetail: '通过与特定经营主体签订《战略合作框架协议》，指定特定经营者实施相关绿化迁移工程项目，排除、限制了其他经营主体参与相关市场竞争',
        content: caseContent
    };

    // 查找并更新
    const existingCase = await prisma.case.findFirst({
        where: {
            title: caseData.title,
            reportId: report.id
        }
    });

    if (existingCase) {
        console.log(`案例更新中...`);
        await prisma.case.update({
            where: { id: existingCase.id },
            data: caseData
        });
        console.log(`✅ 违反条款详情已补全。`);
    } else {
        console.log(`未找到案例，正在创建...`);
        await prisma.case.create({
            data: {
                ...caseData,
                reportId: report.id,
                violationType: '指定交易',
                result: '纠正/废止',
                publishDate: '2024-09-29',
                province: '浙江省',
                documentName: '《关于印发<局工程建设项目采购管理办法（修订）>的通知》',
                documentOrg: '宁波市镇海区住房和建设交通局',
                legalScope: '《中华人民共和国反垄断法》'
            }
        });
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
