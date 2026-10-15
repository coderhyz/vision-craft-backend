# Vision-Craft 后端

Vision-Craft 的后端服务，基于 Express + TypeScript 构建，负责用户认证、页面 Schema 持久化、AI 大屏生成。

## 技术栈

| 分类 | 技术 | 说明 |
|---|---|---|
| 运行环境 | Node.js | JavaScript 运行时 |
| 语言 | TypeScript 5.9 | 类型检查和 ESM 模块 |
| Web 框架 | Express 4 | HTTP API 和 SSE 接口 |
| 数据库 | MongoDB + Mongoose | 用户和页面数据持久化 |
| 身份认证 | JWT + bcryptjs | 登录鉴权和密码哈希 |
| AI 编排 | LangChain + LangGraph | Agent、工具调用、会话记忆 |
| 模型接入 | DeepSeek / OpenAI 兼容接口 | 需求分析和组件生成 |
| 数据校验 | Zod | AI 工具参数与 Schema 输出校验 |
| 联网搜索 | Exa | 为图片等生成内容提供搜索能力 |

## 项目结构

```text
backend/
├── src/
│   ├── index.ts                    # 启动入口：连接 MongoDB、监听端口
│   ├── app.ts                      # Express 应用、中间件和路由装配
│   ├── middleware/
│   │   └── verifyToken.ts          # JWT 鉴权中间件
│   ├── models/
│   │   ├── User.ts                 # 用户模型
│   │   └── Page.ts                 # 页面和 PageDSL 模型
│   ├── routes/
│   │   ├── auth.ts                 # 注册、登录
│   │   ├── page.ts                 # 页面列表、保存、读取、删除
│   │   └── ai.ts                   # AI Schema 生成
│   ├── utils/
│   │   └── response.ts             # 统一响应格式
│   └── ai/
│       ├── agents/
│       │   └── create-agent.ts     # Schema 生成 Agent
│       ├── pipelines/
│       │   └── create-pipeline.ts  # Schema 生成主流程
│       ├── tools/
│       │   ├── component-tools.ts  # 组件创建和页面配置工具
│       │   └── integration-tools.ts# 外部集成工具集合
│       ├── prompt.ts                # 系统提示词、用户消息和组件清单
│       ├── schema.ts                # AI 输出的 Zod Schema
│       ├── cache.ts                 # 进程内短期缓存
│       ├── memory.ts                # 独立的历史消息工具
│       └── abort-guard.ts           # 请求取消控制
├── docs/
│   └── page-api.md                  # 页面接口补充说明
├── .env.example                     # 可提交的环境变量模板
├── package.json
└── tsconfig.json
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
pnpm install
```

### 2. 配置环境变量

复制示例文件：

```bash
cp .env.example .env
```

Windows PowerShell 可以使用：

```powershell
Copy-Item .env.example .env
```

然后在 `.env` 中填写本地配置和真实密钥。不要提交 `.env`。

### 3. 启动 MongoDB

默认连接地址：

```text
mongodb://localhost:27017/vision-craft
```

也可以通过 `MONGODB_URI` 指定其他 MongoDB 实例。

### 4. 启动开发服务器

```bash
pnpm dev
```

默认监听 `http://localhost:3000`，健康检查地址：

```text
GET http://localhost:3000/health
```

成功响应：

```json
{
  "code": 0,
  "message": "ok"
}
```

## 环境变量

完整模板见 [.env.example](./.env.example)。

| 变量 | 必需性 | 默认值或说明 |
|---|---|---|
| `PORT` | 可选 | 后端端口，默认 `3000` |
| `CORS_ORIGIN` | 可选 | 允许访问后端的前端地址，默认 `http://localhost:5173` |
| `MONGODB_URI` | 可选 | MongoDB 地址，默认使用本地 `vision-craft` 数据库 |
| `JWT_SECRET` | 生产必需 | JWT 签名密钥，应使用足够长的随机字符串 |
| `JWT_EXPIRES_IN` | 可选 | Token 有效期，默认 `7d` |
| `DEEPSEEK_API_KEY` | AI 生成必需 | Schema 生成模型的 API Key |
| `DEEPSEEK_BASE_URL` | 可选 | DeepSeek/OpenAI 兼容接口地址 |
| `DEEPSEEK_MODEL` | 可选 | Schema 生成使用的模型名 |
| `DEEPSEEK_REASONING_EFFORT` | 可选 | `low`、`high` 或 `max` |
| `EXASEARCH_API_KEY` | 联网搜索必需 | Exa 搜索 API Key |

## 应用启动流程

入口文件是 [src/index.ts](./src/index.ts)：

```text
读取环境变量
  → 连接 MongoDB
  → 创建 Express 应用
  → 挂载中间件和路由
  → 监听 PORT
```

[src/app.ts](./src/app.ts) 中挂载了：

- CORS；
- 最大 10 MB 的 JSON 请求体解析；
- `/health` 健康检查；
- `/api/auth` 公开认证路由；
- 使用 JWT 保护的 `/api/pages` 和 `/api/ai` 路由。

## 响应格式

普通 JSON 接口使用统一响应结构。

成功：

```json
{
  "code": 0,
  "message": "操作成功",
  "data": {}
}
```

失败：

```json
{
  "code": 40001,
  "message": "参数不合法"
}
```

业务响应码定义在 [src/utils/response.ts](./src/utils/response.ts)：

| code | 含义 |
|---|---|
| `0` | 成功 |
| `40001` | 参数校验失败 |
| `40101` | 未授权 |
| `40901` | 数据冲突 |
| `50000` | 服务器内部错误 |

HTTP 状态码和业务 `code` 是两个不同的概念，调用方应同时关注请求状态和响应内容。

## API 接口

### 认证接口

认证接口不需要 JWT。

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/auth/register` | 使用邮箱和密码注册 |
| `POST` | `/api/auth/login` | 登录并返回 JWT 和安全用户信息 |

注册请求：

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

登录成功后，`data.token` 用于后续接口鉴权：

```http
Authorization: Bearer <token>
```

密码通过 bcrypt 哈希后保存，接口不会返回 `passwordHash`。

### 页面接口

以下接口都需要 JWT。

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/pages?userId=...` | 获取用户的页面列表 |
| `POST` | `/api/pages/save` | 创建或更新页面 |
| `GET` | `/api/pages/:id` | 获取页面和完整 Schema |
| `DELETE` | `/api/pages/:id` | 删除页面 |

保存页面时，没有 `pageId` 表示创建；存在 `pageId` 表示更新：

```json
{
  "pageId": "可选的 MongoDB Page ID",
  "userId": "创建时需要的用户 ID",
  "schema": {
    "id": "root-schema-id",
    "type": "RootContainer",
    "name": "园区运营大屏",
    "props": {
      "title": "园区运营大屏",
      "description": "园区核心指标"
    },
    "settings": {
      "width": 1920,
      "height": 1080
    },
    "children": []
  },
  "meta": {
    "title": "园区运营大屏",
    "description": "园区核心指标"
  },
  "thumbnail": "可选的 base64 图片"
}
```

页面数据由 [src/models/Page.ts](./src/models/Page.ts) 保存，主要字段包括：

- `owner`：所属用户；
- `schema`：完整 PageDSL；
- `name`、`title`、`description`：页面元数据；
- `thumbnailUrl`：项目列表缩略图；
- `createdAt`、`updatedAt`：时间戳。

### AI Schema 生成接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/ai/schema/generate` | 主要用于 `EventSource` SSE 流式生成 |
| `POST` | `/api/ai/schema/generate` | 支持普通 JSON 请求，也支持 `step` 模式 |

主要参数：

| 参数 | 说明 |
|---|---|
| `prompt` | 用户的页面或组件生成需求 |
| `mode` | `step` 为 SSE，`full` 为普通 JSON |
| `sessionId` | 聊天会话 ID；没有时由后端生成 |
| `pageId` | 当前页面 ID，用于 Agent 会话上下文 |
| `existingComponents` | 当前画布组件，帮助 Agent 使用真实组件 ID |
| `token` | GET SSE 鉴权使用的 JWT |

`step` 模式返回 `text/event-stream`，不是普通 JSON。

## JWT 鉴权

[src/middleware/verifyToken.ts](./src/middleware/verifyToken.ts) 支持两种 Token 来源：

1. 普通接口从 `Authorization: Bearer <token>` 读取；
2. SSE 接口可以从 URL 的 `token` query 参数读取。

校验成功后，JWT payload 被写入 `req.user`。当前 payload 包含用户 ID `uid` 和邮箱 `email`。

## AI Schema 生成流程

核心文件：

- [src/routes/ai.ts](./src/routes/ai.ts)：解析请求、建立 SSE、发送 `start/end/error`；
- [src/ai/pipelines/create-pipeline.ts](./src/ai/pipelines/create-pipeline.ts)：编排完整生成流程；
- [src/ai/agents/create-agent.ts](./src/ai/agents/create-agent.ts)：创建规划模型和执行 Agent；
- [src/ai/tools/component-tools.ts](./src/ai/tools/component-tools.ts)：组件创建工具；
- [src/ai/schema.ts](./src/ai/schema.ts)：结构化输出约束；
- [src/ai/prompt.ts](./src/ai/prompt.ts)：生成规则和上下文。

```text
AI 路由接收请求
  → 发送 start(sessionId)
  → Pipeline 检查缓存
  → 推送 analysis / planning
  → reasoningModel 生成执行计划
  → Agent 按 thread_id 读取会话历史
  → Agent 调用组件工具
  → Zod 校验工具输出
  → tool_result 更新前端工具状态
  → ai_chunk 返回页面配置或组件节点
  → 路由发送 end
```

### sessionId 和 thread_id

- `sessionId` 用于前后端维持聊天会话；
- `thread_id` 用于 LangGraph Checkpointer 保存 Agent 历史；
- 当前计算方式为 `thread_id: pageId || sessionId`。

因此，存在 `pageId` 时，同一页面优先复用同一个 Agent 上下文；没有页面 ID 时才使用聊天 `sessionId`。

### SSE 事件

| 事件 | 发送方 | 用途 |
|---|---|---|
| `start` | Route | 生成开始，返回 `sessionId` |
| `progress` | Pipeline | 分析、规划、执行、收尾阶段 |
| `thinking` | Pipeline | 模型思考内容 |
| `tool_call` | Pipeline | Agent 准备调用的工具 |
| `tool_result` | Pipeline | 工具执行状态和摘要 |
| `ai_chunk` | Pipeline | 真正用于更新前端 PageDSL 的数据 |
| `cached` | Pipeline | 命中短期缓存 |
| `end` | Route | 正常结束或取消 |
| `error` | Route | 生成失败 |

`tool_result` 主要用于更新聊天界面中的工具步骤，`ai_chunk` 才是前端新增、更新组件或修改页面配置的数据来源。

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 使用 nodemon + tsx 启动开发服务 |
| `pnpm start` | 使用 tsx 直接启动服务 |
| `pnpm build` | 使用 TypeScript 编译项目 |
| `pnpm typecheck` | 只执行类型检查，不输出文件 |
| `pnpm lint` | 执行 ESLint 检查 |
| `pnpm lint:fix` | 自动修复可修复的 ESLint 问题 |
| `pnpm format` | 使用 Prettier 格式化源码 |
| `pnpm format:check` | 检查源码格式 |

## 开发指南

### 新增普通接口

1. 在 `src/routes/` 中创建或修改 Router；
2. 需要持久化时在 `src/models/` 中定义模型；
3. 使用 `ok()` 和 `fail()` 保持响应格式一致；
4. 在 `src/app.ts` 中挂载 Router；
5. 在前端 `src/api/` 中增加对应请求函数。

### 新增 AI 组件工具

1. 在 `src/ai/schema.ts` 中定义或扩展 Zod Schema；
2. 在 `src/ai/tools/component-tools.ts` 中实现工具；
3. 将工具加入 `componentTools`；
4. 在 `src/ai/prompt.ts` 中补充组件能力和调用规则；
5. 确认前端存在相同 `type` 的组件类型、默认配置和注册表实现；
6. 执行类型检查并通过前端实际生成验证。

### 新增 SSE 事件

1. Pipeline 使用 `onProgress(event, data)` 发送业务事件；
2. `routes/ai.ts` 的 `send()` 将事件编码为 SSE；
3. 前端 Hook 使用 `addEventListener(event, handler)` 消费；
4. 为事件增加明确的数据结构，避免前后端字段漂移。

## 当前注意事项

- `.env` 包含数据库、JWT 和模型密钥，必须保持在 Git 忽略列表中；
- 生产环境必须显式设置强随机 `JWT_SECRET`，不要依赖开发回退值；
- 页面接口当前还需要加强 owner 校验，查询和修改时应结合 `req.user.uid`；
- SSE 将 token 放在 query 中，生产环境应注意代理日志和访问日志脱敏；
- `existingComponents` 通过 GET URL 发送，复杂页面可能触及 URL 长度限制；
- AI 缓存目前只记录成功状态，命中缓存时不会重新回放旧的 `ai_chunk`；
- Agent Checkpointer 使用进程内 `MemorySaver`，服务重启或多实例部署时不会共享历史；
- `Page.schema` 在 MongoDB 中是宽松 Object，普通保存接口暂未执行完整 PageDSL 运行时校验。

## 相关文档
- [页面 API](./docs/page-api.md)

