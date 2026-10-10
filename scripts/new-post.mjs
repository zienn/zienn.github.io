// 新建文章：npm run new -- my-slug "文章标题" [md|html]
import fs from "node:fs";
const [slug, title = "新文章", kind = "md"] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug)) { console.error('用法：npm run new -- <slug(小写字母/数字/-)> "标题" [md|html]'); process.exit(1); }
const file = `content/posts/${slug}.${kind}`;
if (fs.existsSync(file)) { console.error(`已存在：${file}`); process.exit(1); }
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
const fm = `---\ntitle: ${title}\ndate: ${today}\ntags: 标签1, 标签2\ncategory: 未分类\nsummary: 一句话摘要，会显示在首页列表和搜索结果里。\n---\n`;
const body = kind === "md"
  ? `\n## 第一节\n\n正文，支持 **Markdown**。\n\n\`\`\`kotlin\nfun main() = println("hello")\n\`\`\`\n\n\`\`\`mermaid\nflowchart LR\n  A --> B\n\`\`\`\n`
  : `<section>\n<h2>第一节</h2>\n<p>正文，可直接写 HTML（callout / grid2 / card 等样式可用）。</p>\n<pre class="mermaid">\nflowchart LR\n  A --> B\n</pre>\n</section>\n`;
fs.writeFileSync(file, fm + body);
console.log(`✔ 已创建 ${file}`);
