
# 部署说明 (Deployment Guide)

本指南帮助您将「公平竞争审查系统」部署到腾讯云服务器。

## 1. 准备工作

在您的本地电脑上，确保所有文件（代码、`Dockerfile`、`docker-compose.yml`）都已经存在。
特别是 `next.config.ts` 中必须包含 `output: 'standalone'`（已为您配置好）。

## 2. 上传代码到服务器

您可以使用 SFTP 工具（如 FileZilla）或 `scp` 命令将项目上传到服务器。
假设上传到服务器的 `/root/fair-review-system` 目录。

```bash
# 示例：压缩项目 (排除 node_modules 和 .next 以加快上传)
zip -r fair-review-system.zip . -x "node_modules/*" -x ".next/*" -x ".git/*"

# 上传 (请替换您的服务器IP)
scp fair-review-system.zip root@43.143.47.221:/root/
```

## 3. 在服务器上构建并运行

登录您的服务器：
```bash
ssh root@43.143.47.221
```

解压并进入目录：
```bash
unzip fair-review-system.zip -d fair-review-system
cd fair-review-system
```

创建数据目录（用于持久化 SQLite 数据库）：
```bash
mkdir -p data
```

**如果您有现有的 dev.db 想要保留，请将其上传到服务器的 `fair-review-system/data/` 目录下。**
如果没有，系统会自动创建一个新的。

启动服务：
```bash
docker-compose up -d --build
```

查看日志确认启动成功：
```bash
docker-compose logs -f
```

## 4. 初始化数据库 (如果是新数据库)

如果这是第一次运行且没有上传旧的 `.db` 文件，您需要初始化数据库结构。

进入容器：
```bash
docker exec -it fair-review-system sh
```

在容器内执行 Prisma 命令：
```bash
# 生成数据库表
npx prisma db push

# (可选) 植入初始管理员账号 admin / admin123
npx tsx scripts/seed_user.ts
```

退出容器：
```bash
exit
```

## 5. 配置 Nginx (反向代理)

由于您的服务器上已经运行了其他项目，建议为您当前的域名 `shencha.site` 添加一个新的 Nginx 配置。

编辑 Nginx 配置文件（路径可能因安装方式不同而异，通常在 `/etc/nginx/sites-available/` 或 `/etc/nginx/conf.d/`）：

```nginx
server {
    listen 80;
    server_name shencha.site;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

重新加载 Nginx：
```bash
nginx -t
systemctl reload nginx
```

现在，访问 http://shencha.site 应该就能看到您的系统了！
