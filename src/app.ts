
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.ts";
import pageRouter from "./routes/page.ts";
import aiRouter from "./routes/ai.ts";
import { verifyToken } from "./middleware/verifyToken.ts";

// 核心应用实例：挂载通用中间件与业务路由
const app = express();

// 允许前端访问，后续可按需收紧 CORS
app.use(
	cors({
		// 跨域的网址
		origin: process.env.CORS_ORIGIN || "http://localhost:5173",
		credentials: true,
	})
);

// 解析 JSON 请求体
app.use(express.json({ limit: "10mb" }));

// 健康检查
app.get("/health", (_req, res) => {
	res.json({ code: 0, message: "ok" });
});

// 认证路由（无需鉴权）
app.use("/api/auth", authRouter);
// 页面路由：保存 schema（需鉴权）
app.use("/api/pages", verifyToken, pageRouter);
// AI 生成 schema（需鉴权）
app.use("/api/ai", verifyToken, aiRouter);

export default app;
