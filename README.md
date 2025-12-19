# 🏆 慧眼 (InsightEye) - AI 商业智能选址助手

> **2025 高德空间智能开发者大赛 参赛作品**
> 
> [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
> ![Platform: AMap JS API 2.0](https://img.shields.io/badge/Platform-AMap%20JS%20API%202.0-blue)

本项目通过高德 LBS 动态拓扑扫描与生成式 AI 规则引擎，为中小商家提供“即点即得”的电影级商业选址分析。

---


## 🌟 核心亮点 (Key Features)

* **⚡ 动态空间拓扑扫描**：实时调用高德 `placeSearch` 插件，基于“商务/下沉/社区”三种策略模型，动态推演周边 3km 范围内的商业锚点。
* **🧠 生成式 AI 评分引擎**：内置空间衰减算法，结合 `GeometryUtil` 几何运算，对选址坐标进行 0-100 分的量化评级，并一键生成商业计划书（PDF）。
* **🎬 电影级 3D 交互**：深度定制高德 JS API 2.0 的 `viewMode: '3D'`，支持自动 `panTo` 丝滑平移与根据业务场景动态切换的 `zoom` 缩放视角。
* **🔮 决策进化架构**：底层架构预留 LLM (大语言模型) 接入接口，支持未来从结构化数据向认知决策的平滑演进。

## 🛠️ 技术栈 (Tech Stack)

* **Map SDK**: 高德地图 JS API v2.0 (Loca/3D Mode)
* **Core Plugins**: `AMap.PlaceSearch`, `AMap.GeometryUtil`, `AMap.Geocoder`
* **Logic**: 原生 JavaScript (ES6+) 实现的 `STRATEGY_CONFIG` 规则矩阵
* **Reporting**: `html2pdf.js` 异步导出引擎

## 🚀 快速启动 (Quick Start)

1. **克隆项目**
   ```bash
   git clone [https://github.com/vivihe9/InsightEye-AMap](https://github.com/vivihe9/InsightEye-AMap)


2. **配置 Key 在 script.js 中填入你的高德 API Key 和安全密钥（请先在本地清理真实 Key 后上传）：**
   ```JavaScript
// 1. 配置安全密钥
window._AMapSecurityConfig = { 
    securityJsCode: '你的安全密钥' 
};

// 2. 在 AMapLoader.load 处配置 Key
key: '你的API Key'


3. **克运行 直接通过浏览器打开 index.html 即可进入商业指挥室。**

## 📖 交互指南 (Interaction)
* 选择模式：在左上角控制面板选择“商务精英”、“下沉性价比”或“社区生活”模式。

* 精准定穴：在地图上任意点击，系统将自动执行 3D 镜头拉近并开启周边资源动态扫描。

* 生成报告：点击“生成商业计划书”，系统将基于当前空间数据即时生成 PDF 研报。

## 📈 未来展望 (Roadmap)
* Agent 自动化：接入 LLM 智能体，支持自然语言驱动的复杂选址任务扫描。
* 多维数据集成：引入高德实时路况、动态人口热力及周边竞品口碑数据。

© 2025 高德空间智能开发者大赛 参赛组委会
