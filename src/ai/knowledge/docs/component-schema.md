# Vision-Craft 组件 Schema 文档

本文档定义了 Vision-Craft 可视化大屏搭建平台的所有组件类型及其属性结构。

## 通用结构

### 基础组件节点 (BaseComponentNode)

所有组件共享以下字段：

- `id`: string — 组件唯一标识 (UUID)
- `type`: ComponentType — 组件类型枚举
- `name`: string (可选) — 图层面板显示名称
- `isHidden`: boolean (可选) — 是否隐藏
- `isLocked`: boolean (可选) — 是否锁定
- `style`: 样式对象，至少包含:
  - `top`: number — 上偏移 (px)
  - `left`: number — 左偏移 (px)
  - `width`: number — 宽度 (px)
  - `height`: number — 高度 (px)
  - `zIndex`: number — 层级
  - `opacity`: number (可选) — 透明度
  - `backgroundColor`: string (可选) — 背景颜色
  - `border`: string (可选) — 边框样式
  - `borderRadius`: number (可选) — 圆角

### 页面 DSL (PageDSL)

```json
{
  "id": "page-uuid",
  "name": "我的大屏",
  "type": "RootContainer",
  "props": {
    "title": "智慧园区运营大屏",
    "description": "描述"
  },
  "settings": {
    "width": 1920,
    "height": 1080,
    "backgroundColor": "#0a1628",
    "backgroundImage": "",
    "gridSize": 15
  },
  "children": []
}
```

默认大屏尺寸为 1920×1080，网格大小为 15。

## 基础组件 (14种)

### Text — 文本展示

props:
- `content`: string — 文本内容
- `fontSize`: number — 字号
- `fontWeight`: number — 字重
- `color`: string — 文字颜色
- `textAlign`: "左" | "居中" | "右" — 对齐方式

默认尺寸: 200×40

### Image — 图片展示

props:
- `src`: string — 图片地址
- `alt`: string (可选) — 备用文案
- `fit`: "fill" | "contain" | "cover" | "none" | "scale-down" — 填充模式
- `preview`: boolean (可选) — 是否启用预览

默认尺寸: 300×200

### Button — 按钮

props:
- `text`: string — 按钮文案
- `type`: "default" | "primary" | "dashed" | "link" | "text" — 视觉类型
- `size`: "small" | "middle" | "large" — 尺寸
- `danger`: boolean (可选) — 危险态
- `block`: boolean (可选) — 是否通栏
- `disabled`: boolean (可选) — 是否禁用

默认尺寸: 120×40

### Clock — 实时时钟

props:
- `format`: string — 时间格式，如 "HH:mm:ss"
- `fontSize`: number — 字号
- `fontWeight`: number — 字重
- `color`: string — 颜色
- `textAlign`: "左" | "居中" | "右"
- `showSeconds`: boolean (可选)

### StatisticCard — KPI 统计卡

props:
- `title`: string — 主标题
- `subtitle`: string (可选) — 副标题
- `value`: number — 数值
- `prefix`: string (可选) — 前缀
- `suffix`: string (可选) — 后缀
- `valueColor`: string — 数值颜色
- `align`: "左" | "居中" | "右"
- `trend`: "上升" | "下降" | "持平" (可选)
- `showTrendIcon`: boolean (可选)
- `trendColorUp` / `trendColorDown`: string (可选)
- `animated`: boolean (可选) — 数值动画
- `valueFontSize` / `titleFontSize` / `subtitleFontSize`: number

默认尺寸: 240×120。独占一行最多放 4 个，多于 4 个需换行。

### ProgressBar — 进度条

props:
- `value`: number — 当前值
- `max`: number — 最大值
- `showLabel`: boolean — 显示文案
- `strokeColor`: string — 进度条颜色
- `trackColor`: string — 底色
- `strokeWidth`: number — 粗细
- `rounded`: boolean — 圆角
- `animation`: boolean — 动画过渡

### Countdown — 倒计时

props:
- `targetTime`: string — 目标时间 (YYYY-MM-DD HH:mm:ss)
- `format`: string — 展示格式
- `prefix` / `suffix`: string (可选)
- `finishedText`: string (可选) — 结束文案
- `fontSize` / `fontWeight`: number
- `color`: string
- `textAlign`: "左" | "居中" | "右"
- `showMilliseconds`: boolean (可选)

### Divider — 分割线

props:
- `direction`: "horizontal" | "vertical"
- `text`: string (可选) — 中间文字
- `textPosition`: "left" | "center" | "right"
- `lineStyle`: "solid" | "dashed" | "dotted"
- `color`: string

### Badge — 徽标数

props:
- `count`: number — 展示的数字
- `overflowCount`: number — 封顶数字
- `showZero`: boolean
- `dot`: boolean — 只展示小红点
- `color`: string
- `text`: string — 正文内容
- `fontSize`: number

### Tag — 标签

props:
- `text`: string — 标签文字
- `color`: string — 标签颜色
- `bordered`: boolean
- `fontSize`: number

### Avatar — 头像

props:
- `src`: string (可选) — 图片地址
- `text`: string — 文字（无图时展示）
- `shape`: "circle" | "square"
- `size`: number — 尺寸 (px)
- `backgroundColor`: string
- `color`: string — 文字颜色

### Rate — 评分

props:
- `value`: number — 当前值
- `count`: number — 总星数
- `allowHalf`: boolean
- `color`: string
- `size`: number — 星星大小 (px)

### Switch — 开关

props:
- `checked`: boolean
- `checkedText` / `uncheckedText`: string
- `size`: "default" | "small"
- `disabled`: boolean

### Container — 容器

props:
- `layoutMode`: "absolute" | "flex" — 布局模式
- `gap`: number (可选) — flex 间距

特殊字段:
- `children`: ComponentNode[] — 子组件数组（递归结构）

Container 是唯一支持嵌套子组件的组件类型。

## 图表组件 (14种)

所有图表组件共享以下结构：

```json
{
  "id": "xxx",
  "type": "BarChart",
  "name": "柱状图",
  "props": { "title": "...", "showLegend": true, "tooltipEnabled": true },
  "dataSource": {
    "sourceType": "static",
    "data": [...],
    "fieldMapping": { "x": "month", "y": "value" }
  },
  "style": { "top": 0, "left": 0, "width": 500, "height": 350, "zIndex": 1 }
}
```

图表通用 props (ChartBaseProps):
- `title`: string — 图表标题
- `showGrid`: boolean (可选)
- `showLegend`: boolean — 显示图例
- `tooltipEnabled`: boolean — 启用提示框

数据源 (dataSource) 在组件顶层（与 props 同级）：
- `sourceType`: "static" | "api"
- `data`: array — 静态数据
- `apiUrl`: string (可选) — API 地址
- `refreshInterval`: number (可选) — 自动刷新间隔 (ms)
- `fieldMapping`: Record<string, string> — 字段映射

### BarChart — 柱状图

额外 props: `barColor` (可选)
fieldMapping: `x` (必填) + `y` (必填)

### MultiBarChart — 多系列柱状图

额外 props: `colorPalette` (可选), `isStack` (可选)
fieldMapping: `x` + `y` + `series` (均必填)

### LineChart — 折线图

额外 props: `lineColor` (可选), `smooth` (可选), `areaStyle` (可选)
fieldMapping: `x` + `y` (必填)

### AreaChart — 面积图

与 LineChart 相同的 props 结构
fieldMapping: `x` + `y` (必填)

### MultiLineChart — 多系列折线图

额外 props: `colorPalette` (可选), `smooth` (可选), `areaStyle` (可选)
fieldMapping: `x` + `y` + `series` (均必填)

### ScatterChart — 散点图

额外 props: `pointSize` (可选), `pointColor` (可选)
fieldMapping: `x` + `y` (必填)

### BubbleChart — 气泡图

额外 props: `sizeRange` (可选), `colorPalette` (可选), `pointSize` / `pointColor` (可选)
fieldMapping: `x` + `y` + `size` (必填), `category` (可选)

### HorizontalBarChart — 横向柱状图

额外 props: `barColor` (可选)
fieldMapping: `category` + `value` (必填)

### PieChart — 饼图

额外 props: `innerRadius` (可选, 设为非 0 即为环形图)
fieldMapping: `name` + `value` (必填)

### RosePieChart — 玫瑰图

额外 props: `innerRadius` (可选), `roseType`: "area" | "radius" (可选)
fieldMapping: `name` + `value` (必填)

### RadarChart — 雷达图

额外 props:
- `indicators`: array of `{ name: string, max: number }` — 维度定义 (必填)
- `colorPalette` (可选)

注意：RadarChart 不使用 fieldMapping，数据中的字段名需对应 indicators 中的 name。

### FunnelChart — 漏斗图

额外 props: `sort`: "ascending" | "descending" | "none" (可选), `colorPalette` (可选)
fieldMapping: `name` + `value` (必填)

### GaugeChart — 仪表盘

额外 props:
- `value`: number — 当前值 (必填)
- `min`: number — 最小值 (必填)
- `max`: number — 最大值 (必填)
- `gaugeColor` (可选)
- `unit` (可选)

注意：GaugeChart 不需要 dataSource，数据直接在 props 中配置。

### TreemapChart — 矩形树图

额外 props: `colorPalette` (可选)
fieldMapping: `name` + `value` (必填)
