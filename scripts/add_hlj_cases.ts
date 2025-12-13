
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start adding Heilongjiang cases...');

    const cases = [
        {
            title: '哈尔滨市交通运输局滥用行政权力排除、限制竞争行为',
            content: `经查，2018年2月6日，哈尔滨市交通运输局发布了《关于公布首批哈尔滨市网络预约出租汽车车载卫星定位装置专用设备厂家和型号的通知》中规定：首批哈尔滨市网约车车载卫星定位装置的厂家及型号为深圳锐明技术股份有限公司生产的C6D型和河南速恒物联网科技有限公司生产的SH-VST601型。哈尔滨市近4500台网约车安装了该两种型号车载卫星定位装置。上述行为违反了《反垄断法》第三十二条：“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品”之规定，构成滥用行政权力排除、限制竞争行为。

在调查过程中，哈尔滨市交通运输局主动采取措施停止了上述行为，并进行整改。一是废止了《关于公布首批哈尔滨市网络预约出租汽车车载卫星定位装置专用设备厂家和型号的通知》，并予以公示；二是明确提出放开网约车车载卫星定位装置安装市场，网约车车主可自主选择安装符合国家标准的车载卫星定位装置。`,
            violationType: '指定交易',
            result: '纠正/废止',
            publishDate: '2020-06-01', // Based on URL 202006
            province: '黑龙江',
            documentName: '关于公布首批哈尔滨市网络预约出租汽车车载卫星定位装置专用设备厂家和型号的通知',
            documentOrg: '哈尔滨市交通运输局',
            violationDetail: '限定网约车车载卫星定位装置的厂家及型号',
            violationClause: '《反垄断法》第三十二条',
        },
        // The second case (Shuangyashan) is missing details in the source, so we skip it to avoid incomplete data.
    ];

    for (const c of cases) {
        const exists = await prisma.case.findFirst({
            where: {
                title: c.title,
            },
        });

        if (exists) {
            console.log(`Case "${c.title}" already exists. Updating...`);
            await prisma.case.update({
                where: { id: exists.id },
                data: c
            });
        } else {
            console.log(`Adding case "${c.title}"...`);
            await prisma.case.create({
                data: c,
            });
        }
    }

    console.log('Finished adding Heilongjiang cases.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
