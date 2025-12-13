#!/bin/bash

echo "🔄 开始完整恢复所有案例..."
echo ""

# 所有NDRC批次
echo "📋 导入所有NDRC案例..."
npx tsx scripts/add_ndrc_batch1_cases.ts
npx tsx scripts/add_ndrc_batch3_cases.ts
npx tsx scripts/add_ndrc_batch4_cases.ts
npx tsx scripts/add_ndrc_cases_5.ts
npx tsx scripts/add_ndrc_sixth_batch_cases.ts
npx tsx scripts/add_ndrc_q4_2021_cases.ts

# 所有SAMR批次
echo "📋 导入所有SAMR案例..."
npx tsx scripts/add_samr_2021_cases.ts
npx tsx scripts/add_samr_2021_cases_part2.ts
npx tsx scripts/add_samr_2022_batch1_cases.ts
npx tsx scripts/add_samr_2022_batch2_cases.ts
npx tsx scripts/add_samr_batch3.ts
npx tsx scripts/add_samr_batch5_cases.ts
npx tsx scripts/add_samr_cases_2022.ts
npx tsx scripts/add_samr_cases_feb2024.ts

# 地方案例
echo "📋 导入地方案例..."
npx tsx scripts/add_beijing_cases_2022.ts
npx tsx scripts/add_chongqing_2023_cases.ts
npx tsx scripts/add_gansu_cases_jan2024.ts
npx tsx scripts/add_jiangsu_2023_cases.ts
npx tsx scripts/add_jiangsu_cases_2024.ts
npx tsx scripts/add_jiangxi_cases_2025_12.ts
npx tsx scripts/add_liaoning_cases_2024.ts
npx tsx scripts/add_nanjing_cases_2024.ts
npx tsx scripts/add_shandong_cases_2023_formatted.ts
npx tsx scripts/add_shanxi_cases.ts
npx tsx scripts/add_kunming_cases.ts
npx tsx scripts/add_puer_cases_2024.ts
npx tsx scripts/add_taizhou_cases.ts
npx tsx scripts/add_wuxi_cases_2024.ts
npx tsx scripts/add_yangzhou_cases_2025.ts
npx tsx scripts/add_yancheng_cases_1.ts
npx tsx scripts/add_yancheng_cases_2.ts

# 其他批次
echo "📋 导入其他批次案例..."
npx tsx scripts/add_may2023_cases.ts
npx tsx scripts/add_first_batch_cases.ts
npx tsx scripts/add_national_cases_official.ts

echo ""
echo "✅ 所有案例恢复完成！"
npx tsx scripts/count_all_cases.ts
