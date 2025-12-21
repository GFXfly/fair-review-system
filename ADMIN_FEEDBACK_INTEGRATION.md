# 管理后台集成反馈审核功能 - 说明文档

## 📁 已创建的文件

1. **反馈审核组件**
   - ✅ `src/app/felixgao/FeedbackReview.tsx` - 反馈审核面板组件
   - ✅ `src/app/felixgao/FeedbackReview.module.css` - 样式文件

## 🔧 如何集成到 /felixgao 页面

### Step 1: 导入组件

在 `src/app/felixgao/page.tsx` 文件顶部添加：

```tsx
import FeedbackReviewPanel from './FeedbackReview';
```

### Step 2: 添加 feedbacks Tab

找到第42行左右的 `activeTab` state声明，修改为包含 `feedbacks`：

```tsx
const [activeTab, setActiveTab] = useState('monitor'); // monitor, users, reviews, feedbacks, config
```

找到第67行的tab验证数组，添加 `feedbacks`：

```tsx
if (tab \u0026\u0026 ['monitor', 'users', 'reviews', 'feedbacks', 'config'].includes(tab)) {
    setActiveTab(tab);
}
```

### Step 3: 添加侧边栏菜单项

在第308-313行（"审计日志"和"系统配置"之间）添加新的菜单项：

```tsx
\u003cdiv
    className={`${styles.menuItem} ${activeTab === 'reviews' ? styles.menuItemActive : ''}`}
    onClick={() =\u003e handleTabChange('reviews')}
\u003e
    \u003cspan\u003e📑\u003c/span\u003e 审计日志
\u003c/div\u003e

{/* 添加这个 ⬇️ */}
\u003cdiv
    className={`${styles.menuItem} ${activeTab === 'feedbacks' ? styles.menuItemActive : ''}`}
    onClick={() =\u003e handleTabChange('feedbacks')}
\u003e
    \u003cspan\u003e💬\u003c/span\u003e 反馈审核
\u003c/div\u003e
{/* ⬆️ 添加结束 */}

\u003cdiv
    className={`${styles.menuItem} ${activeTab === 'config' ? styles.menuItemActive : ''}`}
    onClick={() =\u003e handleTabChange('config')}
\u003e
    \u003cspan\u003e⚙️\u003c/span\u003e 系统配置
\u003c/div\u003e
```

### Step 4: 添加内容区域

在第564-590行（'config' tab的内容之前）添加：

```tsx
{activeTab === 'reviews' \u0026\u0026 (
    \u003c\u003e
        {/* ... 现有的审计日志内容 ... */}
    \u003c/\u003e
)}

{/* 添加这个 ⬇️ */}
{activeTab === 'feedbacks' \u0026\u0026 (
    \u003cFeedbackReviewPanel /\u003e
)}
{/* ⬆️ 添加结束 */}

{activeTab === 'config' \u0026\u0026 (
    \u003c\u003e
        {/* ... 系统配置内容 ... */}
    \u003c/\u003e
)}
```

## 🎨 功能特性

### 反馈审核面板包含：

1. **待审核/全部** 筛选按钮
   - 待审核：只显示 `isAccurate=false` 且 `adminStatus=pending` 的反馈
   - 全部：显示所有反馈记录

2. **每条反馈显示**：
   - 📄 文件名
   - 👤 反馈用户（姓名+部门）
   - 🕐 反馈时间
   - 🤖 AI完整判断（风险等级、类型、描述、法规、建议）
   - 👤 用户反馈状态

3. **操作按钮**：
   - ✓ 通过（AI误判）- 绿色
   - ✗ 驳回（AI正确）- 红色
   - 📄 查看完整文档 - 跳转到review页面

4. **状态标识**：
   - 已审核的反馈显示"已通过"或"已驳回"badge
   - 待审核数量显示在标题旁

## 📊 数据流

```
用户提交反馈
    ↓
isAccurate: false
adminStatus: pending
    ↓
显示在"反馈审核"页面
    ↓
管理员审核
    ├─ 通过 → adminStatus: approved (AI误判)
    └─ 驳回 → adminStatus: rejected (AI正确)
```

## 🔜 可选增强功能

如果需要进一步增强，可以考虑：

1. **统计面板**
   ```tsx
   - 总反馈数
   - 待审核数
   - AI准确率（驳回数 / 总反馈数）
   - 本周新增反馈
   ```

2. **管理员评论**
   - 在"通过"/"驳回"时弹出modal，允许管理员填写审核意见

3. **批量操作**
   - 批量驳回/通过多个反馈

4. **导出功能**
   - 导出误判案例CSV，用于优化Prompt

## ✅ 集成完成检查清单

- [ ] 导入 `FeedbackReviewPanel` 组件
- [ ] 修改 `activeTab` 初始值和验证数组
- [ ] 添加侧边栏"反馈审核"菜单项
- [ ] 添加 `{activeTab === 'feedbacks' \u0026\u0026 (...)}` 渲染逻辑
- [ ] 测试页面切换
- [ ] 测试审核操作

## 🐛 常见问题

**Q: 点击菜单没反应？**
A: 检查 `activeTab` 验证数组是否包含 'feedbacks'

**Q: 样式不对？**
A: 确保 `FeedbackReview.module.css` 文件存在

**Q: API报错？**
A: 检查是否以管理员身份登录（`/api/feedback` 需要 admin 权限）

---

完成集成后，管理员就可以在 `/felixgao?tab=feedbacks` 查看和审核用户的反馈了！
