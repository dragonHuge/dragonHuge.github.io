(function () {
  var btn = document.getElementById("menuBtn");
  var side = document.getElementById("sidebar");
  var mask = document.getElementById("mask");
  if (!btn || !side) return;
  function close() { side.classList.remove("open"); if (mask) mask.classList.remove("show"); }
  btn.addEventListener("click", function () {
    side.classList.toggle("open");
    if (mask) mask.classList.toggle("show", side.classList.contains("open"));
  });
  if (mask) mask.addEventListener("click", close);
  side.addEventListener("click", function (e) {
    if (e.target.tagName === "A") close();
  });
})();
