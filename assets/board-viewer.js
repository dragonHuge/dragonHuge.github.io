/* 飞书画板矢量查看器（2026-11-24）
   不转图片：直接渲染画板节点（形状/文字/连接线/便签/分区/图片），支持拖动、双指/滚轮缩放、
   单击节点聚焦、全屏。自动接管 .fs-board[data-board]。 */
(function () {
  if (window.__feishuBoardViewer) return;
  window.__feishuBoardViewer = 1;

  var CSS = ""
    + ".fs-board{position:relative;overflow:hidden}"
    + ".fs-board.big{position:fixed!important;inset:0;z-index:500;margin:0!important;border-radius:0;height:100%!important;background:#fafafa}"
    + ".bv{position:absolute;inset:0;overflow:hidden;touch-action:pan-y;background:#fafafa}"
    + ".bv.live{touch-action:none;cursor:grab}"
    + ".bv.live:active{cursor:grabbing}"
    /* 静态预览：内容不接手势，页面正常上下滑 */
    + ".bv.lock .bv-world{pointer-events:none}"
    + ".bv-open{position:absolute;inset:0;z-index:4;border:0;background:linear-gradient(180deg,rgba(0,0,0,0) 60%,rgba(0,0,0,.03));cursor:pointer;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px}"
    + ".bv-open span{font-size:11px;color:#4e5969;background:rgba(255,255,255,.94);border:1px solid #dcdfe6;border-radius:99px;padding:5px 12px;box-shadow:0 2px 8px rgba(0,0,0,.08)}"
    + ".fs-board.big .bv-open{display:none}"
    + ".bv-world{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}"
    + ".bv-lines{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}"
    + ".bv-n{position:absolute;box-sizing:border-box;overflow:hidden;word-break:break-word}"
    + ".bv-n.focus{outline:2px solid #3370ff;outline-offset:2px;box-shadow:0 0 0 4px rgba(51,112,255,.15)}"
    + ".bv-txt{display:flex;width:100%;height:100%;box-sizing:border-box;white-space:pre-wrap;line-height:1.35;padding:4px 6px}"
    + ".bv-txt.mid{align-items:center}.bv-txt.top{align-items:flex-start}"
    + ".bv-hl{display:inline;box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:1px 2px;border-radius:2px}"
    + ".bv-sticky{border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.12);padding:10px;overflow:hidden}"
    + ".bv-sec{border:1px dashed #c9cdd4;border-radius:6px;background:rgba(0,0,0,.015)}"
    + ".bv-sec-t{position:absolute;left:8px;top:-18px;font-size:11px;color:#8f959e;white-space:nowrap}"
    + ".bv-icon img,.bv-icon svg{width:100%;height:100%;object-fit:contain;display:block}"
    + ".bv-img img{width:100%;height:100%;object-fit:contain;display:block;pointer-events:none}"
    + ".bv-bar{position:absolute;right:8px;top:8px;z-index:5;display:flex;gap:6px}"
    + ".bv-bar button{height:28px;min-width:34px;padding:0 9px;border:1px solid #dcdfe6;background:rgba(255,255,255,.94);color:#4e5969;border-radius:8px;font-size:11.5px;cursor:pointer;backdrop-filter:blur(6px)}"
    + ".bv-bar button:active{background:#f2f3f5}"
    + ".bv-bar .bv-link{height:28px;line-height:26px;padding:0 9px;border:1px solid #dcdfe6;background:rgba(255,255,255,.94);color:#3370ff;border-radius:8px;font-size:11.5px;text-decoration:none;backdrop-filter:blur(6px)}"
    + ".bv-hint{position:absolute;left:8px;bottom:8px;z-index:5;font-size:10.5px;color:#86909c;background:rgba(255,255,255,.9);border-radius:99px;padding:3px 9px;pointer-events:none}"
    + ".bv-zoom{position:absolute;right:10px;bottom:10px;z-index:5;font-size:10.5px;color:#86909c;background:rgba(255,255,255,.9);border-radius:99px;padding:3px 8px}";
  CSS += ".bv-extra{display:flex;gap:8px;overflow-x:auto;margin:-8px 0 18px;padding-bottom:2px}"
    + ".bv-extra a{flex:0 0 auto;display:block}"
    + ".bv-extra img{display:block;max-width:88%;max-height:360px;width:auto;border-radius:8px;border:1px solid #e2e2da;background:#fff}";

  var st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);

  var WIDTH = { narrow: 1, medium: 2, bold: 3, none: 0 };
  var RADIUS = { round_rect: 8, round_rect2: 18, ellipse: "50%", circle: "50%", rect: 0 };

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function nodeText(n) {
    var t = n.text || {};
    if (t.text) return String(t.text);
    var rt = t.rich_text;
    if (rt && rt.paragraphs) {
      return rt.paragraphs.map(function (p) {
        return (p.elements || []).map(function (e) {
          var te = e.text_element || {};
          return te.text || "";
        }).join("");
      }).join("\n");
    }
    return "";
  }

  function pointsOf(n) {
    var out = [];
    if (n.type === "composite_shape" || n.type === "text_shape" || n.type === "sticky_note" || n.type === "image" || n.type === "svg") {
      out.push([n.x, n.y], [n.x + n.width, n.y], [n.x + n.width, n.y + n.height], [n.x, n.y + n.height]);
    } else if (n.type === "connector") {
      var pts = [];
      var c = n.connector || {};
      var s = endpoint(c.start), e = endpoint(c.end);
      if (s) pts.push(s);
      (c.turning_points || []).forEach(function (p) { pts.push([p.x, p.y]); });
      if (e) pts.push(e);
      return pts;
    }
    return out;

    function endpoint(ep) {
      if (!ep) return null;
      var obj = ep.attached_object || (ep.attached_object === undefined ? null : ep.attached_object);
      if (obj && obj.id) {
        var t = byId[obj.id];
        if (t) {
          var pos = obj.position || { x: 0.5, y: 0.5 };
          return [t.x + (pos.x || 0) * (t.width || 0), t.y + (pos.y || 0) * (t.height || 0)];
        }
      }
      // 自由连接线：端点坐标放在 position 里（没有 x/y，也没有 attached_object）
      if (ep.position && ep.position.x !== undefined && ep.position.y !== undefined) {
        return [ep.position.x, ep.position.y];
      }
      if (ep.x !== undefined && ep.y !== undefined) return [ep.x, ep.y];
      return null;
    }
  }

  var byId = {};

  function initBoard(fig) {
    if (fig.__bv) return;
    fig.__bv = 1;
    var token = fig.getAttribute("data-board");
    fetch("/assets/boards/" + encodeURIComponent(token) + ".json", { cache: "force-cache" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (nodes) { render(fig, nodes || []); })
      .catch(function () {
        fig.innerHTML = '<div class="board-ph">画板加载失败，请在飞书原文中查看</div>';
      });
  }

  function render(fig, nodes) {
    var token = fig.getAttribute("data-board") || "";
    byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });

    /* 图片一律留在画板里画（2026-11-26 龙老板要求：不再抽成"画板附图"） */
    var extras = [];
    var xs = [], ys = [];
    nodes.forEach(function (n) {
      if (n.width > 0 && n.height > 0) {
        xs.push(n.x, n.x + n.width); ys.push(n.y, n.y + n.height);
      }
    });
    if (!xs.length) { fig.innerHTML = '<div class="board-ph">画板为空</div>'; return; }
    var M = 40;
    var minX = Math.min.apply(null, xs) - M, minY = Math.min.apply(null, ys) - M;
    var maxX = Math.max.apply(null, xs) + M, maxY = Math.max.apply(null, ys) + M;
    var W = maxX - minX, H = maxY - minY;

    fig.innerHTML = "";
    var vp = document.createElement("div"); vp.className = "bv";
    var world = document.createElement("div"); world.className = "bv-world";
    world.style.width = W + "px"; world.style.height = H + "px";

    var svgNS = "http://www.w3.org/2000/svg";
    var lines = document.createElementNS(svgNS, "svg");
    lines.setAttribute("class", "bv-lines");
    lines.setAttribute("width", W); lines.setAttribute("height", H);
    lines.innerHTML = '<defs><marker id="bvarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#4e5969"/></marker></defs>';
    world.appendChild(lines);

    nodes.slice().sort(function (a, b) { return (a.z_index || 0) - (b.z_index || 0); }).forEach(function (n) {
      var el = shapeEl(n, minX, minY);
      if (el) world.appendChild(el);
    });
    // 连接线在形状之前绘制（放到底层）
    nodes.forEach(function (n) {
      if (n.type !== "connector") return;
      var pts = pointsOf(n).map(function (p) { return [p[0] - minX, p[1] - minY]; });
      if (pts.length < 2) return;
      var c = n.connector || {};
      var d;
      if (c.shape === "curve" && pts.length >= 2) {
        d = "M" + pts[0].join(" ") + curvePath(pts);
      } else {
        d = "M" + pts[0].join(" ") + pts.slice(1).map(function (p) { return " L" + p.join(" "); }).join("");
      }
      var p = document.createElementNS(svgNS, "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", (n.style && n.style.border_color) || "#4e5969");
      p.setAttribute("stroke-width", WIDTH[(n.style || {}).border_width] || 1.4);
      if ((c.end || {}).arrow_style && c.end.arrow_style !== "none") p.setAttribute("marker-end", "url(#bvarrow)");
      if ((c.start || {}).arrow_style && c.start.arrow_style !== "none") p.setAttribute("marker-start", "url(#bvarrow)");
      lines.appendChild(p);
    });

    vp.appendChild(world);
    var bar = document.createElement("div"); bar.className = "bv-bar";
    bar.innerHTML = '<button type="button" data-b="fit">适应</button><button type="button" data-b="1x">1:1</button><button type="button" data-b="big">看大图</button>'
      + (fig.getAttribute("data-doc")
        ? '<a class="bv-link" href="' + fig.getAttribute("data-doc") + '" target="_blank" rel="noopener">飞书编辑</a>'
        : "");
    var hint = document.createElement("div"); hint.className = "bv-hint";
    hint.textContent = "轻点进入画板：拖动 · 双指缩放";
    var zoom = document.createElement("div"); zoom.className = "bv-zoom"; zoom.textContent = "100%";
    vp.appendChild(bar); vp.appendChild(hint); vp.appendChild(zoom);
    /* 静态态：一层透明按钮盖住画板，点它才进入可拖动模式，
       这样手指落在画板上时页面照常上下滚动（2026-11-26） */
    var open = document.createElement("button");
    open.type = "button"; open.className = "bv-open";
    open.innerHTML = "<span>轻点进入画板</span>";
    vp.appendChild(open);
    fig.appendChild(vp);

    /* 清理历史版本生成的「画板附图」 */
    var oldEx = fig.nextElementSibling;
    if (oldEx && oldEx.className === "bv-extra") oldEx.remove();

    var st = { s: 1, x: 0, y: 0 }, vw = 0, vh = 0, fit = 1, anim = 0, live = false, savedY = 0;
    function measure() { var r = vp.getBoundingClientRect(); vw = r.width; vh = r.height; }
    function apply() {
      world.style.transform = "translate3d(" + st.x + "px," + st.y + "px,0) scale(" + st.s + ")";
      zoom.textContent = Math.round(st.s / fit * 100) + "%";
    }
    function fitAll() {
      measure();
      fit = Math.min(vw / W, vh / H) * 0.97;
      st = { s: fit, x: (vw - W * fit) / 2, y: (vh - H * fit) / 2 };
      apply();
    }
    function enterBig() {
      if (live) return;
      savedY = window.scrollY || document.documentElement.scrollTop || 0;
      live = true;
      vp.classList.add("live"); vp.classList.remove("lock");
      fig.classList.add("big");
      document.body.style.overflow = "hidden";
      bar.querySelector('[data-b="big"]').textContent = "退出";
      hint.textContent = "拖动查看 · 双指缩放 · 点节点聚焦";
      try { history.pushState({ bv: token }, "", location.hash || "#"); } catch (e) {}
      setTimeout(fitAll, 60);
    }
    function exitBig() {
      if (!live) return;
      live = false;
      window.__bvJustExited = Date.now();
      vp.classList.remove("live"); vp.classList.add("lock");
      fig.classList.remove("big");
      document.body.style.overflow = "";
      bar.querySelector('[data-b="big"]').textContent = "看大图";
      hint.textContent = "轻点进入画板：拖动 · 双指缩放";
      st = { s: 1, x: 0, y: 0 };
      vp.classList.add("lock");
      if (fig.__fitInline) fig.__fitInline();
      window.scrollTo(0, savedY);
      if (history.state && history.state.bv === token) {
        try { history.replaceState({ v: "v-kart" }, "", location.hash || "#"); } catch (e) {}
      }
    }
    vp.classList.add("lock");
    window.__bvExit = exitBig;
    fig.__bvExit = exitBig;
    fig.__bvLive = function () { return live; };
    open.addEventListener("click", function (e) { e.stopPropagation(); enterBig(); });
    function animate(to) {
      cancelAnimationFrame(anim);
      var f = { s: st.s, x: st.x, y: st.y }, t0 = performance.now();
      function step(now) {
        var p = Math.min(1, (now - t0) / 220), e = 1 - Math.pow(1 - p, 3);
        st = { s: f.s + (to.s - f.s) * e, x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e };
        apply();
        if (p < 1) anim = requestAnimationFrame(step);
      }
      anim = requestAnimationFrame(step);
    }
    function zoomAt(ns, px, py) {
      ns = Math.max(fit * 0.3, Math.min(fit * 14, ns));
      var k = ns / st.s;
      st = { s: ns, x: px - (px - st.x) * k, y: py - (py - st.y) * k };
      apply();
    }
    function focusNode(el) {
      var nx = parseFloat(el.style.left) || 0, ny = parseFloat(el.style.top) || 0;
      var nw = el.offsetWidth, nh = el.offsetHeight;
      var ns = Math.min(vw / (nw * 2), vh / (nh * 2), fit * 8);
      ns = Math.max(ns, fit);
      animate({ s: ns, x: vw / 2 - (nx + nw / 2) * ns, y: vh / 2 - (ny + nh / 2) * ns });
    }

    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var a = b.getAttribute("data-b");
      if (a === "fit") animate({ s: fit, x: (vw - W * fit) / 2, y: (vh - H * fit) / 2 });
      else if (a === "1x") animate({ s: 1, x: vw / 2 - W / 2, y: vh / 2 - H / 2 });
      else if (a === "big") {
        if (live) exitBig(); else enterBig();
      }
    });
    vp.addEventListener("wheel", function (e) {
      if (!live) return;
      e.preventDefault();
      var r = vp.getBoundingClientRect();
      zoomAt(st.s * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    var ptrs = new Map(), startDist = 0, startScale = 1, drag = null, tap = null, moved = false;
    vp.addEventListener("pointerdown", function (e) {
      if (!live) return;
      try { vp.setPointerCapture(e.pointerId); } catch (err) {}
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY }; moved = false; tap = { x: e.clientX, y: e.clientY, t: Date.now(), el: e.target.closest(".bv-n") }; }
      else if (ptrs.size === 2) {
        var a = Array.from(ptrs.values());
        startDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        startScale = st.s; moved = true; tap = null;
      }
    });
    vp.addEventListener("pointermove", function (e) {
      if (!live) return;
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2 && startDist > 0) {
        var a = Array.from(ptrs.values());
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        var r = vp.getBoundingClientRect();
        zoomAt(startScale * (d / startDist), (a[0].x + a[1].x) / 2 - r.left, (a[0].y + a[1].y) / 2 - r.top);
        return;
      }
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        st.x += dx; st.y += dy; drag.x = e.clientX; drag.y = e.clientY; apply();
      }
    });
    function up(e) {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) startDist = 0;
      if (ptrs.size === 0) {
        if (tap && !moved && Date.now() - tap.t < 500) {
          var el = tap.el;
          if (el) focusNode(el);
        }
        drag = null; tap = null;
      }
    }
    vp.addEventListener("pointerup", up);
    vp.addEventListener("pointercancel", up);
    vp.addEventListener("dblclick", function (e) {
      if (!live) return;
      var r = vp.getBoundingClientRect();
      var near = Math.abs(st.s - fit) < fit * 0.08;
      if (near) {
        var ns = Math.min(fit * 2.2, fit * 6);
        var px = e.clientX - r.left, py = e.clientY - r.top, k = ns / st.s;
        animate({ s: ns, x: px - (px - st.x) * k, y: py - (py - st.y) * k });
      } else {
        animate({ s: fit, x: (vw - W * fit) / 2, y: (vh - H * fit) / 2 });
      }
    });
    window.addEventListener("resize", function () { if (fig.classList.contains("big")) fitAll(); });
    setTimeout(fitAll, 40);
    fig.__fit = fitAll;
    fig.__fitInline = function () {
      setTimeout(function () {
        measure();
        fit = Math.min(vw / W, vh / H) * 0.97;
        st = { s: fit, x: (vw - W * fit) / 2, y: (vh - H * fit) / 2 };
        apply();
      }, 30);
    };
    fitTextAll(world);
  }

  function curvePath(pts) {
    if (pts.length < 3) return "";
    var d = "";
    for (var i = 1; i < pts.length - 1; i++) {
      var xc = (pts[i][0] + pts[i + 1][0]) / 2, yc = (pts[i][1] + pts[i + 1][1]) / 2;
      d += " Q" + pts[i].join(" ") + " " + [xc, yc].join(" ");
    }
    d += " T" + pts[pts.length - 1].join(" ");
    return d;
  }

  function shapeEl(n, minX, minY) {
    var el = document.createElement("div");
    el.className = "bv-n";
    el.style.left = (n.x - minX) + "px";
    el.style.top = (n.y - minY) + "px";
    el.style.width = Math.max(1, n.width) + "px";
    el.style.height = Math.max(1, n.height) + "px";
    el.style.zIndex = n.z_index || 1;
    /* 图片不跟随 angle：飞书返回的宽高本身就是正立后的框，
       再转 90° 会变成横躺（用户看到的"图倒过来了"）。 */
    if (n.angle && n.type !== "image") el.style.transform = "rotate(" + n.angle + "deg)";
    var s = n.style || {};
    var txt = nodeText(n);
    var t = n.text || {};

    if (n.type === "composite_shape") {
      el.style.background = s.fill_color || "#ffffff";
      el.style.opacity = (s.fill_opacity == null ? 100 : s.fill_opacity) / 100;
      var bw = WIDTH[s.border_width] || 1;
      if (bw && s.border_style !== "none") { el.style.border = bw + "px " + (s.border_style || "solid") + " " + (s.border_color || "#000"); }
      var rad = RADIUS[(n.composite_shape || {}).type];
      if (rad !== undefined) el.style.borderRadius = (typeof rad === "number" ? rad + "px" : rad);
      if ((n.composite_shape || {}).type === "triangle") el.style.clipPath = "polygon(50% 0,100% 100%,0 100%)";
      if ((n.composite_shape || {}).type === "diamond") el.style.clipPath = "polygon(50% 0,100% 50%,50% 100%,0 50%)";
      el.appendChild(textDiv(txt, t, "mid"));
      return el;
    }
    if (n.type === "text_shape") {
      var d = textDiv(txt, t, "top");
      var span = document.createElement("span");
      span.textContent = txt;
      if (t.text_background_color) { span.className = "bv-hl"; span.style.background = t.text_background_color; }
      if (t.font_size) span.style.fontSize = t.font_size + "px";
      if (t.font_weight === "bold") span.style.fontWeight = "700";
      span.style.color = t.text_color || "#1f2329";
      span.style.whiteSpace = "pre";
      d.textContent = ""; d.appendChild(span);
      /* 飞书文字框是自适应的：不要按节点宽度裁剪（时间轴年份就是这么被吃掉的） */
      d.style.width = "auto";
      d.style.height = "auto";
      d.style.padding = "0";
      d.style.display = "inline-block";
      d.style.lineHeight = "1.25";
      el.style.overflow = "visible";
      el.appendChild(d);
      return el;
    }
    if (n.type === "sticky_note") {
      el.className += " bv-sticky";
      el.style.background = s.fill_color || "#fef1ce";
      el.style.padding = "10px";
      var sd = document.createElement("div");
      sd.className = "bv-txt top";
      sd.style.padding = "0";
      sd.textContent = txt;
      sd.style.fontSize = (t.font_size || 13) + "px";
      sd.style.color = t.text_color || "#1f2329";
      el.appendChild(sd);
      return el;
    }
    if (n.type === "image") {
      el.className += " bv-img";
      var im = document.createElement("img");
      im.src = (n.image || {}).src || "";
      im.alt = "";
      im.loading = "lazy";
      el.appendChild(im);
      return el;
    }
    if (n.type === "svg") {
      el.className += " bv-icon";
      el.innerHTML = (n.svg || {}).svg_code || "";
      return el;
    }
    if (n.type === "section") {
      el.className += " bv-sec";
      var title = (n.section || {}).title;
      if (title) { var tt = document.createElement("div"); tt.className = "bv-sec-t"; tt.textContent = title; el.appendChild(tt); }
      return el;
    }
    if (n.type === "group") return null;
    if (n.type === "connector") return null;
    // 未知：有文字就画文字
    if (txt) { el.appendChild(textDiv(txt, t, "top")); return el; }
    return null;
  }

  function textDiv(txt, t, valign) {
    var d = document.createElement("div");
    d.className = "bv-txt " + (valign === "mid" ? "mid" : "top");
    d.style.justifyContent = t.horizontal_align === "left" ? "flex-start" : t.horizontal_align === "right" ? "flex-end" : "center";
    d.style.textAlign = t.horizontal_align || "center";
    d.style.fontSize = (t.font_size || 14) + "px";
    d.style.fontWeight = t.font_weight === "bold" ? "700" : "400";
    d.style.color = t.text_color || "#1f2329";
    if (t.italic) d.style.fontStyle = "italic";
    if (t.underline) d.style.textDecoration = "underline";
    /* 飞书里这类「左边年代 …… 右边关键词」的标签是用一串空格顶开的。
       直接 pre-wrap 渲染会因空格变宽被挤成两行（"起源" 拆成 "起"/"源"），
       这里识别出来改成左右两端对齐（2026-11-26）。 */
    var single = txt.indexOf("\n") < 0;
    var sp = single && txt.match(/^(\S(?:[\s\S]*?\S)?)[ \u3000]{3,}(\S(?:[\s\S]*\S)?)$/);
    if (sp) {
      d.innerHTML = "<span>" + esc(sp[1]) + "</span><span>" + esc(sp[2]) + "</span>";
      d.style.justifyContent = "space-between";
      d.style.whiteSpace = "nowrap";
    } else {
      d.textContent = txt;
    }
    return d;
  }

  /* 文字兜底：装不下就逐级缩字号，宁可小一点也不要被 overflow:hidden 吃掉 */
  function fitTextAll(root) {
    [].forEach.call(root.querySelectorAll(".bv-n"), function (n) {
      var d = n.querySelector(".bv-txt");
      if (!d) return;
      var fs = parseFloat(d.style.fontSize) || 14;
      var guard = 0;
      while ((d.scrollWidth > d.clientWidth + 1 || d.scrollHeight > d.clientHeight + 1)
             && fs > 8 && guard++ < 24) {
        fs -= 1;
        d.style.fontSize = fs + "px";
      }
    });
  }

  function boot() {
    var figs = document.querySelectorAll(".fs-board[data-board]");
    if (!("IntersectionObserver" in window)) { [].forEach.call(figs, initBoard); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { initBoard(e.target); io.unobserve(e.target); } });
    }, { rootMargin: "300px" });
    [].forEach.call(figs, function (f) { io.observe(f); });
  }
  /* 返回键 / 浏览器后退：先退出画板，别直接退出文章 */
  window.__bvActive = function () {
    var fig = document.querySelector(".fs-board.big");
    if (fig && fig.__bvExit) { fig.__bvExit(); return true; }
    return false;
  };
  window.addEventListener("popstate", function () {
    var fig = document.querySelector(".fs-board.big");
    if (fig && fig.__bvExit) fig.__bvExit();
  });
  window.__feishuBoardInit = initBoard;
  window.__feishuBoardBoot = boot;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
