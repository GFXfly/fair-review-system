# HTTPS 部署指南

本文档说明如何为公平竞争审查系统配置HTTPS，确保会话Cookie的安全传输。

## 前提条件

- 服务器IP: `43.143.47.221`
- 域名: `shencha.site` 和 `www.shencha.site`
- 域名已正确解析到服务器IP
- 服务器已安装Nginx

## 修改说明

### 已完成的代码修改

1. **会话Cookie安全配置** (`src/lib/session.ts:15`)
   - ✅ 已修改为: `secure: process.env.NODE_ENV === 'production'`
   - 生产环境自动启用HTTPS-only Cookie

2. **Docker环境配置** (`docker-compose.yml:13`)
   - ✅ 已添加: `NODE_ENV=production`
   - 确保生产环境正确识别

3. **Nginx配置** (`shencha_nginx.conf`)
   - ✅ 已配置HTTP到HTTPS自动重定向
   - ✅ 已添加SSL证书配置
   - ✅ 已添加安全头部 (HSTS, X-Frame-Options等)

---

## 部署步骤

### 步骤1: 安装Certbot (Let's Encrypt客户端)

SSH登录到服务器，执行以下命令：

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y
```

### 步骤2: 获取SSL证书

```bash
# 停止Nginx（如果正在运行）
sudo systemctl stop nginx

# 使用standalone模式获取证书
sudo certbot certonly --standalone -d shencha.site -d www.shencha.site

# 或者使用webroot模式（Nginx继续运行）
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d shencha.site -d www.shencha.site
```

按照提示：
1. 输入邮箱地址（用于证书过期提醒）
2. 同意服务条款
3. 等待验证完成

证书将保存在：
- 证书: `/etc/letsencrypt/live/shencha.site/fullchain.pem`
- 私钥: `/etc/letsencrypt/live/shencha.site/privkey.pem`

### 步骤3: 验证证书文件

```bash
sudo ls -la /etc/letsencrypt/live/shencha.site/
```

确保看到以下文件：
- `fullchain.pem`
- `privkey.pem`
- `cert.pem`
- `chain.pem`

### 步骤4: 设置证书自动续期

Let's Encrypt证书有效期为90天，需要定期续期。

```bash
# 测试自动续期
sudo certbot renew --dry-run

# 添加自动续期任务（每天凌晨2点检查）
sudo crontab -e

# 添加以下行
0 2 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

### 步骤5: 部署更新的配置

在本地执行部署脚本：

```bash
# 在项目根目录执行
./deploy.sh
```

部署脚本会自动：
1. 打包项目
2. 上传到服务器
3. 重新构建Docker容器
4. 复制更新的Nginx配置
5. 重新加载Nginx

### 步骤6: 验证HTTPS

1. **测试HTTP重定向**
   ```bash
   curl -I http://shencha.site
   # 应该看到: HTTP/1.1 301 Moved Permanently
   # Location: https://shencha.site/
   ```

2. **测试HTTPS访问**
   ```bash
   curl -I https://shencha.site
   # 应该看到: HTTP/2 200
   ```

3. **浏览器测试**
   - 访问 http://shencha.site（应自动跳转到HTTPS）
   - 访问 https://shencha.site（应显示绿色锁图标）
   - 检查Cookie设置（F12 > Application > Cookies）
     - `fair_competition_session` 应该标记为 `Secure` 和 `HttpOnly`

### 步骤7: 安全验证

使用在线工具测试SSL配置：

1. **SSL Labs测试**
   ```
   https://www.ssllabs.com/ssltest/analyze.html?d=shencha.site
   ```
   目标等级: A 或 A+

2. **检查安全头部**
   ```bash
   curl -I https://shencha.site | grep -E "(Strict-Transport|X-Frame|X-Content|X-XSS)"
   ```

   应该看到：
   ```
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   X-Frame-Options: SAMEORIGIN
   X-Content-Type-Options: nosniff
   X-XSS-Protection: 1; mode=block
   ```

---

## 故障排查

### 问题1: Certbot验证失败

**原因**: 端口80被占用或防火墙阻止

**解决方案**:
```bash
# 检查80端口
sudo netstat -tulpn | grep :80

# 临时停止Nginx
sudo systemctl stop nginx

# 重新获取证书
sudo certbot certonly --standalone -d shencha.site -d www.shencha.site

# 启动Nginx
sudo systemctl start nginx
```

### 问题2: Nginx启动失败

**原因**: SSL证书路径错误

**解决方案**:
```bash
# 检查Nginx配置
sudo nginx -t

# 查看详细错误
sudo tail -f /var/log/nginx/error.log

# 检查证书路径
sudo ls -la /etc/letsencrypt/live/shencha.site/
```

### 问题3: Cookie仍然不是Secure

**原因**: NODE_ENV未正确设置

**解决方案**:
```bash
# 进入容器检查环境变量
docker exec -it fair-review-system env | grep NODE_ENV
# 应该输出: NODE_ENV=production

# 如果不是，重新构建容器
cd /root/fair-review-system
docker-compose down
docker-compose up -d --build
```

### 问题4: 混合内容警告

**原因**: 页面中包含HTTP资源

**解决方案**:
```bash
# 检查是否有硬编码的HTTP链接
grep -r "http://" src/
grep -r "http://" public/

# 确保所有外部资源使用HTTPS或相对路径
```

---

## 安全最佳实践

### 1. 定期检查证书过期时间

```bash
# 查看证书有效期
sudo certbot certificates
```

### 2. 监控SSL配置评分

每月检查一次 SSL Labs 评分，确保维持 A 级以上。

### 3. 更新SSL配置

当发现新的安全漏洞时，及时更新Nginx SSL配置：

```bash
# 编辑配置文件
sudo nano /etc/nginx/conf.d/shencha.conf

# 测试配置
sudo nginx -t

# 重新加载
sudo systemctl reload nginx
```

### 4. 启用OCSP Stapling（可选）

在 `shencha_nginx.conf` 的HTTPS server块中添加：

```nginx
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/shencha.site/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

---

## 验证清单

部署后请确认以下各项：

- [ ] 访问 http://shencha.site 自动跳转到 https://shencha.site
- [ ] 浏览器地址栏显示绿色锁图标
- [ ] Cookie `fair_competition_session` 标记为 `Secure` 和 `HttpOnly`
- [ ] SSL Labs测试评分 >= A
- [ ] 响应头包含 `Strict-Transport-Security`
- [ ] 响应头包含 `X-Frame-Options: SAMEORIGIN`
- [ ] 响应头包含 `X-Content-Type-Options: nosniff`
- [ ] 响应头包含 `X-XSS-Protection: 1; mode=block`
- [ ] 登录功能正常
- [ ] 文件上传功能正常
- [ ] 审查分析功能正常

---

## 回滚方案

如果HTTPS配置出现问题，可以临时回滚到HTTP：

```bash
# SSH到服务器
ssh root@43.143.47.221

# 恢复旧的Nginx配置
sudo cat > /etc/nginx/conf.d/shencha.conf << 'EOF'
server {
    listen 80;
    server_name shencha.site www.shencha.site;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_set_header Host $host;
        client_max_body_size 50M;
        proxy_read_timeout 300s;
    }
}
EOF

# 重新加载Nginx
sudo nginx -t && sudo systemctl reload nginx

# 修改容器环境变量（临时）
docker exec -it fair-review-system /bin/sh -c "export NODE_ENV=development"
docker restart fair-review-system
```

**注意**: 回滚后会话Cookie将不再安全，仅用于紧急情况。

---

## 联系支持

如果遇到问题，请检查：
1. Nginx错误日志: `sudo tail -f /var/log/nginx/error.log`
2. 容器日志: `docker logs fair-review-system`
3. Certbot日志: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`

---

**最后更新**: 2025-12-18
**文档版本**: 1.0
