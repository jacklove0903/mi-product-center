# 小米产品参数中心

一个基于 React + TypeScript + Vite 构建的小米产品参数对比网站，支持浏览和对比小米/Redmi 手机的详细规格参数。

## 功能特性

- **参数列表** — 按系列分类浏览小米和 Redmi 全系手机
- **参数对比** — 选择最多 4 款设备进行详细参数对比
- **系列筛选** — 侧边栏按品牌（Xiaomi / Redmi）和系列快速筛选

### 已支持系列

| 品牌 | 系列 |
|------|------|
| 小米 | 数字旗舰、MIX 系列、Civi 系列 |
| 红米 | K 系列、Turbo 系列、Note 系列、数字系列 |

### 即将支持

平板、手表、笔记本、汽车

## 技术栈

- React 19 + TypeScript
- Vite 8
- 数据采集脚本（Node.js + Axios + Cheerio）

## 快速开始

```bash
npm install
npm run dev
```

## 项目结构

```
src/
├── components/        # 页面组件（DeviceList、CompareView）
├── data/              # 设备数据
├── types/             # TypeScript 类型定义
tools/                 # 数据采集脚本
data/output/           # 采集输出的 JSON 数据
```
