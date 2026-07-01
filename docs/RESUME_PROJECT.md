# Industrial AI OS 简历项目描述

以下内容可按简历篇幅直接复制或删减。

## 标准版

**Industrial AI OS｜工业人工智能办公操作系统**

技术栈：JavaScript、HTML5、CSS3、Node.js、Express、SQLite、JWT、DeepSeek/OpenAI-compatible API、SheetJS、PDF.js、Tesseract.js

- 独立设计并开发面向制造业与企业办公场景的 Web AI 工作台，采用深色工业驾驶舱 UI，支持 Windows、macOS、Linux、手机和平板浏览器。
- 设计统一 AI Gateway，业务模块通过统一接口调用真实模型，支持 Mock、API、Hybrid 模式和异常兜底，避免前端暴露 API Key。
- 完成 AI 生产计划闭环：支持订单粘贴与 CSV 导入，结合设备台账、工艺、负载和维护状态，输出生产计划、交期风险、物料风险、每日安排及生产日报。
- 完成 Excel 发货单智能处理，自动识别产品明细区，统计数量和金额，过滤电话、备注、合计等非业务数据，并提供查重、分类、分析和导出能力。
- 集成 PDF.js、Tesseract.js、Mammoth、SheetJS 等前端文件处理能力，实现 PDF 文字提取与总结、OCR 结构化识别、Word 处理、PPT 逐页大纲及多格式导出。
- 构建系统状态中心和验收中心，对 PDF、OCR、PPT、生产计划、CSV、设备台账、API 和模型状态进行可视化检查，提升演示稳定性和可维护性。
- 项目支持 Node.js 本地运行、静态构建、GitHub Pages 前端部署和 Vercel API 部署，并为后续 MES/ERP、知识库和工作流集成预留模块化接口。

## 精简版

开发 Industrial AI OS 工业 AI 工作台，通过统一 AI Gateway 接入真实模型，完成订单 CSV 导入、设备约束排产、Excel 发货单统计、PDF/OCR/PPT 智能处理及生产日报导出；采用 JavaScript + Node.js + Express + SQLite 架构，支持 Mock/API 双模式、响应式多端访问、GitHub Pages/Vercel 部署和系统验收检查。

## 面试讲解重点

1. 为什么做：制造业办公数据分散在 Excel、PDF、图片和业务系统中，需要统一智能入口。
2. 最难点：不是调用一次模型，而是把订单、设备、文件解析、AI 输出、错误兜底和人工确认串成闭环。
3. 技术亮点：AI Gateway 解耦、结构化订单解析、设备约束排产、浏览器文件处理、Mock/API 双模式、可观测验收。
4. 可扩展性：下一阶段可接入工单、报警、RAG 知识库和企业级后端同步。

## 项目链接占位

```text
GitHub：https://github.com/shirunjies8-png/personal-ai-os-ai-ai-erp
Demo：https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/
```
