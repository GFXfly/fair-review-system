import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const cases = [
        {
            title: '黑龙江省市场监督管理局纠正牡丹江市城市管理综合执法局滥用行政权力排除、限制竞争行为',
            content: `2022年7月31日，黑龙江省市场监管局依法对牡丹江市城市管理综合执法局涉嫌滥用行政权力排除、限制竞争行为立案调查。
经查，2022年3月15日，当事人与某科技有限公司签订的《共享单车规范停放管理协议》，规定“乙方应当严格按照《牡丹江共享单车及助力车投放可行性报告》进行车辆投放，乙方通过规模发展、优质服务、公平竞争等市场手段扩大市场份额，直至饱和，保证牡丹江市场需求和车辆供给”。
黑龙江省市场监管局认为，当事人与某科技有限公司签订合同，约定只由该企业提供牡丹江市共享单车市场服务，排除、限制了其他具有相应资质和服务能力的企业参与牡丹江市共享单车市场的竞争，剥夺了消费者的自主选择权。当事人的上述行为违反了《中华人民共和国反垄断法》第四十条关于行政机关不得滥用行政权力排除、限制竞争的规定。
调查期间，当事人积极整改，消除不良影响，解除相关协议，发布“欢迎共享单车企业到我市考察入驻经营”的通知，并在牡丹江市人民政府官网公布。`,
            violationType: '指定交易',
            result: '已纠正',
            publishDate: '2023-01-01',
            province: '黑龙江省牡丹江市',
            documentName: '《共享单车规范停放管理协议》',
            documentOrg: '牡丹江市城市管理综合执法局',
            violationClause: '《反垄断法》第四十条',
            violationDetail: '指定特定企业提供共享单车服务，排除限制竞争',
        }
    ];

    for (const caseData of cases) {
        await prisma.case.create({
            data: caseData,
        });
        console.log(`Added case: ${caseData.title}`);
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
