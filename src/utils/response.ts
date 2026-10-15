import type { Response } from "express";

export const RespCode = {
	// 成功
	SUCCESS: 0,
	// 失败
	VALIDATION: 40001,
	// 未授权
	UNAUTHORIZED: 40101,
	// 冲突
	CONFLICT: 40901,
	// 服务器错误
	SERVER_ERROR: 50000,
} as const;
// 响应码类型
export type RespCodeValue = (typeof RespCode)[keyof typeof RespCode];
// 成功的响应
export function ok(res: Response, data: unknown = null, message = "ok", code: RespCodeValue = RespCode.SUCCESS) {
	return res.json(
		{
			code, message, data
		});
}
// 失败的响应
export function fail(res: Response, message = "error", code: RespCodeValue = RespCode.SERVER_ERROR, httpStatus = 500) {
	return res.status(httpStatus).json({ code, message });
}
