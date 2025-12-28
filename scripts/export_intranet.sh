#!/bin/bash

# ==========================================================
# 公平竞争审查系统 - 内网离线打包脚本 (v2.0)
# ==========================================================

BUNDLE_NAME="fair-review-INTRANET-v2.zip"
EXPORT_DIR="dist_intranet"

echo "🚀 开始制作内网离线包..."

# 1. 清理旧数据
rm -rf $EXPORT_DIR
rm -f $BUNDLE_NAME
mkdir -p $EXPORT_DIR

# 2. 拷贝代码 (排除大型缓存和 Git 目录)
echo "📦 正在复制源码..."
rsync -av --progress . $EXPORT_DIR \
    --exclude "node_modules" \
    --exclude ".next" \
    --exclude ".git" \
    --exclude "*.zip" \
    --exclude "*.tar" \
    --exclude ".env*" \
    --exclude "dist_intranet"

# 3. 准备内网配置文件
echo "⚙️ 配置内网环境变量..."
cat > $EXPORT_DIR/.env << 'EOF'
# 内网部署环境变量 (针对 10.33.188.149 昇腾服务器)
PORT=3000
NODE_ENV=production
USE_LOCAL_LLM=true
MAIN_MODEL_NAME=DeepSeek-R1-Distill-Qwen-32B
SILICONFLOW_BASE_URL=http://10.33.188.202:10304/v1
EMBEDDING_SOURCE=local-transformers
USE_LOCAL_EMBEDDING=true
DATABASE_URL="file:/app/data/dev.db"
SESSION_SECRET=fair_intranet_secure_2025_secret
EOF

# 4. 确保模型文件已包含
if [ -d "models" ]; then
    echo "✅ 发现离线向量模型，正在打包入项目..."
    cp -r models $EXPORT_DIR/
else
    echo "❌ 警告：未发现 models 文件夹，请先运行 npx tsx scripts/prepare_offline.ts"
    exit 1
fi

# 5. 确保数据库包含最新数据 (从 prisma/dev.db 拷贝)
echo "🗄️ 同步最新案例库数据..."
mkdir -p $EXPORT_DIR/data
cp prisma/dev.db $EXPORT_DIR/data/dev.db

# 6. 生成内网一键启动专用 Dockerfile (针对 ARM64 优化)
echo "🐳 生成内网专用 Dockerfile..."
cat > $EXPORT_DIR/Dockerfile.offline << 'EOF'
FROM node:20-alpine
WORKDIR /app

# 安装基础运行库 (内网可能无法安装，如果基础镜像自带最好)
# 如果服务器完全没网，建议直接 docker load 导出的镜像

COPY . .

# 全量安装依赖（假设内网有私有源或我们把 node_modules 打包进去）
# 推荐：在有网环境 build 成镜像后再导出 tar 包
RUN npm install --production --registry=https://registry.npmmirror.com

EXPOSE 3000
CMD ["npm", "run", "start"]
EOF

# 7. 压缩成品
echo "🗜️ 正在生成最终压缩包: $BUNDLE_NAME"
zip -r $BUNDLE_NAME $EXPORT_DIR
rm -rf $EXPORT_DIR

echo "----------------------------------------------------------"
echo "✅ 大功告成！"
echo "📦 内网离线包已生成: $BUNDLE_NAME"
echo "💡 请将此压缩包拷贝至 U 盘，在内网服务器解压后运行即可。"
echo "----------------------------------------------------------"
