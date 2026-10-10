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
const ICON = {
  search: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  sun: `<svg class="i-sun" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  moon: `<svg class="i-moon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
};

function layout({ title, rel, body, desc = cfg.subtitle, path: here = "", active = "" }) {
  const nav = (key, href, label) => `<a href="${rel}${href}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!DOCTYPE html>
<html lang="${cfg.lang}" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="color-scheme" content="dark light">
<script>(function(){var q=new URLSearchParams(location.search).get("theme");if(q==="light"||q==="dark")localStorage.setItem("theme",q);var t=localStorage.getItem("theme")||"dark";document.documentElement.dataset.theme=t;})();</script>
<link rel="preload" href="${rel}assets/fonts/ibm-plex-mono-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${rel}assets/style.css">
</head>
<body>
<a class="skip" href="#content">跳到正文</a>
<header class="masthead">
  <div class="masthead-inner">
    <a class="mark" href="${rel}index.html" aria-label="${esc(cfg.title)} 首页"><span class="mark-path">~/</span><span class="mark-name">${esc(cfg.handle || "zienn")}</span><span class="caret" aria-hidden="true"></span></a>
    <nav class="sitenav" aria-label="主导航">
      ${nav("home", "index.html", "文章")}
      ${nav("tags", "tags/index.html", "标签")}
      ${nav("about", "about.html", "关于")}
    </nav>
    <div class="search" role="search">
      <label class="search-field">
        ${ICON.search}
        <input id="search-input" type="search" placeholder="搜索标题、标签、正文" autocomplete="off" aria-label="搜索文章">
        <kbd>/</kbd>
      </label>
      <div id="search-results" class="search-results" hidden></div>
    </div>
    <button id="theme-toggle" class="icon-btn" type="button" aria-label="切换深色 / 浅色">${ICON.sun}${ICON.moon}</button>
  </div>
  ${here ? `<div class="runninghead"><div class="masthead-inner"><span>${esc(here)}</span></div></div>` : ""}
</header>
<div id="content">
${body}
</div>
<footer class="site-footer"><div class="footer-inner"><span>© ${new Date().getFullYear()} ${esc(cfg.author)}</span><span>静态生成 · 无追踪 · <a href="${rel}index.html">回到首页</a></span></div></footer>
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

const tagLinks = (tags, rel) => tags.map((t) => `<a class="tag" href="${rel}tags/index.html#${tagId(t)}">#${esc(t)}</a>`).join("");

function postRow(p, rel) {
  return `<li class="entry">
  <time class="entry-date" datetime="${p.date}">${p.date}</time>
  <div class="entry-main">
    <h2 class="entry-title"><a href="${rel}posts/${p.slug}.html">${esc(p.title)}</a></h2>
    <p class="entry-summary">${esc(p.summary || "")}</p>
    <div class="entry-meta"><span>${esc(p.category || "未分类")}</span><span>${p.minutes} min</span>${tagLinks(p.tags, rel)}</div>
  </div>
</li>`;
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
  <article class="post">
    <header class="post-head">
      <h1>${esc(p.title)}</h1>
      ${p.summary ? `<p class="lede">${esc(p.summary)}</p>` : ""}
      <div class="post-meta"><time datetime="${p.date}">${p.date}</time><span>${esc(p.category || "未分类")}</span><span>约 ${p.minutes} 分钟</span>${tagLinks(p.tags, rel)}</div>
    </header>
    ${p.tocCount ? `<details class="toc-inline"><summary>目录</summary><nav>${p.tocHtml}</nav></details>` : ""}
    <div class="post-body">
${p.html}
    </div>
    <nav class="post-nav" aria-label="相邻文章">
      ${prev ? `<a rel="prev" href="${prev.slug}.html"><span>上一篇</span>${esc(prev.title)}</a>` : "<span></span>"}
      ${next ? `<a rel="next" href="${next.slug}.html"><span>下一篇</span>${esc(next.title)}</a>` : "<span></span>"}
    </nav>
  </article>
  ${p.tocCount ? `<aside class="post-toc" aria-label="文章目录"><div class="toc-title">目录</div><nav id="toc">${p.tocHtml}</nav><a class="toc-top" href="#content">回到顶部 ↑</a></aside>` : ""}
</div>`;
    fs.writeFileSync(path.join(OUT, "posts", `${p.slug}.html`), layout({ title: `${p.title} | ${cfg.title}`, rel, body, desc: p.summary, path: `~/posts/${p.slug}.html`, active: "home" }));
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
  <section class="intro">
    <h1>${esc(cfg.title)}</h1>
    <p>${esc(cfg.subtitle)}</p>
  </section>
  <div class="home-grid">
    <section aria-labelledby="latest">
      <h2 id="latest" class="list-head">全部文章</h2>
      <ol class="entries" id="post-list">
      ${posts.map((p) => postRow(p, rel)).join("\n")}
      </ol>
    </section>
    <aside class="rail" aria-label="分类与标签">
      <h2 class="rail-head">分类</h2>
      <ul class="index-list">${cats.map(([c, ps]) => `<li><a href="tags/index.html#${tagId("cat:" + c)}">${esc(c)}</a><span class="count">${ps.length}</span></li>`).join("")}</ul>
      <h2 class="rail-head">标签</h2>
      <div class="tag-cloud">${tags.map(([t, ps]) => `<a class="tag" href="tags/index.html#${tagId(t)}">#${esc(t)}<span class="count">${ps.length}</span></a>`).join("")}</div>
    </aside>
  </div>
</main>`;
    fs.writeFileSync(path.join(OUT, "index.html"), layout({ title: cfg.title, rel, body, active: "home" }));
  }

  // 标签页
  {
    const rel = "../";
    const list = (ps) => `<ul class="tag-posts">${ps.map((p) => `<li><time>${p.date}</time><a href="../posts/${p.slug}.html">${esc(p.title)}</a></li>`).join("")}</ul>`;
    const groups = (arr, pre, prefix) => arr.map(([k, ps]) => `<section class="tag-group" id="${tagId(pre + k)}"><h3>${prefix}${esc(k)}<span class="count">${ps.length}</span></h3>${list(ps)}</section>`).join("");
    const body = `<main class="page">
  <h1>标签与分类</h1>
  <p class="lede">${posts.length} 篇文章按分类和标签归档。点任意标签跳到对应列表。</p>
  <div class="tag-cloud big">${tags.map(([t, ps]) => `<a class="tag" href="#${tagId(t)}">#${esc(t)}<span class="count">${ps.length}</span></a>`).join("")}</div>
  <h2 class="list-head">分类</h2>
  <div class="tag-groups">${groups(cats, "cat:", "")}</div>
  <h2 class="list-head">标签</h2>
  <div class="tag-groups">${groups(tags, "", "#")}</div>
</main>`;
    fs.writeFileSync(path.join(OUT, "tags", "index.html"), layout({ title: `标签 / 分类 | ${cfg.title}`, rel, body, path: "~/tags/", active: "tags" }));
  }

  // 关于页
  fs.writeFileSync(path.join(OUT, "about.html"), layout({ title: `关于 | ${cfg.title}`, rel: "", active: "about", path: "~/about.html", body: `<main class="page"><h1>关于</h1>
<p>这里记录我对 Android、AI 基础设施和系统原理的学习与思考。复杂的概念尽量配上流程图、源码和可运行的示例。</p>
<p>本站由一个约 300 行的 Node.js 脚本生成，纯静态，可部署到 GitHub Pages / Vercel / Cloudflare Pages。</p></main>` }));

  // 搜索索引（以 JS 形式输出，保证 file:// 直接打开也能用）
  const index = posts.map((p) => ({ t: p.title, s: p.summary || "", g: p.tags, c: p.category || "", d: p.date, u: `posts/${p.slug}.html`, x: p.text.slice(0, 30000) }));
  fs.writeFileSync(path.join(OUT, "search-index.js"), "window.SEARCH_INDEX=" + JSON.stringify(index) + ";\n");
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
  fs.writeFileSync(path.join(OUT, "404.html"), layout({ title: "404", rel: (cfg.base || "") + "/", body: `<main class="page"><h1>404 · 页面不存在</h1><p><a href="${(cfg.base || "") + "/"}index.html">返回首页</a></p></main>` }));

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
