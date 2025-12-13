
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. 南阳市公平竞争审查典型案例（二）
    const nanyangReport2Data = {
        title: '南阳市公平竞争审查工作典型案例（二）',
        publishDate: '2023-04-15',
        department: '南阳市市场监督管理局',
        province: '河南省'
    };

    let nanyangReport2 = await prisma.report.findFirst({ where: { title: nanyangReport2Data.title } });
    if (!nanyangReport2) {
        nanyangReport2 = await prisma.report.create({ data: nanyangReport2Data });
        console.log(`Created Report: ${nanyangReport2.title}`);
    }

    const nanyangCase1 = {
        title: '南阳市人民政府关于加快培育壮大建筑业的实施意见（存在税收留成大额奖励情形）',
        content: `《南阳市人民政府关于加快培育壮大建筑业的实施意见》（宛政〔2018〕11号）存在税收留成部分奖励情形。
【基本情况】“本地建筑业类企业在外地施工回本地缴纳所得税的,注册地政府给予所得税地方留成部分20%的奖励。”
【定性分析】存在涉嫌违反《公平竞争审查实施细则》第十五条 影响生产经营成本标准“2.安排财政支出一般不得与特定经营者缴纳的税收或非税收入挂钩。”
【建议】删除该补贴条款或者考虑其他方式的奖补措施。`,
        violationType: '税收奖励/与税收挂钩',
        violationClause: '《公平竞争审查制度实施细则》第十五条（安排财政支出一般不得与特定经营者缴纳的税收或非税收入挂钩）',
        documentName: '《南阳市人民政府关于加快培育壮大建筑业的实施意见》（宛政〔2018〕11号）',
        documentOrg: '河南省南阳市人民政府',
        province: '河南省南阳市',
        violationDetail: '规定本地企业在外地施工回本地缴纳所得税的，给予地方留成部分20%奖励。',
        result: '删除该补贴条款。',
        publishDate: '2023-04-15',
        reportId: nanyangReport2.id
    };

    const nanyangCase2 = {
        title: '南阳市促进电子商务产业发展扶持办法（存在税收留成部分奖励情形）',
        content: `《南阳市促进电子商务产业发展扶持办法》（宛政办〔2019〕41号）存在税收留成部分奖励情形。
【基本情况】“(二)扶持成长型企业。对年纳税额达到100万元以上的电子商务企业，每增加100万元给予30万元奖励，连续奖励3年。每年奖励最高不超过100万元。(三)培育初创企业。对创办不超过两年且年纳税额10万元以上的电子商务企业，自成立或认定年度起，前3年按地方财政贡献额予以全额奖励，第4、5年按50%予以奖励。”
【定性分析】存在涉嫌违反《公平竞争审查实施细则》第十五条 影响生产经营成本标准“2.安排财政支出一般不得与特定经营者缴纳的税收或非税收入挂钩。”
【建议】删除该补贴条款或者考虑其他方式的奖补措施。`,
        violationType: '税收奖励/与税收挂钩',
        violationClause: '《公平竞争审查制度实施细则》第十五条（安排财政支出一般不得与特定经营者缴纳的税收或非税收入挂钩）',
        documentName: '《南阳市促进电子商务产业发展扶持办法》（宛政办〔2019〕41号）',
        documentOrg: '河南省南阳市人民政府',
        province: '河南省南阳市',
        violationDetail: '对电商企业按纳税额或地方财政贡献额给予奖励。',
        result: '删除该补贴条款。',
        publishDate: '2023-04-15',
        reportId: nanyangReport2.id
    };

    await prisma.case.create({ data: nanyangCase1 });
    await prisma.case.create({ data: nanyangCase2 });
    console.log(`Created 2 cases for Nanyang Report 2`);


    // 2. 南阳市公平竞争审查典型案例（一）
    const nanyangReport1Data = {
        title: '南阳市公平竞争审查工作典型案例（一）',
        publishDate: '2023-04-10',
        department: '南阳市市场监督管理局',
        province: '河南省'
    };

    let nanyangReport1 = await prisma.report.findFirst({ where: { title: nanyangReport1Data.title } });
    if (!nanyangReport1) {
        nanyangReport1 = await prisma.report.create({ data: nanyangReport1Data });
        console.log(`Created Report: ${nanyangReport1.title}`);
    }

    const nanyangCase3 = {
        title: '河南省市场监管局纠正南阳市淅川县发展和改革委员会滥用行政权力排除、限制竞争行为',
        content: `【基本案情】经查，2019年9月，当事人委托第三方公司对该县电动汽车充电基础设施特许经营权项目进行公开招标，并于2019年11月22日与中标企业签订了《淅川县电动汽车充电基础设施项目特许经营合同书》。特许经营合同书中“3.4特许经营内容和业务范围”第一款“在公共领域推广充电站建设”的相关规定属于在特许经营范围内的授权行为；第二款“在单位与居民区停车位建设充电设施”中约定“政府机关、公共机构及事业单位内部停车资源，应结合各单位电动汽车配备、更新计划，规划建设电动汽车专用停车位和充电设施，建设比例不低于15%，并由乙方（中标企业）配建”。
【定性分析】河南省市场监管局认为，上述第二款规定将该县特许经营权地域范围内专用充电设施的建设运营权授予中标企业，属于超范围授予特许经营权行为。当事人在没有法律法规依据的情况下，与中标企业签订特许经营协议将有关专用充电设施超范围授予中标企业，剥夺了建设开发单位自主选择建设企业的权力，限制了其他具有电动汽车充电设施建设施工资质企业的服务，妨碍了该县充电设施建设运营市场的公平竞争。当事人的上述行为违反了《中华人民共和国反垄断法》第三十九条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品”的规定，构成滥用行政权力排除、限制竞争行为。
【纠正情况】调查期间，当事人积极整改，消除不良影响，与中标企业签订了《关于对<淅川县电动汽车充电基础设施特许经营合同书>的补充说明》，修改原协议有关条款，调整后的特许经营范围不再包含电动汽车专用充电设施的配建。对全县电动汽车充电基础设施项目开展自查清理，督促特许经营企业依法依规履行协议，确保该县电动汽车及充电基础设施行业持续健康发展。`,
        violationType: '超范围授权特许经营/指定交易',
        violationClause: '《中华人民共和国反垄断法》第三十九条（不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品）',
        documentName: '《淅川县电动汽车充电基础设施项目特许经营合同书》',
        documentOrg: '河南省南阳市淅川县发展和改革委员会',
        province: '河南省南阳市淅川县',
        violationDetail: '在特许经营合同中将政府机关、公共机构及事业单位内部充电设施配建权独家授予中标企业，属于超范围授权。',
        result: '签订补充说明修改协议，不再包含专用充电设施配建。',
        publishDate: '2023-04-10',
        reportId: nanyangReport1.id
    };

    await prisma.case.create({ data: nanyangCase3 });
    console.log(`Created 1 case for Nanyang Report 1`);


    // 3. 内蒙古自治区发布3起违反公平竞争审查典型案例
    const innerMongoliaReportData = {
        title: '内蒙古自治区公平竞争审查工作厅际联席会议办公室发布3起违反公平竞争审查典型案例',
        publishDate: '2023-02-09',
        department: '内蒙古自治区市场监督管理局',
        province: '内蒙古自治区'
    };

    let innerMongoliaReport = await prisma.report.findFirst({ where: { title: innerMongoliaReportData.title } });
    if (!innerMongoliaReport) {
        innerMongoliaReport = await prisma.report.create({ data: innerMongoliaReportData });
        console.log(`Created Report: ${innerMongoliaReport.title}`);
    }

    const imCases = [
        {
            title: '呼和浩特市人民政府办公室关于印发网络预约出租汽车经营服务管理实施细则的通知',
            content: `【案例一】呼和浩特市人民政府办公室将从事网约车经营的非本市企业在本地投资或者设立分支机构作为经营的必要条件。
【基本案情】《呼和浩特市人民政府办公室关于印发网络预约出租汽车经营服务管理实施细则的通知》（呼政办发〔2020〕14号）规定，在呼和浩特市申请从事网约车经营的非本市市业法人，须在本市市场监管、税务注册登记分支机构，并在本市有同经营规模相适应的办公场所、运营机构、管理人员。
【定性分析】违反了《公平竞争审查制度实施细则》第十三条第一款“不得以不合理或者歧视性的准入和退出条件，包括但不限于：3.没有法律、行政法规或者国务院规定依据，以备案、登记、注册、目录、年检、年报、监制、认定、认证、认可、检验、监测、审定、指定、配号、复检、复审、换证、要求设立分支机构以及其他任何形式，设定或者变相设定市场准入障碍;”的规定。`,
            violationType: '强制设立分支机构/本地注册要求',
            violationClause: '《公平竞争审查制度实施细则》第十三条第一款（不得以不合理或者歧视性的准入和退出条件...要求设立分支机构）',
            documentName: '《呼和浩特市人民政府办公室关于印发网络预约出租汽车经营服务管理实施细则的通知》（呼政办发〔2020〕14号）',
            documentOrg: '内蒙古自治区呼和浩特市人民政府办公室',
            province: '内蒙古自治区呼和浩特市',
            violationDetail: '要求申请网约车经营的非本市企业法人必须在本地注册登记分支机构。',
            result: '进行整改或废止程序。'
        },
        {
            title: '科尔沁区规范互联网租赁自行车发展的实施意见',
            content: `【案例二】科尔沁区人民政府将设立分支机构作为进入科尔沁区互联网租赁自行车系统的必要条件。
【基本案情】《科尔沁区人民政府关于印发科尔沁区规范互联网租赁自行车发展的实施意见的通知》（通科政发〔2020〕199号）要求进入科尔沁区互联网租赁自行车系统必须要在区内注册。
【定性分析】违反了《公平竞争审查制度实施细则》第十三条第一款。`,
            violationType: '强制本地注册',
            violationClause: '《公平竞争审查制度实施细则》第十三条第一款（不得要求设立分支机构或强制在本地注册）',
            documentName: '《科尔沁区人民政府关于印发科尔沁区规范互联网租赁自行车发展的实施意见的通知》（通科政发〔2020〕199号）',
            documentOrg: '内蒙古自治区通辽市科尔沁区人民政府',
            province: '内蒙古自治区通辽市科尔沁区',
            violationDetail: '要求互联网租赁自行车系统必须在区内注册。',
            result: '进行整改或废止程序。'
        },
        {
            title: '鄂尔多斯市东胜区互联网租赁助力共享单车管理实施方案(试行)',
            content: `【案例三】鄂尔多斯市东胜区人民政府规定外地共享单车投放运营企业须在本地设置分支机构。
【基本案情】《鄂尔多斯市东胜区人民政府关于互联网租赁助力共享单车管理实施方案(试行)》（东政发〔2020〕51号）规定共享单车投放运营企业必须在本地设立分支机构。
【定性分析】违反了《公平竞争审查制度实施细则》第十三条第一款。`,
            violationType: '强制设立分支机构',
            violationClause: '《公平竞争审查制度实施细则》第十三条第一款（不得要求设立分支机构）',
            documentName: '《鄂尔多斯市东胜区人民政府关于互联网租赁助力共享单车管理实施方案(试行)》（东政发〔2020〕51号）',
            documentOrg: '内蒙古自治区鄂尔多斯市东胜区人民政府',
            province: '内蒙古自治区鄂尔多斯市东胜区',
            violationDetail: '规定共享单车运营企业必须在本地设立分支机构。',
            result: '进行整改或废止程序。'
        }
    ];

    for (const c of imCases) {
        await prisma.case.create({
            data: {
                title: c.title,
                content: c.content,
                violationType: c.violationType,
                violationClause: c.violationClause,
                documentName: c.documentName,
                documentOrg: c.documentOrg,
                province: c.province,
                violationDetail: c.violationDetail,
                result: c.result,
                publishDate: '2023-02-09',
                reportId: innerMongoliaReport.id
            }
        });
    }
    console.log(`Created 3 cases for Inner Mongolia Report`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
