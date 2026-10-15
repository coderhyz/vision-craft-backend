import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { COMPONENT_TYPES } from "./schema.ts";

interface ComponentNode {
	id: string;
	type: string;
	name?: string;
	children?: ComponentNode[];
}
/**
 * 
 * @param children 
 * @returns 
 */
export function buildComponentManifest(children: ComponentNode[] = []): string {
	if (!children || children.length === 0) {
		return "当前画布为空，没有已存在的组件。所有组件均为新增，不需要传 id。";
	}
	const lines: string[] = [];
	const walk = (nodes: ComponentNode[]) => {
		for (const node of nodes) {
			lines.push(`- id: "${node.id}", type: "${node.type}", name: "${node.name || ""}"`);
			if (Array.isArray(node.children)) walk(node.children);
		}
	};
	walk(children);
	return [
		"当前画布已有以下组件（修改已有组件时必须使用对应的 id，严禁编造 id）：",
		...lines,
		"",
		"规则：修改已有组件 → 必须传该组件的 id；新增组件 → 不传 id（系统自动生成）。",
	].join("\n");
}

export function buildSystemMessage(): SystemMessage {
	return new SystemMessage(
		[
			"你是大屏组件 Schema 生成助手，请严格输出 JSON，符合规定的 DSL 格式。",
			"默认的大屏尺寸是1920*1080，网格大小是15，请注意组件的尺寸和边界，不要超出大屏。",
			`允许的组件类型: ${COMPONENT_TYPES.join(", ")}。`,
			"",
			"## 组件分类与选型指南",
			"",
			"### 基础组件（antd 封装）",
			"- Text: 文本展示，支持字号/颜色/对齐",
			"- Image: 图片展示，支持 fit 模式",
			"- Button: 按钮，支持 primary/dashed/link 等类型",
			"- Clock: 实时时钟，支持格式化",
			"- StatisticCard: 数据统计卡片，独占一行最多4个，多于4个需换行，排列类似 justify-evenly",
			"- ProgressBar: 进度条，支持颜色/圆角/动画",
			"- Countdown: 倒计时，支持目标时间",
			"- Divider: 分割线，用于区域分隔，支持 horizontal/vertical 方向、中间文字、solid/dashed/dotted 线型",
			"- Badge: 徽标数，用于消息/状态提示，支持数字/小红点模式、溢出封顶(overflowCount)",
			"- Tag: 标签，用于分类/状态标注，支持颜色、边框",
			"- Avatar: 头像，支持图片(src)/文字、circle/square 形状、自定义尺寸颜色",
			"- Rate: 评分，支持半选(allowHalf)、自定义颜色和星星大小",
			"- Switch: 开关，支持选中/未选中文字、default/small 两种尺寸",
			"- Container: 容器，支持 absolute/flex 布局，可嵌套子组件",
			"",
			"### 图表组件（echarts 封装）",
			"图表组件结构：dataSource 在组件顶层（与 props 同级），字段映射统一放在 dataSource.fieldMapping 中。",
			"fieldMapping 的 key 为语义名（x/y/name/value/series/category/size），value 为数据中的实际字段名。",
			"- BarChart/MultiBarChart: 柱状图，fieldMapping 需含 x+y，多序列需 series",
			"- LineChart/MultiLineChart/AreaChart: 折线/面积图，fieldMapping 需含 x+y，多序列需 series",
			"- PieChart/RosePieChart: 饼图/玫瑰图，fieldMapping 需含 name+value",
			"- ScatterChart/BubbleChart: 散点/气泡图，fieldMapping 需含 x+y，气泡还需 size，可选 category",
			"- HorizontalBarChart: 横向柱状图，fieldMapping 需含 category+value",
			"- RadarChart: 雷达图，多维度指标对比，需 props.indicators 数组(每项含 name+max)，不使用 fieldMapping，data 中字段名对应 indicator.name",
			"- FunnelChart: 漏斗图，fieldMapping 需含 name+value，支持 sort(ascending/descending/none)",
			"- GaugeChart: 仪表盘，单值进度展示，需 props 中 value+min+max，可选 unit 和 gaugeColor，无需 dataSource",
			"- TreemapChart: 矩形树图，fieldMapping 需含 name+value",
			"",
			"## 核心规则",
			"组件 id 规则：修改已有组件时，必须使用用户消息中提供的真实 id，严禁自行编造 id；新增组件时，不要传 id 字段，系统会自动生成。",
			"必须包含：type:'RootContainer'，settings.width/height/gridSize，children 为组件数组。",
			"图表组件的 dataSource 在组件顶层（与 props 同级），字段映射用 dataSource.fieldMapping（key 为语义名如 x/y/name/value/series，value 为数据字段名）。GaugeChart 例外，直接在 props 中传 value 即可。",
			"样式 style 至少包含 top/left/width/height/zIndex。",
			"多轮对话时，仅操作需要变动的组件：修改已有组件 → 调用 create_* 工具并传入该组件的真实 id；新增组件 → 调用 create_* 工具但不传 id。不要重新生成未变动的组件。",
			"不得输出额外字段或评论。",
			"用户要求修改页面标题、描述、背景色、背景图、画布尺寸等根节点配置时，调用 update_page_config 工具。",
			"用户要求搜索或设置背景图时，调用 update_page_config 工具并在 backgroundImageQuery 字段传入搜索关键词，系统会自动联网搜索并设置背景图。",
		].join("\n")
	);
}
/**
 * 
 * @param userPrompt 用户的提示词
 * @param mode 用户要求的生成模式
 * @param componentManifest 
 * @returns 
 */
export function buildUserMessage(userPrompt: string, mode: string, componentManifest = ""): HumanMessage {
	const parts = [
		"用户需求：" + userPrompt,
		"生成模式：" + mode,
	];
	if (componentManifest) {
		parts.push(componentManifest);
	}
	parts.push("请直接返回 JSON 对象，无需解释。");
	return new HumanMessage(parts.join("\n"));
}
