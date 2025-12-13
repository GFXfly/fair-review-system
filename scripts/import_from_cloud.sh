#!/bin/bash

echo "📥 从云服务器下载核心数据..."
echo ""

# 创建临时目录
mkdir -p /tmp/db_export

# SSH到云服务器，导出Regulation和Case表
echo "1️⃣ 导出法规库和案例库..."
ssh root@shencha.site << 'ENDSSH'
cd /root/gfx-review-system
sqlite3 prisma/dev.db << 'EOF'
.output /tmp/regulations.sql
.mode insert Regulation
SELECT * FROM Regulation;
.output /tmp/cases.sql
.mode insert Case
SELECT * FROM Case;
.output /tmp/reports.sql
.mode insert Report
SELECT * FROM Report;
.quit
EOF
echo "✅ 导出完成"
ENDSSH

echo ""
echo "2️⃣ 下载导出文件..."
scp root@shencha.site:/tmp/regulations.sql /tmp/db_export/
scp root@shencha.site:/tmp/cases.sql /tmp/db_export/
scp root@shencha.site:/tmp/reports.sql /tmp/db_export/

echo ""
echo "3️⃣ 导入到本地数据库..."
sqlite3 prisma/dev.db < /tmp/db_export/regulations.sql
sqlite3 prisma/dev.db < /tmp/db_export/reports.sql
sqlite3 prisma/dev.db < /tmp/db_export/cases.sql

echo ""
echo "4️⃣ 清理临时文件..."
rm -rf /tmp/db_export
ssh root@shencha.site "rm -f /tmp/regulations.sql /tmp/cases.sql /tmp/reports.sql"

echo ""
echo "✅ 数据导入完成！"
npx tsx scripts/count_regulations.ts
npx tsx scripts/count_all_cases.ts
