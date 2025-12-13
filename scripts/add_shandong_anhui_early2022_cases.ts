
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Case 1: Shandong Heze (2022-02-09)
    const report1Title = '山东省市场监督管理局纠正菏泽市应急管理局滥用行政权力排除、限制竞争行为';
    const report1Date = '2022-02-09';
    let report1 = await prisma.report.findFirst({ where: { title: report1Title } });
    if (!report1) {
        report1 = await prisma.report.create({
            data: {
                title: report1Title,
                department: '国家市场监督管理总局',
                publishDate: report1Date,
                province: '山东省'
            }
        });
        console.log(`Created Report: ${report1Title}`);
    }

    const case1 = {
        title: '山东省市场监督管理局纠正菏泽市应急管理局滥用行政权力排除、限制竞争行为',
        province: '山东省菏泽市',
        documentOrg: '菏泽市应急管理局',
        violationType: '指定交易/强制连锁',
        documentName: '《菏泽市烟花爆竹连锁经营工作方案》',
        violationClause: '《反垄断法》第三十七条“行政机关不得滥用行政权力，制定含有排除、限制竞争内容的规定”之规定',
        violationDetail: '规定“申请办理《烟花爆竹零售许可证》的零售店（点），必须与辖区内批发企业签订连锁经营协议。”',
        content: `2021年11月至2022年1月，山东省市场监督管理局对菏泽市应急管理局滥用行政权力排除、限制竞争行为进行调查。
经查，2020年11月6日，菏泽市应急管理局以菏泽市安全生产委员会办公室的名义制定和印发了《菏泽市烟花爆竹连锁经营工作方案》，其中规定“申请办理《烟花爆竹零售许可证》的零售店（点），必须与辖区内批发企业签订连锁经营协议。”上述规定违反了《反垄断法》第三十七条“行政机关不得滥用行政权力，制定含有排除、限制竞争内容的规定”之规定，构成滥用行政权力排除、限制竞争的行为。
调查期间，菏泽市应急管理局主动采取措施进行整改，消除后果。一是及时对《菏泽市烟花爆竹连锁经营工作方案》中的相关规定进行修订，并在菏泽市应急管理局官方网站上进行了公示；二是健全公平竞争审查机制；三是向山东省市场监督管理局报送了整改报告。
下一步，山东省市场监督管理局将持续加大滥用行政权力排除、限制竞争行为的查处力度，进一步推进公平竞争审查制度有效落实，全力保障各类市场主体的合法权益，营造公平竞争的市场环境。`,
        result: `调查期间，菏泽市应急管理局主动采取措施进行整改，消除后果...下一步，山东省市场监督管理局将持续加大滥用行政权力排除、限制竞争行为的查处力度...`
    };

    // Case 2: Shandong Jinan (2022-01-05)
    const report2Title = '山东省市场监督管理局纠正济南市生态环境局滥用行政权力排除、限制竞争行为';
    const report2Date = '2022-01-05';
    let report2 = await prisma.report.findFirst({ where: { title: report2Title } });
    if (!report2) {
        report2 = await prisma.report.create({
            data: {
                title: report2Title,
                department: '国家市场监督管理总局',
                publishDate: report2Date,
                province: '山东省'
            }
        });
        console.log(`Created Report: ${report2Title}`);
    }

    const case2 = {
        title: '山东省市场监督管理局纠正济南市生态环境局滥用行政权力排除、限制竞争行为',
        province: '山东省济南市',
        documentOrg: '济南市生态环境局',
        violationType: '妨碍流通/设置标准',
        documentName: '《关于切实加强外埠转入机动车管理的通告》',
        violationClause: '《反垄断法》第三十三条、第三十七条的规定',
        violationDetail: '规定济南市将实施外埠转入机动车临时性管理措施，外埠机动车(摩托车除外)办理机动车转移登记的，应当达到本省对济南市要求执行的外埠转入的机动车排气污染物排放标准(国五标准)。',
        content: `2021年10月-12月，山东省市场监督管理局对济南市生态环境局滥用行政权力排除、限制竞争行为进行调查。
经查，2021年9月6日，济南市生态环境局、济南市公安局联合发布了《关于切实加强外埠转入机动车管理的通告》。该《通告》规定，2021年9月8日至2022年8月31日，济南市将实施外埠转入机动车临时性管理措施，外埠机动车(摩托车除外)办理机动车转移登记的，应当达到本省对济南市要求执行的外埠转入的机动车排气污染物排放标准(国五标准)。上述行为违反了《反垄断法》第三十三条、第三十七条的规定，构成滥用行政权力排除、限制竞争的行为。
2021年12月10日，济南市生态环境局、济南市公安局发布了《关于停止执行外埠转入机动车临时性管理措施的通知》，主动纠正了违法行为，该通知已在济南市生态环境局网站进行了公示。
下一步，山东省市场监督管理局将强化反垄断执法，进一步推进公平竞争审查制度有效落实，全力保障各类市场主体的合法权益，营造公平有序的市场竞争环境。`,
        result: `2021年12月10日，济南市生态环境局、济南市公安局发布了《关于停止执行外埠转入机动车临时性管理措施的通知》，主动纠正了违法行为...下一步，山东省市场监督管理局将强化反垄断执法...`
    };

    // Case 3: Anhui Wuhu (2021-12-24)
    const report3Title = '安徽省市场监管局纠正芜湖市湾沚区人民政府滥用行政权力排除、限制竞争行为';
    const report3Date = '2021-12-24';
    let report3 = await prisma.report.findFirst({ where: { title: report3Title } });
    if (!report3) {
        report3 = await prisma.report.create({
            data: {
                title: report3Title,
                department: '国家市场监督管理总局',
                publishDate: report3Date,
                province: '安徽省'
            }
        });
        console.log(`Created Report: ${report3Title}`);
    }

    const case3 = {
        title: '安徽省市场监管局纠正芜湖市湾沚区人民政府滥用行政权力排除、限制竞争行为',
        province: '安徽省芜湖市湾沚区',
        documentOrg: '芜湖市湾沚区人民政府',
        violationType: '指定交易/限定服务',
        documentName: '《关于芜湖县天然气利用工程合资建设经营优惠政策的通知》（芜政办〔2005〕7号）',
        violationClause: '《反垄断法》第三十二条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品”之规定',
        violationDetail: '要求芜湖县所有开发公司在办理房屋开工许可证前要向原芜湖县中燃城市燃气发展有限公司交纳管道燃气用户建设安装费。',
        content: `2021年5月，安徽省市场监管局对芜湖市湾沚区人民政府涉嫌滥用行政权力排除、限制竞争行为进行调查。
经查，原芜湖县人民政府和芜湖中燃城市燃气发展有限公司于2004年11月23日签订《安徽省芜湖县天然气项目投资开发合同》，合同中约定燃气管道工程安装由原芜湖县中燃城市燃气发展有限公司实施。原芜湖县人民政府于2005年3月10日以县政府办公室的名义下发了《关于芜湖县天然气利用工程合资建设经营优惠政策的通知》（芜政办〔2005〕7号），要求芜湖县所有开发公司在办理房屋开工许可证前要向原芜湖县中燃城市燃气发展有限公司（现变更为芜湖湾沚中燃城市燃气发展有限公司）交纳管道燃气用户建设安装费。截止到2021年6月4日，该通知内容一直有效实施。上述行为违反了《反垄断法》第三十二条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品”之规定，构成滥用行政权力，排除、限制竞争行为。
调查期间，芜湖市湾沚区人民政府积极主动整改，消除违法行为造成的不良影响。一是芜湖市湾沚区人民政府于2021年6月4日召开专题会议，决定废止《关于芜湖县天然气利用工程合资建设经营优惠政策的通知》中有关燃气安装市场限制竞争行为的条款内容...并于2021年12月2日在当地政府门户网站向社会公布；二是芜湖市湾沚区人民政府表示要加强源头防控，认真落实公平竞争审查制度。今后区政府制定涉及市场主体经济活动规范性文件和其他政策措施，均要进行公平竞争审查...`,
        result: `调查期间，芜湖市湾沚区人民政府积极主动整改，消除违法行为造成的不良影响。一是芜湖市湾沚区人民政府于2021年6月4日召开专题会议，决定废止...二是芜湖市湾沚区人民政府表示要加强源头防控，认真落实公平竞争审查制度。`
    };

    // Add cases
    const casesToAdd = [
        { caseData: case1, reportId: report1.id },
        { caseData: case2, reportId: report2.id },
        { caseData: case3, reportId: report3.id }
    ];

    for (const item of casesToAdd) {
        const existing = await prisma.case.findFirst({
            where: {
                title: item.caseData.title,
                reportId: item.reportId
            }
        });

        if (!existing) {
            await prisma.case.create({
                data: {
                    ...item.caseData,
                    reportId: item.reportId,
                    publishDate: item.caseData === case1 ? report1Date : (item.caseData === case2 ? report2Date : report3Date)
                }
            });
            console.log(`Added case: ${item.caseData.title}`);
        } else {
            console.log(`Updating existing case: ${item.caseData.title}`);
            const dataToUpdate = { ...item.caseData };
            delete dataToUpdate.title;
            await prisma.case.update({
                where: { id: existing.id },
                data: dataToUpdate
            });
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
