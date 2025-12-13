
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Both cases are from the same date: 2023-07-25
    const publishDate = '2023-07-25';
    const department = '国家市场监督管理总局';

    // Case 1: Hunan Yongxing Case
    const reportTitle1 = '湖南省市场监管局纠正永兴县人民政府滥用行政权力排除、限制竞争行为';
    let report1 = await prisma.report.findFirst({ where: { title: reportTitle1 } });

    if (!report1) {
        report1 = await prisma.report.create({
            data: {
                title: reportTitle1,
                department: department,
                publishDate: publishDate,
                province: '湖南省',
            }
        });
        console.log(`Created Report 1: ${report1.title}`);
    } else {
        console.log(`Report 1 already exists: ${report1.title}`);
    }

    const case1 = {
        title: '湖南省市场监管局纠正永兴县人民政府滥用行政权力排除、限制竞争行为',
        content: `2023年1月10日，湖南省市场监管局对永兴县人民政府涉嫌滥用行政权力排除、限制竞争行为进行立案调查。
经查，2022年9月16日，当事人印发《关于规范机关事业单位工作人员健康体检工作的通知》，其中含有“二、健康体检机构 永兴县辖区内县级公立医院”之内容，排除、限制竞争。
湖南省市场监管局认为，体检市场是一个充分竞争的市场，该县属相关单位拥有自主选择体检机构的权利。当事人在组织行政事业单位工作人员体检过程中，以发文的形式限定永兴县各乡镇（街道）和县直机关、事业单位选择永兴县辖区内县级公立医院作为健康检查机构，剥夺了体检单位的自主选择权，排除、限制了其他具有合格资质和服务能力健康检查机构的体检服务平等参与权，妨碍了该区域体检服务市场的公平、充分竞争，违反了《中华人民共和国反垄断法》第四十五条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，制定含有排除、限制竞争内容的规定”之规定，构成滥用行政权力排除、限制竞争行为。
调查期间，当事人积极主动纠错，及时整改，在政府门户网站向社会发布公告，明确废止上述《通知》，消除不良社会影响。`,
        violationType: '指定交易/滥用行政权力',
        violationClause: '《中华人民共和国反垄断法》第四十五条（不得滥用行政权力，制定含有排除、限制竞争内容的规定）',
        documentName: '《关于规范机关事业单位工作人员健康体检工作的通知》',
        documentOrg: '湖南省郴州市永兴县人民政府',
        province: '湖南省郴州市永兴县',
        violationDetail: '发文限定各单位选择辖区内县级公立医院作为健康体检机构。',
        result: '废止相关文件，向社会发布公告。',
        publishDate: publishDate,
        reportId: report1.id
    };

    await prisma.case.create({ data: case1 });
    console.log(`Created Case 1: ${case1.title}`);

    // Case 2: Hunan Shaoyang Case
    const reportTitle2 = '湖南省市场监管局纠正邵阳县人民政府滥用行政权力排除、限制竞争行为';
    let report2 = await prisma.report.findFirst({ where: { title: reportTitle2 } });

    if (!report2) {
        report2 = await prisma.report.create({
            data: {
                title: reportTitle2,
                department: department,
                publishDate: publishDate,
                province: '湖南省',
            }
        });
        console.log(`Created Report 2: ${report2.title}`);
    } else {
        console.log(`Report 2 already exists: ${report2.title}`);
    }

    const case2 = {
        title: '湖南省市场监管局纠正邵阳县人民政府滥用行政权力排除、限制竞争行为',
        content: `2023年1月17日，湖南省市场监管局对邵阳县人民政府涉嫌滥用行政权力排除、限制竞争行为进行立案调查。
经查，2022年10月13日，当事人召开2022年第15次县长办公室会议，形成《县长办公会议纪要》，该《会议纪要》第十二项含有“原则同意由县财政局牵头将广告资源一体化经营、教育营养餐一体化经营、人力资源一体化经营和县城物业（保洁）一体化经营等四个方面进行第一批财政性资金统筹整合试点工作，通过购买服务授予县某集团公司”之内容。该《会议纪要》发送各有关单位。
湖南省市场监管局认为，当事人以开展财政性资金统筹整合试点为由，通过发布《会议纪要》的形式，将邵阳县广告资源一体化经营、教育营养餐一体化经营、人力资源一体化经营和县城物业（保洁）一体化经营，指定授予邵阳县某集团公司，直接排除、限制了现有的经营者和其他具有合格资质和服务能力的经营企业参与相关市场公平竞争的机会。该行为违反了《中华人民共和国反垄断法》第三十九条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品”之规定，具有排除、限制邵阳县相关市场竞争的效果，构成滥用行政权力排除、限制竞争行为。
调查期间，当事人积极配合调查，组织召开政府常务会议专题研究整改事项，主动采取措施停止相关行为，消除相关竞争限制，并组织各部门认真学习《中华人民共和国反垄断法》等相关法律法规，严格落实公平竞争审查制度。`,
        violationType: '指定交易/滥用行政权力',
        violationClause: '《中华人民共和国反垄断法》第三十九条（不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品）',
        documentName: '《县长办公会议纪要》（2022年第15次）',
        documentOrg: '湖南省邵阳市邵阳县人民政府',
        province: '湖南省邵阳市邵阳县',
        violationDetail: '通过会议纪要将广告、营养餐、人力资源、物业等四个方面经营权直接授予某集团公司。',
        result: '召开专题会议整改，停止相关行为。',
        publishDate: publishDate,
        reportId: report2.id
    };

    await prisma.case.create({ data: case2 });
    console.log(`Created Case 2: ${case2.title}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
