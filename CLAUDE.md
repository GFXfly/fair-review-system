# CLAUDE.md — 公平竞争审查系统

本文件只记录**读代码读不出来的东西**。目录结构、依赖清单、API 签名请直接看代码和 `package.json`，不要往这里抄。

项目介绍和部署步骤见 `README.md`，当前进度见 `ROADMAP.md`。

---

## 必须知道的坑

### 构建必须带 `--webpack`

`package.json` 里 `dev` 和 `build` 都显式加了 `--webpack`。Next 16 默认用 Turbopack，本项目**不能用**——`next.config.ts` 里有一段 `webpack()` 回调，把 `@xenova/transformers` 和 `sharp` 声明成 commonjs external，Turbopack 不走这个回调，构建产物会在运行时炸。

**不要删这个 flag，也不要"顺手升级到 Turbopack"。**

### 列表接口绝不能返回全文字段

`ReviewRecord` 上的 `originalText` / `originalHtml` 是整篇文档的全文，单条可达数百 KB。

- `GET /api/reviews`（列表）必须用 `select` 白名单，**排除**这两个字段。用 `include` 会把 20 条记录的全文一起 JSON 序列化，首屏延迟 1–2 秒。
- 需要全文的只有详情页，走 `GET /api/reviews/[id]`。

改这个接口时，先确认没有前端消费方依赖全文——目前消费列表接口的是 `src/app/ledger/page.tsx`、`src/app/dashboard/page.tsx`、`src/app/felixgao/page.tsx`，三个都只用元数据。

### PDF 解析用的是 fork，不是原包

依赖是 `pdf-parse-fork` 而非 `pdf-parse`。原包在 import 时会尝试读一个测试文件导致构建失败，不要"修正"成原包。

### 两个 AI 服务缺一不可

- `DEEPSEEK_API_KEY` → LLM 推理（gatekeeper / auditor / debate）
- `SILICONFLOW_API_KEY` → 向量 embedding（RAG 检索）

只配一个的话，审查流程会在中途静默降级而不是报错。

---

## Agent 流水线

`src/lib/agents/` 下六个模块不是平级的，调用顺序有依赖：

```
gatekeeper（判断是否需要审查，可提前终止）
   └→ radar（扫出候选风险片段）
        └→ retrieval（Agentic RAG：查询重写 + 迭代检索案例/法规）
             └→ auditor（逐条深度认定）
                  └→ debate（对抗复核，置信度低于 DISMISS_CONFIDENCE_THRESHOLD 才推翻）
                       └→ guidance_counselor（出整改建议）
```

改任何一个 agent 的输出结构，下游都要跟着改。`retrieval` 可以用 `ENABLE_AGENTIC_RAG=false` 关掉退回朴素检索，用于隔离问题。

---

## `scripts/` 是历史沉淀，不是工具库

`scripts/` 下有 200 多个 `.ts` / `.js` 文件，绝大多数是一次性的案例导入、数据修补、排查脚本（`add_*`、`fix_*`、`check_*`、`debug_*`、`update_*`）。它们：

- **不是 API，不要 import**；
- **不要重构、不要合并、不要清理**——它们是数据来源的可追溯记录；
- 新的一次性脚本继续按 `动词_对象.ts` 命名扔进去即可。

真正会反复用到的只有这几个：

| 脚本 | 用途 |
|---|---|
| `scripts/restore_data.sh` | 恢复核心法规 + 案例基础数据 |
| `scripts/restore_all_cases.sh` | 恢复全部 427 个案例 |
| `scripts/create_admin_felix.ts` | 建管理员账号 |
| `scripts/generate_all_embeddings.ts` | 重算全库 embedding（换 embedding 模型后必跑） |
| `scripts/export_intranet.sh` | 打内网离线包 |

---

## 数据与部署

- 数据库是 SQLite，`prisma/dev.db`。**`.gitignore` 里所有 `*.db` 都排除**，数据不进仓库，靠 `scripts/restore_data.sh` 重建。
- 生产环境是**内网离线部署**，没有公网。相关文件：`intranet_deploy.txt`、`shencha_nginx.conf`、`scripts/export_intranet.sh`、`deploy.sh`。内网机器装不了包，依赖必须随包带过去——`prepare_offline.ts` 就是干这个的。
- `models/` 被 gitignore（本地 embedding 模型权重，体积大）。

---

## 红线

- **`.env*` 全部 gitignore，任何情况下不提交、不打印、不写进日志。** 仓库里已有 `.env`、`.env.local`、`.env.backup`、`.env.local.backup` 四份，都含真实 key。
- 不要为了让构建过去而注释报错、加 `@ts-ignore` 或 `eslint-disable`，先找根因。
- 数据库 schema 变更（`prisma/schema.prisma`）和数据迁移必须先说明方案再动手。
- 部署（`deploy.sh`、内网导包）属于发布动作，必须先确认。

---

## 提交规范

- 分支：`main` 日常开发。
- 提交前跑 `npm run build`（不是只跑 `tsc --noEmit`——webpack external 那段只有 build 才验证得到）。
- Commit 信息中文，前缀 `feat:` / `fix:` / `refactor:` / `docs:` / `chore:`，说清楚改了什么、为什么改。不写「优化代码」「修复 bug」这类空话。
