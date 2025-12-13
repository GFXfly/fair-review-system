#!/bin/bash

echo "🔄 开始恢复数据库..."
echo ""

# 核心法规
echo "📚 导入核心法规..."
npx tsx scripts/update_regulations_batch1.ts
npx tsx scripts/update_regulations_batch2.ts  
npx tsx scripts/update_regulations_batch3.ts

# 典型案例 - NDRC批次
echo "📋 导入NDRC案例..."
npx tsx scripts/add_ndrc_batch1_cases.ts
npx tsx scripts/add_ndrc_batch3_cases.ts
npx tsx scripts/add_ndrc_batch4_cases.ts
npx tsx scripts/add_ndrc_sixth_batch_cases.ts

# 典型案例 - SAMR批次
echo "📋 导入SAMR案例..."
npx tsx scripts/add_samr_2021_cases.ts
npx tsx scripts/add_samr_2022_batch1_cases.ts
npx tsx scripts/add_samr_batch5_cases.ts

# Q&A
echo "❓ 导入Q&A..."
npx tsx scripts/add_hybrid_qa.ts

echo ""
echo "✅ 数据恢复完成！"
