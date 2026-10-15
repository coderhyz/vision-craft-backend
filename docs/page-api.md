# Page 接口文档

## 基础信息

- Base URL: `http://localhost:3000/api`
- 响应格式：`{ code: number, message: string, data?: any }`
- 成功 code: `0`；失败时 `code` 为后端定义的错误码，HTTP 状态码与场景保持一致。

## 保存页面

- 方法与路径：`POST /pages/save`
- 请求体：
  ```json
  {
    "pageId": "可选，已有页面 id，传则更新",
    "schema": { "id": "root-1", "name": "首页", "type": "RootContainer", "props": { "title": "首页", "description": "描述" }, "settings": { "width": 1920, "height": 1080 }, "children": [] },
    "meta": {
      "title": "可选，标题，默认取 schema.props.title",
      "description": "可选，描述，默认取 schema.props.description"
    }
  }
  ```
- 响应体示例：
  ```json
  {
    "code": 0,
    "message": "保存成功",
    "data": {
      "pageId": "663b0f...",
      "name": "",
      "title": "首页",
      "description": "描述",
      "schema": { "...": "与入参 schema 一致" },
      "createdAt": "2024-05-10T10:00:00.000Z",
      "updatedAt": "2024-05-10T10:00:00.000Z"
    }
  }
  ```
- 典型错误：
  - 400：`schema 不能为空`
  - 404（传入 pageId 且不存在）：`未找到对应页面`
  - 500：`保存失败，请稍后重试`

## 获取页面列表

- 方法与路径：`GET /pages`
- 说明：返回当前全部页面的基础信息（不含 schema）。
- 响应体示例：
  ```json
  {
    "code": 0,
    "message": "获取成功",
    "data": [
      {
        "pageId": "663b0f...",
        "name": "",
        "title": "首页",
        "description": "描述",
        "createdAt": "2024-05-10T10:00:00.000Z",
        "updatedAt": "2024-05-10T10:00:00.000Z"
      }
    ]
  }
  ```

## 获取页面

- 方法与路径：`GET /pages/:id`
- 路径参数：`id` 页面 id（必填）
- 响应体示例：
  ```json
  {
    "code": 0,
    "message": "获取成功",
    "data": {
      "pageId": "663b0f...",
      "name": "",
      "title": "首页",
      "description": "描述",
      "schema": { "...": "保存的 schema" },
      "createdAt": "2024-05-10T10:00:00.000Z",
      "updatedAt": "2024-05-10T10:00:00.000Z"
    }
  }
  ```
- 典型错误：
  - 400：`pageId 不能为空`
  - 404：`未找到对应页面`
  - 500：`获取失败，请稍后重试`

## 删除页面

- 方法与路径：`DELETE /pages/:id`
- 路径参数：`id` 页面 id（必填）
- 响应体示例：
  ```json
  {
    "code": 0,
    "message": "删除成功",
    "data": {
      "pageId": "663b0f..."
    }
  }
  ```
- 典型错误：
  - 400：`pageId 不能为空` / `pageId 格式不合法`
  - 404：`未找到对应页面`
  - 500：`删除失败，请稍后重试`

## AI 生成页面 Schema

- 方法与路径：`POST /ai/schema/generate`
- 说明：调用 LangChain + DeepSeek(OpenAI 兼容) 生成大屏 PageDSL，支持分步或一次性生成，内置 Zod 校验与最多 2 次重试，5 分钟超时；可选 SSE 流式输出。
- 请求体：
  ```json
  {
    "prompt": "用户需求，必填",
    "phase": "layout | components | data | full（默认 full）",
    "mode": "step | full（默认 step）",
    "prevSchema": {},          // 可选，上一步 schema，分步场景传入
    "sessionId": "可选，默认 default，用于短期记忆",
    "stream": false            // 可选，true 时使用 SSE 流式返回
  }
  ```
- 成功响应（非流式）：
  ```json
  {
    "code": 0,
    "message": "生成成功",
    "data": {
      "schema": { "id": "...", "type": "RootContainer", "settings": { "width": 1920, "height": 1080, "gridSize": 10 }, "children": [] },
      "validation": { "ok": true },
      "cached": false
    }
  }
  ```
- 流式返回（`stream=true`）：SSE 事件 `start` -> `result` -> `end`，错误时发送 `error` 事件并结束连接。
- 典型错误：
  - 400：`prompt 不能为空` / `phase 不合法` / `mode 不合法`
  - 500：生成失败、校验失败或超时
