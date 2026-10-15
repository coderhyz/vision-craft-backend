import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.ts";
import { ok, fail, RespCode } from "../utils/response.ts";
import type { Request, Response } from "express";

const router = express.Router();
// token过期时间，默认7天
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
// 生成 JWT token
function signToken(user: { _id: { toString(): string }; email: string }) {
	// JWT秘钥
	const JWT_SECRET = process.env.JWT_SECRET || "23e28c7b21415a1b2439f08940a5204937c64617049f9421d4feaed52b773b8b";
	// 生成 token，payload中包含用户id和邮箱，过期时间为7天
	return jwt.sign({ uid: user._id.toString(), email: user.email }, JWT_SECRET, {
		expiresIn: TOKEN_EXPIRES_IN,
	} as jwt.SignOptions);
}

// 注册
router.post("/register", async (req: Request, res: Response) => {
	const { email, password } = req.body || {};
	if (!email || !password) {
		return fail(res, "邮箱和密码不能为空", RespCode.VALIDATION, 400);
	}

	try {
		// 检查邮箱是否已注册
		const existing = await User.findOne({ email });
		if (existing) {
			return fail(res, "邮箱已注册", RespCode.CONFLICT, 409);
		}

		const passwordHash = await bcrypt.hash(password, 10);
		const user = await User.create({ email, passwordHash });

		return ok(res, user.toSafeJSON(), "注册成功");
	} catch (err) {
		console.error("[auth/register] error", err);
		return fail(res, "注册失败，请稍后重试", RespCode.SERVER_ERROR, 500);
	}
});

// 登录
router.post("/login", async (req: Request, res: Response) => {
	// 邮箱和密码
	const { email, password } = req.body || {};
	if (!email || !password) {
		return fail(res, "邮箱和密码不能为空", RespCode.VALIDATION, 400);
	}

	try {
		const user = await User.findOne({ email });
		if (!user) {
			return fail(res, "邮箱或密码错误", RespCode.UNAUTHORIZED, 401);
		}

		const isMatch = await bcrypt.compare(password, user.passwordHash);
		if (!isMatch) {
			return fail(res, "邮箱或密码错误", RespCode.UNAUTHORIZED, 401);
		}
		// 生成 token 返回给前端
		const token = signToken(user);
		return ok(
			res,
			{
				token,
				user: user.toSafeJSON(),
			},
			"登录成功"
		);
	} catch (err) {
		console.error("[auth/login] error", err);
		return fail(res, "登录失败，请稍后重试", RespCode.SERVER_ERROR, 500);
	}
});

export default router;
