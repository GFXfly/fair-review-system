import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding...')

    // 1. Seed Regulations (法规)
    const regulations = [
        {
            title: '公平竞争审查条例',
            level: '行政法规',
            content: '第一条 为了规范公平竞争审查工作，促进市场公平竞争，优化营商环境，建设全国统一大市场，根据《中华人民共和国反垄断法》等法律，制定本条例...',
            publishDate: '2024-06-01',
            department: '国务院',
            category: '综合'
        },
        {
            title: '中华人民共和国反垄断法',
            level: '法律',
            content: '第一条 为了预防和制止垄断行为，保护市场公平竞争，鼓励创新，提高经济运行效率，维护消费者利益和社会公共利益，促进社会主义市场经济健康发展，制定本法...',
            publishDate: '2022-06-24',
            department: '全国人大常委会',
            category: '综合'
        },
        {
            title: '优化营商环境条例',
            level: '行政法规',
            content: '第一条 为了持续优化营商环境，激发市场主体活力，维护市场主体合法权益，制定本条例...',
            publishDate: '2019-10-22',
            department: '国务院',
            category: '营商环境'
        },
        {
            title: '招标投标法实施条例',
            level: '行政法规',
            content: '第六条 招标人可以自行办理招标事宜，也可以委托招标代理机构办理招标事宜...',
            publishDate: '2019-03-02',
            department: '国务院',
            category: '招投标'
        }
    ]

    for (const r of regulations) {
        const regulation = await prisma.regulation.create({
            data: r,
        })
        console.log(`Created regulation with id: ${regulation.id}`)
    }

    // 2. Seed Cases (案例)
    const cases = [
        {
            title: '某市住建局指定特定中介机构案',
            violationType: '指定交易',
            content: '某市住建局在办理施工许可证时，要求企业必须在指定的3家检测机构中选择一家进行检测，排除了其他具备资质的检测机构的竞争资格。',
            result: '通报整改',
            publishDate: '2023-05-12',
            province: '浙江省'
        },
        {
            title: '某县政府给予本地企业物流补贴案',
            violationType: '歧视性补贴',
            content: '某县政府出台文件，规定仅对注册在本地的物流企业给予每单2元的财政补贴，对外地企业不予补贴，构成了对非本地经营者的歧视。',
            result: '纠正',
            publishDate: '2023-08-20',
            province: '江苏省'
        },
        {
            title: '某行业协会组织企业达成价格联盟案',
            violationType: '行业自律',
            content: '某混凝土协会组织15家会员单位召开会议，约定统一上调混凝土销售价格，并约定了最低限价。',
            result: '罚款',
            publishDate: '2023-11-05',
            province: '广东省'
        },
        {
            title: '某招标文件设置不合理加分项案',
            violationType: '招投标',
            content: '某政府采购项目在招标文件中规定，获得过“本地纳税大户”荣誉的企业加5分，变相排斥了外地企业。',
            result: '废标重招',
            publishDate: '2024-01-15',
            province: '四川省'
        }
    ]

    for (const c of cases) {
        const caseItem = await prisma.case.create({
            data: c,
        })
        console.log(`Created case with id: ${caseItem.id}`)
    }

    console.log('Seeding finished.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
