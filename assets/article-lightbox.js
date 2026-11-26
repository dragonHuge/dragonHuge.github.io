/* 文章图片 / 飞书画板放大查看器（2026-11-24）
   单指拖动、双指缩放、滚轮缩放、双击放大、单击关闭。
   自动接管 .md 内图片，可用于网页文章页和 App 内文章阅读页。 */
(function () {
  if (window.__artLightbox) return;
  window.__artLightbox = 1;

  var css = ""
    + ".alb{position:fixed;inset:0;z-index:400;background:rgba(12,14,13,.96);display:flex;flex-direction:column;opacity:0;transition:opacity .16s}"
    + ".alb.on{opacity:1}.alb[hidden]{display:none}"
    + ".alb-top{display:flex;align-items:center;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 12px 8px}"
    + ".alb-name{flex:1;min-width:0;color:#cfd6d1;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".alb-top button{height:30px;min-width:36px;padding:0 10px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#e8eae8;border-radius:8px;font-size:12px;cursor:pointer}"
    + ".alb-stage{flex:1;position:relative;overflow:hidden;touch-action:none;cursor:grab}"
    + ".alb-stage:active{cursor:grabbing}"
    + ".alb-stage img{position:absolute;left:0;top:0;max-width:none;max-height:none;transform-origin:0 0;will-change:transform;user-select:none;-webkit-user-drag:none;background:#fff}"
    + ".alb-tip{text-align:center;color:rgba(255,255,255,.42);font-size:10.5px;padding:6px 0 calc(8px + env(safe-area-inset-bottom))}"
    + "@media(min-width:641px){.alb-tip{font-size:11px}}";

  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var lb = document.createElement("div");
  lb.className = "alb";
  lb.hidden = true;
  lb.innerHTML = '<div class="alb-top"><span class="alb-name"></span>'
    + '<button type="button" data-a="fit">适应</button>'
    + '<button type="button" data-a="1x">1:1</button>'
    + '<button type="button" data-a="close" aria-label="关闭">×</button></div>'
    + '<div class="alb-stage"><img alt=""></div>'
    + '<div class="alb-tip">拖动移动 · 双指/滚轮缩放 · 双击放大 · 单击关闭</div>';
  document.body.appendChild(lb);

  var stage = lb.querySelector(".alb-stage"),
      img = lb.querySelector("img"),
      nameEl = lb.querySelector(".alb-name");

  var t = { s: 1, x: 0, y: 0 }, fitS = 1, W = 1, H = 1;
  var rect = { left: 0, top: 0, width: 1, height: 1 };
  var drag = null, pinch = null, tap = null, lastTap = 0, lastX = 0, lastY = 0;
  var closeTimer = 0, closing = 0, anim = 0;

  function measure() {
    var r = stage.getBoundingClientRect();
    rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  function draw() {
    img.style.transform = "translate3d(" + t.x + "px," + t.y + "px,0) scale(" + t.s + ")";
  }
  function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = 0; } }
  function fitTarget() {
    W = img.naturalWidth || 1; H = img.naturalHeight || 1;
    fitS = Math.min(rect.width / W, rect.height / H) * 0.96;
    return { s: fitS, x: (rect.width - W * fitS) / 2, y: (rect.height - H * fitS) / 2 };
  }
  function animateTo(to, dur) {
    stopAnim();
    var f = { s: t.s, x: t.x, y: t.y }, t0 = performance.now();
    function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      t.s = f.s + (to.s - f.s) * e;
      t.x = f.x + (to.x - f.x) * e;
      t.y = f.y + (to.y - f.y) * e;
      draw();
      if (p < 1) anim = requestAnimationFrame(step); else anim = 0;
    }
    anim = requestAnimationFrame(step);
  }
  function zoomAt(ns, px, py, an) {
    ns = Math.max(fitS * 0.4, Math.min(fitS * 12, ns));
    var k = ns / t.s;
    var to = { s: ns, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
    if (an) animateTo(to, 170);
    else { t = to; draw(); }
  }
  function open(src, name, fromRect) {
    stopAnim();
    clearTimeout(closeTimer);
    closing = 0;
    img.src = src; img.alt = name || "";
    nameEl.textContent = name || "";
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    measure();
    requestAnimationFrame(function () { lb.classList.add("on"); });
    function start() {
      var fit = fitTarget();
      if (fromRect && fromRect.width > 8) {
        var s0 = fromRect.width / W;
        t = { s: s0, x: fromRect.left - rect.left, y: fromRect.top - rect.top };
        draw();
        animateTo(fit, 240);
      } else { t = fit; draw(); }
    }
    if (img.complete && img.naturalWidth) start();
    else img.onload = start;
  }
  function close() {
    if (closing) return;
    closing = 1;
    stopAnim();
    lb.classList.remove("on");
    setTimeout(function () {
      lb.hidden = true;
      img.removeAttribute("src");
      document.body.style.overflow = "";
      closing = 0;
    }, 160);
  }
  function toggleZoom(px, py) {
    var nearFit = Math.abs(t.s - fitS) < fitS * 0.08;
    zoomAt(nearFit ? fitS * 2.6 : fitS, px, py, true);
  }
  function singleTap(x, y) {
    var now = Date.now();
    if (now - lastTap < 300 && Math.abs(x - lastX) < 32 && Math.abs(y - lastY) < 32) {
      clearTimeout(closeTimer); closeTimer = 0; lastTap = 0;
      toggleZoom(x, y);
      return;
    }
    lastTap = now; lastX = x; lastY = y;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () { closeTimer = 0; close(); }, 300);
  }

  lb.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) {
      var a = b.getAttribute("data-a");
      if (a === "close") close();
      else if (a === "fit") animateTo(fitTarget(), 200);
      else if (a === "1x") zoomAt(1, rect.width / 2, rect.height / 2, true);
    }
  });
  lb.addEventListener("wheel", function (e) {
    e.preventDefault(); stopAnim();
    zoomAt(t.s * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX - rect.left, e.clientY - rect.top, false);
  }, { passive: false });
  img.addEventListener("dblclick", function (e) {
    e.preventDefault(); toggleZoom(e.clientX - rect.left, e.clientY - rect.top);
  });

  var pointers = new Map(), startDist = 0, startScale = 1, startMid = null;
  stage.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, moved: false, t: Date.now() };
      tap = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
    } else if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      startScale = t.s;
      startMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      if (tap) tap.moved = true;
      clearTimeout(closeTimer);
    }
  });
  stage.addEventListener("pointermove", function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (startDist > 0) {
        var mx = (pts[0].x + pts[1].x) / 2 - rect.left;
        var my = (pts[0].y + pts[1].y) / 2 - rect.top;
        zoomAt(startScale * (d / startDist), mx, my, false);
      }
      return;
    }
    if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(e.clientX - tap.x) + Math.abs(e.clientY - tap.y) > 10) tap.moved = true;
      t.x += dx; t.y += dy;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved = true;
      draw();
    }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) { startDist = 0; startMid = null; }
    if (pointers.size === 0) {
      if (tap && !tap.moved && Date.now() - tap.t < 500) singleTap(e.clientX, e.clientY);
      tap = null; drag = null;
    }
  }
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !lb.hidden) close(); });
  window.addEventListener("resize", function () { if (!lb.hidden) { measure(); animateTo(fitTarget(), 160); } });

  /* 自动接管文章正文图片（网页文章页 + App 内阅读页） */
  document.addEventListener("click", function (e) {
    if (!lb.hidden) return;
    var el = e.target;
    var pic = el && el.closest ? el.closest(".md img, .kart-a img") : null;
    if (!pic) return;
    if (pic.closest("a")) return;
    e.preventDefault();
    e.stopPropagation();
    open(pic.currentSrc || pic.src, pic.alt || "", pic.getBoundingClientRect());
  }, true);
})();
