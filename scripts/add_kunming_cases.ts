
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const department = '昆明市市场监督管理局';
    const province = '云南省昆明市';

    const reportsData = [
        {
            title: '昆明市公平竞争审查工作部门联席会议办公室对违反公平竞争审查典型案例的分析（第5期）',
            publishDate: '2022-06-17',
            cases: [
                {
                    title: '昆明市某区文化和旅游局违规限制外地企业申报旅游业补助资金',
                    province: '云南省昆明市',
                    documentOrg: '昆明市某区文化和旅游局',
                    violationType: '准入障碍/地域限制',
                    documentName: '《促进经济平稳健康发展的政策措施-转型升级发展旅游业实施细则》',
                    violationClause: '《公平竞争审查制度实施细则》第十三条第一款',
                    violationDetail: '申报转型升级发展旅游业补助资金的企业，必须在某区注册、办理税务登记且独立核算；申请并获得本政策扶持的企业，需承诺5年内不得将工商注册、纳税、统计等关系迁出某区。',
                    content: `昆明市某区文化和旅游局在制定促进经济平稳健康发展的政策措施-转型升级发展旅游业实施细则中“第一条 适用范围在某区实施旅游产业品质提升、开展A级旅游景区创建，申报转型升级发展旅游业补助资金的企业，必须在某区注册、办理税务登记且独立核算的企业，具有健全的财务管理制度、会计核算制度和统计管理体系，严格做到依法经营、依法纳税、依法统计”；“第五条 申报流程 （二）区文化和旅游局征求相关行业主管部门意见，申报内容符合要求，申报主体企业5年内无违法违规行为受到处罚。申请并获得本政策扶持的企业（单位），需承诺5年内不得将工商注册、纳税、统计等关系迁出某区，否则将收回其获得的扶持资金，并列入失信企业名单，不再享有某区任何扶持政策”。
该文件将补助对象限制在该区注册、办理税务登记，排除了在该区依法生产经营并符合补助条件的区外企业，为不合理的准入门槛，违反《公平竞争审查制度实施细则》第十三条第一款“2.没有法律、行政法规或者国务院规定依据，对不同所有制、地区、组织形式的经营者实施不合理的差别化待遇，设置不平等的市场准入和退出条件”的规定。同时，对享受优惠政策的企业，限制其五年内不得迁出该区，违反了《公平竞争审查制度实施细则》第十三条第一款“1.设置明显不必要或者超出实际需要的退出条件”的规定。`,
                    result: `温馨提示：根据《公平竞争审查制度实施细则》第二条规定：行政机关以及法律法规授权的具有管理公共事务职能的组织...在制定...涉及市场主体经济活动的规章、规范性文件、其他政策性文件以及“一事一议”形式的具体政策措施...时，应当进行公平竞争审查，评估对市场竞争的影响，防止排除、限制市场竞争；未经公平竞争审查的，不得出台。`
                }
            ]
        },
        {
            title: '昆明市公平竞争审查工作部门联席会议办公室对违反公平竞争审查典型案例的分析（第4期）',
            publishDate: '2022-06-15',
            cases: [
                {
                    title: '昆明市某县经济技术开发区管理委员会在招标公告中违规设定营业执照经营范围限制',
                    province: '云南省昆明市',
                    documentOrg: '昆明市某县经济技术开发区管理委员会',
                    violationType: '准入障碍/资质限制',
                    documentName: '《道路绿化维护服务、道路亮化及10KV线路维护服务招标公告》',
                    violationClause: '《公平竞争审查制度实施细则》第十三条第一款',
                    violationDetail: '要求投标人营业执照经营范围包括园林绿化工程相关范围。',
                    content: `昆明市某县经济技术开发区管理委员会在道路绿化维护服务、道路亮化及10KV线路维护服务招标公告中对投标人设定营业执照经营范围，为不合理的准入门槛。
某县经济技术开发区管理委员会在道路绿化维护服务、道路亮化及10KV线路维护服务招标公告中“3.本项目的特定资格要求：本次招标A标包要求投标人具备：投标人必须是在中华人民共和国境内依法成立，具有独立法人资格和独立承担民事责任的能力，营业执照年检合格且在有效期内，经营范围包括园林绿化工程相关范围”。
该条款设定营业执照经营范围，为不合理的准入门槛，违反了《公平竞争审查制度实施细则》第十三条第一款“3.没有法律、行政法规或者国务院规定依据，以备案、登记、注册、目录、年检、年报、监制、认定、认证、认可、检验、监测、审定、指定、配号、复检、复审、换证、要求设立分支机构以及其他任何形式，设定或者变相设定市场准入障碍”的规定。`,
                    result: `温馨提示：根据《公平竞争审查制度实施细则》第二条规定...应当进行公平竞争审查...未经公平竞争审查的，不得出台。`
                }
            ]
        },
        {
            title: '昆明市公平竞争审查工作部门联席会议办公室对违反公平竞争审查典型案例的分析（第3期）',
            publishDate: '2022-06-14',
            cases: [
                {
                    title: '昆明市某县人民政府办公室公务用车定点维修采购公告中限定本地服务',
                    province: '云南省昆明市',
                    documentOrg: '昆明市某县人民政府办公室',
                    violationType: '指定交易/地域限制',
                    documentName: '《行政事业单位公务用车2021-2023年车辆定点维修和保养服务采购公告》',
                    violationClause: '《公平竞争审查制度实施细则》第十三条第三款、《反垄断法》相关规定',
                    violationDetail: '要求政府集中采购所需产品（服务）时，在同质同价条件下原则上优先就近采购本地服务。',
                    content: `昆明市某县人民政府办公室在行政事业单位公务用车2021-2023年车辆定点维修和保养服务采购公告中限定经营、购买、使用特定经营者提供的商品和服务。
昆明市某县人民政府办公室在采购公告中公告中规定“要求政府集中采购所需产品（服务）时，在同质同价条件下原则上优先就近采购本地服务”。
此规定违反《公平竞争审查制度实施细则》第十三条第三款“不得限定经营、购买、使用特定经营者提供的商品和服务”的规定。
相关行为实施涉嫌违反《反垄断法》第八条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，排除、限制竞争”；违反《反垄断法》第三十二条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品”和第三十七条所列“行政机关不得滥用行政权力，制定含有排除、限制竞争内容的规定”的要求。`,
                    result: `温馨提示：根据《中华人民共和国反垄断法》、《优化营商环境条例》...行政机关...在制定...政策措施时，应当进行公平竞争审查...经公平竞争审查认为具有排除、限制竞争效果且不符合例外规定的，应当不予出台或者调整至符合相关要求后出台；未经公平竞争审查的，不得出台。`
                }
            ]
        },
        {
            title: '昆明市公平竞争审查工作部门联席会议办公室对违反公平竞争审查典型案例的分析（第2期）',
            publishDate: '2022-06-13',
            cases: [
                {
                    title: '昆明市某区水务局在河道管护招标公告中限制投标人独立法人资格',
                    province: '云南省昆明市',
                    documentOrg: '昆明市某区水务局',
                    violationType: '准入障碍/资质限制',
                    documentName: '《河道管护招标公告》',
                    violationClause: '《公平竞争审查制度实施细则》第十三条第一款',
                    violationDetail: '要求投标人具有独立法人资格；提供近三年经审计机构审计过的财务审计报告；提供2020年1月至今任意三个月的缴纳税收及社会保障资金的证明材料。',
                    content: `昆明市某区水务局在河道管护招标公告中限制投标人独立法人资格，设置了不合理或歧视性的准入条件。
昆明市某区水务局在招标公告文件中规定“1.投标人必须是在中国境内合法注册企业、具有独立法人资格的单位；当前未被建设行政主管部门取消投标资格；5.提供近三年（2018年、2019年、2020年）经审计机构审计过的财务审计报告；6.提供2020年1月至今任意三个月的缴纳税收及社会保障资金的证明材料”的资格要求。
该文件将投标人资格限制在具有独立法人资格的单位，排除了依法生产经营的非独立法人企业，为不合理的准入门槛，违反了《公平竞争审查制度实施细则》第十三条第一款“2.没有法律、行政法规或者国务院规定依据，对不同所有制、地区、组织形式的经营者实施不合理的差别化待遇，设置不平等的市场准入和退出条件”的规定。同时，要求投标人提供近三年（2018年、2019年、2020年）经审计机构审计过的财务审计报告以及提供2020年1月至今任意三个月的缴纳税收及社会保障资金的证明材料，此项通过限制审计报告年限和缴纳税收的年限，变相限制企业经营年限，排斥新成立的公司参与投标，违反了《公平竞争审查制度实施细则》第十三条第一款“3.没有法律、行政法规或者国务院规定依据，以备案、登记、注册、目录、年检、年报、监制、认定、认证、认可、检验、监测、审定、指定、配号、复检、复审、换证、要求设立分支机构以及其他任何形式，设定或者变相设定市场准入障碍”的规定。`,
                    result: `温馨提示：根据《公平竞争审查制度实施细则》第二条规定...应当进行公平竞争审查...未经公平竞争审查的，不得出台。`
                }
            ]
        }
    ];

    for (const reportData of reportsData) {
        // 1. Create or Find Report
        let report = await prisma.report.findFirst({
            where: { title: reportData.title }
        });

        if (!report) {
            console.log(`Creating report: ${reportData.title}`);
            report = await prisma.report.create({
                data: {
                    title: reportData.title,
                    department: department,
                    publishDate: reportData.publishDate,
                    province: province
                }
            });
        } else {
            console.log(`Report already exists: ${reportData.title}`);
            await prisma.report.update({
                where: { id: report.id },
                data: {
                    department: department,
                    publishDate: reportData.publishDate,
                    province: province
                }
            });
        }

        // 2. Insert Cases
        for (const item of reportData.cases) {
            const exists = await prisma.case.findFirst({
                where: {
                    title: item.title,
                    reportId: report.id
                }
            });

            if (!exists) {
                await prisma.case.create({
                    data: {
                        ...item,
                        reportId: report.id,
                        publishDate: reportData.publishDate
                    }
                });
                console.log(`Added case: ${item.title}`);
            } else {
                console.log(`Updating existing case: ${item.title}`);
                await prisma.case.update({
                    where: { id: exists.id },
                    data: {
                        content: item.content,
                        result: item.result,
                        province: item.province,
                        documentOrg: item.documentOrg,
                        documentName: item.documentName,
                        violationType: item.violationType,
                        violationClause: item.violationClause,
                        violationDetail: item.violationDetail
                    }
                });
            }
        }
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
