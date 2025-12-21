const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateEmbedding(text) {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
        console.log('SILICONFLOW_API_KEY not set');
        return [];
    }

    try {
        const response = await fetch('https://api.siliconflow.cn/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'BAAI/bge-large-zh-v1.5',
                input: text.substring(0, 8000)
            })
        });

        if (!response.ok) {
            console.log('API Error:', response.status);
            return [];
        }

        const data = await response.json();
        return data.data[0].embedding;
    } catch (e) {
        console.error('Embedding error:', e.message);
        return [];
    }
}

async function updateEmbedding() {
    const reg = await prisma.regulation.findUnique({
        where: { id: 18 }
    });

    if (!reg) {
        console.log('未找到该法规');
        return;
    }

    console.log('正在为法规生成向量...');
    console.log('法规标题:', reg.title);

    const embedding = await generateEmbedding(reg.content);

    if (embedding.length > 0) {
        await prisma.regulation.update({
            where: { id: 18 },
            data: { embedding: JSON.stringify(embedding) }
        });
        console.log('向量更新成功！维度:', embedding.length);
    } else {
        console.log('向量生成失败');
    }

    await prisma.$disconnect();
}

updateEmbedding();
