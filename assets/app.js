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
  /* 侧栏当前文章滚进可视区（只动侧栏容器，不动页面） */
  var act = document.querySelector(".side-nav a.art.active");
  if (act && act.scrollIntoView) {
    try { act.scrollIntoView({ block: "nearest" }); } catch (e) { act.scrollIntoView(false); }
  }
})();
