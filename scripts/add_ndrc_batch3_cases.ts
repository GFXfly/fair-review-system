
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Report Title inferred from content and typical NDRC naming conventions for "第3期"
    const reportTitle = '国家发展改革委办公厅关于违背市场准入负面清单典型案例及处理情况的通报（第3期）';
    const publishDate = '2022-08-16'; // Derived from URL t20220816
    const department = '国家发展和改革委员会';

    // 1. Create or Find Report
    let report = await prisma.report.findFirst({
        where: { title: reportTitle }
    });

    if (!report) {
        console.log(`Creating report: ${reportTitle}`);
        report = await prisma.report.create({
            data: {
                title: reportTitle,
                department: department,
                publishDate: publishDate,
                province: '全国'
            }
        });
    } else {
        console.log(`Report already exists: ${reportTitle}`);
        await prisma.report.update({
            where: { id: report.id },
            data: {
                department: department,
                publishDate: publishDate
            }
        });
    }

    // 2. Define Cases
    const cases = [
        {
            title: '湖北省黄冈市有关部门违规限制外地经营者参与本地招投标活动',
            province: '湖北省黄冈市',
            documentOrg: '黄冈市城市管理执法委员会',
            violationType: '准入障碍/地域限制',
            documentName: '《2021 年度项目招标代理机构遴选公告》',
            violationClause: null,
            violationDetail: '要求招标代理机构在黄冈市区具有固定的经营场所，提供自有房产证或租用房产协议或其他房产证明材料，涉及限制外地企业进入本地市场。',
            content: `2021 年 3 月，湖北省黄冈市城市管理执法委员会在政府网发布《2021 年度项目招标代理机构遴选公告》，要求招标代理机构在黄冈市区具有固定的经营场所，提供自有房产证或租用房产协议或其他房产证明材料，涉及限制外地企业进入本地市场。`,
            result: `该案例已完成整改。黄冈市城市管理执法委员会全面纠正在项目招标遴选工作中违法行政行为。2021 年 12 月 22 日，在政府网上公示《关于废止〈2021 年度项目招标代理机构遴选入围结果公示〉的公告》，废止相关文件。召开会议检视整改，要求全面清理废除妨碍统一市场和公平竞争的各种规定做法，特别是对需“一事一议”的通知公告审查不细或漏审的问题进行认真整改，并将《反垄断法》纳入单位普法内容。按照《公平竞争审查制度实施细则》要求，对已出台的政策措施进行全面清理，补做公平竞争审查，确保政策措施符合公平竞争要求。`
        },
        {
            title: '山东省菏泽市有关部门违规设置行政许可前置条件',
            province: '山东省菏泽市',
            documentOrg: '菏泽市应急管理局',
            violationType: '准入障碍/许可前置不当',
            documentName: '《菏泽市烟花爆竹连锁经营工作方案》',
            violationClause: null,
            violationDetail: '规定“申请办理《烟花爆竹零售许可证》的零售店（点），必须与辖区内批发企业签订连锁经营协议。”',
            content: `2020 年 11 月 6 日，菏泽市应急管理局以菏泽市安全生产委员会办公室的名义制定和印发《菏泽市烟花爆竹连锁经营工作方案》 ，规定“申请办理《烟花爆竹零售许可证》的零售店（点），必须与辖区内批发企业签订连锁经营协议。”`,
            result: `该案例已完成整改。2021 年 11 月，山东省市场监管局对菏泽市该行为进行调查。菏泽市应急管理局迅速整改，于 11 月 5 日印发《关于规范全市烟花爆竹连锁经营推广工作有关事项的通知》，对《菏泽市烟花爆竹连锁经营工作方案》中的相关规定进行修订，并在市政府网站进行社会公示，消除影响。`
        },
        {
            title: '湖北省随州市有关部门违规设置土地估价机构准入前置条件',
            province: '湖北省随州市',
            documentOrg: '随州市自然资源和规划局',
            violationType: '准入障碍/违规备案',
            documentName: '《关于开展 2021 年土地估价机构备案工作的通知》',
            violationClause: null,
            violationDetail: '要求从事评估业务的土地估价机构应事先申请备案，且须已经省自然资源厅同意予以备案。',
            content: `2021 年 4 月，湖北省随州市自然资源和规划局在政府网上发布《关于开展 2021 年土地估价机构备案工作的通知》，要求“在我市行政辖区内从事评估业务的土地估价机构，应事先向我局申请备案，凭备案证明开展土地估价业务。申请备案的土地估价机构，须已经省自然资源厅同意予以备案。”`,
            result: `该案例已完成整改。湖北省市场监管局于 2021 年 11 月 25 日派专班展开调查，宣传法律法规，12 月 3 日对随州市自然资源和规划局涉嫌滥用行政权力排除、限制竞争行为立案调查。湖北省自然资源厅组织核查督办，随州市自然资源和规划局积极整改。一是废止相关文件。2021 年 11 月 25 日，将《关于开展 2021 年土地估价机构备案工作的通知》等公示内容从政府网站上撤回，12 月 2 日印发《关于对开展土地评估机构备案妨碍公平竞争问题整改的通知》，不再开展土地评估机构备案。二是召开专题整改会议，组织政策学习。2021 年 11 月 25 日，专题学习《反垄断法》、《公平竞争审查制度实施细则》，严格落实公平竞争审查制度。湖北省自然资源厅开展针对性制度建设和工作规范，全面规范监管。2022 年 4 月，印发《关于进一步规范土地估价行业监管的通知》，2022 年 5 月，印发《关于开展 2022 年土地估价行业“双随机、一公开”监督检查工作的通知》，2022 年 6 月，印发《关于做好 2022 年度自然资源评价评估工作的通知》。于 2022 年 4 月至 5 月，在全省系统部署开展土地估价行业监管问题排查整治活动。`
        },
        {
            title: '重庆市合川区有关部门违规设置教育采购市场准入限制',
            province: '重庆市合川区',
            documentOrg: '重庆市合川区教育委员会',
            violationType: '指定交易/独家经营',
            documentName: '《重庆市合川区教育委员会关于坚持民生导向服务教育事业加强中小学后勤服务管理工作的意见》',
            violationClause: null,
            violationDetail: '规定全区中小学教辅资料、服装采购、办公用品等一律由学子公司集中采购供给或代理。',
            content: `市场主体反映，重庆市合川区教育委员会下发《重庆市合川区教育委员会关于坚持民生导向服务教育事业加强中小学后勤服务管理工作的意见》，规定“全区中小学教辅资料发行统一由合川区教委组织，具体由学子公司统一发行；全区中小学服装采购统一由学子公司组织供货；全区中小学办公用品、文教用品、体育器材供给，一律由学子公司集中采购供给；全区中小学学生保险，统一由学子公司代理；全区教育考察培训，统一由学子公司组织办理。”`,
            result: `该案例已完成整改。2021 年 11 月，重庆市市场监管局收到该问题举报后迅即开展调查，督促合川区教委立即做好违规文件的整改，形成《关于合川区教育委员会涉嫌滥用行政权力排除、限制竞争案的调查报告》。2021 年 12 月，合川区教委印发《关于废止〈关于坚持民生导向服务教育事业加强中小学后勤服务管理工作的意见〉的决定》（合川教〔2021〕461 号）。从 2022 年春季学期起，合川区已全面终止学子公司在全区中小学的食堂（超市）物资配送、教辅资料发行、服装采购等。同时，合川区教委制定《中小学食堂大宗物资统一采购配送项目招投标方案》，为各市场主体营造公开公平的市场竞争环境。目前，市教委正在全市教育系统开展优化营商环境专项整治工作，重点对违背市场准入负面清单、违反公平竞争等规范性文件、政策措施、行政行为进行重点整治，坚决杜绝类似情况再度发生。`
        },
        {
            title: '广西壮族自治区柳州市相关市场主体违规进入负面清单禁止或限制进入的行业、领域、业务',
            province: '广西壮族自治区柳州市',
            documentOrg: '柳州市体育行政主管部门',
            violationType: '违规经营/未获许可',
            documentName: null,
            violationClause: '违背“未获得许可、资质条件或通过内容审核，不得从事特定文体演艺活动、业务或社会艺术水平考级活动”等有关要求',
            violationDetail: '3家场馆经营攀岩、游泳等项目未获得经营高危险性体育项目许可审批，私自对外营业。',
            content: `广西壮族自治区柳州市体育行政主管部门检查发现，3 家场馆经营攀岩、游泳等项目未获得经营高危险性体育项目许可审批，私自对外营业。涉及违背“未获得许可、资质条件或通过内容审核，不得从事特定文体演艺活动、业务或社会艺术水平考级活动”等有关要求。`,
            result: `该案例已完成整改。柳州市体育行政主管部门执法队伍勒令 3 家场馆暂时停业整顿，在获批《经营高危险性体育项目许可证》之前不可开放运营场内项目。指导有意向经营高危性体育项目的场馆办理有关许可，上门告知办理流程及所需资料，引导其成为合规市场经营主体。`
        },
        {
            title: '四川省内江市相关市场主体违规进入负面清单禁止或限制进入的行业、领域、业务',
            province: '四川省内江市',
            documentOrg: '内江市文化广播电视和旅游局',
            violationType: '违规经营/无证经营',
            documentName: null,
            violationClause: null,
            violationDetail: '企业在未办理《旅行社业务经营许可证》情况下，以零团费方式招揽组织旅游者。',
            content: `四川省内江市文化广播电视和旅游局文化市场综合行政执法直属大队在有关景区开展执法检查时发现，辖区某企业在未办理《旅行社业务经营许可证》情况下，以零团费方式招揽组织旅游者内江二日游，并已安排旅游者到有关景点及其代理的保健品生产商等地进行现场参观。`,
            result: `该案例已完成整改。内江市文化广播电视和旅游局依据《中华人民共和国旅游法》有关规定，责令当事人立即改正违法行为，并处罚款 1 万元，对其法定代表人处 2 千元罚款。`
        }
    ];

    // 3. Insert Cases
    for (const item of cases) {
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
                    publishDate: publishDate
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

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
