#!/bin/bash
set -euo pipefail

# 单位生产服务器配置（shencha.lalws.cn，与 unit-sites 统一编排）
SERVER_IP="43.142.83.192"
SERVER_USER="root"
REMOTE_DIR="/root/fair-review-system"
UNIT_COMPOSE="/opt/unit-sites/compose.json"
IMAGE_NAME="fair-review-system-fair-review-system:latest"
LOCAL_ZIP="fair-review-system.zip"

echo "🚀 Starting deployment to $SERVER_IP (shencha.lalws.cn)..."

# 1. Clean previous local zip
echo "🧹 Cleaning up old archive..."
rm -f "$LOCAL_ZIP"

# 2. Package the application (excluding heavy/local-only files; never upload local .env*)
echo "📦 Packaging application..."
cat > .deployignore << 'IGNORE_EOF'
node_modules/*
.next/*
.git/*
.tmp/*
.env
.env.*
fair-review-system.zip
data/*
prisma/*.db
prisma/*.db-*
prisma/*.local_backup
models/*
*.zip
dist_intranet/*
*.docx
*.doc
*.pdf
*.xlsx
*.html
IGNORE_EOF

zip -rq "$LOCAL_ZIP" . -x@.deployignore
rm -f .deployignore

# 3. Upload to server
echo "⬆️ Uploading code to server..."
ssh "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR/data"
scp "$LOCAL_ZIP" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"
rm -f "$LOCAL_ZIP"

# 4. Build image with resource guard and recreate only shencha service
echo "🔄 Building image and rolling unit-shencha on remote server..."
ssh "$SERVER_USER@$SERVER_IP" << EOF
    set -euo pipefail
    cd "$REMOTE_DIR"

    # Backup current image tag for instant rollback
    docker tag "$IMAGE_NAME" "fair-review-system-fair-review-system:backup-\$(date +%Y%m%d%H%M)" || true

    # Sync source directories cleanly (preserve server .env and data/)
    rm -rf src public prisma/migrations tests
    unzip -oq "$LOCAL_ZIP"
    rm -f "$LOCAL_ZIP"

    # Resource-bounded build on 2C/4G host so sibling containers stay smooth
    docker build --memory=1800m --memory-swap=3400m --cpu-quota=150000 -t "$IMAGE_NAME" .

    # Recreate only shencha service inside /opt/unit-sites/compose.json
    docker compose -f "$UNIT_COMPOSE" up -d --no-deps --force-recreate shencha

    echo "🗄 Syncing database schema..."
    docker exec unit-shencha prisma db push --skip-generate

    echo "🧹 Cleaning up dangling build cache & images..."
    docker builder prune -f
    docker image prune -f
EOF

echo "✅ Deployment complete! Verify https://shencha.lalws.cn"
