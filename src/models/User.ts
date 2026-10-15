import { Schema, model, type Document, type Types } from "mongoose";

export interface IUser extends Document {
	_id: Types.ObjectId;
	email: string;
	passwordHash: string;
	name?: string;
	createdAt: Date;
	toSafeJSON(): {
		id: Types.ObjectId;
		email: string;
		name?: string;
		createdAt: Date
	};
}

const UserSchema = new Schema<IUser>(
	{
		// 邮箱
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		// 加密的密码
		passwordHash: {
			type: String,
			required: true,
		},
		// 昵称
		name: {
			type: String,
			trim: true,
		},
		// 创建时间
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		collection: "users",
	}
);
// 返回安全的用户信息，不包含敏感信息
UserSchema.methods.toSafeJSON = function (this: IUser) {
	return {
		id: this._id,
		email: this.email,
		name: this.name,
		createdAt: this.createdAt,
	};
};
// 用户数据库实例
const User = model<IUser>("User", UserSchema);
export default User;
