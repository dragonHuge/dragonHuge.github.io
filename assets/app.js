(function () {
  var btn = document.getElementById("menuBtn");
  var side = document.getElementById("sidebar");
  var mask = document.getElementById("mask");
  if (btn && side) {
    function close() {
      side.classList.remove("open");
      if (mask) mask.classList.remove("show");
      document.body.style.overflow = "";
    }
    btn.addEventListener("click", function () {
      side.classList.toggle("open");
      var on = side.classList.contains("open");
      if (mask) mask.classList.toggle("show", on);
      document.body.style.overflow = on ? "hidden" : "";
    });
    if (mask) mask.addEventListener("click", close);
    side.addEventListener("click", function (e) {
      if (e.target.tagName === "A") close();
    });
  }
  /* 窄屏：抽屉初始不自动展开长列表（手机上找文章走模块列表页更短路径） */
  try {
    if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) {
      [].forEach.call(document.querySelectorAll(".side-nav details[open]"), function (d) {
        d.removeAttribute("open");
      });
      side && side.scrollTop && (side.scrollTop = 0);
    }
  } catch (e) {}
  /* 侧栏当前文章滚进可视区（只动侧栏容器，不动页面） */
  var act = document.querySelector(".side-nav a.art.active");
  if (act && act.scrollIntoView) {
    try { act.scrollIntoView({ block: "nearest" }); } catch (e) { act.scrollIntoView(false); }
  }
})();

/* ---- 文章页本篇目录：scrollspy / 收起状态持久化 / 跳转焦点跟随 ---- */
(function () {
  var tocBox = document.getElementById("tocBox");
  if (tocBox) {
    try { if (localStorage.getItem("tocClosed") === "1") tocBox.removeAttribute("open"); } catch (e) {}
    tocBox.addEventListener("toggle", function () {
      try { localStorage.setItem("tocClosed", tocBox.open ? "0" : "1"); } catch (e) {}
    });
  }
  var links = [].slice.call(document.querySelectorAll(".toc-list a"));
  if (!links.length) return;
  var heads = links.map(function (a) {
    return document.getElementById(a.getAttribute("href").slice(1));
  }).filter(Boolean);
  heads.forEach(function (h) { h.tabIndex = -1; });
  var cur = null, raf = 0;
  function mark(h) {
    if (!h || h === cur) return;
    cur = h;
    var id = "#" + h.id;
    links.forEach(function (a) {
      var on = a.getAttribute("href") === id;
      a.classList.toggle("on", on);
      if (on && a.scrollIntoView) a.scrollIntoView({ block: "nearest" });
    });
  }
  function spy() {
    raf = 0;
    if (!heads.length) return;
    var line = window.scrollY + window.innerHeight * 0.3, c = heads[0];
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top + window.scrollY <= line) c = heads[i];
      else break;
    }
    mark(c);
  }
  window.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });
  window.addEventListener("resize", function () { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });
  spy();
  links.forEach(function (a) {
    a.addEventListener("click", function () {
      var h = document.getElementById(a.getAttribute("href").slice(1));
      if (h) setTimeout(function () { h.focus({ preventScroll: true }); }, 350);
    });
  });
})();
