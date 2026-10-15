/* eslint-disable @typescript-eslint/no-namespace */
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { fail, RespCode } from "../utils/response.ts";

declare global {
	namespace Express {
		interface Request {
			user?: jwt.JwtPayload | string;
		}
	}
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
	const JWT_SECRET = process.env.JWT_SECRET || "23e28c7b21415a1b2439f08940a5204937c64617049f9421d4feaed52b773b8b";

	let token: string | null = null;
	// 校验token
	const authorization = req.headers.authorization;
	if (authorization?.startsWith("Bearer ")) {
		token = authorization.slice(7);
	}
	// 如果没有在 headers 中带 token，则尝试从 query 中获取
	if (!token && req.query?.token) {
		token = req.query.token as string;
	}
	// 如果没有带token，直接返回 403
	if (!token) {
		return fail(res, "UnAuthorized", RespCode.UNAUTHORIZED, 403);
	}

	try {
		// 返回的 user 对象中包含 uid 和 email
		req.user = jwt.verify(token, JWT_SECRET);
		next();
	} catch {
		return fail(res, "UnAuthorized", RespCode.UNAUTHORIZED, 403);
	}
}
