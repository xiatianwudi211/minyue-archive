/* ============================================================
   中国民乐 · 数字乐器馆 —— CircularCarousel 3D 环形轮播（原生 JS 移植版）
   把 React WebGL/CSS 3D 组件移植为 vanilla JS 工厂：
   cylinder 预设、drift 自动旋转、拖拽惯性 + 吸附、focus、parallax、
   rise 入场、曲面分片（TILES=8）弯曲卡片、深度渐隐。
   无 transform-style 3D / 不支持时退化为普通横向排列（横向滚动）。
   ============================================================ */
(function (global) {
  "use strict";

  var TILES = 8;
  var OVERLAP = 2.5;
  var DRAG_THRESHOLD = 5;
  var SPRING = 118;
  var SETTLE_SPEED = 9;
  var INTRO_LENGTH = { assemble: 1500, rise: 1400, spin: 1800, none: 0 };
  var TO_RAD = Math.PI / 180;

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function wrap(degrees) { return ((((degrees + 180) % 360) + 360) % 360) - 180; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }
  function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }
  function rotateX(p, degrees) {
    var r = degrees * TO_RAD, c = Math.cos(r), s = Math.sin(r);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  }
  function rotateY(p, degrees) {
    var r = degrees * TO_RAD, c = Math.cos(r), s = Math.sin(r);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  }

  function CircularCarousel(container, options) {
    options = options || {};
    var items = options.items && options.items.length ? options.items : [];
    if (!container || !items.length) return null;

    var reduced = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || false;
    var count = items.length;
    var axis = "y";
    var tiltValue = options.tilt != null ? clamp(options.tilt, -45, 45) : -5;
    var curveValue = clamp(options.curve == null ? 1 : options.curve, 0, 1);
    var perspective = options.perspective != null ? Math.max(100, options.perspective) : 2500;
    var cardW = Math.max(40, options.cardWidth || 150);
    var aspectRatio = clamp(options.aspectRatio == null ? 0.85 : options.aspectRatio, 0.2, 5);
    var cardH = cardW / aspectRatio;
    var gap = options.gap == null ? 18 : options.gap;
    var along = cardW;
    var step = 360 / count;
    var spread = 1;

    /* ---- 半径（复用原公式） ---- */
    var n = Math.max(count, 3);
    var pitch = (along + gap) * spread;
    var chord = pitch / (2 * Math.sin(Math.PI / n));
    var arc = (n * pitch) / (2 * Math.PI);
    var radius = Math.max(chord + (arc - chord) * curveValue, along * 0.6);

    /* ---- 曲面分片 ---- */
    var totalTiles = curveValue > 0.001 ? TILES : 1;
    var tileLen = along / totalTiles;
    var bend = curveValue > 0.001 ? radius / curveValue : 0;
    var tiles = [];
    for (var ti = 0; ti < totalTiles; ti++) {
      var start = ti * tileLen - (ti > 0 ? OVERLAP / 2 : 0);
      var end = (ti + 1) * tileLen + (ti < totalTiles - 1 ? OVERLAP / 2 : 0);
      var center = (start + end) / 2 - along / 2;
      var alpha = bend ? center / bend : 0;
      var shift = bend ? bend * Math.sin(alpha) : center;
      var sink = bend ? bend * (1 - Math.cos(alpha)) : 0;
      var depth = -sink;
      var turn = (alpha * 180) / Math.PI;
      tiles.push({
        index: ti,
        start: start,
        end: end,
        size: end - start,
        move: "translate3d(" + shift.toFixed(3) + "px, 0px, " + depth.toFixed(3) + "px) rotateY(" + turn.toFixed(3) + "deg)"
      });
    }

    /* ---- DOM ---- */
    var settings = {
      count: count, step: step, radius: radius,
      tilt: tiltValue, perspective: perspective,
      cardW: cardW, cardH: cardH,
      autoplay: reduced ? "off" : (options.autoplay || "drift"),
      speed: options.speed == null ? 10 : options.speed,
      draggable: options.draggable !== false,
      momentum: clamp(options.momentum == null ? 0.6 : options.momentum, 0, 1),
      snap: options.snap !== false,
      pauseOnHover: options.pauseOnHover !== false,
      parallax: reduced ? 0 : clamp(options.parallax == null ? 0.3 : options.parallax, 0, 1),
      depthFade: clamp(options.depthFade == null ? 0.5 : options.depthFade, 0, 1),
      fadeColor: options.fadeColor || "#556f80",
      intro: reduced ? "none" : (options.intro in INTRO_LENGTH ? options.intro : "rise"),
      onChange: options.onChange || null,
      onItemClick: options.onItemClick || null
    };

    var root = document.createElement("div");
    root.className = "circular-carousel";
    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "carousel");
    root.setAttribute("aria-label", "乐器轮播");
    root.tabIndex = 0;
    root.setAttribute("data-ready", "");
    root.setAttribute("data-draggable", "");
    root.style.setProperty("--cc-fade", settings.fadeColor);
    root.style.setProperty("--cc-radius", (options.cornerRadius == null ? 14 : Math.max(0, options.cornerRadius)) + "px");
    var view = document.createElement("div"); view.className = "circular-carousel__view";
    var stageEl = document.createElement("div"); stageEl.className = "circular-carousel__stage";
    var camera = document.createElement("div"); camera.className = "circular-carousel__camera";
    var ring = document.createElement("div"); ring.className = "circular-carousel__ring";
    view.appendChild(stageEl); stageEl.appendChild(camera); camera.appendChild(ring); root.appendChild(view);
    container.appendChild(root);

    var cardEls = [];
    items.forEach(function (item, index) {
      var card = document.createElement("div");
      card.className = "circular-carousel__card";
      card.setAttribute("data-cc-index", index);
      card.setAttribute("role", "group");
      card.setAttribute("aria-roledescription", "slide");
      card.setAttribute("aria-label", (item.title || item.alt || "乐器") + "，" + (index + 1) + " / " + count);
      tiles.forEach(function (tile) {
        var t = document.createElement("div");
        t.className = "circular-carousel__tile";
        t.setAttribute("aria-hidden", "true");
        var frame = document.createElement("div");
        frame.className = "circular-carousel__frame";
        var first = tile.index === 0;
        var last = tile.index === totalTiles - 1;
        var r = "var(--cc-radius)";
        frame.style.borderRadius = (first ? r : "0") + " " + (last ? r : "0") + " " + (last ? r : "0") + " " + (first ? r : "0");
        var photo = document.createElement("img");
        photo.className = "circular-carousel__photo";
        photo.src = item.src;
        photo.alt = "";
        photo.draggable = false;
        photo.decoding = "async";
        photo.style.left = (-tile.start) + "px";
        photo.style.top = "0px";
        photo.style.width = cardW + "px";
        photo.style.height = cardH + "px";
        frame.appendChild(photo);
        var shade = document.createElement("span");
        shade.className = "circular-carousel__shade";
        frame.appendChild(shade);
        t.appendChild(frame);
        t.style.left = (-tile.size / 2) + "px";
        t.style.top = (-cardH / 2) + "px";
        t.style.width = tile.size + "px";
        t.style.height = cardH + "px";
        t.style.transform = tile.move;
        card.appendChild(t);
      });
      card.addEventListener("click", function () {
        if (performance.now() < dragBlockUntil) return;
        if (settings.onItemClick) settings.onItemClick(item, index);
      });
      ring.appendChild(card);
      cardEls.push(card);
    });

    /* ---- 状态 ---- */
    var state = {
      angle: 0,
      velocity: 0,
      target: null,
      dir: -1,
      press: null,
      drag: false,
      hover: false,
      pointer: { inside: false, x: 0, y: 0 },
      yaw: 0,
      pitch: 0,
      intro: null,
      introDone: false,
      stepAt: 0,
      fit: 1,
      shift: 0,
      drop: 0,
      last: 0,
      active: 0
    };
    var raf = 0;
    var visible = true;
    var alive = true;
    var dragBlockUntil = 0;

    /* ---- 视口适配：让圆柱整体装进容器 ---- */
    function measure() {
      var rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var width = rect.width * 0.94;
      var height = rect.height * 0.92;
      var P = perspective;
      var corners = [[-cardW / 2, -cardH / 2], [cardW / 2, -cardH / 2], [-cardW / 2, cardH / 2], [cardW / 2, cardH / 2]];
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var a = -180; a <= 180; a += 7.5) {
        for (var ci = 0; ci < corners.length; ci++) {
          var p = rotateX(rotateY([corners[ci][0], corners[ci][1], radius], a), tiltValue);
          p = [p[0], p[1], p[2] - radius];
          if (p[2] >= P * 0.95) continue;
          var k = P / (P - p[2]);
          if (p[0] * k < minX) minX = p[0] * k;
          if (p[0] * k > maxX) maxX = p[0] * k;
          if (p[1] * k < minY) minY = p[1] * k;
          if (p[1] * k > maxY) maxY = p[1] * k;
        }
      }
      var spanX = Math.max(maxX - minX, 1);
      var spanY = Math.max(maxY - minY, 1);
      var fit = Math.min(1, width / spanX, height / spanY);
      state.fit = fit;
      state.shift = -((minY + maxY) / 2) * fit;
      state.drop = (rect.height / fit) * 0.55 + cardH;
      stageEl.style.perspective = P + "px";
      stageEl.style.transform = "translate3d(0, " + state.shift.toFixed(2) + "px, 0) scale(" + fit.toFixed(4) + ")";
    }

    /* ---- 入场 ---- */
    function introCard(elapsed, landing) {
      if (!state.intro) return { radius: 1, lift: 0 };
      var type = state.intro.type;
      var reach = Math.abs(wrap(landing + state.angle));
      if (type === "assemble") {
        var d = (reach / 180) * 420;
        return { radius: 1 + 0.6 * (1 - easeOut(clamp((elapsed - d) / 1080, 0, 1))), lift: 0 };
      }
      if (type === "rise") {
        var d2 = (reach / 180) * 480;
        var p = easeOutQuint(clamp((elapsed - d2) / 900, 0, 1));
        return { radius: 1, lift: (1 - p) * state.drop };
      }
      if (type === "spin") {
        return { radius: 1 + 0.28 * (1 - easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1))), lift: 0 };
      }
      return { radius: 1, lift: 0 };
    }

    function nearest(angle) { return Math.round(angle / step) * step; }

    /* ---- 推进 ---- */
    function advance(s, dt, now) {
      if (!state.introDone) {
        if (!state.intro) {
          if (s.intro === "none") state.introDone = true;
          else state.intro = { type: s.intro, start: now };
        }
        if (state.intro && now - state.intro.start >= INTRO_LENGTH[state.intro.type]) {
          state.intro = null;
          state.introDone = true;
        }
      }
      var paused = (s.pauseOnHover && state.hover) || state.drag;
      var cruise = s.autoplay === "drift" && !paused && !state.intro ? s.speed * state.dir : 0;
      var busy = Boolean(state.intro) || state.drag;
      if (state.drag || state.intro) {
        state.velocity = state.drag ? state.velocity : 0;
      } else if (state.target !== null) {
        var remaining = dt;
        var damping = 2 * Math.sqrt(SPRING);
        while (remaining > 0) {
          var h = Math.min(remaining, 1 / 240);
          var accel = SPRING * (state.target - state.angle) - damping * state.velocity;
          state.velocity += accel * h;
          state.angle += state.velocity * h;
          remaining -= h;
        }
        if (Math.abs(state.target - state.angle) < 0.004 && Math.abs(state.velocity) < 0.03) {
          state.angle = state.target;
          state.velocity = 0;
          state.target = null;
        }
        busy = true;
      } else {
        var tau = 0.18 + s.momentum * 1.5;
        state.velocity += (cruise - state.velocity) * (1 - Math.exp(-dt / tau));
        state.angle += state.velocity * dt;
        if (cruise === 0 && s.snap && Math.abs(state.velocity) < SETTLE_SPEED) state.target = nearest(state.angle);
        busy = busy || cruise !== 0 || Math.abs(state.velocity) > 0.01 || state.target !== null;
      }
      var ease = 1 - Math.exp(-dt / 0.35);
      var aimYaw = state.pointer.inside ? state.pointer.x * s.parallax * 9 : 0;
      var aimPitch = state.pointer.inside ? -state.pointer.y * s.parallax * 6 : 0;
      state.yaw += (aimYaw - state.yaw) * ease;
      state.pitch += (aimPitch - state.pitch) * ease;
      if (Math.abs(aimYaw - state.yaw) > 0.01 || Math.abs(aimPitch - state.pitch) > 0.01) busy = true;
      return busy;
    }

    /* ---- 渲染 ---- */
    function render(s, now) {
      var elapsed = state.intro ? now - state.intro.start : 0;
      var swell = 1;
      var angle = state.angle;
      var R = s.radius * swell;
      camera.style.transform = "translate3d(0, 0, " + (-R).toFixed(2) + "px) rotateX(" + (s.tilt + state.pitch).toFixed(2) + "deg) rotateY(" + state.yaw.toFixed(2) + "deg)";
      ring.style.transform = "rotateY(" + angle.toFixed(3) + "deg)";
      for (var index = 0; index < s.count; index++) {
        var card = cardEls[index];
        if (!card) continue;
        var base = index * s.step;
        var mod = introCard(elapsed, base);
        var r = R * mod.radius;
        var transform = "rotateY(" + base.toFixed(3) + "deg) translateZ(" + r.toFixed(2) + "px)";
        if (mod.lift) transform += " translateY(" + mod.lift.toFixed(2) + "px)";
        card.style.transform = transform;
        var world = wrap(base + angle);
        var facing = Math.cos(world * TO_RAD);
        card.style.visibility = Math.abs(world) > 95 ? "hidden" : "";
        var fade = s.depthFade * Math.pow((1 - facing) / 2, 1.25);
        card.style.setProperty("--cc-depth", fade.toFixed(3));
      }
      var idx = ((Math.round(-state.angle / s.step) % s.count) + s.count) % s.count;
      if (idx !== state.active) {
        state.active = idx;
        if (s.onChange) s.onChange(idx);
      }
    }

    function frame(now) {
      raf = 0;
      if (!alive) return;
      var dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 1 / 60;
      state.last = now;
      var busy = advance(settings, dt, now);
      render(settings, now);
      if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame);
      else state.last = 0;
    }
    function wake() {
      if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    /* ---- 拖拽 ---- */
    function perPixel() { return 180 / (Math.PI * radius * state.fit); }
    function onPointerDown(e) {
      if (!settings.draggable || e.button !== 0) return;
      state.press = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        angle: state.angle,
        moved: false,
        origin: 0,
        samples: [{ time: performance.now(), angle: state.angle }]
      };
    }
    function onPointerMove(e) {
      if (e.pointerType === "mouse") {
        var rect = root.getBoundingClientRect();
        state.pointer.x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
        state.pointer.y = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
        state.pointer.inside = true;
      }
      var press = state.press;
      if (!press || press.id !== e.pointerId) { wake(); return; }
      var delta = e.clientX - press.x;
      if (!press.moved) {
        if (Math.abs(delta) < DRAG_THRESHOLD) return;
        press.moved = true;
        press.origin = delta;
        state.drag = true;
        state.target = null;
        state.velocity = 0;
        root.classList.add("circular-carousel--dragging");
        try { root.setPointerCapture(e.pointerId); } catch (err) {}
      }
      state.angle = press.angle + (delta - press.origin) * perPixel();
      var now = performance.now();
      press.samples.push({ time: now, angle: state.angle });
      while (press.samples.length > 2 && now - press.samples[0].time > 110) press.samples.shift();
      wake();
    }
    function onPointerUp(e) {
      var press = state.press;
      if (!press || press.id !== e.pointerId) return;
      state.press = null;
      if (!press.moved) return;
      state.drag = false;
      root.classList.remove("circular-carousel--dragging");
      dragBlockUntil = performance.now() + 350;
      var first = press.samples[0];
      var last = press.samples[press.samples.length - 1];
      var span = (last.time - first.time) / 1000;
      var velocity = span > 0.008 ? clamp((last.angle - first.angle) / span, -1400, 1400) : 0;
      state.velocity = velocity;
      if (Math.abs(velocity) > 60) state.dir = Math.sign(velocity);
      if (settings.snap) {
        var tau = 0.18 + settings.momentum * 1.5;
        state.target = Math.round((state.angle + velocity * tau * 0.55) / step) * step;
      }
      wake();
    }
    function onPointerEnter(e) {
      if (e.pointerType !== "mouse") return;
      state.hover = true;
      wake();
    }
    function onPointerLeave(e) {
      if (e.pointerType === "mouse") {
        state.hover = false;
        state.pointer.inside = false;
      }
      wake();
    }

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerUp);
    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);

    var resizeObs = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(function () { measure(); wake(); });
      resizeObs.observe(root);
    }
    var io = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(function (entries) {
        visible = entries.some(function (en) { return en.isIntersecting; });
        if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; state.last = 0; }
      });
      io.observe(root);
    }
    var onVisibility = function () {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; state.last = 0; }
      else wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    /* ---- 公开 API ---- */
    var api = {
      focus: function (index) {
        var target = -index * step;
        target += 360 * Math.round((state.angle - target) / 360);
        state.target = target;
        wake();
      },
      stepBy: function (delta) {
        var base = state.target != null ? state.target : Math.round(state.angle / step) * step;
        state.target = base - delta * step;
        wake();
      },
      getActive: function () { return state.active; },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        root.removeEventListener("pointerdown", onPointerDown);
        root.removeEventListener("pointermove", onPointerMove);
        root.removeEventListener("pointerup", onPointerUp);
        root.removeEventListener("pointercancel", onPointerUp);
        root.removeEventListener("pointerenter", onPointerEnter);
        root.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        if (resizeObs) resizeObs.disconnect();
        if (io) io.disconnect();
        root.parentNode && root.parentNode.removeChild(root);
      }
    };

    measure();
    render(settings, performance.now());
    wake();
    return api;
  }

  global.CircularCarousel = CircularCarousel;
})(window);
