(function () {
  var rel = window.SITE_REL || "";
  var root = document.documentElement;

  // ---------- 深色模式 ----------
  function applyHljs() {
    var dark = root.dataset.theme === "dark";
    var l = document.getElementById("hljs-light"), d = document.getElementById("hljs-dark");
    if (l) l.disabled = dark;
    if (d) d.disabled = !dark;
  }
  applyHljs();
  document.getElementById("theme-toggle").addEventListener("click", function () {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", root.dataset.theme);
    applyHljs();
    renderMermaid();
  });

  // ---------- 代码高亮 ----------
  if (window.hljs) document.querySelectorAll("pre code").forEach(function (el) { hljs.highlightElement(el); });

  // ---------- Mermaid（随主题重绘） ----------
  var blocks = Array.prototype.slice.call(document.querySelectorAll("pre.mermaid"));
  blocks.forEach(function (b) { b.dataset.src = b.innerHTML; });
  function renderMermaid() {
    var m = window.__mermaid;
    if (!m || !blocks.length) return;
    m.initialize({ startOnLoad: false, theme: root.dataset.theme === "dark" ? "dark" : "default",
      securityLevel: "loose", flowchart: { htmlLabels: true, curve: "basis" } });
    blocks.forEach(function (b) { b.removeAttribute("data-processed"); b.innerHTML = b.dataset.src; });
    m.run({ nodes: blocks }).catch(function (e) { console.error(e); });
  }
  if (window.__mermaid) renderMermaid(); else window.addEventListener("mermaid-ready", renderMermaid);

  // ---------- 目录高亮 ----------
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll("#toc a"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[decodeURIComponent(a.hash.slice(1))] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) {
          tocLinks.forEach(function (a) { a.classList.remove("active"); });
          map[e.target.id].classList.add("active");
        }
      });
    }, { rootMargin: "-70px 0px -70% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) obs.observe(el); });
  }

  // ---------- 客户端搜索 ----------
  var input = document.getElementById("search-input"), box = document.getElementById("search-results");
  var idx = window.SEARCH_INDEX || [];
  function escHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hl(s, terms) {
    var out = escHtml(s);
    terms.forEach(function (t) { if (t) out = out.replace(new RegExp(escHtml(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), function (m) { return "<mark>" + m + "</mark>"; }); });
    return out;
  }
  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return idx.map(function (p) {
      var title = p.t.toLowerCase(), meta = (p.s + " " + p.g.join(" ") + " " + p.c).toLowerCase(), body = p.x.toLowerCase();
      var score = 0, ok = terms.every(function (t) {
        var s = (title.indexOf(t) >= 0 ? 10 : 0) + (meta.indexOf(t) >= 0 ? 4 : 0) + (body.indexOf(t) >= 0 ? 1 : 0);
        score += s; return s > 0;
      });
      if (!ok) return null;
      var pos = body.indexOf(terms[0]), snip = pos >= 0 ? p.x.slice(Math.max(0, pos - 40), pos + 80) : p.s;
      return { p: p, score: score, snip: snip, terms: terms };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
  }
  var active = -1;
  function show(q) {
    var res = search(q);
    active = -1;
    if (!q.trim()) { box.hidden = true; return; }
    box.innerHTML = res.length ? res.map(function (r) {
      return '<a href="' + rel + r.p.u + '"><div class="r-title">' + hl(r.p.t, r.terms) + '</div><div class="r-snip">' + r.p.d + " · " + hl(r.snip, r.terms) + "…</div></a>";
    }).join("") : '<div class="empty">没有找到与 “' + escHtml(q) + '” 相关的文章</div>';
    box.hidden = false;
  }
  input.addEventListener("input", function () { show(input.value); });
  input.addEventListener("focus", function () { if (input.value) show(input.value); });
  input.addEventListener("keydown", function (e) {
    var items = box.querySelectorAll("a");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach(function (a, i) { a.classList.toggle("active", i === active); });
    } else if (e.key === "Enter" && items.length) { location.href = items[Math.max(active, 0)].href; }
    else if (e.key === "Escape") { box.hidden = true; input.blur(); }
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".search")) box.hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); } });
  var q = new URLSearchParams(location.search).get("q");
  if (q) { input.value = q; show(q); }
})();
