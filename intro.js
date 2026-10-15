/* ============================================================
   开场动画：文字「中国民乐」溶解成花瓣粒子（原生 Canvas）
   源自 Codrops「WebGPU Gommage」视觉 · 原生重写 · file:// 可运行
   文字「中国民乐」· 一次溶解后丝滑衔接展厅
   配色从网站提取：蓝绿 #4aa5a0 / 石蓝 #556f80 / 浅蓝 #6f8797 /
                 浅蓝绿 #cfe7e2 / 米白 #fdf3ee / 汤红点缀 #b83a2a
   流畅度优化：更密粒子 · 缓动曲线 · 平滑噪声转向 · 渐变透明度
   ============================================================ */
(function () {
  "use strict";
  var stage = document.getElementById("introStage");
  if (!stage) return;
  var canvas = document.getElementById("introCanvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  var W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // 网站配色（提取自民乐馆视觉）
  var COLORS = ["#4aa5a0", "#556f80", "#6f8797", "#cfe7e2", "#fdf3ee", "#b83a2a"];
  var TEXT = (window.LOCALE === "en") ? "Chinese Folk Music" : "中国民乐";
  var SEGMENTS = 1;                     // 一次溶解后进入展厅
  var FONT = "'Ma Shan Zheng', 'Noto Serif SC', serif";
  var DUR = { form: 1.0, hold: 0.55, scatter: 1.6 };  // 每段时长(秒)

  var reduce = (typeof window.matchMedia !== "undefined" &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduce) { stage.classList.add("done"); return; }

  var textColor = "#fdf3ee";
  var fontPx = 0;
  var pts = [];
  var particles = [];
  var segIndex = 0;
  var segStart = 0;
  var running = true;
  var finished = false;

  // 缓动曲线（更丝滑）
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function smoothstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // 字号自适应：中文「中国民乐」/ 英文 "Chinese Folk Music" 均不超宽
  function measureFontPx() {
    var f = Math.min(W * 0.155, 160);
    ctx.save();
    ctx.font = f + "px " + FONT;
    var w = ctx.measureText(TEXT).width;
    ctx.restore();
    if (w > W * 0.78) f = Math.max(28, Math.floor(f * (W * 0.78) / w));
    return f;
  }

  function samplePoints() {
    var off = document.createElement("canvas");
    off.width = W; off.height = H;
    var o = off.getContext("2d");
    fontPx = measureFontPx();
    o.clearRect(0, 0, W, H);
    o.font = fontPx + "px " + FONT;
    o.textAlign = "center"; o.textBaseline = "middle";
    o.fillStyle = "#fff";
    o.fillText(TEXT, W / 2, H / 2 - fontPx * 0.06);
    var img = o.getImageData(0, 0, W, H);
    var list = [];
    var gap = Math.max(2, Math.round(fontPx * 0.011));  // 更密：细腻溶解
    for (var y = 0; y < H; y += gap) {
      for (var x = 0; x < W; x += gap) {
        var i = (y * W + x) * 4;
        if (img.data[i + 3] > 110) list.push({ x: x, y: y });
      }
    }
    return list;
  }

  function beginSegment() {
    pts = samplePoints();
    particles = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var a = Math.random() * Math.PI * 2;
      var sp = (0.45 + Math.random() * 1.1) * (W * 0.00055);
      particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.15 * (W * 0.0004),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.045,
        size: (1 + Math.random() * 1.6) * (W * 0.0015),
        color: COLORS[(Math.random() * COLORS.length) | 0],
        alpha: 0,
        seed: Math.random() * 100
      });
    }
    segStart = performance.now();
  }

  // 平滑噪声转向：模拟空气流动，使飞散更灵动
  function flow(dt, x, y, seed) {
    return {
      ax: Math.sin(x * 0.004 + seed + dt * 0.5) * 0.28,
      ay: Math.cos(y * 0.0035 + seed * 1.7 + dt * 0.4) * 0.24
    };
  }

  function segPhase(now) {
    var el = (now - segStart) / 1000;
    var d = DUR.form + DUR.hold + DUR.scatter;
    if (el < DUR.form) return { ph: "form", t: el / DUR.form, d: d };
    if (el < DUR.form + DUR.hold) return { ph: "hold", t: 1, d: d };
    return { ph: "scatter", t: (el - DUR.form - DUR.hold) / DUR.scatter, d: d };
  }

  function drawText(alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = fontPx + "px " + FONT;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = textColor;
    ctx.shadowColor = "rgba(79,151,150,0.30)";
    ctx.shadowBlur = 20;
    ctx.fillText(TEXT, W / 2, H / 2 - fontPx * 0.06);
    ctx.restore();
  }

  function update(now) {
    var sp = segPhase(now);
    var segEl = (now - segStart) / 1000;
    var t = Math.max(0, Math.min(1, sp.t));
    var dt = Math.min(0.05, (now - (update._last || now)) / 1000);  // 平滑 dt
    update._last = now;

    // 文字层：缓动淡入 / 溶解淡出
    var textAlpha = 0;
    if (sp.ph === "form") textAlpha = easeInOut(t);
    else if (sp.ph === "hold") textAlpha = 1;
    else textAlpha = Math.max(0, 1 - smoothstep(0, 0.8, t));

    ctx.clearRect(0, 0, W, H);
    drawText(textAlpha);

    // 粒子
    var k = now / 1000;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (sp.ph === "scatter") {
        var fl = flow(k, p.x, p.y, p.seed);
        p.vx += fl.ax * dt;
        p.vy += fl.ay * dt + 0.014 * dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.998; p.vy *= 0.998;
        p.rot += p.vr;
        p.size *= 0.9992;                       // 缓慢微缩，更柔和
        p.alpha = smoothstep(0, 0.12, t) * (1 - smoothstep(0.55, 1, t));
      } else if (sp.ph === "form") {
        p.alpha = easeInOut(t) * 0.42;          // 作为文字氛围轻微浮动
        p.rot += p.vr * 0.25;
      } else {
        p.alpha = 0.55;
      }
      if (p.alpha <= 0.008) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 段推进
    if (segEl >= sp.d) {
      segIndex++;
      if (segIndex >= SEGMENTS) { finish(); return; }
      beginSegment();
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    running = false;
    stage.classList.add("fade-out");
    setTimeout(function () { stage.classList.add("done"); }, 950);
  }

  var loop = function (now) {
    if (!running) return;
    update(now);
    requestAnimationFrame(loop);
  };

  var started = false;
  function startIntro() {
    if (started) return;
    started = true;
    beginSegment();
    requestAnimationFrame(loop);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(startIntro);
    setTimeout(startIntro, 1200);
  } else {
    startIntro();
  }

  setTimeout(function () {
    if (!finished) finish();
  }, (SEGMENTS * (DUR.form + DUR.hold + DUR.scatter) * 1000) + 1400);
})();
