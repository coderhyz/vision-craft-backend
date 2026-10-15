import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app.ts";

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/vision-craft";

// 启动函数：连接数据库并启动服务
async function bootstrap() {
	try {
		await mongoose.connect(MONGODB_URI);
		console.log("[mongo] connected");

		app.listen(PORT, () => {
			console.log(`[server] listening on http://localhost:${PORT}`);
		});
	} catch (err) {
		console.error("[startup] failed to start server", err);
		process.exit(1);
	}
}

bootstrap();
