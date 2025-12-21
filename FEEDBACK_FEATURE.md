# 风险反馈功能 - 使用说明

## 📁 已创建的文件

1. **数据库**
   - ✅ `prisma/schema.prisma` - 添加了 `RiskFeedback` 模型
   - ✅ Migration 已生成并应用

2. **API**
   - ✅ `src/app/api/feedback/route.ts` - 提交和获取反馈
   - ✅ `src/app/api/feedback/[id]/route.ts` - 管理员审核

3. **组件**
   - ✅ `src/components/RiskFeedback.tsx` - 反馈按钮组件
   - ✅ `src/components/RiskFeedback.module.css` - 组件样式

## 🔧 如何在 Review 页面使用

### 方法1：在风险详情页面底部添加

在 `src/app/review/[id]/page.tsx` 中：

#### 1. 导入组件
```tsx
import RiskFeedback from '@/components/RiskFeedback';
```

#### 2. 在风险详情展示的末尾添加（约第1249行）

找到"修改建议"section的结束位置，在 `\u003c/div\u003e` 之前添加：

```tsx
                                        \u003cdiv className={styles.detailSection}\u003e
                                            \u003cdiv className={styles.detailTitle}\u003e💡 修改建议\u003c/div\u003e
                                            \u003cdiv className={styles.suggestionBox}\u003e
                                                {activeRisk.suggestion}
                                            \u003c/div\u003e
                                        \u003c/div\u003e

                                        {/* 添加这部分 ⬇️ */}
                                        \u003cRiskFeedback
                                            reviewId={id}
                                            riskId={activeRisk.id}
                                        /\u003e
                                        {/* ⬆️ 添加结束 */}
                                    \u003c/div\u003e
```

### 方法2：在每个风险卡片上添加（可选）

如果想在风险列表卡片上也显示反馈按钮，可以在第1158行附近添加：

```tsx
{risks.map(risk =\u003e (
    \u003cdiv key={risk.id} className={styles.riskCard}\u003e
        \u003cdiv className={styles.cardHeader}\u003e
            \u003cspan className={styles.riskType}\u003e{risk.type}\u003c/span\u003e
            \u003cspan className={styles.riskLevel}\u003e
                {risk.level === 'high' ? '🔴 高风险' : '🟡 疑似风险'}
            \u003c/span\u003e
        \u003c/div\u003e
        \u003cdiv className={styles.riskTitle}\u003e{risk.title}\u003c/div\u003e
        \u003cdiv className={styles.riskSnippet}\u003e"{risk.snippet}"\u003c/div\u003e
        
        {/* 添加这部分（可选）⬇️ */}
        \u003cdiv style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '12px' }}\u003e
            \u003cRiskFeedback reviewId={id} riskId={risk.id} /\u003e
        \u003c/div\u003e
        {/* ⬆️ 添加结束 */}
    \u003c/div\u003e
))}
```

## 📊 API 端点

### 用户提交反馈
```
POST /api/feedback
Body: {
  reviewId: string,
  riskId: number,
  isAccurate: boolean
}
```

### 管理员获取待审核列表
```
GET /api/feedback?onlyNeedReview=true
```

### 管理员审核
```
PATCH /api/feedback/:id
Body: {
  adminStatus: "approved" | "rejected",
  adminComment?: string
}
```

## 🎨 组件特性

- ✅ 一键提交，无需填写原因
- ✅ 防重复提交
- ✅ 即时UI反馈（按钮变灰+文字变更）
- ✅ 错误处理和用户提示
- ✅ 简洁美观的样式

## 🔜 下一步：管理后台

需要在 `/felixgao` 页面添加反馈审核功能。

建议添加新的Tab：
- "反馈审核" - 显示待审核的反馈列表
- 每条反馈显示：风险信息、用户名、反馈时间
- 提供"通过"和"驳回"按钮

## 🐛 如需帮助

如果在集成过程中遇到问题：
1. 检查imports是否正确
2. 确保reviewId和riskId传递正确
3. 查看浏览器Console的错误日志
4. 检查API返回的错误信息
