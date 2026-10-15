
import express from "express";
import mongoose from "mongoose";
import Page from "../models/Page.ts";
import { ok, fail, RespCode } from "../utils/response.ts";
import type { Request, Response } from "express";

const router = express.Router();

// 获取当前用户的页面列表：按更新时间倒序
router.get("/", async (req: Request, res: Response) => {
	try {
		// 用户id
		const { userId } = req.query;
		if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
			return fail(res, "userId 不合法", RespCode.VALIDATION, 400);
		}
		// 找到的用户的所有大屏
		const pages = await Page.find({ owner: userId })
			// 仅返回必要字段，减少数据传输量
			.select("name title description thumbnailUrl createdAt updatedAt")
			// 按照时间倒序
			.sort({ updatedAt: -1 });
		// console.log("pages", pages);
		const data = pages.map((page) => ({
			pageId: page._id.toString(),
			name: page.name,
			title: page.title,
			description: page.description,
			thumbnailUrl: page.thumbnailUrl,
			createdAt: page.createdAt,
			updatedAt: page.updatedAt,
		}));

		return ok(res, data, "获取成功");
	} catch (err) {
		console.error("[pages/list] error", err);
		return fail(res, "获取失败，请稍后重试", RespCode.SERVER_ERROR, 500);
	}
});

// 保存页面 schema：支持创建与更新
router.post("/save", async (req: Request, res: Response) => {
	// 请求体参数
	const { pageId, schema, meta = {}, thumbnail, userId } = req.body || {};

	if (!schema) {
		return fail(res, "schema 不能为空", RespCode.VALIDATION, 400);
	}

	const payload: Record<string, any> = {
		schema,
		name: meta.name ?? schema?.name ?? "",
		title: meta.title ?? schema?.props?.title ?? "",
		description: meta.description ?? schema?.props?.description ?? "",
	};

	// 仅在前端传入缩略图时更新，避免覆盖旧图
	if (typeof thumbnail === "string" && thumbnail.length) {
		payload.thumbnailUrl = thumbnail;
	}

	try {
		let pageDoc;

		if (pageId) {
			if (!mongoose.Types.ObjectId.isValid(pageId)) {
				return fail(res, "pageId 格式不合法", RespCode.VALIDATION, 400);
			}
			// 更新的文档
			pageDoc = await Page.findByIdAndUpdate(pageId, payload, {
				new: true,
				upsert: false,
			});

			if (!pageDoc) {
				return fail(res, "未找到对应页面", RespCode.VALIDATION, 404);
			}
		} else {
			if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
				return fail(res, "userId 不合法", RespCode.VALIDATION, 400);
			}
			// 创建大屏初始页
			pageDoc = await Page.create({ ...payload, owner: userId });
		}

		return ok(res, pageDoc.toSafeJSON(), "保存成功");
	} catch (err) {
		console.error("[pages/save] error", err);
		return fail(res, "保存失败，请稍后重试", RespCode.SERVER_ERROR, 500);
	}
});

// 获取指定页面 schema
router.get("/:id", async (req: Request, res: Response) => {
	// 前端传来的页面 id
	const { id } = req.params || {};
	if (!id) {
		return fail(res, "pageId 不能为空", RespCode.VALIDATION, 400);
	}
	// 判断id合法不合法
	if (!mongoose.Types.ObjectId.isValid(id as string)) {
		return fail(res, "pageId 格式不合法", RespCode.VALIDATION, 400);
	}
	try {
		// 查询大屏页面
		const pageDoc = await Page.findById(id);
		if (!pageDoc) {
			return fail(res, "未找到对应页面", RespCode.VALIDATION, 404);
		}
		// 返回安全的 JSON 数据，避免泄露敏感信息
		return ok(res, pageDoc.toSafeJSON(), "获取成功");
	} catch (err) {
		console.error("[pages/get] error", err);
		return fail(res, "获取失败，请稍后重试", RespCode.SERVER_ERROR, 500);
	}
});

// 删除指定页面：先校验 id 合法性再执行删除
router.delete("/:id", async (req: Request, res: Response) => {
	// pageId
	const { id } = req.params || {};
	if (!id) {
		return fail(res, "pageId 不能为空", RespCode.VALIDATION, 400);
	}
	// 判断id合法不合法
	if (!mongoose.Types.ObjectId.isValid(id as string)) {
		return fail(res, "pageId 格式不合法", RespCode.VALIDATION, 400);
	}

	try {
		// 删除大屏页面
		const deleted = await Page.findByIdAndDelete(id);
		if (!deleted) {
			return fail(res, "未找到对应页面", RespCode.VALIDATION, 404);
		}

		return ok(res, { pageId: id }, "删除成功");
	} catch (err) {
		console.error("[pages/delete] error", err);
		return fail(res, "删除失败，请稍后重试", RespCode.SERVER_ERROR, 500);
	}
});

export default router;
