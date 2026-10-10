// 极简静态博客生成器：content/posts/*.{md,html} → dist/
// 用法：node build.mjs [--watch]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(ROOT, "content/posts");
const ASSETS_DIR = path.join(ROOT, "assets");
const OUT = path.join(ROOT, "dist");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));

const HLJS = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0";

// ---------- 工具函数 ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const stripTags = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/\s+/g, " ").trim();
const tagId = (t) => "t-" + Buffer.from(t).toString("hex").slice(0, 24);

function parseFrontMatter(src, file) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) throw new Error(`${file}: 缺少 front matter（--- ... ---）`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0 || !line.trim() || line.trim().startsWith("#")) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  meta.tags = (meta.tags || "").replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const k of ["title", "date"]) if (!meta[k]) throw new Error(`${file}: front matter 缺少 ${k}`);
  return { meta, body: src.slice(m[0].length) };
}

// Markdown：```mermaid 代码块 → <pre class="mermaid">
marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === "mermaid") return `<pre class="mermaid">${esc(text)}</pre>\n`;
      return `<pre><code class="language-${esc(lang || "plaintext")}">${esc(text)}</code></pre>\n`;
    },
  },
});

// 给 h2/h3 补 id，并生成 TOC
function buildToc(html) {
  const toc = [];
  let n = 0;
  const out = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g, (all, lvl, attrs, inner) => {
    let id = (attrs.match(/\sid="([^"]+)"/) || [])[1];
    if (!id) { id = `h-${++n}`; attrs += ` id="${id}"`; }
    toc.push({ lvl: Number(lvl), id, text: stripTags(inner) });
    return `<h${lvl}${attrs}>${inner}</h${lvl}>`;
  });
  let tocHtml = "<ol>";
  let open = false;
  for (const t of toc) {
    if (t.lvl === 2) { if (open) { tocHtml += "</ol></li>"; open = false; } tocHtml += `<li><a href="#${t.id}">${esc(t.text)}</a>`; tocHtml += "<ol>"; open = true; }
    else tocHtml += `<li><a href="#${t.id}">${esc(t.text)}</a></li>`;
  }
  if (open) tocHtml += "</ol></li>";
  tocHtml += "</ol>";
  tocHtml = tocHtml.replace(/<ol><\/ol>/g, "");
  return { html: out, tocHtml, count: toc.length };
}

// ---------- 页面骨架 ----------
function layout({ title, rel, body, desc = cfg.subtitle, extraHead = "" }) {
  return `<!DOCTYPE html>
<html lang="${cfg.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<script>(function(){var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;})();</script>
<link rel="stylesheet" href="${rel}assets/style.css">
<link rel="stylesheet" id="hljs-light" href="${HLJS}/styles/github.min.css">
<link rel="stylesheet" id="hljs-dark" href="${HLJS}/styles/github-dark.min.css">
${extraHead}
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="${rel}index.html">🧭 ${esc(cfg.title)}</a>
    <nav class="topnav">
      <a href="${rel}index.html">首页</a>
      <a href="${rel}tags/index.html">标签 / 分类</a>
      <a href="${rel}about.html">关于</a>
    </nav>
    <div class="search">
      <input id="search-input" type="search" placeholder="搜索文章…  (按 / 聚焦)" autocomplete="off" aria-label="搜索">
      <div id="search-results" class="search-results" hidden></div>
    </div>
    <button id="theme-toggle" class="theme-toggle" type="button" aria-label="切换深色/浅色">🌓</button>
  </div>
</header>
${body}
<footer class="site-footer">© ${new Date().getFullYear()} ${esc(cfg.author)} · ${esc(cfg.title)} · 由自制静态生成器构建</footer>
<script>window.SITE_REL=${JSON.stringify(rel)};</script>
<script src="${rel}search-index.js"></script>
<script src="${HLJS}/highlight.min.js"></script>
<script src="${HLJS}/languages/kotlin.min.js"></script>
<script src="${HLJS}/languages/go.min.js"></script>
<script src="${HLJS}/languages/yaml.min.js"></script>
<script src="${rel}assets/app.js"></script>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  window.__mermaid = mermaid;
  window.dispatchEvent(new Event("mermaid-ready"));
</script>
</body>
</html>`;
}

const tagChips = (tags, rel) => tags.map((t) => `<a class="chip" href="${rel}tags/index.html#${tagId(t)}">#${esc(t)}</a>`).join("");

function postCard(p, rel) {
  return `<article class="post-card">
  <div class="post-meta"><time datetime="${p.date}">${p.date}</time>${p.category ? ` · <span>${esc(p.category)}</span>` : ""} · 约 ${p.minutes} 分钟</div>
  <h2><a href="${rel}posts/${p.slug}.html">${esc(p.title)}</a></h2>
  <p>${esc(p.summary || "")}</p>
  <div class="chips">${tagChips(p.tags, rel)}</div>
</article>`;
}

// ---------- 构建 ----------
function build() {
  const t0 = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "posts"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "tags"), { recursive: true });
  fs.cpSync(ASSETS_DIR, path.join(OUT, "assets"), { recursive: true });

  const posts = [];
  for (const f of fs.readdirSync(POSTS_DIR).sort()) {
    const ext = path.extname(f);
    if (![".md", ".html"].includes(ext) || f.startsWith("_")) continue;
    const src = fs.readFileSync(path.join(POSTS_DIR, f), "utf8");
    const { meta, body } = parseFrontMatter(src, f);
    if (meta.draft === "true") continue;
    const raw = ext === ".md" ? marked.parse(body) : body;
    const { html, tocHtml, count } = buildToc(raw);
    const text = stripTags(html);
    posts.push({ ...meta, slug: meta.slug || path.basename(f, ext), html, tocHtml, tocCount: count, text,
      minutes: Math.max(1, Math.round(text.length / 500)) });
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));

  // 文章页
  posts.forEach((p, i) => {
    const rel = "../";
    const prev = posts[i + 1], next = posts[i - 1];
    const body = `<div class="post-layout${p.tocCount ? "" : " no-toc"}">
  ${p.tocCount ? `<aside class="post-toc"><div class="toc-title">📑 目录</div><nav id="toc">${p.tocHtml}</nav></aside>` : ""}
  <main class="post">
    <header class="hero">
      <div class="post-meta"><time datetime="${p.date}">${p.date}</time>${p.category ? ` · ${esc(p.category)}` : ""} · 约 ${p.minutes} 分钟阅读</div>
      <h1>${esc(p.title)}</h1>
      ${p.summary ? `<p>${esc(p.summary)}</p>` : ""}
      <div class="chips">${tagChips(p.tags, rel)}</div>
    </header>
    <div class="post-body">
${p.html}
    </div>
    <nav class="post-nav">
      ${prev ? `<a href="${prev.slug}.html">← ${esc(prev.title)}</a>` : "<span></span>"}
      ${next ? `<a href="${next.slug}.html">${esc(next.title)} →</a>` : "<span></span>"}
    </nav>
  </main>
</div>`;
    fs.writeFileSync(path.join(OUT, "posts", `${p.slug}.html`), layout({ title: `${p.title} | ${cfg.title}`, rel, body, desc: p.summary }));
  });

  // 标签 / 分类聚合
  const group = (key) => {
    const m = new Map();
    for (const p of posts) for (const v of key === "tags" ? p.tags : [p.category || "未分类"]) {
      if (!m.has(v)) m.set(v, []);
      m.get(v).push(p);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  };
  const tags = group("tags"), cats = group("category");

  // 首页
  {
    const rel = "";
    const body = `<main class="home">
  <section class="home-hero">
    <h1>${esc(cfg.title)}</h1>
    <p>${esc(cfg.subtitle)}</p>
    <div class="stats">${posts.length} 篇文章 · ${tags.length} 个标签 · ${cats.length} 个分类</div>
  </section>
  <div class="home-grid">
    <div class="post-list" id="post-list">
      ${posts.map((p) => postCard(p, rel)).join("\n")}
    </div>
    <aside class="sidebar">
      <div class="side-card"><h3>📂 分类</h3><ul>${cats.map(([c, ps]) => `<li><a href="tags/index.html#${tagId("cat:" + c)}">${esc(c)}</a> <span class="count">${ps.length}</span></li>`).join("")}</ul></div>
      <div class="side-card"><h3>🏷️ 标签</h3><div class="chips">${tags.map(([t, ps]) => `<a class="chip" href="tags/index.html#${tagId(t)}">#${esc(t)} <span class="count">${ps.length}</span></a>`).join("")}</div></div>
    </aside>
  </div>
</main>`;
    fs.writeFileSync(path.join(OUT, "index.html"), layout({ title: cfg.title, rel, body }));
  }

  // 标签页
  {
    const rel = "../";
    const list = (ps) => `<ul class="tag-posts">${ps.map((p) => `<li><time>${p.date}</time> <a href="../posts/${p.slug}.html">${esc(p.title)}</a></li>`).join("")}</ul>`;
    const body = `<main class="tags-page">
  <h1>📂 分类</h1>
  <div class="tag-groups">${cats.map(([c, ps]) => `<section class="tag-group" id="${tagId("cat:" + c)}"><h2>${esc(c)} <span class="count">${ps.length}</span></h2>${list(ps)}</section>`).join("")}</div>
  <h1>🏷️ 标签</h1>
  <div class="chips big">${tags.map(([t, ps]) => `<a class="chip" href="#${tagId(t)}">#${esc(t)} <span class="count">${ps.length}</span></a>`).join("")}</div>
  <div class="tag-groups">${tags.map(([t, ps]) => `<section class="tag-group" id="${tagId(t)}"><h2>#${esc(t)} <span class="count">${ps.length}</span></h2>${list(ps)}</section>`).join("")}</div>
</main>`;
    fs.writeFileSync(path.join(OUT, "tags", "index.html"), layout({ title: `标签 / 分类 | ${cfg.title}`, rel, body }));
  }

  // 关于页
  fs.writeFileSync(path.join(OUT, "about.html"), layout({ title: `关于 | ${cfg.title}`, rel: "", body: `<main class="tags-page"><h1>关于</h1>
<p>这里记录我对 Android、AI 基础设施和系统原理的学习与思考。复杂的概念尽量配上流程图、源码和可运行的示例。</p>
<p>本站由一个约 300 行的 Node.js 脚本生成，纯静态，可部署到 GitHub Pages / Vercel / Cloudflare Pages。</p></main>` }));

  // 搜索索引（以 JS 形式输出，保证 file:// 直接打开也能用）
  const index = posts.map((p) => ({ t: p.title, s: p.summary || "", g: p.tags, c: p.category || "", d: p.date, u: `posts/${p.slug}.html`, x: p.text.slice(0, 30000) }));
  fs.writeFileSync(path.join(OUT, "search-index.js"), "window.SEARCH_INDEX=" + JSON.stringify(index) + ";\n");
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
  fs.writeFileSync(path.join(OUT, "404.html"), layout({ title: "404", rel: (cfg.base || "") + "/", body: `<main class="tags-page"><h1>404 · 页面不存在</h1><p><a href="${(cfg.base || "") + "/"}index.html">返回首页</a></p></main>` }));

  console.log(`✔ 构建完成：${posts.length} 篇文章，${tags.length} 个标签 → dist/ (${Date.now() - t0}ms)`);
}

build();
if (process.argv.includes("--watch")) {
  console.log("👀 监听 content/ 与 assets/ 变化…");
  let timer;
  for (const d of [POSTS_DIR, ASSETS_DIR]) fs.watch(d, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { build(); } catch (e) { console.error("✖", e.message); } }, 150);
  });
}
