/* 全站搜索：顶栏下拉建议 + 搜索结果页（数据源 search-index.json，构建期生成） */
(function () {
  var SCRIPT = document.currentScript;
  var PREFIX = SCRIPT ? SCRIPT.src.replace(/assets\/search\.js.*$/, "") : "/";
  var idxPromise = null;

  function loadIdx() {
    if (!idxPromise) {
      idxPromise = fetch(PREFIX + "search-index.json").then(function (r) { return r.json(); });
    }
    return idxPromise;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* 关键词高亮：命中段包 <b>，其余原样转义 */
  function hl(text, q) {
    if (!q) return esc(text);
    var lower = text.toLowerCase(), ql = q.toLowerCase();
    var out = "", i = 0, p;
    while ((p = lower.indexOf(ql, i)) !== -1) {
      out += esc(text.slice(i, p)) + "<b>" + esc(text.slice(p, p + q.length)) + "</b>";
      i = p + q.length;
      if (out.length > 4000) break;
    }
    return out + esc(text.slice(i));
  }

  function search(q, items) {
    var ql = q.toLowerCase().trim();
    if (!ql) return [];
    var res = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var t = it.t.toLowerCase(), m = (it.m || "").toLowerCase(), x = (it.x || "").toLowerCase();
      var score = 0;
      if (t.indexOf(ql) === 0) score += 12;
      else if (t.indexOf(ql) !== -1) score += 8;
      if (m.indexOf(ql) !== -1) score += 3;
      if (x.indexOf(ql) !== -1) score += 1;
      if (score) res.push({ s: score, it: it, pos: x.indexOf(ql) });
    }
    res.sort(function (a, b) { return b.s - a.s || (a.it.d < b.it.d ? 1 : -1); });
    return res;
  }

  /* 摘要：围绕首个命中截取窗口 */
  function snippet(it, q) {
    var x = it.x || "", ql = q.toLowerCase(), pos = x.toLowerCase().indexOf(ql);
    if (pos < 0) return x.slice(0, 110) + (x.length > 110 ? "…" : "");
    var s = Math.max(0, pos - 30);
    return (s > 0 ? "…" : "") + x.slice(s, s + 130) + (x.length > s + 130 ? "…" : "");
  }

  /* ---------------- 顶栏下拉 ---------------- */
  var q = document.getElementById("topq");
  var sug = document.getElementById("sug");
  var timer = null, act = -1, cur = [];

  function hideSug() { if (sug) { sug.hidden = true; sug.innerHTML = ""; act = -1; } }

  function renderSug(items, kw) {
    if (!sug) return;
    if (!items.length) {
      sug.innerHTML = '<div class="sug-none">没找到「' + esc(kw) + '」，回车看全部结果</div>';
      sug.hidden = false;
      return;
    }
    var h = "";
    for (var i = 0; i < items.length; i++) {
      h += '<a class="sug-item" href="' + PREFIX + items[i].u + '" data-i="' + i + '">' +
        '<span class="sug-t">' + hl(items[i].t, kw) + '</span>' +
        '<span class="sug-m">' + esc(items[i].m) + ' · ' + esc(items[i].d) + '</span></a>';
    }
    sug.innerHTML = h;
    sug.hidden = false;
    act = -1;
  }

  if (q) {
    q.addEventListener("focus", function () { loadIdx(); });
    q.addEventListener("input", function () {
      var kw = q.value.trim();
      clearTimeout(timer);
      if (!kw) { hideSug(); return; }
      timer = setTimeout(function () {
        loadIdx().then(function (items) { renderSug(search(kw, items).slice(0, 8).map(function (r) { return r.it; }), kw); });
      }, 160);
    });
    q.addEventListener("keydown", function (e) {
      var items = sug ? sug.querySelectorAll(".sug-item") : [];
      if (e.key === "ArrowDown" && items.length) {
        e.preventDefault(); act = (act + 1) % items.length;
        for (var i = 0; i < items.length; i++) items[i].classList.toggle("act", i === act);
      } else if (e.key === "ArrowUp" && items.length) {
        e.preventDefault(); act = (act - 1 + items.length) % items.length;
        for (var j = 0; j < items.length; j++) items[j].classList.toggle("act", j === act);
      } else if (e.key === "Enter") {
        var kw = q.value.trim();
        if (act >= 0 && items[act]) {
          var _h = items[act].href;
          if (/^https?:/.test(_h)) { window.open(_h, "_blank", "noopener"); }
          else { location.href = _h; }
        }
        else if (kw) { location.href = PREFIX + "search.html?q=" + encodeURIComponent(kw); }
      } else if (e.key === "Escape") { hideSug(); q.blur(); }
    });
    q.addEventListener("blur", function () { setTimeout(hideSug, 160); });
    if (sug) sug.addEventListener("mousedown", function (e) { e.preventDefault(); });
  }

  /* 快捷键：/ 或 Ctrl/Command+K 聚焦搜索 */
  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
      var box = document.getElementById("topq") || document.getElementById("pageq");
      if (box) { e.preventDefault(); box.focus(); box.select(); }
    }
  });

  /* ---------------- 搜索结果页 ---------------- */
  var pq = document.getElementById("pageq");
  if (pq) {
    var countEl = document.getElementById("count");
    var resEl = document.getElementById("results");
    var emptyEl = document.getElementById("empty");
    var ptimer = null;

    function renderPage(kw) {
      loadIdx().then(function (items) {
        if (!kw) {
          countEl.textContent = "";
          resEl.innerHTML = "";
          emptyEl.hidden = false;
          emptyEl.textContent = "输入关键词开始搜索，全站 " + items.length + " 篇文章等你翻牌 ✨";
          return;
        }
        var res = search(kw, items);
        countEl.textContent = res.length ? "“" + kw + "” 找到 " + res.length + " 篇" : "";
        if (!res.length) {
          resEl.innerHTML = "";
          emptyEl.hidden = false;
          emptyEl.textContent = "没找到「" + kw + "」——试试更短的关键词，或换个说法。";
          return;
        }
        emptyEl.hidden = true;
        var show = res.slice(0, 200), h = "";
        for (var i = 0; i < show.length; i++) {
          var it = show[i].it;
          h += '<a class="res-card" href="' + PREFIX + it.u + '">' +
            '<div class="res-t">' + hl(it.t, kw) + '</div>' +
            '<div class="res-meta"><span class="badge">' + esc(it.m) + '</span><span class="date">' + esc(it.d) + '</span></div>' +
            '<div class="res-x">' + hl(snippet(it, kw), kw) + '</div></a>';
        }
        if (res.length > show.length) h += '<div class="res-more">仅显示前 ' + show.length + ' 条，共 ' + res.length + ' 条，换个更精确的词试试</div>';
        resEl.innerHTML = h;
      });
    }

    var initQ = (new URLSearchParams(location.search)).get("q") || "";
    if (initQ) pq.value = initQ;
    renderPage(initQ.trim());
    pq.addEventListener("input", function () {
      clearTimeout(ptimer);
      ptimer = setTimeout(function () {
        var kw = pq.value.trim();
        renderPage(kw);
        var u = kw ? location.pathname + "?q=" + encodeURIComponent(kw) : location.pathname;
        history.replaceState(null, "", u);
      }, 180);
    });
    pq.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { clearTimeout(ptimer); renderPage(pq.value.trim()); }
      if (e.key === "Escape") { pq.value = ""; renderPage(""); }
    });
  }
})();
