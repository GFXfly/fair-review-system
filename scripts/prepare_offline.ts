import { pipeline } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';

async function downloadModels() {
    console.log('🚀 开始下载 BGE-M3 向量模型用于离线部署...');

    // 设置本地缓存路径，确保模型下载到项目内部
    const modelDir = path.join(process.cwd(), 'models');
    if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir);
    }

    process.env.XENOVA_CACHE_DIR = modelDir;

    try {
        console.log('⏳ 正在从 Hugging Face 获取模型 (约 300MB-500MB)，请保持网络通畅...');

        // 这一步会实际触发下载并存储到 ./models
        await pipeline('feature-extraction', 'Xenova/bge-m3', {
            cache_dir: modelDir,
        });

        console.log('✅ 模型下载成功！已存储在 ./models 文件夹中。');
        console.log('📦 之后您可以将此目录整个拷贝到无法联网的内网环境。');
    } catch (error) {
        console.error('❌ 下载失败:', error);
    }
}

downloadModels();
