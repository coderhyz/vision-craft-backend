import { z } from "zod";

// 后端对应的组件类型枚举，需与前端保持一致
export const COMPONENT_TYPES = [
	"Text",
	"Image",
	"Button",
	"Container",
	"Clock",
	"StatisticCard",
	"ProgressBar",
	"Countdown",
	"BarChart",
	"MultiBarChart",
	"LineChart",
	"PieChart",
	"ScatterChart",
	"BubbleChart",
	"AreaChart",
	"MultiLineChart",
	"HorizontalBarChart",
	"RosePieChart",
	"Divider",
	"Badge",
	"Tag",
	"Avatar",
	"Rate",
	"Switch",
	"RadarChart",
	"FunnelChart",
	"GaugeChart",
	"TreemapChart",
] as const;

// zod 枚举，供判定/复用时保持类型一致
const componentType = z.enum([
	"Text",
	"Image",
	"Button",
	"Container",
	"Clock",
	"StatisticCard",
	"ProgressBar",
	"Countdown",
	"BarChart",
	"MultiBarChart",
	"LineChart",
	"PieChart",
	"ScatterChart",
	"BubbleChart",
	"AreaChart",
	"MultiLineChart",
	"HorizontalBarChart",
	"RosePieChart",
	"Divider",
	"Badge",
	"Tag",
	"Avatar",
	"Rate",
	"Switch",
	"RadarChart",
	"FunnelChart",
	"GaugeChart",
	"TreemapChart",
]);
// 推导出来一个 TypeScript 类型，供代码中使用
// export type ComponentType = "text" | "image" | "button" | "chart";
export type ComponentType = z.infer<typeof componentType>;

// 便捷的可选类型工厂，减少重复代码
const optStr = () => z.string().optional();
const optNum = () => z.number().optional();
const optBool = () => z.boolean().optional();
const optArr = <T extends z.ZodTypeAny>(schema: T) => z.array(schema).optional();

// 通用样式：大屏依赖绝对定位，核心字段必填
const styleSchema = z.object({
	top: z.number(),
	left: z.number(),
	width: z.number(),
	height: z.number(),
	zIndex: z.number(),
}).passthrough();
//passthrough表示 除了规定的字段之外，其他字段也允许保留。


// 通用数据源（dataSource 提升到组件顶层，字段映射统一用 fieldMapping）
const chartDataSource = z.object({
	sourceType: z.enum(["static", "api"]).default("static"), //图表的数据源
	data: z.array(z.any()).optional().default([]), //静态数据源
	apiUrl: optStr(), //API 接口地址
	refreshInterval: optNum(), //刷新间隔
	fieldMapping: z.record(z.string()).optional(),
});

// 基础图表 props（纯视觉/交互配置，不含 dataSource）
const chartBaseProps = z.object({
	title: z.string(), //图表标题，
	showGrid: optBool(), //是否显示网格
	showLegend: z.boolean(), //是否显示图例
	tooltipEnabled: z.boolean(), //是否启用提示框
});

// 柱状图
const barChartProps = chartBaseProps.extend({
	barColor: optStr(),
});

// 多序列柱状图
const multiBarChartProps = chartBaseProps.extend({
	colorPalette: optArr(z.string()),
	isStack: optBool(),
});
// 折线图
const lineChartProps = chartBaseProps.extend({
	lineColor: optStr(),
	smooth: optBool(),
	areaStyle: optBool(),
});
// 多序列折线图
const multiLineChartProps = chartBaseProps.extend({
	colorPalette: optArr(z.string()),
	smooth: optBool(),
	areaStyle: optBool(),
});
// 散点图
const scatterChartProps = chartBaseProps.extend({
	pointSize: optNum(),
	pointColor: optStr(),
});
// 气泡图
const bubbleChartProps = scatterChartProps.extend({
	sizeRange: z.tuple([z.number(), z.number()]).nullable().optional(),
	colorPalette: optArr(z.string()),
});
// 水平柱状图
const horizontalBarChartProps = chartBaseProps.extend({
	barColor: optStr(),
});

// 饼图
const pieChartProps = chartBaseProps.extend({
	innerRadius: optNum(),
});

// 玫瑰图
const rosePieChartProps = pieChartProps.extend({
	roseType: z.enum(["area", "radius"]).nullable().optional(),
});

// 所有组件的公共字段定义
const baseComponent = z.object({
	id: z.string(),
	type: componentType,
	name: z.string().optional(),
	isHidden: optBool(), //是否隐藏
	isLocked: optBool(), //是否锁定
	style: styleSchema.optional(),
});
//文字组件
const textComponent = baseComponent.extend({
	type: z.literal("Text"),
	props: z.object({
		content: z.string(), //内容
		fontSize: z.number(), //字号
		fontWeight: z.number(), //字体粗细
		color: z.string(), //颜色
		textAlign: z.enum(["左", "居中", "右"]), //对齐方式
	}),
});
// 图片组件
const imageComponent = baseComponent.extend({
	type: z.literal("Image"),
	props: z.object({
		src: z.string(),
		alt: optStr(),
		fit: z.enum(["fill", "contain", "cover", "none", "scale-down"]),
		preview: optBool(),
	}),
});
// 按钮组件
const buttonComponent = baseComponent.extend({
	type: z.literal("Button"),
	props: z.object({
		text: z.string(),
		type: z.enum(["default", "primary", "dashed", "link", "text"]),
		size: z.enum(["small", "middle", "large"]),
		danger: optBool(),
		block: optBool(),
		disabled: optBool(),
	}),
});

const clockComponent = baseComponent.extend({
	type: z.literal("Clock"),
	props: z.object({
		format: z.string(),
		fontSize: z.number(),
		fontWeight: z.number(),
		color: z.string(),
		textAlign: z.enum(["左", "居中", "右"]),
		showSeconds: optBool(), //是否显示秒
	}),
});

const statisticCardComponent = baseComponent.extend({
	type: z.literal("StatisticCard"),
	props: z.object({
		title: z.string(),
		subtitle: optStr(),
		value: z.number(),
		prefix: optStr(),
		suffix: optStr(),
		valueColor: z.string(),
		align: z.enum(["左", "居中", "右"]),
		trend: z.enum(["上升", "下降", "持平"]).optional(),
		showTrendIcon: optBool(), //是否显示趋势图标
		trendColorUp: optStr(), //上升时的趋势颜色
		trendColorDown: optStr(), //下降时的趋势颜色
		animated: optBool(), //是否启用动画
		valueFontSize: z.number(),
		titleFontSize: z.number(),
		subtitleFontSize: z.number(),
	}),
});

const progressBarComponent = baseComponent.extend({
	type: z.literal("ProgressBar"),
	props: z.object({
		value: z.number(),
		max: z.number(),
		showLabel: z.boolean(),
		strokeColor: z.string(),
		trackColor: z.string(),
		strokeWidth: z.number(),
		rounded: z.boolean(),
		animation: z.boolean(),
	}),
});

const countdownComponent = baseComponent.extend({
	type: z.literal("Countdown"),
	props: z.object({
		targetTime: z.string(),
		format: z.string(),
		prefix: optStr(),
		suffix: optStr(),
		finishedText: optStr(),
		fontSize: z.number(),
		fontWeight: z.number(),
		color: z.string(),
		textAlign: z.enum(["左", "居中", "右"]),
		showMilliseconds: optBool(),
	}),
});
// 容器组件
const containerComponent: any = baseComponent.extend({
	type: z.literal("Container"),
	props: z
		.object({
			layoutMode: z.enum(["absolute", "flex"]),
			gap: optNum(),
		})
		.optional(),
	children: z.lazy(() => componentNode.array()).optional(),
});

// 图表组件（dataSource 在组件顶层）
const barChartComponent = baseComponent.extend({
	type: z.literal("BarChart"),
	props: barChartProps,
	dataSource: chartDataSource.optional(),
});

const multiBarChartComponent = baseComponent.extend({
	type: z.literal("MultiBarChart"),
	props: multiBarChartProps,
	dataSource: chartDataSource.optional(),
});

const lineChartComponent = baseComponent.extend({
	type: z.literal("LineChart"),
	props: lineChartProps,
	dataSource: chartDataSource.optional(),
});

const areaChartComponent = baseComponent.extend({
	type: z.literal("AreaChart"),
	props: lineChartProps,
	dataSource: chartDataSource.optional(),
});

const multiLineChartComponent = baseComponent.extend({
	type: z.literal("MultiLineChart"),
	props: multiLineChartProps,
	dataSource: chartDataSource.optional(),
});

const scatterChartComponent = baseComponent.extend({
	type: z.literal("ScatterChart"),
	props: scatterChartProps,
	dataSource: chartDataSource.optional(),
});

const bubbleChartComponent = baseComponent.extend({
	type: z.literal("BubbleChart"),
	props: bubbleChartProps,
	dataSource: chartDataSource.optional(),
});

const horizontalBarChartComponent = baseComponent.extend({
	type: z.literal("HorizontalBarChart"),
	props: horizontalBarChartProps,
	dataSource: chartDataSource.optional(),
});

const pieChartComponent = baseComponent.extend({
	type: z.literal("PieChart"),
	props: pieChartProps,
	dataSource: chartDataSource.optional(),
});
// 玫瑰图表
const rosePieChartComponent = baseComponent.extend({
	type: z.literal("RosePieChart"),
	props: rosePieChartProps,
	dataSource: chartDataSource.optional(),
});

// 分割线
const dividerComponent = baseComponent.extend({
	type: z.literal("Divider"),
	props: z.object({
		direction: z.enum(["horizontal", "vertical"]),
		text: optStr(),
		textPosition: z.enum(["left", "center", "right"]),
		lineStyle: z.enum(["solid", "dashed", "dotted"]),
		color: z.string(),
	}),
});

// 徽标数
const badgeComponent = baseComponent.extend({
	type: z.literal("Badge"),
	props: z.object({
		count: z.number(),
		overflowCount: z.number(),
		showZero: z.boolean(),
		dot: z.boolean(),
		color: z.string(),
		text: z.string(),
		fontSize: z.number(),
	}),
});

// 标签
const tagComponent = baseComponent.extend({
	type: z.literal("Tag"),
	props: z.object({
		text: z.string(),
		color: z.string(),
		bordered: z.boolean(),
		fontSize: z.number(),
	}),
});

// 头像
const avatarComponent = baseComponent.extend({
	type: z.literal("Avatar"),
	props: z.object({
		src: optStr(),
		text: z.string(),
		shape: z.enum(["circle", "square"]),
		size: z.number(),
		backgroundColor: z.string(),
		color: z.string(),
	}),
});

// 评分
const rateComponent = baseComponent.extend({
	type: z.literal("Rate"),
	props: z.object({
		value: z.number(),
		count: z.number(),
		allowHalf: z.boolean(),
		color: z.string(),
		size: z.number(),
	}),
});

// 开关
const switchComponent = baseComponent.extend({
	type: z.literal("Switch"),
	props: z.object({
		checked: z.boolean(),
		checkedText: z.string(),
		uncheckedText: z.string(),
		size: z.enum(["default", "small"]),
		disabled: z.boolean(),
	}),
});

// 雷达图
const radarChartProps = chartBaseProps.extend({
	indicators: z.array(z.object({ name: z.string(), max: z.number() })),
	colorPalette: optArr(z.string()),
});

const radarChartComponent = baseComponent.extend({
	type: z.literal("RadarChart"),
	props: radarChartProps,
	dataSource: chartDataSource.optional(),
});

// 漏斗图
const funnelChartProps = chartBaseProps.extend({
	sort: z.enum(["ascending", "descending", "none"]).optional(),
	colorPalette: optArr(z.string()),
});

const funnelChartComponent = baseComponent.extend({
	type: z.literal("FunnelChart"),
	props: funnelChartProps,
	dataSource: chartDataSource.optional(),
});

// 仪表盘
const gaugeChartProps = chartBaseProps.extend({
	value: z.number(),
	min: z.number(),
	max: z.number(),
	gaugeColor: optStr(),
	unit: optStr(),
});

const gaugeChartComponent = baseComponent.extend({
	type: z.literal("GaugeChart"),
	props: gaugeChartProps,
});

// 矩形树图
const treemapChartProps = chartBaseProps.extend({
	colorPalette: optArr(z.string()),
});

const treemapChartComponent = baseComponent.extend({
	type: z.literal("TreemapChart"),
	props: treemapChartProps,
	dataSource: chartDataSource.optional(),
});

// 递归 discriminated union，按 type 快速分流
const componentNode: any = z.discriminatedUnion("type", [
	textComponent,
	imageComponent,
	buttonComponent,
	clockComponent,
	statisticCardComponent,
	progressBarComponent,
	countdownComponent,
	containerComponent,
	dividerComponent,
	badgeComponent,
	tagComponent,
	avatarComponent,
	rateComponent,
	switchComponent,
	barChartComponent,
	multiBarChartComponent,
	lineChartComponent,
	areaChartComponent,
	multiLineChartComponent,
	scatterChartComponent,
	bubbleChartComponent,
	horizontalBarChartComponent,
	pieChartComponent,
	rosePieChartComponent,
	radarChartComponent,
	funnelChartComponent,
	gaugeChartComponent,
	treemapChartComponent,
]);

// 页面级设置：宽高可用数值或百分比字符串
const pageSettings = z.object({
	width: z.union([z.number(), z.string()]), //宽度
	height: z.union([z.number(), z.string()]), //高度
	backgroundColor: optStr(), //背景颜色
	backgroundImage: optStr(), //背景图片
	gridSize: optNum(), //网格大小
});
// 页面的 schema，包含页面设置和组件树
export const pageSchema = z.object({
	id: z.string(),
	name: z.string(), //页面名称
	type: z.literal("RootContainer"),
	props: z.object({
		title: z.string(), //页面标题
		description: z.string(), //页面描述
	}),
	settings: pageSettings,
	children: componentNode.array().optional(),
});

export type PageDSL = z.infer<typeof pageSchema>;

// 对外导出：供 agent 工具复用的组件/节点 schema
export const componentNodeSchema = componentNode;
export const baseComponentSchema = baseComponent;
export const textComponentSchema = textComponent;
export const imageComponentSchema = imageComponent;
export const buttonComponentSchema = buttonComponent;
export const clockComponentSchema = clockComponent;
export const statisticCardComponentSchema = statisticCardComponent;
export const progressBarComponentSchema = progressBarComponent;
export const countdownComponentSchema = countdownComponent;
export const containerComponentSchema = containerComponent;
export const barChartComponentSchema = barChartComponent;
export const multiBarChartComponentSchema = multiBarChartComponent;
export const lineChartComponentSchema = lineChartComponent;
export const areaChartComponentSchema = areaChartComponent;
export const multiLineChartComponentSchema = multiLineChartComponent;
export const scatterChartComponentSchema = scatterChartComponent;
export const bubbleChartComponentSchema = bubbleChartComponent;
export const horizontalBarChartComponentSchema = horizontalBarChartComponent;
export const pieChartComponentSchema = pieChartComponent;
export const rosePieChartComponentSchema = rosePieChartComponent;
export const dividerComponentSchema = dividerComponent;
export const badgeComponentSchema = badgeComponent;
export const tagComponentSchema = tagComponent;
export const avatarComponentSchema = avatarComponent;
export const rateComponentSchema = rateComponent;
export const switchComponentSchema = switchComponent;
export const radarChartComponentSchema = radarChartComponent;
export const funnelChartComponentSchema = funnelChartComponent;
export const gaugeChartComponentSchema = gaugeChartComponent;
export const treemapChartComponentSchema = treemapChartComponent;
// 校验PageDSL的格式是否准确
// parse在不符合时直接抛出错误
export function validatePageDSL(payload: unknown) {
	try {
		const parsed = pageSchema.parse(payload);
		return { ok: true as const, data: parsed };
	} catch (err: any) {
		return {
			ok: false as const,
			error: err instanceof Error ? err.message : "schema 校验失败",
			issues: err?.issues,
		};
	}
}
