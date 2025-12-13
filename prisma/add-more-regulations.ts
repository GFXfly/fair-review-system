import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Adding additional regulations...')

    const regulations = [
        {
            title: '中华人民共和国政府采购法',
            level: '法律',
            content: `《中华人民共和国政府采购法》已由中华人民共和国第九届全国人民代表大会常务委员会第二十八次会议于2002年6月29日通过，并于2003年1月1日起施行。该法旨在规范政府采购行为，提高政府采购资金的使用效益，维护国家利益和社会公共利益，保护政府采购当事人的合法权益，并促进廉政建设。主要内容包括：
1. 总则：明确了法律的立法宗旨、适用范围和基本原则，如公开透明、公平竞争、公正和诚实信用原则。
2. 政府采购当事人：界定了采购人、供应商、采购代理机构、评审专家等各方主体的权利和义务。
3. 政府采购方式：规定了公开招标、邀请招标、竞争性谈判、单一来源采购、询价、竞争性磋商以及国务院政府采购监督管理部门认定的其他采购方式。
4. 政府采购程序：详细规定了采购计划、采购信息发布、采购文件编制、投标、开标、评标、定标、签订合同等各个环节的具体要求。
5. 监督检查与法律责任：明确了财政部门和其他有关部门对政府采购活动的监督管理职责，以及违反本法规定的法律责任。`,
            publishDate: '2003-01-01',
            department: '全国人大常委会',
            category: '政府采购'
        },
        {
            title: '浙江省招标投标领域公平竞争审查细则',
            level: '地方性法规',
            content: `由浙江省市场监督管理局等十部门于2025年10月21日印发，并自2025年12月1日起施行。这份细则是在《中华人民共和国招标投标法》《公平竞争审查条例》《公平竞争审查条例实施办法》以及《浙江省公平竞争审查办法》等规定的基础上，为进一步规范招标投标领域的公平竞争审查工作而制定。
主要内容包括：
1. 审查范围：拓展了审查范围，规定“招标投标领域涉及经营者经济活动的政策措施”和“招标文件”两类为审查对象。
2. 审查标准：细化了审查标准，针对招标投标领域涉及经营者经济活动的政策措施，规定了七个方面46项审查标准。同时明确了招标人在编制招标文件时不得设置的21种限制情形。
3. 审查主体：明确了政策措施的审查主体，由起草单位在起草阶段开展公平竞争审查。
4. 强化机制建设：要求起草单位、招标人建立健全内部公平竞争审查工作机制，并明确负责机构和审查流程。
5. 强化数字赋能：提出运用人工智能、大数据等技术建设公平竞争审查智能平台，提升审查的穿透式监管能力。
6. 协同治理与责任追究：强调了相关部门间的协同配合，并规定了对未进行公平竞争审查或违反审查标准的行为的责任追究。`,
            publishDate: '2025-10-21',
            department: '浙江省市场监督管理局等十部门',
            category: '招投标'
        }
    ]

    for (const r of regulations) {
        const existing = await prisma.regulation.findFirst({
            where: { title: r.title }
        })

        if (!existing) {
            const created = await prisma.regulation.create({
                data: r,
            })
            console.log(`Created regulation: ${created.title}`)
        } else {
            console.log(`Skipped existing regulation: ${r.title}`)
        }
    }
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
