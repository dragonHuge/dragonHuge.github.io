(function () {
  var btn = document.getElementById("menuBtn");
  var side = document.getElementById("sidebar");
  var mask = document.getElementById("mask");
  var closeBtn = document.getElementById("sidebarClose");
  if (btn && side) {
    function close() {
      side.classList.remove("open");
      if (mask) mask.classList.remove("show");
      btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    }
    btn.addEventListener("click", function () {
      side.classList.toggle("open");
      var on = side.classList.contains("open");
      if (mask) mask.classList.toggle("show", on);
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      document.body.classList.toggle("nav-open", on);
    });
    if (mask) mask.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);
    side.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && side.classList.contains("open")) {
        close();
        btn.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.matchMedia && window.matchMedia("(min-width: 1080px)").matches) close();
    });
  }
  /* 侧栏当前文章滚进可视区（只动侧栏容器，不动页面） */
  var act = document.querySelector(".context-nav a.art.active");
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

/* 版本自更新（2026-11-21）：站点重建后，App/浏览器自动感知并刷新 */
(function () {
  var KEY = "dh-build";
  function fetchVer() {
    return fetch("/version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  fetchVer().then(function (v) {
    if (v && v.build && !localStorage.getItem(KEY)) localStorage.setItem(KEY, v.build);
  });
  function check() {
    if (document.visibilityState !== "visible") return;
    fetchVer().then(function (v) {
      if (!v || !v.build) return;
      var seen = localStorage.getItem(KEY);
      if (seen && seen !== v.build) {
        var u = new URL(location.href);
        u.searchParams.set("v", v.build);
        location.replace(u.toString());
        return;
      }
      localStorage.setItem(KEY, v.build);
    });
  }
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  setInterval(check, 10 * 60 * 1000);

  /* App 内显示手动刷新按钮（浏览器里不显示） */
  if (window.Capacitor) {
    var b = document.createElement("button");
    b.className = "app-refresh";
    b.type = "button";
    b.title = "刷新内容";
    b.textContent = "↻";
    b.addEventListener("click", function () {
      var u = new URL(location.href);
      u.searchParams.set("v", Date.now());
      location.replace(u.toString());
    });
    document.body.appendChild(b);
  }
})();
