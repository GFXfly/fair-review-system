
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start adding Wuxi cases...');

    const reportData = {
        title: '公平竞争审查微课堂丨公平竞争审查典型案例',
        department: '无锡市市场监督管理局',
        publishDate: '2024-11-13',
        province: '江苏省'
    };

    // 1. Create or Find Report
    let report = await prisma.report.findFirst({
        where: {
            title: reportData.title,
            department: reportData.department
        }
    });

    if (!report) {
        report = await prisma.report.create({
            data: reportData
        });
        console.log(`Created report: ${report.title}`);
    } else {
        console.log(`Report already exists: ${report.title}`);
        // Update date if needed
        await prisma.report.update({
            where: { id: report.id },
            data: { publishDate: reportData.publishDate }
        });
    }

    const cases = [
        {
            title: '无锡市某部门违规给予特定经营者税收优惠案',
            content: '某部门印发促进消费相关措施，规定对年经营收入达到200万元以上的个体经营户申请注册为企业法人的，及时列入本地纳统范围，并自变更为企业法人的当月起给予6个月的税费减免优惠。',
            violationType: '影响生产经营成本',
            result: '纠正',
            violationDetail: '上述做法，违反了《公平竞争审查条例》第十条第一项规定：“起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：（一）给予特定经营者税收优惠”。\n\n税收法定是税法的基本原则。任何机关、单位和个人不得违反法律、行政法规的规定，擅自作出减税、免税、退税及其他同税收法律、行政法规相抵触的决定。全面规范税收等优惠政策，有利于维护公平的市场竞争环境，加快建设全国统一大市场。',
            violationClause: '《公平竞争审查条例》第十条第一项'
        },
        {
            title: '无锡市某县人民政府对企业设置不合理退出条件案',
            content: '《关于印发某县“十四五”企业上市（挂牌）行动计划的通知》中“（七）相关要求。企业在享受奖励政策前，须对本企业在上市成功后5年内注册地不迁出我县向县政府作出书面承诺，如违反承诺，收（扣）回已兑现的奖励资金”等内容。',
            documentName: '关于印发某县“十四五”企业上市（挂牌）行动计划的通知',
            documentOrg: '某市某县人民政府',
            violationType: '限制市场准入和退出',
            result: '纠正',
            violationDetail: '上述做法，违反《公平竞争审查条例》的第八条第四项规定：“起草单位起草的政策措施，不得含有下列限制或者变相限制市场准入和退出的内容：（四）设置不合理或者歧视性的准入、退出条件”的规定。\n\n设置不合理的准入或者歧视性的准入、退出条件，会限制市场的自由竞争，导致市场活力下降，影响企业自主经营，妨碍全国统一大市场建设。违法违规限制或者变相限制市场准入和退出，既阻碍了市场一体化，又极大影响资源的优化配置，应当坚决予以禁止。',
            violationClause: '《公平竞争审查条例》第八条第四项'
        },
        {
            title: '无锡市某县级市人民政府区别对待本地与外地企业案',
            content: '《某市工业经济高质量发展若干扶持政策》中“项目奖励金额按照合同能源管理项目中企业和服务公司的投资比例实行分配，其中对非本地注册的服务公司不进行奖励”等内容。',
            documentName: '某市工业经济高质量发展若干扶持政策',
            documentOrg: '某县级市人民政府',
            violationType: '限制商品、要素自由流动',
            result: '纠正',
            violationDetail: '上述做法，违反《公平竞争审查条例》的第九条第四项规定：“起草单位起草的政策措施，不得含有下列限制商品、要素自由流动的内容：对外地或者进口商品、要素设置歧视性收费项目、收费标准、价格或者补贴”的规定。\n\n设置歧视性收费项目、收费标准、价格或者补贴不仅损害了市场竞争的公平性，还可能对消费者权益、市场效率以及企业的投资决策产生负面影响。因此，需要防范和纠正此类不公平的做法，维护公平竞争的市场环境。',
            violationClause: '《公平竞争审查条例》第九条第四项'
        },
        {
            title: '无锡市某县级市人民政府违法对“种子库”企业给予优惠政策案',
            content: '《关于印发某市电子信息产业创新集群建设实施意见的通知》中“建立健全培育北交所上市‘种子库’，将‘种子库’企业优先纳入市级财政风险补偿资金池支持名录”等内容。',
            documentName: '关于印发某市电子信息产业创新集群建设实施意见的通知',
            documentOrg: '某县级市人民政府',
            violationType: '影响生产经营成本',
            result: '纠正',
            violationDetail: '上述做法，违反《公平竞争审查条例》的第十条第二项规定：“起草单位起草的政策措施，没有法律、行政法规依据或者未经国务院批准，不得含有下列影响生产经营成本的内容：给予特定经营者选择性、差异化的财政奖励或者补贴”的规定。\n\n给予特定经营者选择性、差异化的财政奖励或补贴不仅会破坏市场公平竞争，还可能带来资源浪费、增加财政负担和引发地方保护主义等问题。因此，应当坚决禁止出台此类政策，并确保政策措施符合法律法规和公平竞争原则。',
            violationClause: '《公平竞争审查条例》第十条第二项'
        }
    ];

    for (const caseItem of cases) {
        const existingCase = await prisma.case.findFirst({
            where: {
                title: caseItem.title,
                reportId: report.id
            }
        });

        if (!existingCase) {
            await prisma.case.create({
                data: {
                    ...caseItem,
                    province: '江苏省',
                    publishDate: reportData.publishDate,
                    legalScope: '公平竞争审查',
                    reportId: report.id
                }
            });
            console.log(`Added case: ${caseItem.title}`);
        } else {
            console.log(`Case already exists: ${caseItem.title}`);
            // Update details
            await prisma.case.update({
                where: { id: existingCase.id },
                data: {
                    content: caseItem.content,
                    violationDetail: caseItem.violationDetail,
                    publishDate: reportData.publishDate
                }
            });
        }
    }

    console.log('Done adding Wuxi cases.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
