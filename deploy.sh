#!/bin/bash

# Configuration - Change these if needed
SERVER_IP="43.143.47.221"
SERVER_USER="root"
REMOTE_DIR="/root/fair-review-system"
LOCAL_ZIP="fair-review-system.zip"

echo "🚀 Starting deployment to $SERVER_IP..."

# 1. Clean previous build artifacts
echo "🧹 Cleaning up old builds..."
rm -f $LOCAL_ZIP
rm -rf .next

# 2. Package the application
echo "📦 Packaging application (excluding heavy files)..."
# Create a temporary exclusion file
echo "node_modules/*" > .deployignore
echo ".next/*" >> .deployignore
echo ".git/*" >> .deployignore
echo ".env.local" >> .deployignore
echo "$LOCAL_ZIP" >> .deployignore
echo "data/*" >> .deployignore 

zip -r $LOCAL_ZIP . -x@.deployignore
rm .deployignore

# 3. Upload to server
echo "mb Uploading code to server..."
ssh $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_DIR/data"
scp $LOCAL_ZIP $SERVER_USER@$SERVER_IP:$REMOTE_DIR/

# 4. Execute remote commands
echo "🔄 building and restarting containers on remote server..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
    cd /root/fair-review-system
    
    # Unzip over existing files
    unzip -o fair-review-system.zip
    rm fair-review-system.zip


    # Update permission for scripts
    chmod +x scripts/*.ts
    
    # Ensure data directory exists and is writable by the container user (1001)
    mkdir -p data
    chown -R 1001:1001 data
    chmod -R 777 data


    # Rebuild and restart container
    docker-compose down
    docker-compose up -d --build

    # Run DB migration (if schema changed)
    echo "🗄 Syncing database schema..."
    # Use global prisma installed in Dockerfile
    docker exec fair-review-system prisma db push

    # Ensure Admin Role
    echo "👑 Configure Admin..."
    docker exec fair-review-system node scripts/ensure_admin.js

    # Setup Nginx
    echo "🌍 Configuring Nginx..."
    yes | cp shencha_nginx.conf /etc/nginx/conf.d/shencha.conf
    nginx -t && systemctl reload nginx

    # Clean up unused images
    docker image prune -f

    echo "✅ Deployment complete! App is running on port 3005 and domain shencha.site should be active."
EOF

echo "🎉 All Done! Visit http://$SERVER_IP:3005 if you haven't configured Nginx yet."
