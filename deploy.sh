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
echo "prisma/*.db" >> .deployignore
echo "prisma/dev.db" >> .deployignore
echo "models/*" >> .deployignore
echo "*.zip" >> .deployignore
echo "dist_intranet/*" >> .deployignore

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
    # Update permission for scripts
    chmod +x scripts/*.ts
    
    # Run database migration (if needed)
    docker compose up -d

    # Wait for container to be ready
    # Run the user creation script inside the container (Optional: Commented out to save time on updates)
    # echo "Using Docker container to run batch user creation..."
    # docker exec fair-review-system sh -c "
    #   npm install pinyin-pro xlsx && \
    #   node scripts/batch_create_users.js
    # "
    
    # Copy the Excel file from container to host (Optional)
    # docker cp fair-review-system:/app/user_accounts_server.xlsx ./user_accounts_server.xlsx
EOF

# 5. Download the Excel file to local
echo "⬇️ Downloading generated user accounts..."
scp $SERVER_USER@$SERVER_IP:~/fair-review-system/user_accounts_server.xlsx ./user_accounts_server.xlsx

echo "✅ Deployment complete! App is running on port 3005 and domain shencha.site should be active."
echo "✅ User accounts Excel downloaded to ./user_accounts_server.xlsx"
echo "🎉 All Done! Visit http://$SERVER_IP:3005 if you haven't configured Nginx yet."
