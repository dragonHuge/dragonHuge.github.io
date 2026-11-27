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

/* App：返回键/手势 → 网页后退；根页面最小化（2026-11-22） */
(function () {
  var C = window.Capacitor;
  if (!C || !C.Plugins || !C.Plugins.App) return;
  var App = C.Plugins.App;
  App.addListener("backButton", function () {
    if (window.history.length > 1) { window.history.back(); }
    else if (typeof App.minimizeApp === "function") { App.minimizeApp(); }
    else { App.exitApp(); }
  });
})();

/* 顶部模式切换：网站版 → App 版（2026-11-22 统一到右上角） */
(function () {
  var ms = document.getElementById("modeSwitch");
  if (!ms) return;
  ms.addEventListener("click", function () {
    localStorage.setItem("dh-style", "app");
    location.href = "/app/";
  });
})();

/* 手机默认进入 App 版（2026-11-22）；用户手动切过网站版则尊重选择 */
(function () {
  var p = location.pathname;
  if (p !== "/" && p !== "/index.html") return;
  if ((location.search || "").indexOf("web=1") >= 0) return;
  var inApp = !!window.Capacitor;
  if (!inApp) {
    if (localStorage.getItem("dh-style")) return;
    var mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || window.innerWidth < 820;
    if (!mobile) return;
  }
  localStorage.setItem("dh-style", "app");
  location.replace("/app/");
})();


/* 站内页面在 App 内自动切换为 App 布局（app-mode-auto） */
(function () {
  var inApp = !!window.Capacitor || localStorage.getItem("dh-style") === "app";
  if (!inApp) return;
  if (location.pathname.indexOf("/app") === 0) return;
  if (document.body.classList.contains("app-mode")) return;
  document.body.classList.add("app-mode");
  var st = document.createElement("style");
  st.id = "app-mode-auto";
  st.textContent = [
    "body.app-mode{background:#eceae3;-webkit-tap-highlight-color:transparent}",
    "body.app-mode .sidebar,body.app-mode .mask,body.app-mode .menu-btn{display:none!important}",
    "body.app-mode .mode-switch{display:none!important}",
    "body.app-mode .layout{display:block!important}",
    "body.app-mode .content{margin:0 auto!important;max-width:560px!important;padding:16px 18px 96px!important}",
    "body.app-mode .topbar{position:sticky;top:0;z-index:90;background:rgba(251,250,246,.94);backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid var(--line);padding:env(safe-area-inset-top) 12px 0;gap:8px}",
    "body.app-mode .brand-sub{display:none}",
    "body.app-mode .app-back{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--muted);font-size:16px;cursor:pointer}",
    "body.app-mode .app-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:95;height:calc(56px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);display:flex;background:#fff;border-top:1px solid var(--line)}",
    "body.app-mode .app-tabbar a{flex:1;display:flex;align-items:center;justify-content:center;font-size:12.5px;color:#6b6f6d;text-decoration:none}",
    "body.app-mode .app-tabbar a:active{color:#0e7a52}"
  ].join("");
  document.head.appendChild(st);
  var bar = document.querySelector(".topbar");
  if (bar && !document.querySelector(".app-back")) {
    var b = document.createElement("button");
    b.className = "app-back"; b.type = "button"; b.setAttribute("aria-label", "返回");
    b.textContent = "←";
    b.addEventListener("click", function () {
      if (window.history.length > 1) window.history.back();
      else location.href = "/app/";
    });
    bar.insertBefore(b, bar.firstChild);
  }
  if (!document.querySelector(".app-tabbar")) {
    var nav = document.createElement("nav");
    nav.className = "app-tabbar";
    nav.innerHTML = '<a href="/app/#home">首页</a><a href="/app/#kb">知识</a><a href="/app/#qa">问答</a><a href="/app/#me">我的</a>';
    document.body.appendChild(nav);
  }
})();
