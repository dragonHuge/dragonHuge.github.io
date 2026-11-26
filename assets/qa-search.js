/* QA_SEARCH_V1（2026-11-21）：问答模块页内搜索
   数据源 qa/search.json（构建期生成，含问题与答案全文）
   - 问答沉淀首页：data-scope="" → 搜全部月份
   - 月页：data-scope="YYYY-MM" → 只搜当前月 */
(function () {
  var inp = document.getElementById('qas');
  if (!inp) return;
  var wrap = inp.closest ? inp.closest('.qa-search') : null;
  var scope = wrap ? (wrap.getAttribute('data-scope') || '') : '';
  var box = document.getElementById('qas-res');
  var S = document.currentScript;
  var PREFIX = S ? S.src.replace(/assets\/qa-search\.js.*$/, '') : '/';
  var DATA_URL = PREFIX + 'qa/search.json';
  var rows = null, loading = null, timer = null;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* 命中词高亮：按 token 切分，奇数段包 <mark> */
  function hl(text, toks) {
    if (!toks.length) return esc(text);
    var re = new RegExp('(' + toks.map(escRe).join('|') + ')', 'gi');
    var parts = String(text).split(re), out = '';
    for (var i = 0; i < parts.length; i++) {
      out += (i % 2) ? '<mark>' + esc(parts[i]) + '</mark>' : esc(parts[i]);
    }
    return out;
  }

  function tokens(q) {
    return q.toLowerCase().split(/\s+/).filter(function (t) { return t; }).slice(0, 6);
  }

  /* 打分：标题 > 关键词 > 提问 > 答案；多个词必须全部命中（AND） */
  function score(r, toks) {
    var t = (r.t || '').toLowerCase(), k = (r.k || '').toLowerCase(),
        q = (r.q || '').toLowerCase(), a = (r.a || '').toLowerCase();
    var total = 0;
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i], s = 0;
      if (t.indexOf(tk) === 0) s += 16;
      else if (t.indexOf(tk) >= 0) s += 11;
      if (k.indexOf(tk) >= 0) s += 7;
      if (q.indexOf(tk) >= 0) s += 5;
      if (a.indexOf(tk) >= 0) s += 2;
      if (!s) return 0;
      total += s;
    }
    return total;
  }

  function snippet(r, toks) {
    var fields = [r.q, r.a], f = '', pos = -1, tk = toks[0] || '';
    for (var i = 0; i < fields.length; i++) {
      var p = (fields[i] || '').toLowerCase().indexOf(tk);
      if (p >= 0) { f = fields[i]; pos = p; break; }
    }
    if (pos < 0) { f = r.a || r.q || ''; pos = 0; }
    var st = Math.max(0, pos - 40);
    return (st > 0 ? '…' : '') + f.slice(st, st + 150) + (f.length > st + 150 ? '…' : '');
  }

  function load() {
    if (rows) return Promise.resolve(rows);
    if (!loading) {
      loading = fetch(DATA_URL).then(function (r) { return r.json(); }).then(function (j) {
        rows = j.filter(function (x) { return !scope || x.m === scope; });
        return rows;
      }).catch(function () { rows = []; return rows; });
    }
    return loading;
  }

  function render(q) {
    var toks = tokens(q);
    if (!toks.length) { box.hidden = true; box.innerHTML = ''; return; }
    load().then(function (all) {
      var hits = [];
      for (var i = 0; i < all.length; i++) {
        var s = score(all[i], toks);
        if (s) hits.push({ s: s, r: all[i] });
      }
      hits.sort(function (a, b) { return b.s - a.s || (a.r.d < b.r.d ? 1 : -1); });
      box.hidden = false;
      if (!hits.length) {
        box.innerHTML = '<div class="qa-sr-none">没找到「' + esc(q) + '」——换个更短的关键词试试</div>';
        return;
      }
      var h = '<div class="qa-sr-count">找到 ' + hits.length + ' 个问题'
        + (scope ? '（' + esc(scope) + '）' : '（全部月份）') + '</div>';
      var show = hits.slice(0, 30);
      for (var j = 0; j < show.length; j++) {
        var r = show[j].r;
        h += '<a class="qa-sr" href="' + r.u + '">'
          + '<span class="qa-sr-head"><b>' + hl(r.t, toks) + '</b>'
          + '<span class="qa-sr-meta">' + esc(r.d) + (scope ? '' : ' · ' + esc(r.m)) + '</span></span>'
          + '<span class="qa-sr-x">' + hl(snippet(r, toks), toks) + '</span></a>';
      }
      if (hits.length > show.length) {
        h += '<div class="qa-sr-none">仅显示前 ' + show.length + ' 条，共 ' + hits.length + ' 条，多加一个词缩小范围</div>';
      }
      box.innerHTML = h;
    });
  }

  inp.addEventListener('focus', load);
  inp.addEventListener('input', function () {
    clearTimeout(timer);
    var v = inp.value.trim();
    timer = setTimeout(function () { render(v); }, 140);
  });
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var first = box.querySelector('a.qa-sr');
      if (first) { e.preventDefault(); location.href = first.getAttribute('href'); }
      else { clearTimeout(timer); render(inp.value.trim()); }
    } else if (e.key === 'Escape') {
      inp.value = ''; box.hidden = true; box.innerHTML = '';
    }
  });
})();
