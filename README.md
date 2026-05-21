# 体曰 · Body Voice

你的身体有自己的社交账号。

上传可穿戴设备数据（Oura / Apple Watch / Whoop），AI 以身体的语气生成每日动态 + 签文。

## 4 种人格

| 人格 | 风格 |
|------|------|
| **懒得伺候者** | 室友吐槽风，数据差时嘴臭，数据好时正常 |
| **上奏者** | 臣心率谨奏——文言奏折口吻 |
| **记录者** | 冷面系统简报，"简报：睡眠4h42m。建议关注。自动生成。" |
| **守护者** | Baymax 式医疗机器人，平静专业的医学观察 |

## 快速开始

```bash
npm install
cp .env.example .env   # 填入 DEEPSEEK_API_KEY
node server.js          # → http://localhost:3000
```

## 部署

```bash
vercel --prod
```

需要 `DEEPSEEK_API_KEY` 环境变量。

## 技术栈

- 纯前端（HTML/CSS/JS），无框架
- 后端：Node.js（本地）/ Vercel Serverless Functions
- AI：DeepSeek Chat API
- 数据源：Oura / Apple Health XML / Whoop CSV
