import mongoose, { type Types } from "mongoose";
const { Schema, model } = mongoose;
export interface IPage {
	// 默认添加的属性
	_id: Types.ObjectId;
	name: string;
	title: string;
	description: string;
	thumbnailUrl: string;
	schema: Record<string, any>;
	owner: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
	toSafeJSON(): {
		pageId: string;
		name: string;
		title: string;
		description: string;
		thumbnailUrl: string;
		// 页面的 schema，包含组件树、属性、样式等信息
		schema: Record<string, any>;
		createdAt: Date;
		updatedAt: Date;
	};
}

const PageSchema = new Schema<IPage>(
	{
		// 名称
		name: {
			type: String,
			default: ""
		},
		// 标题
		title: {
			type: String,
			default: ""
		},
		// 描述
		description: {
			type: String,
			default: ""
		},
		// 缩略图
		thumbnailUrl: {
			type: String,
			default: ""
		},
		// DSL
		schema: {
			type: Object,
			required: true
		},
		owner: {
			// 关联的用户
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
	},
	{
		timestamps: true,
	}
);

PageSchema.methods.toSafeJSON = function (this: IPage) {
	return {
		// 对象转字符串
		pageId: this._id.toString(),
		name: this.name,
		title: this.title,
		description: this.description,
		thumbnailUrl: this.thumbnailUrl,
		schema: this.schema,
		createdAt: this.createdAt,
		updatedAt: this.updatedAt,
	};
};

const Page = model<IPage>("Page", PageSchema);

export default Page;
