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

---

## 进行中

无。上一处未提交改动已于 2026-07-25 验证并合入。

---

## 待办

（待确认——此前的待办事项没有书面记录，需要补齐后填入。）

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

> 注意：只跑 `tsc --noEmit` 不够。`next.config.ts` 里的 webpack external 配置只有完整 build 才验证得到。
