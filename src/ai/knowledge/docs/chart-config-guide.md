# Vision-Craft 图表配置与数据源指南

本文档详解图表组件的数据源配置、字段映射规范和最佳实践。

## 数据源结构

图表数据源 (dataSource) 位于组件顶层，与 props 同级：

```json
{
  "type": "BarChart",
  "props": { ... },
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "month": "1月", "value": 350 },
      { "month": "2月", "value": 480 }
    ],
    "fieldMapping": {
      "x": "month",
      "y": "value"
    }
  }
}
```

### sourceType 类型

- `"static"`: 静态数据，直接在 `data` 数组中提供 JSON 数据
- `"api"`: API 接口数据，配置 `apiUrl` 和可选的 `refreshInterval`

### fieldMapping 规范

fieldMapping 使用语义化 key 映射到数据中的实际字段名：

| 语义 key | 用途 | 示例值 |
|----------|------|--------|
| `x` | X 轴类目字段 | "month", "date", "category" |
| `y` | Y 轴数值字段 | "value", "amount", "count" |
| `name` | 名称字段（饼图等） | "name", "label", "category" |
| `value` | 数值字段（饼图等） | "value", "amount" |
| `series` | 系列分组字段 | "type", "category", "group" |
| `category` | 类目字段（横向柱状图等） | "department", "region" |
| `size` | 尺寸字段（气泡图） | "population", "volume" |

## 各图表类型的 fieldMapping 要求

### 柱状图 (BarChart)

必填: `x`, `y`

```json
{
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "month": "1月", "sales": 350 },
      { "month": "2月", "sales": 480 },
      { "month": "3月", "sales": 620 }
    ],
    "fieldMapping": { "x": "month", "y": "sales" }
  }
}
```

### 多系列柱状图 (MultiBarChart)

必填: `x`, `y`, `series`

```json
{
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "month": "1月", "value": 350, "type": "线上" },
      { "month": "1月", "value": 200, "type": "线下" },
      { "month": "2月", "value": 480, "type": "线上" },
      { "month": "2月", "value": 310, "type": "线下" }
    ],
    "fieldMapping": { "x": "month", "y": "value", "series": "type" }
  }
}
```

props 可配置 `isStack: true` 实现堆叠柱状图。

### 折线图 (LineChart) / 面积图 (AreaChart)

必填: `x`, `y`

```json
{
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "date": "03-01", "temperature": 12 },
      { "date": "03-02", "temperature": 15 },
      { "date": "03-03", "temperature": 11 }
    ],
    "fieldMapping": { "x": "date", "y": "temperature" }
  }
}
```

### 多系列折线图 (MultiLineChart)

必填: `x`, `y`, `series`

与 MultiBarChart 类似，通过 series 字段区分系列。

### 饼图 (PieChart) / 玫瑰图 (RosePieChart)

必填: `name`, `value`

```json
{
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "category": "电子产品", "amount": 4500 },
      { "category": "服装", "amount": 3200 },
      { "category": "食品", "amount": 2800 }
    ],
    "fieldMapping": { "name": "category", "value": "amount" }
  }
}
```

PieChart 设置 `props.innerRadius` 非 0 可变为环形图。
RosePieChart 额外支持 `props.roseType: "area" | "radius"`。

### 散点图 (ScatterChart)

必填: `x`, `y`

```json
{
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "height": 170, "weight": 65 },
      { "height": 175, "weight": 72 },
      { "height": 168, "weight": 58 }
    ],
    "fieldMapping": { "x": "height", "y": "weight" }
  }
}
```

### 气泡图 (BubbleChart)

必填: `x`, `y`, `size`; 可选: `category`

```json
{
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "gdp": 14.7, "population": 14.1, "area": 960, "region": "亚洲" },
      { "gdp": 21.4, "population": 3.3, "area": 983, "region": "北美" }
    ],
    "fieldMapping": { "x": "gdp", "y": "population", "size": "area", "category": "region" }
  }
}
```

### 横向柱状图 (HorizontalBarChart)

必填: `category`, `value`

```json
{
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "department": "研发部", "headcount": 120 },
      { "department": "市场部", "headcount": 85 },
      { "department": "销售部", "headcount": 95 }
    ],
    "fieldMapping": { "category": "department", "value": "headcount" }
  }
}
```

### 雷达图 (RadarChart)

注意：RadarChart 不使用 fieldMapping。需要在 props 中定义 indicators，数据字段名与 indicator.name 对应。

```json
{
  "props": {
    "title": "能力评估",
    "showLegend": true,
    "tooltipEnabled": true,
    "indicators": [
      { "name": "销售", "max": 100 },
      { "name": "管理", "max": 100 },
      { "name": "技术", "max": 100 },
      { "name": "服务", "max": 100 }
    ]
  },
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "销售": 80, "管理": 70, "技术": 90, "服务": 85 }
    ]
  }
}
```

### 漏斗图 (FunnelChart)

必填: `name`, `value`

```json
{
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "stage": "访问", "count": 10000 },
      { "stage": "注册", "count": 5000 },
      { "stage": "下单", "count": 2000 },
      { "stage": "付款", "count": 1500 }
    ],
    "fieldMapping": { "name": "stage", "value": "count" }
  }
}
```

props 可配置 `sort: "ascending" | "descending" | "none"`。

### 仪表盘 (GaugeChart)

不需要 dataSource，数据直接配置在 props 中：

```json
{
  "props": {
    "title": "CPU 使用率",
    "showLegend": false,
    "tooltipEnabled": false,
    "value": 72.5,
    "min": 0,
    "max": 100,
    "unit": "%",
    "gaugeColor": "#5470c6"
  }
}
```

### 矩形树图 (TreemapChart)

必填: `name`, `value`

```json
{
  "dataSource": {
    "sourceType": "static",
    "data": [
      { "name": "视频", "size": 4500 },
      { "name": "图片", "size": 3200 },
      { "name": "文档", "size": 1800 },
      { "name": "音乐", "size": 900 }
    ],
    "fieldMapping": { "name": "name", "value": "size" }
  }
}
```

## API 数据源配置

```json
{
  "dataSource": {
    "sourceType": "api",
    "apiUrl": "https://api.example.com/dashboard/metrics",
    "refreshInterval": 30000,
    "fieldMapping": { "x": "date", "y": "value" }
  }
}
```

- `apiUrl`: 数据接口地址，需返回 JSON 数组
- `refreshInterval`: 自动刷新间隔（毫秒），如 30000 表示每 30 秒刷新
- fieldMapping 与静态数据源相同，映射 API 返回数据中的字段名
