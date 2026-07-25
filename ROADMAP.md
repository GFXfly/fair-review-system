# ROADMAP — 公平竞争审查系统

> 本文件是项目真实进度源。只有**已实现并验证过**的事项才能进「已完成」；没核实的写「待确认」，不猜。
> 项目介绍看 `README.md`，协作约定看 `CLAUDE.md`。

**最后更新：2026-07-25**

---

## 当前阶段

功能已完整可用，处于**维护与性能打磨**阶段。核心审查流程（上传 → 双 AI 审查 → 风险定位 → 案例引用 → Word 报告导出）已跑通并在内网部署使用。

近期工作集中在首屏加载性能，不在新功能。

---

## 已完成（已验证）

- 完整审查流水线：gatekeeper → radar → retrieval → auditor → debate → guidance_counselor
- Agentic RAG 检索（v2.3，`src/lib/agents/retrieval.ts`）：查询重写 + 迭代检索 + 多查询融合
- 知识库：427 个典型案例 + 120 条法规，向量 embedding 检索
- 文档解析：`.docx`（mammoth）+ `.pdf`（pdf-parse-fork），表格与合并单元格渲染
- 文档原文高保真还原（docx-preview）+ 风险点高亮定位
- 用户体系：登录鉴权（iron-session）、管理员/普通用户角色、审计日志、限流
- Word 审查意见书导出
- 内网离线部署链路：`deploy.sh`、`scripts/export_intranet.sh`、`shencha_nginx.conf`
- **审查列表接口性能优化**（2026-07-25 验证并提交）：`GET /api/reviews` 改用 `select` 白名单，排除 `originalText` / `originalHtml` 两个全文大字段，消除首屏 1–2 秒延迟
- **项目规范补齐**（2026-07-25）：新增 `CLAUDE.md`、`ROADMAP.md`
- **移除仪表盘假预警数据**（2026-07-25）：「🚨 预警消息」面板此前是硬编码的示例条目，真实用户会当成实际风险提示。改为空态，等接入真实数据源
- **移除仪表盘调试日志**（2026-07-25）：列表加载时会把文件名和用户名打印到浏览器控制台
- **拆分 `src/app/dashboard/page.tsx`**（2026-07-25，构建已验证，浏览器冒烟待人工确认）：993 行拆成 10 个文件，主文件降至 202 行。上传/审查与知识库状态抽成 `use-review-submit.ts`、`use-knowledge-base.ts` 两个 hook，**仍在 `page.tsx` 中调用**，以保证 tab 切换时进行中的审查不被打断（这是拆分中唯一的行为风险点）。`page.module.css` 未改动
- **补齐 dashboard 类型定义并删除死代码**（2026-07-25）：新增 `dashboard/types.ts`（`DashboardUser` / `ReviewRecordSummary` / `KnowledgeItem`，字段以各 API 路由实际的 `select` 为准），替换该目录全部业务 `any`；删除零引用的 `formatAction`

---

## 进行中

无。

---

## 待办

以下条目来自 2026-07-25 的前端代码审查，按优先级排列。

**中**
- 知识库改服务端分页。`/api/regulations` 与 `/api/cases` 目前把全量数据返回前端再 `slice()` 分页（`dashboard/page.tsx:719`、`:792`）。与 2026-07-25 修掉的 reviews 全文问题同源，案例数继续增长会重演首屏卡顿。
- 收敛 26 处原生 `alert()` 为统一提示组件（`felixgao/page.tsx` 14 处、`dashboard/page.tsx` 8 处、其余 4 处）。

**低**
- 内联 `style={{}}` 与 CSS Modules 混用（散落在 `dashboard/` 各组件与 `felixgao/`）。不影响正确性。
- `dashboard/use-knowledge-base.ts` 里按 `[activeTab]` 触发的 `useEffect` 依赖数组不完整（body 内使用了 `searchQuery`）。当前因有独立的 `handleSearch` 按钮兜底，行为正确，ESLint `exhaustive-deps` 会报警。

**明确不做**
- `dashboard/use-review-submit.ts` 里两处 `catch (e: any)`：TypeScript 的 catch 绑定只能是 `any` 或 `unknown`，而代码要读 `error.message` / `error.suggestion`。改成 `unknown` 需要加类型守卫，收益不抵改动风险。
- `src/app/review/[id]/` 与 `src/components/` 结构健康，不重构。

---

## 阻塞与风险

- **构建期反复输出 `CRITICAL: SESSION_SECRET must be set in production!`**
  `npm run build` 过程中该告警出现 3 次，但构建成功（exit 0）。属于既有问题，非本次改动引入。需确认：是构建期误报（静态生成时读不到 `.env.local`），还是生产环境真的缺这个变量。**在确认之前不要当成无害告警忽略**——它关系到 session 加密。

- **版本号不一致**
  `package.json` 写 `1.3.0`，`CHANGELOG.md` 最新条目是 `v2.3`（2026-01-01），`README.md` 标题写 `v1.0`。三处对不上，需要定一个真实版本号并统一。

- **`.env` 类文件有 4 份**（`.env`、`.env.local`、`.env.backup`、`.env.local.backup`），都含真实 key。虽已被 `.gitignore` 排除，但备份文件散落容易误操作，建议收敛。

- **`scripts/` 已积累 200+ 一次性脚本**。按 `CLAUDE.md` 的约定不清理（保留数据来源可追溯性），但新人进入项目会被误导，已在 `CLAUDE.md` 中写明其性质。

---

## 最近验证

| 日期 | 验证内容 | 结果 |
|---|---|---|
| 2026-07-25 | `npx tsc --noEmit` | ✅ 通过，无类型错误 |
| 2026-07-25 | `npm run build`（webpack） | ✅ 通过，21 个页面 + 16 个 API 路由全部构建成功 |
| 2026-07-25 | `npm run build`（移除假预警数据与调试日志后复验） | ✅ 通过 |
| 2026-07-25 | `npm run build`（dashboard 拆分后复验） | ✅ `Compiled successfully`，21 个页面全部生成 |
| — | dashboard 拆分的浏览器冒烟测试 | ⏳ **未做**，需人工在 `npm run dev` 下逐项确认，重点是「审查进行中切 tab 再切回，进度条不重置」 |

> 注意：只跑 `tsc --noEmit` 不够。`next.config.ts` 里的 webpack external 配置只有完整 build 才验证得到。
