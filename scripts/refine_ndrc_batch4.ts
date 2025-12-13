
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reportTitle = '国家发展改革委办公厅关于违背市场准入负面清单典型案例（第四批）的通报';

    const report = await prisma.report.findFirst({
        where: { title: reportTitle }
    });

    if (!report) {
        console.log('Report not found');
        return;
    }

    const updates = [
        {
            title: '河南省安阳市8家市场主体违背《市场准入负面清单（2022年版）》有关规定',
            violationClause: '《市场准入负面清单（2022 年版）》禁止准入类措施“禁止违规开展金融相关经营活动”中的“非金融机构、不从事金融活动的企业，在注册名称和经营范围中不得使用‘银行’‘保险’‘证券公司’‘基金管理公司’‘融资担保’‘征信’‘交易所’……等与金融相关的字样”的相关规定'
        },
        {
            title: '湖南省张家界市以特许经营权公开拍卖方式限制共享单车企业准入',
            documentName: '城区共享电单车5年特许经营权拍卖公告'
        },
        {
            title: '广西壮族自治区钦州市以招标遴选方式确定唯一助力车经营者，限制其他企业准入经营并违规收取车辆占道经营费',
            documentName: '助力车招标遴选公告'
        },
        {
            title: '云南省昆明市某县人民政府办公室违规限制外地企业进入本地行政事业单位公务用车市场',
            documentName: '行政事业单位公务用车2021—2023年车辆定点维修和保养服务采购公告'
        },
        {
            title: '云南省瑞丽市住房和城乡建设局以特许经营权公开拍卖方式限制共享电单车企业准入经营',
            documentName: '共享电单车特许经营权拍卖文件' // Inferred
        }
    ];

    for (const update of updates) {
        // Build the update object dynamically
        const dataToUpdate: any = {};
        if (update.violationClause) dataToUpdate.violationClause = update.violationClause;
        if (update.documentName) dataToUpdate.documentName = update.documentName;

        await prisma.case.updateMany({
            where: {
                title: update.title,
                reportId: report.id
            },
            data: dataToUpdate
        });
        console.log(`Refined details for: ${update.title}`);
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
