const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const record = await prisma.reviewRecord.findFirst({
        where: { fileName: { contains: '临安区地质灾害' } },
        include: { risks: true }
    });

    if (!record) {
        console.log('未找到该审查记录');
        return;
    }

    console.log('=== 审查记录详情 ===');
    console.log('文件名:', record.fileName);
    console.log('状态:', record.status);
    console.log('摘要:', record.summary);
    console.log('riskCount 字段值:', record.riskCount);
    console.log('实际风险数组长度:', record.risks.length);
    console.log('');

    if (record.risks.length > 0) {
        console.log('=== 发现的风险点 ===');
        record.risks.forEach((risk, index) => {
            console.log(`\n风险 ${index + 1}:`);
            console.log('  等级:', risk.level);
            console.log('  标题:', risk.title);
            console.log('  描述:', risk.description);
        });
    } else {
        console.log('✅ AI 未发现任何风险点（这可能是正常的）');
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
