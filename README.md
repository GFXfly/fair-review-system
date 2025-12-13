# 公平竞争审查系统 v1.0

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![React](https://img.shields.io/badge/React-19.0-blue)

**AI驱动的政府文件公平竞争智能审查系统**

</div>

---

## 📖 项目简介

本系统是一套完整的公平竞争审查解决方案，基于《公平竞争审查条例》等法律法规，利用AI技术对政府政策文件、招标文件等进行智能审查，识别可能存在的限制竞争条款。

### 🎯 核心价值

- **提升审查效率**：AI智能审查，5分钟完成人工需1小时的工作
- **确保审查质量**：基于427个典型案例和120条法规的知识库
- **降低合规风险**：7大违规类型智能分类，精准定位问题
- **优化审查流程**：从文件上传到报告导出一站式解决

---

## ✨ 核心功能

### 1️⃣ 双AI智能审查

- **Gatekeeper（守门员）**：快速判断文件是否需要审查
- **Auditor（审计员）**：深度分析，识别具体风险点

### 2️⃣ 智能文档处理

- ✅ 支持`.docx`、`.pdf`格式
- ✅ 完美表格渲染（支持合并单元格）
- ✅ 5重风险点匹配策略
- ✅ 自动高亮显示风险位置

### 3️⃣ 知识库系统

- **427个典型案例**：涵盖国家、省、市各级通报案例
- **120条法规文件**：核心法规+官方Q&A
- **智能案例推荐**：7大违规类型精准匹配

### 4️⃣ 完整工作流

```
文件上传 → AI初筛 → 深度审查 → 风险识别 → 案例引用 → 报告导出
```

### 5️⃣ 用户管理

- 角色权限控制（管理员/普通用户）
- 审查记录追踪
- 审计日志记录

---

## 🏗️ 技术架构

### 前端技术栈

- **框架**: Next.js 16 (App Router)
- **UI库**: React 19
- **语言**: TypeScript
- **样式**: CSS Modules

### 后端技术栈

- **运行时**: Node.js 20+
- **数据库**: SQLite + Prisma ORM
- **AI服务**: DeepSeek API

### AI能力

- **文档解析**: mammoth.js (Word) + pdf-parse (PDF)
- **语义搜索**: 向量embeddings + RAG
- **智能分析**: 多Agent协作（Gatekeeper + Auditor）

---

## 🚀 快速开始

### 方法一：Docker部署（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/YOUR_USERNAME/fair-review-system.git
cd fair-review-system

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入您的 DeepSeek API Key

# 3. 一键部署
chmod +x deploy.sh
./deploy.sh

# 4. 访问系统
# http://localhost:3000
```

### 方法二：本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local

# 3. 初始化数据库
npx prisma migrate deploy
npx prisma generate

# 4. 导入基础数据
chmod +x scripts/restore_data.sh
./scripts/restore_data.sh

# 5. 启动开发服务器
npm run dev
```

---

## 📊 违规类型分类

系统将违规行为划分为7大类型：

| 类型 | 说明 | 关键词示例 |
|-----|------|----------|
| 1️⃣ 地域性限制 | 基于地理位置的区别对待 | 本地/外地、本省/外省 |
| 2️⃣ 所有制歧视 | 基于企业性质的区别对待 | 国企优先、排斥民企 |
| 3️⃣ 规模/业绩限制 | 设置过高的准入门槛 | 营收要求、纳税额 |
| 4️⃣ 资质/荣誉限制 | 要求特定资质或称号 | 示范企业、龙头企业 |
| 5️⃣ 指定交易/排他性 | 指定特定企业或品牌 | 指定供应商、限定品牌 |
| 6️⃣ 财政优惠/补贴 | 选择性财政支持 | 税收返还、定向补贴 |
| 7️⃣ 不合理准入/退出 | 设置不必要的障碍 | 不必要审批、迁出限制 |

---

## 📁 项目结构

```
公平竞争审查系统/
├── src/
│   ├── app/                    # Next.js页面
│   │   ├── api/               # API路由
│   │   ├── dashboard/         # 仪表板
│   │   ├── review/            # 审查详情页
│   │   ├── cases/             # 案例库
│   │   └── reports/           # 通报文件
│   ├── components/            # React组件
│   ├── lib/                   # 核心库
│   │   ├── agents/           # AI Agents
│   │   ├── file-parser.ts    # 文档解析
│   │   ├── rag.ts            # RAG检索
│   │   └── llm.ts            # AI调用
├── prisma/                    # 数据库
│   ├── schema.prisma         # 数据模型
│   └── dev.db                # SQLite数据库
├── scripts/                   # 工具脚本
│   ├── restore_data.sh       # 数据恢复
│   └── create_admin.ts       # 创建管理员
├── Dockerfile                 # Docker配置
├── docker-compose.yml         # Docker Compose
└── deploy.sh                  # 部署脚本
```

---

## 🔑 环境变量配置

创建`.env.local`文件：

```env
# DeepSeek API
DEEPSEEK_API_KEY=sk-your-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 数据库
DATABASE_URL="file:./dev.db"

# Session密钥（生产环境请更换）
SESSION_SECRET=your-random-secret-key-here
```

---

## 👥 默认账号

首次部署后，使用以下账号登录：

- **管理员账号**：`admin` / `admin123`

建议登录后立即修改密码！

---

## 📝 使用说明

### 1. 上传文档

1. 登录系统
2. 点击"上传文件"或拖拽文件到上传区
3. 等待AI分析（约30-60秒）

### 2. 查看审查结果

- **左侧**：文档内容，风险点自动高亮
- **右侧**：风险列表，点击可定位到文档位置
- **底部**：AI分析摘要

### 3. 导出报告

点击"导出报告"按钮，生成Word格式的审查意见书。

---

## 🛠️ 数据管理

### 恢复基础数据

```bash
# 恢复核心法规和案例
./scripts/restore_data.sh

# 恢复所有427个案例（可选）
./scripts/restore_all_cases.sh
```

### 创建管理员账号

```bash
npx tsx scripts/create_admin_felix.ts
```

---

## 🔄 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新部署
./deploy.sh
```

**注意**：更新不会影响现有数据和用户账号！

---

## 📊 系统性能

- **文档解析**：支持最大10MB的Word/PDF文件
- **AI分析速度**：30-60秒/文档
- **并发处理**：支持多用户同时使用
- **知识库规模**：427个案例 + 120条法规

---

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发规范

1. 遵循TypeScript严格模式
2. 使用Prettier格式化代码
3. 提交前运行`npm run build`确保无错误

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE)

---

## 💬 联系方式

- **作者**: Felix Gao
- **项目地址**: [GitHub Repository](https://github.com/YOUR_USERNAME/fair-review-system)

---

## 🙏 致谢

感谢以下开源项目：

- [Next.js](https://nextjs.org/)
- [Prisma](https://www.prisma.io/)
- [DeepSeek](https://www.deepseek.com/)
- [mammoth.js](https://github.com/mwilliamson/mammoth.js)

---

<div align="center">

**⭐️ 如果这个项目对您有帮助，请给个Star！⭐️**

Made with ❤️ by Felix Gao

</div>
