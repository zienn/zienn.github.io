# 我的技术博客

零框架静态博客：一个约 300 行的 `build.mjs` 把 `content/posts/` 里的文章生成为纯静态站点 `dist/`。
唯一依赖是 `marked`（Markdown 解析）。代码高亮（highlight.js）与流程图（Mermaid）通过 CDN 在浏览器端渲染。

功能：首页文章列表 · 标签 / 分类 · 客户端全文搜索（按 `/` 聚焦） · 深色（默认）/ 浅色主题（`?theme=light` 可强制） · 每篇文章自动目录 · 代码块复制按钮。设计说明见 `DESIGN.md`。

## 目录结构

```
content/posts/     # 文章：一篇一个文件（.md 或 .html），以 _ 开头的文件不会发布
assets/            # style.css（全站样式 + 教程组件样式）、app.js（搜索/主题/目录/Mermaid）
site.config.json   # 站点标题、副标题、作者
build.mjs          # 生成器
scripts/serve.mjs  # 本地预览服务器（零依赖）
scripts/new-post.mjs
dist/              # 构建产物（部署这个目录）
```

## 新增文章

```bash
npm run new -- my-post "文章标题"         # 生成 content/posts/my-post.md
npm run new -- my-post "文章标题" html    # 或 HTML 版本（适合富交互教程）
```

或者手动新建文件，开头写 front matter：

```
---
title: 文章标题
date: 2026-10-10
tags: Android, 性能优化
category: Android
summary: 一句话摘要（首页与搜索结果展示）
draft: false          # 可选，true 时不发布
slug: custom-url      # 可选，默认取文件名
---
```

- **Markdown**：```` ```mermaid ```` 代码块会渲染成流程图；其它语言代码块自动高亮；可混写 HTML。
- **HTML**：直接写正文片段（不需要 `<html>/<head>`）。用 `<section>` 包裹一节会得到卡片样式；可使用 `callout`（`warn` / `danger` / `ok`）、`grid2` + `card`、`badge`、`stack` 等组件；`<pre class="mermaid">` 写流程图，`<pre><code class="language-xxx">` 写代码（`<`、`&` 需转义）。
- `h2` / `h3` 会自动生成文章目录。

## 预览与构建

```bash
npm install          # 首次
npm run build        # 生成 dist/
npm run preview      # http://localhost:4321/
npm run dev          # 监听 content/ 与 assets/ 变化，自动重新构建（配合 preview 使用，刷新即可）
```

`dist/` 里的页面全部使用相对路径，搜索索引是 `search-index.js`，所以**直接双击 `dist/index.html`（file://）也能浏览和搜索**（流程图与高亮需要联网加载 CDN）。

## 部署（静态输出 = `dist/`）

- **GitHub Pages**：已附带 `.github/workflows/deploy.yml`，推送到 `main` 后自动构建并发布（Settings → Pages → Source 选 GitHub Actions）。
- **Vercel**：Build Command `npm run build`，Output Directory `dist`。
- **Cloudflare Pages**：构建命令 `npm run build`，输出目录 `dist`。

因为站内链接都是相对路径，部署在子路径（如 `https://user.github.io/blog/`）下也无需额外配置；只有 `404.html` 用到 `site.config.json` 的 `base`（子路径部署时设为 `/blog`）。
