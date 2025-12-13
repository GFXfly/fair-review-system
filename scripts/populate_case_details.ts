import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 更新案例1的详细信息
    await prisma.case.update({
        where: { id: 6 },
        data: {
            violationClause: '《公平竞争审查条例》第十二条第一款第二项',
            documentName: '《某市推进服务业高质量发展若干措施重点推进会计服务实施细则》',
            documentOrg: '某市财政局',
            violationDetail: '规定以在本地设立分支机构、注册等作为享受奖励的必要条件',
            legalScope: '影响生产经营成本'
        }
    });

    // 更新案例2
    await prisma.case.update({
        where: { id: 7 },
        data: {
            violationClause: '《公平竞争审查条例》第十二条第二款第一项',
            documentName: '《某市某区支持专精特新中小企业高质量发展若干措施（试行）》',
            documentOrg: '某区人民政府办公室',
            violationDetail: '规定获得奖补企业六年内迁出的须全额退还奖补',
            legalScope: '限制商品要素自由流动'
        }
    });

    // 更新案例3
    await prisma.case.update({
        where: { id: 8 },
        data: {
            violationClause: '《公平竞争审查条例》第十二条第一款第二项',
            documentName: '《关于优化营商环境推进企业上市"映山红行动"若干政策措施的通知》',
            documentOrg: '某区人民政府办公室',
            violationDetail: '将外地上市公司迁至本地并将注册地迁至本地作为享受奖励的必要条件',
            legalScope: '影响生产经营成本'
        }
    });

    // 更新案例4-10（使用通用信息）
    const updates = [
        { id: 9, clause: '第十二条第一款第二项', doc: '《某县人民政府关于推进装配式建筑发展的实施意见（修订）》', org: '某县人民政府办公室' },
        { id: 10, clause: '第十二条第一款第二项', doc: '《关于印发某县现代商贸物流产业链链长制工作推进方案的通知》', org: '某县人民政府办公室' },
        { id: 11, clause: '第十二条第二款第一项', doc: '《关于加强某县户用分布式光伏建设管理的实施意见（试行）》', org: '某县人民政府办公室' },
        { id: 12, clause: '第十二条第一款第二项', doc: '《某区现代农业产业化及农产品加工评价方案（2023-2025年）》', org: '某区人民政府办公室' },
        { id: 13, clause: '第十二条第一款第二项', doc: '《新一轮科技创新驱动高质量发展若干工作方案》', org: '某市科学技术局' },
        { id: 14, clause: '第十二条第一款第三项', doc: '《某区中心城区开放式居民区综合管理工作实施方案》', org: '某区人民政府办公室' },
        { id: 15, clause: '第十二条第二款第一项', doc: '《某县"四上"企业培育及项目入规入库工作方案》', org: '某县人民政府办公室' }
    ];

    for (const u of updates) {
        const caseData = await prisma.case.findUnique({ where: { id: u.id } });
        await prisma.case.update({
            where: { id: u.id },
            data: {
                violationClause: `《公平竞争审查条例》${u.clause}`,
                documentName: u.doc,
                documentOrg: u.org,
                violationDetail: caseData?.title || '',
                legalScope: caseData?.violationType || ''
            }
        });
    }

    console.log('✅ 已更新所有案例的详细信息');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
