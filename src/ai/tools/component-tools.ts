import { tool } from "@langchain/core/tools";
import { z } from "zod";
import Exa from "exa-js";
import dotenv from "dotenv";
import { COMPONENT_TYPES } from "../schema.ts";

dotenv.config();

const exaClient = new Exa(process.env.EXASEARCH_API_KEY);

/**
 * 联网搜索背景图片，返回可用 URL 列表
 * @param {string} query 搜索关键词
 * @returns {Promise<string[]>}
 */
async function searchBackgroundImages(query: string) {
	const results = await exaClient.search(query, {
		type: "neural",
		numResults: 5,
		useAutoprompt: true,
		contents: { extras: { imageLinks: 5 } },
	});
	const imageUrls = [];
	for (const result of results.results ?? []) {
		const extras = result.extras?.imageLinks ?? [];
		for (const url of extras) {
			if (typeof url === "string" && url.startsWith("http")) {
				imageUrls.push(url);
			}
		}
	}
	return imageUrls;
}

// 工具：为模型提供组件清单与字段提示，减少幻觉
/**
 * 返回可被 LangChain 调用的组件清单工具
 * - 无入参，仅输出允许的组件类型与注意事项
 * - 供模型调用，帮助其遵循受控字段集
 */
export const componentPaletteTool = tool(
	async () => {
		// 为防止模型编造未知组件，显式返回白名单与提示
		return {
			components: COMPONENT_TYPES,
			notes: [
				"所有组件必须包含 id、type、style(top/left/width/height/zIndex)。",
				"图表组件的 dataSource 在组件顶层（与 props 同级），不在 props 内。字段映射统一用 dataSource.fieldMapping，key 为语义名(x/y/name/value/series/category/size)，value 为数据中的实际字段名。",
				"GaugeChart 例外，直接在 props 中传 value/min/max，无需 dataSource。",
				"RadarChart 不使用 fieldMapping，通过 props.indicators 定义雷达维度，数据行用 indicator.name 作为 key。",
				"StatisticCard 组件需要独占一行，一行最多4个，如果多于4个需要换行，一行中的组件排列效果类似justify-evenly。",
				"Divider/Badge/Tag/Avatar/Rate/Switch 为基础 antd 封装组件，适合装饰、状态标注、评分展示等场景。",
			],
		};
	},
	{
		name: "get_component_palette",
		description: "返回可用的大屏组件类型及核心字段提示，避免生成未支持的组件。",
		schema: z.object({}), // 无参工具，显式声明空 schema 避免 langchain 校验异常
	}
);

// =========================
// 组件生成工具（每组件一个工具）
// =========================
// 说明：
// - 每个工具只负责生成一种组件，并对输出进行 schema 校验
// - 工具本身不调用 LLM，输出可重复、可预测，便于 agent 组合成 PageDSL

import { nanoid } from "nanoid";
import {
	textComponentSchema,
	imageComponentSchema,
	buttonComponentSchema,
	clockComponentSchema,
	statisticCardComponentSchema,
	progressBarComponentSchema,
	countdownComponentSchema,
	containerComponentSchema,
	barChartComponentSchema,
	multiBarChartComponentSchema,
	lineChartComponentSchema,
	areaChartComponentSchema,
	multiLineChartComponentSchema,
	scatterChartComponentSchema,
	bubbleChartComponentSchema,
	horizontalBarChartComponentSchema,
	pieChartComponentSchema,
	rosePieChartComponentSchema,
	dividerComponentSchema,
	badgeComponentSchema,
	tagComponentSchema,
	avatarComponentSchema,
	rateComponentSchema,
	switchComponentSchema,
	radarChartComponentSchema,
	funnelChartComponentSchema,
	gaugeChartComponentSchema,
	treemapChartComponentSchema,
} from "../schema.ts";

// 统一的 style 兜底：前端定义要求 top/left/width/height/zIndex 必须存在
function ensureStyle(style: Record<string, any> = {}) {
	return {
		top: typeof style.top === "number" ? style.top : 0,
		left: typeof style.left === "number" ? style.left : 0,
		width: typeof style.width === "number" ? style.width : 400,
		height: typeof style.height === "number" ? style.height : 240,
		zIndex: typeof style.zIndex === "number" ? style.zIndex : 1,
		...style,
	};
}

function ensureId(id: any) {
	return typeof id === "string" && id.length ? id : nanoid();
}

const baseToolInput = z.object({
	id: z.string().optional().describe("组件 id（可选，不传则自动生成）"),
	name: z.string().optional().describe("组件名称（图层面板显示用）"),
	style: z
		.object({
			top: z.number().optional(),
			left: z.number().optional(),
			width: z.number().optional(),
			height: z.number().optional(),
			zIndex: z.number().optional(),
		})
		.passthrough()
		.optional()
		.describe("组件样式（至少会补齐 top/left/width/height/zIndex）"),
});

export const createTextTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Text",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				content: input.content,
				fontSize: input.fontSize,
				fontWeight: input.fontWeight,
				color: input.color,
				textAlign: input.textAlign,
			},
		};
		return textComponentSchema.parse(node);
	},
	{
		name: "create_text_component",
		description: "生成 Text 组件（严格遵守前端 schema）",
		schema: baseToolInput.extend({
			content: z.string().describe("内容"),
			fontSize: z.number().describe("字体大小"),
			fontWeight: z.number().describe("字体粗细"),
			color: z.string().describe("颜色"),
			textAlign: z.enum(["左", "居中", "右"]).describe("对齐方式"),
		}),
	}
);

export const createImageTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Image",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				src: input.src,
				alt: input.alt,
				fit: input.fit,
				preview: input.preview,
			},
		};
		return imageComponentSchema.parse(node);
	},
	{
		name: "create_image_component",
		description: "生成 Image 组件（严格遵守前端 schema）",
		schema: baseToolInput.extend({
			src: z.string().describe("图片地址"),
			alt: z.string().optional().describe("备用文案"),
			fit: z.enum(["fill", "contain", "cover", "none", "scale-down"]).describe("对齐模式"),
			preview: z.boolean().optional().describe("是否启用预览"),
		}),
	}
);

export const createButtonTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Button",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				text: input.text,
				type: input.type,
				size: input.size,
				danger: input.danger,
				block: input.block,
				disabled: input.disabled,
			},
		};
		return buttonComponentSchema.parse(node);
	},
	{
		name: "create_button_component",
		description: "生成 Button 组件（严格遵守前端 schema）",
		schema: baseToolInput.extend({
			text: z.string().describe("按钮文案"),
			type: z.enum(["default", "primary", "dashed", "link", "text"]).describe("视觉类型"),
			size: z.enum(["small", "middle", "large"]).describe("尺寸"),
			danger: z.boolean().optional().describe("危险态"),
			block: z.boolean().optional().describe("是否通栏"),
			disabled: z.boolean().optional().describe("是否禁用"),
		}),
	}
);

export const createClockTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Clock",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				format: input.format,
				fontSize: input.fontSize,
				fontWeight: input.fontWeight,
				color: input.color,
				textAlign: input.textAlign,
				showSeconds: input.showSeconds,
			},
		};
		return clockComponentSchema.parse(node);
	},
	{
		name: "create_clock_component",
		description: "生成 Clock 组件（严格遵守前端 schema）",
		schema: baseToolInput.extend({
			format: z.string().describe("时间格式，例如：HH:mm:ss"),
			fontSize: z.number().describe("字体大小"),
			fontWeight: z.number().describe("字体粗细"),
			color: z.string().describe("颜色"),
			textAlign: z.enum(["左", "居中", "右"]).describe("对齐方式"),
			showSeconds: z.boolean().optional().describe("是否显示秒"),
		}),
	}
);

export const createStatisticCardTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "StatisticCard",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				title: input.title,
				subtitle: input.subtitle,
				value: input.value,
				prefix: input.prefix,
				suffix: input.suffix,
				valueColor: input.valueColor,
				align: input.align,
				trend: input.trend,
				showTrendIcon: input.showTrendIcon,
				trendColorUp: input.trendColorUp,
				trendColorDown: input.trendColorDown,
				animated: input.animated,
				valueFontSize: input.valueFontSize,
				titleFontSize: input.titleFontSize,
				subtitleFontSize: input.subtitleFontSize,
			},
		};
		return statisticCardComponentSchema.parse(node);
	},
	{
		name: "create_statistic_card_component",
		description: "生成 StatisticCard 组件（严格遵守前端 schema）",
		schema: baseToolInput.extend({
			title: z.string().describe("主标题"),
			subtitle: z.string().optional().describe("副标题"),
			value: z.number().describe("数值"),
			prefix: z.string().optional().describe("前缀"),
			suffix: z.string().optional().describe("后缀"),
			valueColor: z.string().describe("数值颜色"),
			align: z.enum(["左", "居中", "右"]).describe("对齐"),
			trend: z.enum(["上升", "下降", "持平"]).optional().describe("趋势方向"),
			showTrendIcon: z.boolean().optional().describe("显示趋势图标"),
			trendColorUp: z.string().optional().describe("上升颜色"),
			trendColorDown: z.string().optional().describe("下降颜色"),
			animated: z.boolean().optional().describe("数值动画"),
			valueFontSize: z.number().describe("数值字体大小"),
			titleFontSize: z.number().describe("标题字体大小"),
			subtitleFontSize: z.number().describe("副标题字体大小"),
		}),
	}
);

export const createProgressBarTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "ProgressBar",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				value: input.value,
				max: input.max,
				showLabel: input.showLabel,
				strokeColor: input.strokeColor,
				trackColor: input.trackColor,
				strokeWidth: input.strokeWidth,
				rounded: input.rounded,
				animation: input.animation,
			},
		};
		return progressBarComponentSchema.parse(node);
	},
	{
		name: "create_progress_bar_component",
		description: "生成 ProgressBar 组件（严格遵守前端 schema）",
		schema: baseToolInput.extend({
			value: z.number().describe("当前值"),
			max: z.number().describe("最大值"),
			showLabel: z.boolean().describe("显示文案"),
			strokeColor: z.string().describe("进度条颜色"),
			trackColor: z.string().describe("底色"),
			strokeWidth: z.number().describe("粗细"),
			rounded: z.boolean().describe("圆角"),
			animation: z.boolean().describe("动画过渡"),
		}),
	}
);

export const createCountdownTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Countdown",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				targetTime: input.targetTime,
				format: input.format,
				prefix: input.prefix,
				suffix: input.suffix,
				finishedText: input.finishedText,
				fontSize: input.fontSize,
				fontWeight: input.fontWeight,
				color: input.color,
				textAlign: input.textAlign,
				showMilliseconds: input.showMilliseconds,
			},
		};
		return countdownComponentSchema.parse(node);
	},
	{
		name: "create_countdown_component",
		description: "生成 Countdown 组件（严格遵守前端 schema）",
		schema: baseToolInput.extend({
			targetTime: z.string().describe("目标时间字符串（YYYY-MM-DD HH:mm:ss）"),
			format: z.string().describe("展示格式，如 HH:mm:ss"),
			prefix: z.string().optional().describe("前缀文案"),
			suffix: z.string().optional().describe("后缀文案"),
			finishedText: z.string().optional().describe("结束文案"),
			fontSize: z.number().describe("字号"),
			fontWeight: z.number().describe("字重"),
			color: z.string().describe("颜色"),
			textAlign: z.enum(["左", "居中", "右"]).describe("对齐"),
			showMilliseconds: z.boolean().optional().describe("是否显示毫秒"),
		}),
	}
);

export const createContainerTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Container",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			children: input.children ?? [],
		};
		return containerComponentSchema.parse(node);
	},
	{
		name: "create_container_component",
		description: "生成 Container 组件（严格遵守前端 schema）",
		schema: baseToolInput.extend({
			props: z
				.object({
					layoutMode: z.enum(["absolute", "flex"]).describe("布局模式"),
					gap: z.number().optional().describe("flex 模式下的间距"),
				})
				.optional()
				.describe("容器 props"),
			children: z
				.array(z.any())
				.optional()
				.describe("子组件数组（建议由 agent 先用其它工具生成后再组装）"),
		}),
	}
);

// 图表组件工具：dataSource 在组件顶层，字段映射统一用 fieldMapping
const chartDataSourceInput = z.object({
	sourceType: z.enum(["static", "api"]).describe("数据来源"),
	data: z.array(z.unknown()).describe("静态数据"),
	apiUrl: z.string().optional(),
	refreshInterval: z.number().optional(),
	fieldMapping: z.record(z.string()).optional().describe("字段映射，key 为语义名(x/y/name/value/series/category/size)，value 为数据字段名"),
});

const chartBaseInput = z.object({
	title: z.string(),
	showGrid: z.boolean().optional(),
	showLegend: z.boolean(),
	tooltipEnabled: z.boolean(),
});

export const createBarChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "BarChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return barChartComponentSchema.parse(node);
	},
	{
		name: "create_bar_chart_component",
		description: "生成 BarChart 组件。dataSource.fieldMapping 需含 x(类目) 和 y(数值)",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				barColor: z.string().optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createMultiBarChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "MultiBarChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return multiBarChartComponentSchema.parse(node);
	},
	{
		name: "create_multi_bar_chart_component",
		description: "生成 MultiBarChart 组件。dataSource.fieldMapping 需含 x、y、series",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				colorPalette: z.array(z.string()).optional(),
				isStack: z.boolean().optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createLineChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "LineChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return lineChartComponentSchema.parse(node);
	},
	{
		name: "create_line_chart_component",
		description: "生成 LineChart 组件。dataSource.fieldMapping 需含 x 和 y",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				lineColor: z.string().optional(),
				smooth: z.boolean().optional(),
				areaStyle: z.boolean().optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createAreaChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "AreaChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return areaChartComponentSchema.parse(node);
	},
	{
		name: "create_area_chart_component",
		description: "生成 AreaChart 组件。dataSource.fieldMapping 需含 x 和 y",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				lineColor: z.string().optional(),
				smooth: z.boolean().optional(),
				areaStyle: z.boolean().optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createMultiLineChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "MultiLineChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return multiLineChartComponentSchema.parse(node);
	},
	{
		name: "create_multi_line_chart_component",
		description: "生成 MultiLineChart 组件。dataSource.fieldMapping 需含 x、y、series",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				colorPalette: z.array(z.string()).optional(),
				smooth: z.boolean().optional(),
				areaStyle: z.boolean().optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createScatterChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "ScatterChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return scatterChartComponentSchema.parse(node);
	},
	{
		name: "create_scatter_chart_component",
		description: "生成 ScatterChart 组件。dataSource.fieldMapping 需含 x 和 y",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				pointSize: z.number().optional(),
				pointColor: z.string().optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createBubbleChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "BubbleChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return bubbleChartComponentSchema.parse(node);
	},
	{
		name: "create_bubble_chart_component",
		description: "生成 BubbleChart 组件。dataSource.fieldMapping 需含 x、y、size，可选 category",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				pointSize: z.number().optional(),
				pointColor: z.string().optional(),
				sizeRange: z.tuple([z.number(), z.number()]).nullable().optional(),
				colorPalette: z.array(z.string()).optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createHorizontalBarChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "HorizontalBarChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return horizontalBarChartComponentSchema.parse(node);
	},
	{
		name: "create_horizontal_bar_chart_component",
		description: "生成 HorizontalBarChart 组件。dataSource.fieldMapping 需含 category 和 value",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				barColor: z.string().optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createPieChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "PieChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return pieChartComponentSchema.parse(node);
	},
	{
		name: "create_pie_chart_component",
		description: "生成 PieChart 组件。dataSource.fieldMapping 需含 name 和 value",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				innerRadius: z.number().optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createRosePieChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "RosePieChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return rosePieChartComponentSchema.parse(node);
	},
	{
		name: "create_rose_pie_chart_component",
		description: "生成 RosePieChart 组件。dataSource.fieldMapping 需含 name 和 value",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				innerRadius: z.number().optional(),
				roseType: z.enum(["area", "radius"]).nullable().optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

// =============================
// 新增基础组件工具（6 个）
// =============================

export const createDividerTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Divider",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				direction: input.direction,
				text: input.text,
				textPosition: input.textPosition,
				lineStyle: input.lineStyle,
				color: input.color,
			},
		};
		return dividerComponentSchema.parse(node);
	},
	{
		name: "create_divider_component",
		description: "生成 Divider 分割线组件，支持水平/垂直方向、中间文字、线型（实/虚/点）",
		schema: baseToolInput.extend({
			direction: z.enum(["horizontal", "vertical"]).describe("方向：水平或垂直"),
			text: z.string().optional().describe("中间文字"),
			textPosition: z.enum(["left", "center", "right"]).describe("文字位置"),
			lineStyle: z.enum(["solid", "dashed", "dotted"]).describe("线型"),
			color: z.string().describe("颜色"),
		}),
	}
);

export const createBadgeTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Badge",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				count: input.count,
				overflowCount: input.overflowCount,
				showZero: input.showZero,
				dot: input.dot,
				color: input.color,
				text: input.text,
				fontSize: input.fontSize,
			},
		};
		return badgeComponentSchema.parse(node);
	},
	{
		name: "create_badge_component",
		description: "生成 Badge 徽标数组件，支持数字/小红点模式、溢出封顶",
		schema: baseToolInput.extend({
			count: z.number().describe("展示的数字"),
			overflowCount: z.number().describe("封顶数字，超出显示 xx+"),
			showZero: z.boolean().describe("值为 0 时是否显示"),
			dot: z.boolean().describe("不展示数字，只展示一个小红点"),
			color: z.string().describe("小圆点颜色"),
			text: z.string().describe("正文内容"),
			fontSize: z.number().describe("正文字号"),
		}),
	}
);

export const createTagTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Tag",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				text: input.text,
				color: input.color,
				bordered: input.bordered,
				fontSize: input.fontSize,
			},
		};
		return tagComponentSchema.parse(node);
	},
	{
		name: "create_tag_component",
		description: "生成 Tag 标签组件，支持颜色、边框、字号",
		schema: baseToolInput.extend({
			text: z.string().describe("标签文字"),
			color: z.string().describe("标签颜色"),
			bordered: z.boolean().describe("是否有边框"),
			fontSize: z.number().describe("字号"),
		}),
	}
);

export const createAvatarTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Avatar",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				src: input.src,
				text: input.text,
				shape: input.shape,
				size: input.size,
				backgroundColor: input.backgroundColor,
				color: input.color,
			},
		};
		return avatarComponentSchema.parse(node);
	},
	{
		name: "create_avatar_component",
		description: "生成 Avatar 头像组件，支持图片/文字、圆形/方形、自定义尺寸颜色",
		schema: baseToolInput.extend({
			src: z.string().optional().describe("图片地址"),
			text: z.string().describe("文字（无图片时展示）"),
			shape: z.enum(["circle", "square"]).describe("形状"),
			size: z.number().describe("尺寸 px"),
			backgroundColor: z.string().describe("背景色"),
			color: z.string().describe("文字颜色"),
		}),
	}
);

export const createRateTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Rate",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				value: input.value,
				count: input.count,
				allowHalf: input.allowHalf,
				color: input.color,
				size: input.size,
			},
		};
		return rateComponentSchema.parse(node);
	},
	{
		name: "create_rate_component",
		description: "生成 Rate 评分组件，支持半选、自定义颜色和星星大小",
		schema: baseToolInput.extend({
			value: z.number().describe("当前评分值"),
			count: z.number().describe("总星数"),
			allowHalf: z.boolean().describe("是否允许半选"),
			color: z.string().describe("选中颜色"),
			size: z.number().describe("星星大小 px"),
		}),
	}
);

export const createSwitchTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "Switch",
			name: input.name,
			style: ensureStyle(input.style),
			props: {
				checked: input.checked,
				checkedText: input.checkedText,
				uncheckedText: input.uncheckedText,
				size: input.size,
				disabled: input.disabled,
			},
		};
		return switchComponentSchema.parse(node);
	},
	{
		name: "create_switch_component",
		description: "生成 Switch 开关组件，支持选中/未选中文字、两种尺寸",
		schema: baseToolInput.extend({
			checked: z.boolean().describe("是否选中"),
			checkedText: z.string().describe("选中时文字"),
			uncheckedText: z.string().describe("未选中时文字"),
			size: z.enum(["default", "small"]).describe("尺寸"),
			disabled: z.boolean().describe("是否禁用"),
		}),
	}
);

// =============================
// 新增图表组件工具（4 个）
// =============================

export const createRadarChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "RadarChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return radarChartComponentSchema.parse(node);
	},
	{
		name: "create_radar_chart_component",
		description: "生成 RadarChart 雷达图组件，用于多维度指标对比。不使用 fieldMapping，通过 indicators 定义维度",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				indicators: z.array(z.object({ name: z.string(), max: z.number() })).describe("雷达指标列表，每项含 name 和 max"),
				colorPalette: z.array(z.string()).optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createFunnelChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "FunnelChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return funnelChartComponentSchema.parse(node);
	},
	{
		name: "create_funnel_chart_component",
		description: "生成 FunnelChart 漏斗图组件。dataSource.fieldMapping 需含 name 和 value",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				sort: z.enum(["ascending", "descending", "none"]).optional().describe("排序方式"),
				colorPalette: z.array(z.string()).optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

export const createGaugeChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "GaugeChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
		};
		return gaugeChartComponentSchema.parse(node);
	},
	{
		name: "create_gauge_chart_component",
		description: "生成 GaugeChart 仪表盘组件，用于单值进度展示，无需 dataSource",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				value: z.number().describe("当前值"),
				min: z.number().describe("最小值"),
				max: z.number().describe("最大值"),
				gaugeColor: z.string().optional().describe("仪表盘颜色"),
				unit: z.string().optional().describe("单位文字"),
			}),
		}),
	}
);

export const createTreemapChartTool = tool(
	async (input) => {
		const node = {
			id: ensureId(input.id),
			type: "TreemapChart",
			name: input.name,
			style: ensureStyle(input.style),
			props: input.props,
			dataSource: input.dataSource,
		};
		return treemapChartComponentSchema.parse(node);
	},
	{
		name: "create_treemap_chart_component",
		description: "生成 TreemapChart 矩形树图组件。dataSource.fieldMapping 需含 name 和 value",
		schema: baseToolInput.extend({
			props: chartBaseInput.extend({
				colorPalette: z.array(z.string()).optional(),
			}),
			dataSource: chartDataSourceInput.optional(),
		}),
	}
);

// 页面配置更新工具：修改根节点 props（标题/描述）和 settings（宽高/背景等）
// 集成了背景图搜索能力，传入 backgroundImageQuery 即可自动联网搜索并填入
export const updatePageConfigTool = tool(
	async (input) => {
		const config: Record<string, any> = {};
		if (input.props) config.props = input.props;

		// 构建 settings，若传了 backgroundImageQuery 则联网搜图后自动写入
		let settings: Record<string, any> = input.settings ? { ...input.settings } : {};
		if (input.backgroundImageQuery) {
			try {
				const imageUrls = await searchBackgroundImages(input.backgroundImageQuery);
				if (imageUrls.length > 0) {
					settings.backgroundImage = imageUrls[0];
				}
			} catch (err: any) {
				console.warn("[updatePageConfigTool] 背景图搜索失败:", err.message);
			}
		}
		if (Object.keys(settings).length > 0) {
			config.settings = settings;
		}

		return config;
	},
	{
		name: "update_page_config",
		description:
			"修改大屏根节点配置，包括页面标题(title)、描述(description)、背景色(backgroundColor)、背景图(backgroundImage)、画布宽高(width/height)、网格大小(gridSize)。支持通过 backgroundImageQuery 联网搜索背景图并自动填入。不影响 children 组件。",
		schema: z.object({
			props: z
				.object({
					title: z.string().optional().describe("页面标题"),
					description: z.string().optional().describe("页面描述"),
				})
				.optional()
				.describe("根节点 props，不传则不修改"),
			settings: z
				.object({
					width: z.union([z.number(), z.string()]).optional().describe("画布宽度，默认1920"),
					height: z.union([z.number(), z.string()]).optional().describe("画布高度，默认1080"),
					backgroundColor: z.string().optional().describe("背景颜色，CSS颜色值"),
					backgroundImage: z.string().optional().describe("背景图片URL"),
					gridSize: z.number().optional().describe("网格大小，默认15"),
				})
				.optional()
				.describe("页面设置，不传则不修改"),
			backgroundImageQuery: z
				.string()
				.optional()
				.describe(
					"背景图搜索关键词。传入后系统会联网搜索并自动将最佳结果写入 settings.backgroundImage。建议用英文获得更好结果，如 'dark blue tech dashboard background 1920x1080'。"
				),
		}),
	}
);

// 统一导出工具列表：agent 直接挂载即可
export const componentTools = [
	componentPaletteTool,
	updatePageConfigTool,
	createTextTool,
	createImageTool,
	createButtonTool,
	createClockTool,
	createStatisticCardTool,
	createProgressBarTool,
	createCountdownTool,
	createContainerTool,
	createDividerTool,
	createBadgeTool,
	createTagTool,
	createAvatarTool,
	createRateTool,
	createSwitchTool,
	createBarChartTool,
	createMultiBarChartTool,
	createLineChartTool,
	createAreaChartTool,
	createMultiLineChartTool,
	createScatterChartTool,
	createBubbleChartTool,
	createHorizontalBarChartTool,
	createPieChartTool,
	createRosePieChartTool,
	createRadarChartTool,
	createFunnelChartTool,
	createGaugeChartTool,
	createTreemapChartTool,
];
