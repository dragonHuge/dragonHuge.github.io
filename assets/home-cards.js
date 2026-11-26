/* HOME_CARDS_SORT_V1（2026-11-21）：首页模块卡排序
   - 手机：长按 320ms 后拖动；电脑：按住拖动（移动 >5px 才算拖，不影响点击）
   - 顺序存 localStorage，刷新/下次访问保持；可一键恢复默认
   - 拖拽时用占位块（placeholder）稳住网格，浮起卡片跟随指针 */
(function () {
  var grid = document.getElementById('homeCards');
  if (!grid) return;
  var KEY = 'dragonhuge.home.card.order.v1';
  var bar = document.getElementById('cardsSortBar');
  var enterBtn = document.getElementById('cardsSortEnter');
  var doneBtn = document.getElementById('cardsSortDone');
  var resetBtn = document.getElementById('cardsSortReset');

  var editing = false;
  var drag = null;          // {el, ph, offX, offY}
  var mouseDown = null;     // {card, x, y, started}
  var touchDown = null;     // {card, x, y}
  var pressTimer = null;
  var suppressClick = false;
  var LONG_PRESS = 320;
  var MOVE_TOL = 8;

  function list() { return Array.prototype.slice.call(grid.querySelectorAll('.card')); }
  function mod(el) { return el.getAttribute('data-mod'); }
  function order() { return list().map(mod); }

  var defaultOrder = order();
  list().forEach(function (c) { c.setAttribute('draggable', 'false'); });

  function applyOrder(arr) {
    if (!arr || !arr.length) return;
    var map = {}, used = {};
    list().forEach(function (c) { map[mod(c)] = c; });
    arr.forEach(function (id) {
      var c = map[id];
      if (c && !used[id]) { grid.appendChild(c); used[id] = 1; }
    });
    list().forEach(function (c) { if (!used[mod(c)]) grid.appendChild(c); });
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(order())); } catch (e) {}
  }

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.length) applyOrder(saved);
  } catch (e) {}

  /* 编辑模式：显式入口，避免长按手势没人发现；同时给出按钮式兜底（可点、可键盘） */
  function buildControls() {
    list().forEach(function (card) {
      if (card.querySelector('.card-ctl')) return;
      var ctl = document.createElement('div');
      ctl.className = 'card-ctl';
      ctl.innerHTML = '<button type="button" data-act="top" title="移到最前">⇤ 置顶</button>'
        + '<button type="button" data-act="up" title="上移一位">↑</button>'
        + '<button type="button" data-act="down" title="下移一位">↓</button>';
      card.appendChild(ctl);
    });
  }
  function removeControls() {
    Array.prototype.forEach.call(grid.querySelectorAll('.card-ctl'), function (n) { n.remove(); });
  }
  function setEditing(on) {
    editing = on;
    grid.classList.toggle('editing', on);
    if (bar) bar.hidden = !on;
    if (enterBtn) enterBtn.hidden = on;
    if (on) buildControls(); else removeControls();
  }
  if (enterBtn) enterBtn.addEventListener('click', function () { setEditing(true); });
  if (doneBtn) doneBtn.addEventListener('click', function () { setEditing(false); save(); });
  if (resetBtn) resetBtn.addEventListener('click', function () { applyOrder(defaultOrder); save(); });

  /* 编辑态 / 拖拽后的点击一律拦掉，避免误进模块；卡片上的排序按钮除外 */
  grid.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('.card-ctl button') : null;
    if (btn) {
      ev.preventDefault(); ev.stopPropagation();
      var card = btn.closest('.card');
      if (!card) return;
      var act = btn.getAttribute('data-act');
      if (act === 'top') grid.insertBefore(card, grid.firstElementChild);
      else if (act === 'up' && card.previousElementSibling) grid.insertBefore(card, card.previousElementSibling);
      else if (act === 'down' && card.nextElementSibling) grid.insertBefore(card.nextElementSibling, card);
      save();
      return;
    }
    if (editing || suppressClick) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);

  function startDrag(card, x, y) {
    var r = card.getBoundingClientRect();
    var ph = document.createElement('div');
    ph.className = 'card-ph';
    ph.style.height = r.height + 'px';
    grid.insertBefore(ph, card.nextSibling);

    card.style.left = r.left + 'px';
    card.style.top = r.top + 'px';
    card.style.width = r.width + 'px';
    card.style.height = r.height + 'px';
    card.classList.add('dragging');
    document.documentElement.classList.add('card-sorting');

    drag = { el: card, ph: ph, offX: x - r.left, offY: y - r.top };
    suppressClick = true;
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
  }

  function moveGhost(x, y) {
    if (!drag) return;
    drag.el.style.left = (x - drag.offX) + 'px';
    drag.el.style.top = (y - drag.offY) + 'px';
  }

  /* 找离指针最近的目标卡，按「左/右、上/下」决定插在前面还是后面 */
  function updateSlot(x, y) {
    if (!drag) return;
    var cands = list().filter(function (c) { return c !== drag.el; });
    if (!cands.length) return;
    var best = null, bestD = Infinity;
    cands.forEach(function (c) {
      var r = c.getBoundingClientRect();
      var dx = Math.max(r.left - x, 0, x - r.right);
      var dy = Math.max(r.top - y, 0, y - r.bottom);
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = c; }
    });
    if (!best) return;
    var r2 = best.getBoundingClientRect();
    var cx = r2.left + r2.width / 2, cy = r2.top + r2.height / 2;
    var before;
    if (Math.abs(y - cy) > r2.height * 0.35) before = y < cy;
    else before = x < cx;
    var ref = before ? best : best.nextElementSibling;
    if (ref === drag.ph || ref === drag.ph.nextElementSibling) return;
    grid.insertBefore(drag.ph, ref);
  }

  function endDrag() {
    if (!drag) return;
    var el = drag.el, ph = drag.ph;
    el.classList.remove('dragging');
    el.style.left = ''; el.style.top = '';
    el.style.width = ''; el.style.height = '';
    if (ph.parentNode) { ph.parentNode.insertBefore(el, ph); ph.remove(); }
    drag = null;
    document.documentElement.classList.remove('card-sorting');
    save();
    setTimeout(function () { suppressClick = false; }, 260);
  }

  function cardOf(target) {
    if (!target || !target.closest) return null;
    var c = target.closest('.card');
    return c && grid.contains(c) && !c.classList.contains('dragging') ? c : null;
  }

  /* ---- 鼠标：按住拖动 ---- */
  grid.addEventListener('mousedown', function (ev) {
    if (ev.button !== 0 || drag) return;
    var card = cardOf(ev.target);
    if (!card) return;
    ev.preventDefault();                       // 禁掉链接原生拖拽与文字选中
    mouseDown = { card: card, x: ev.clientX, y: ev.clientY, started: false };
  });
  document.addEventListener('mousemove', function (ev) {
    if (!mouseDown || drag) {
      if (drag) { updateSlot(ev.clientX, ev.clientY); moveGhost(ev.clientX, ev.clientY); ev.preventDefault(); }
      return;
    }
    if (!mouseDown.started) {
      if (Math.abs(ev.clientX - mouseDown.x) + Math.abs(ev.clientY - mouseDown.y) < 5) return;
      mouseDown.started = true;
      startDrag(mouseDown.card, ev.clientX, ev.clientY);
    }
    updateSlot(ev.clientX, ev.clientY);
    moveGhost(ev.clientX, ev.clientY);
    ev.preventDefault();
  });
  document.addEventListener('mouseup', function () {
    if (mouseDown && mouseDown.started) endDrag();
    mouseDown = null;
  });

  /* ---- 触屏：长按后拖动（长按前移动则视为滚动，不打断页面） ---- */
  grid.addEventListener('touchstart', function (ev) {
    if (ev.touches.length !== 1 || drag) return;
    var card = cardOf(ev.target);
    if (!card) return;
    var t = ev.touches[0];
    touchDown = { card: card, x: t.clientX, y: t.clientY };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(function () {
      if (!touchDown) return;
      startDrag(touchDown.card, touchDown.x, touchDown.y);
    }, editing ? 160 : LONG_PRESS);
  }, { passive: true });

  document.addEventListener('touchmove', function (ev) {
    if (!touchDown) return;
    var t = ev.touches[0];
    if (!drag) {
      if (Math.abs(t.clientX - touchDown.x) + Math.abs(t.clientY - touchDown.y) > MOVE_TOL) {
        clearTimeout(pressTimer);
        touchDown = null;
      }
      return;
    }
    ev.preventDefault();                       // 拖拽中锁住页面滚动
    updateSlot(t.clientX, t.clientY);
    moveGhost(t.clientX, t.clientY);
  }, { passive: false });

  function touchEnd() {
    clearTimeout(pressTimer);
    pressTimer = null;
    if (drag) endDrag();
    touchDown = null;
  }
  document.addEventListener('touchend', touchEnd);
  document.addEventListener('touchcancel', touchEnd);

  /* 长按不弹系统菜单 */
  grid.addEventListener('contextmenu', function (ev) {
    if (editing || drag) ev.preventDefault();
  });
})();
