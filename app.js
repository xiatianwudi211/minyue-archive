/* ============================================================
   中国民乐 · 数字乐器馆 —— 交互逻辑
   原生 JS：hash 路由 + 展厅展示台 + 详情页三区镜头靠近放大
   ============================================================ */
(function () {
  "use strict";

  var instruments = window.INSTRUMENTS || [];
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var els = {
    showcase: document.getElementById("view-showcase"),
    detail: document.getElementById("view-detail"),
    bgFibers: document.getElementById("bgFibers"),
    stageCarousel: document.getElementById("stageCarousel"),
    stageCode: document.getElementById("stageCode"),
    captionCat: document.getElementById("captionCat"),
    captionName: document.getElementById("captionName"),
    captionSub: document.getElementById("captionSub"),
    captionSummary: document.getElementById("captionSummary"),
    specimenStrip: document.getElementById("specimenStrip"),
    enterBtn: document.getElementById("enterBtn"),
    backBtn: document.getElementById("backBtn"),
    detailImg: document.getElementById("detailImg"),
    detailName: document.getElementById("detailName"),
    detailCode: document.getElementById("detailCode"),
    detailCat: document.getElementById("detailCat"),
    zoomViewport: document.getElementById("zoomViewport"),
    zoomReset: document.getElementById("zoomReset"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    zoneLegend: document.getElementById("zoneLegend"),
    zoneTabs: document.querySelectorAll(".zone-tab"),
    zoneAnchorHistory: document.getElementById("zoneAnchorHistory"),
    zoneAnchorConstruction: document.getElementById("zoneAnchorConstruction"),
    zoneAnchorSchools: document.getElementById("zoneAnchorSchools"),
    autoBtn: document.getElementById("autoBtn"),
    infoIntro: document.getElementById("infoIntro"),
    infoTitle: document.getElementById("infoTitle"),
    infoText: document.getElementById("infoText"),
    infoFigure: document.getElementById("infoFigure"),
    infoFigureImg: document.getElementById("infoFigureImg"),
    infoFigureCaption: document.getElementById("infoFigureCaption"),
    featuredMusic: document.getElementById("featuredMusic"),
    featuredName: document.getElementById("featuredName"),
    featuredState: document.getElementById("featuredState"),
    fmPlay: document.getElementById("fmPlay"),
    splashCursor: document.getElementById("splashCursor"),
  };

  /* ---------- HoloCard 全息效果：详情放大图 ---------- */
  var detailHolo = null;
  var detailFace = null;
  function initHolo() {
    try {
      if (window.HoloCard) {
        detailHolo = window.HoloCard({
          container: els.zoomViewport,
          img: els.detailImg,
          preset: "bursts",
          foilColor: "#dfc9a0",
          intensity: 0.78,
          edgeSparkle: 0.7,
          glare: 0.5,
          radius: 14,
          tiltMax: 12,
          hoverScale: 1.0,
          idle: false,
          shadow: false
        });
        if (detailHolo) detailFace = detailHolo.face;
      }
    } catch (e) {
      detailHolo = null;
      detailFace = null;
    }
  }
  initHolo();

  /* ---------- GhostFibers 动态背景（原生移植） ---------- */
  var bgFibers = null;
  function initFibers() {
    if (!window.GhostFibers || !els.bgFibers) return;
    try {
      bgFibers = window.GhostFibers(els.bgFibers, {
        glowColor: "#4aa5a0",
        layers: 3,
        twist: 1.2,
        threads: 72,
        fiberStyle: "dots",
        depthOfField: 0.85,
        hoverEffect: "focus",
        intro: true,
        mouseInteraction: true,
        lineColor: "#cfe7e2",
        secondaryColor: "#2f7d78",
        gradient: "depth",
        waves: 1,
        volume: 0.7,
        spread: 1,
        scale: 1,
        rotation: 18,
        perspective: 0.65,
        density: 1,
        thickness: 1,
        tips: 0,
        foldGlow: 1,
        speed: 0.5,
        flow: 0.4,
        rollSpeed: 0.15,
        focusDepth: 0,
        particles: 0.5,
        sparkle: 0.5,
        glow: 0.8,
        brightness: 1,
        vignette: 0.3,
        grain: 0.06,
        mouseStrength: 1,
        pulseOnClick: true,
        lightMode: false
      });
    } catch (e) {
      bgFibers = null;
    }
  }

  /* 鼠标彩墨拖尾（SplashCursor 原生移植 · 网站风格色：汤红/米金/石蓝/暖橘） */
  var splashCursor = null;
  function initSplash() {
    if (!window.SplashCursor || !els.splashCursor) return;
    try {
      splashCursor = window.SplashCursor(els.splashCursor, {
        colors: ["#b83a2a", "#e8c9a0", "#6f8797", "#c96a4a"],
        rainbow: false,
        colorSpeed: 1,
        intensity: 1,
        size: 1,
        force: 1,
        swirl: 3,
        trail: 1,
        momentum: 1,
        shading: 1,
        glow: 0,
        quality: "high",
        clickSplash: true,
        intro: true,
        contained: false,
        theme: "dark"
      });
    } catch (e) {
      splashCursor = null;
    }
  }

  var state = {
    activeIndex: 0,
    typewriterTimer: null,
    autoTimer: null,
  };

  /* ---------- 工具：打字机 ---------- */
  function typewriter(el, text, speed) {
    clearTimeout(state.typewriterTimer);
    if (reduced) {
      el.textContent = text;
      return;
    }
    el.textContent = "";
    var i = 0;
    function step() {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i < text.length) {
        state.typewriterTimer = setTimeout(step, speed || 26);
      }
    }
    step();
  }

  /* ---------- 路由 ---------- */
  function route() {
    var hash = location.hash || "#/";
    if (hash.indexOf("#/instrument/") === 0) {
      var slug = hash.slice("#/instrument/".length).replace(/\/$/, "");
      var inst = instruments.filter(function (s) { return s.slug === slug; })[0];
      if (inst) { showDetail(inst); } else { location.hash = "#/"; }
    } else {
      showShowcase();
    }
  }
  window.addEventListener("hashchange", route);

  function switchView(show) {
    els.showcase.classList.toggle("active", show);
    els.detail.classList.toggle("active", !show);
  }

  /* ============================================================
     展厅展示台
     ============================================================ */
  function renderStrip() {
    els.specimenStrip.innerHTML = "";
    instruments.forEach(function (inst, i) {
      // amber 风分段缩略图条：无硬边框，底部为汤红分段指示
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "specimen-chip" + (i === state.activeIndex ? " active" : "");
      chip.setAttribute("role", "tab");
      chip.setAttribute("aria-label", I18N.text("viewInstr") + I18N.field(inst, "name"));
      chip.setAttribute("aria-current", i === state.activeIndex ? "true" : "false");
      chip.title = I18N.field(inst, "name");
      var img = document.createElement("img");
      img.src = inst.image;
      img.alt = "";
      img.draggable = false;
      var seg = document.createElement("span");
      seg.className = "chip-seg";
      seg.setAttribute("aria-hidden", "true");
      chip.appendChild(img);
      chip.appendChild(seg);
      chip.addEventListener("click", function () { selectInstrument(i, true); });
      els.specimenStrip.appendChild(chip);
    });
  }

  function applyShowcase(index) {
    state.activeIndex = index;
    var inst = instruments[index];
    if (!inst) return;
    els.stageCode.textContent = inst.code;
    els.captionName.textContent = I18N.field(inst, "name");
    els.captionCat.textContent = I18N.field(inst, "category") + " · " + I18N.field(inst, "line");
    els.captionSub.textContent = I18N.field(inst, "altName");
    typewriter(els.captionSummary, I18N.field(inst, "summary"), 24);
    els.specimenStrip.querySelectorAll(".specimen-chip").forEach(function (c, i) {
      var active = i === index;
      c.classList.toggle("active", active);
      c.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  /* 选中某件乐器：让轮播转到位 + 立即同步标题/缩略条 */
  function selectInstrument(index, focusChip) {
    index = (index + instruments.length) % instruments.length;
    if (carousel) carousel.focus(index);
    applyShowcase(index);
    if (focusChip) {
      var chips = els.specimenStrip.querySelectorAll(".specimen-chip");
      if (chips[index]) chips[index].focus();
    }
  }

  function showShowcase() {
    switchView(true);
    stopAudio();  // 跳出详情 / 返回展厅：自动暂停乐器音乐
    bgmEnsurePlay();  // 返回展厅：恢复背景音乐（若开启）
    if (!els.specimenStrip.children.length) renderStrip();
    applyShowcase(state.activeIndex);
  }

  /* ---------- 3D 环形轮播（展示台中央） ---------- */
  var carousel = null;
  function initCarousel() {
    if (!window.CircularCarousel || !els.stageCarousel) return;
    carousel = window.CircularCarousel(els.stageCarousel, {
      items: instruments.map(function (inst, i) {
        return { src: inst.image.replace("assets/", "assets/carousel/"), title: I18N.field(inst, "name"), alt: I18N.field(inst, "imageAlt"), code: inst.code, index: i };
      }),
      cardWidth: 250,
      aspectRatio: 1.3,
      gap: 18,
      tilt: -5,
      curve: 1,
      perspective: 2500,
      autoplay: "drift",
      speed: 9,
      direction: "left",
      momentum: 0.6,
      snap: true,
      draggable: true,
      parallax: 0.3,
      depthFade: 0.35,
      fadeColor: "#556f80",
      cornerRadius: 12,
      intro: "rise",
      onChange: function (index) { applyShowcase(index); },
      onItemClick: function (item, index) {
        selectInstrument(index);
        goDetailAt(index);
      }
    });
    applyShowcase(state.activeIndex);
  }

  /* ============================================================
     详情页：乐器图片自由缩放（滚轮 / 双指 / 拖拽 / ＋−全览）
     ============================================================ */
  var ZOOM_MIN = 1;
  var ZOOM_MAX = 10;
  var zoom = { s: 1, tx: 0, ty: 0 };

  function zoomTarget() {
    return detailFace || els.detailImg;
  }

  function applyZoom(animate) {
    var t = zoomTarget();
    if (!t) return;
    if (animate) els.zoomViewport.classList.add("zoom-anim");
    t.style.transformOrigin = "0 0";
    t.style.transform = "translate(" + zoom.tx.toFixed(2) + "px, " + zoom.ty.toFixed(2) + "px) scale(" + zoom.s.toFixed(4) + ")";
    els.zoomViewport.classList.toggle("zoomed", zoom.s > 1.001);
    els.zoomReset.disabled = zoom.s <= 1.001;
    if (animate) setTimeout(function () { els.zoomViewport.classList.remove("zoom-anim"); }, 520);
  }

  function clampZoom() {
    zoom.s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom.s));
    var vp = els.zoomViewport.getBoundingClientRect();
    var mx = (zoom.s - 1) * vp.width / 2;
    var my = (zoom.s - 1) * vp.height / 2;
    zoom.tx = Math.min(mx, Math.max(-mx, zoom.tx));
    zoom.ty = Math.min(my, Math.max(-my, zoom.ty));
  }

  function resetImageZoom(animate) {
    zoom.s = 1;
    zoom.tx = 0;
    zoom.ty = 0;
    applyZoom(animate !== false);
  }

  function zoomAt(cx, cy, factor) {
    var vp = els.zoomViewport.getBoundingClientRect();
    var x = cx - vp.left;
    var y = cy - vp.top;
    var newS = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom.s * factor));
    if (newS === zoom.s) { applyZoom(false); return; }
    zoom.tx = x - (x - zoom.tx) * (newS / zoom.s);
    zoom.ty = y - (y - zoom.ty) * (newS / zoom.s);
    zoom.s = newS;
    clampZoom();
    applyZoom(false);
  }

  /* 专题锚点标签（保留给专题切换条） */
  function setZoneAnchors(inst) {
    var zs = I18N.zones(inst);
    els.zoneAnchorHistory.textContent = zs[0] || "";
    els.zoneAnchorConstruction.textContent = zs[1] || "";
    els.zoneAnchorSchools.textContent = zs[2] || "";
  }

  function zoneKey(inst, key) {
    return inst.zones.filter(function (z) { return z.key === key; })[0];
  }

  function selectZone(key) {
    stopAuto();
    var inst = currentDetail;
    var zone = zoneKey(inst, key);
    if (!zone) return;
    els.zoneTabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-zone") === key);
    });
    renderInfo(inst, key);
  }

  var INFO = {
    history: "历史渊源",
    construction: "构造与形制",
    schools: "流派与风格",
  };

  function renderInfo(inst, key) {
    els.infoTitle.textContent = I18N.text("zone_" + key);
    els.infoText.textContent = I18N.field(inst, key);
    // 专题配图（箫 → 骨哨，编钟 → 曾侯乙编钟）
    if (key === "history" && inst.historyImg) {
      els.infoFigureImg.src = inst.historyImg;
      els.infoFigureImg.alt = I18N.field(inst, "historyImgCaption") || "";
      els.infoFigureCaption.textContent = I18N.field(inst, "historyImgCaption") || "";
      els.infoFigure.hidden = false;
    } else {
      els.infoFigure.hidden = true;
    }
  }

  function startAuto() {
    stopAuto();
    var inst = currentDetail;
    var keys = ["history", "construction", "schools"];
    var i = 0;
    selectZone(keys[0]);
    els.autoBtn.classList.add("running");
    els.autoBtn.lastChild.textContent = I18N.text("autoTouring");
    state.autoTimer = setInterval(function () {
      i = (i + 1) % keys.length;
      selectZone(keys[i]);
    }, 3400);
  }
  function stopAuto() {
    if (state.autoTimer) { clearInterval(state.autoTimer); state.autoTimer = null; }
    els.autoBtn.classList.remove("running");
    els.autoBtn.lastChild.textContent = I18N.text("autoTour");
  }

  var currentDetail = null;

  function showDetail(inst) {
    currentDetail = inst;
    switchView(false);
    bgmPause();  // 进入详情：关闭背景音乐
    stopAuto();
    els.detailName.textContent = I18N.field(inst, "name");
    els.detailCode.textContent = inst.code;
    els.detailCat.textContent = I18N.field(inst, "category") + " · " + I18N.field(inst, "line");
    els.detailImg.src = inst.image;
    els.detailImg.alt = I18N.field(inst, "imageAlt");
    if (detailHolo) detailHolo.setImage(inst.image);
    resetImageZoom(false);

    els.infoIntro.textContent = I18N.field(inst, "intro");
    setZoneAnchors(inst);
    renderInfo(inst, "history");
    els.zoneTabs.forEach(function (t) { t.classList.remove("active"); });

    // 特色音乐：切换乐器时停掉上一首
    stopAudio();
    if (inst.music) {
      els.featuredName.textContent = I18N.field(inst, "featuredMusic") || (I18N.field(inst, "name") + I18N.text("theme"));
      els.featuredMusic.hidden = false;
      els.fmPlay.classList.remove("playing");
      els.featuredState.textContent = I18N.text("fmPlay");
    } else {
      els.featuredMusic.hidden = true;
    }
    // 自动播放：进入详情 2 秒后自动播放该乐器音乐
    if (autoplayTimer) clearTimeout(autoplayTimer);
    autoplayTimer = setTimeout(function () {
      autoplayTimer = null;
      if (currentDetail && currentDetail.music) {
        if (!(audio && audioSlug === currentDetail.slug && !audio.paused)) {
          toggleMusic(currentDetail);
        }
      }
    }, 2000);
  }

  /* ---------- 多语言：刷新详情文案（不动缩放/音乐/专题状态） ---------- */
  function refreshDetailText(inst) {
    els.detailName.textContent = I18N.field(inst, "name");
    els.detailCode.textContent = inst.code;
    els.detailCat.textContent = I18N.field(inst, "category") + " · " + I18N.field(inst, "line");
    els.detailImg.alt = I18N.field(inst, "imageAlt");
    els.infoIntro.textContent = I18N.field(inst, "intro");
    setZoneAnchors(inst);
    var activeKey = "history";
    els.zoneTabs.forEach(function (t) { if (t.classList.contains("active")) activeKey = t.getAttribute("data-zone"); });
    renderInfo(inst, activeKey);
    if (inst.music) {
      els.featuredName.textContent = I18N.field(inst, "featuredMusic") || (I18N.field(inst, "name") + I18N.text("theme"));
    }
    updateFmState();
  }

  /* ---------- 多语言：应用当前语言到界面与内容 ---------- */
  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = I18N.text(el.getAttribute("data-i18n"));
    });
    var ls = document.getElementById("langSwitch");
    if (ls) ls.textContent = I18N.text("langSwitch");
    document.documentElement.lang = (window.LOCALE === "en") ? "en" : "zh-CN";
    document.title = I18N.text("brandTitle");
    bgmUpdateBtn();
    els.autoBtn.lastChild.textContent = els.autoBtn.classList.contains("running") ? I18N.text("autoTouring") : I18N.text("autoTour");
    if (els.showcase.classList.contains("active")) {
      renderStrip();
      applyShowcase(state.activeIndex);
    } else if (els.detail.classList.contains("active") && currentDetail) {
      refreshDetailText(currentDetail);
    }
  }

  /* ---------- 事件绑定 ---------- */
  els.zoneTabs.forEach(function (t) {
    t.addEventListener("click", function () { selectZone(t.getAttribute("data-zone")); });
  });

  /* ============================================================
     特色音乐：点击乐器图 / 特色音乐控件播放·暂停
     ============================================================ */
  var audio = null;        // 当前 Audio
  var audioSlug = null;    // 当前音频所属乐器
  var autoplayTimer = null; // 进入详情后的自动播放延时

  function updateFmState() {
    if (!els.featuredState || !els.fmPlay) return;
    if (audio && audioSlug && currentDetail && audioSlug === currentDetail.slug) {
      els.featuredState.textContent = audio.paused ? I18N.text("fmPaused") : I18N.text("fmPlaying");
      els.fmPlay.classList.toggle("playing", !audio.paused);
    } else {
      els.featuredState.textContent = "▶ 点击播放";
      els.fmPlay.classList.remove("playing");
    }
  }

  function stopAudio() {
    if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
    audioSlug = null;
    updateFmState();
  }

  function toggleMusic(inst) {
    if (!inst || !inst.music) return;
    // 同曲：播放 / 暂停切换
    if (audio && audioSlug === inst.slug) {
      if (audio.paused) { audio.play().catch(function () {}); } else { audio.pause(); }
      updateFmState();
      return;
    }
    // 换曲：停掉上一首，播放新的
    if (audio) { try { audio.pause(); } catch (e) {} }
    audio = new Audio(inst.music);
    audioSlug = inst.slug;
    audio.play().catch(function () {});
    updateFmState();
  }

  /* 特色音乐控件点击 */
  els.fmPlay.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMusic(currentDetail);
  });

  /* ============================================================
     展厅背景音乐（梁祝 · 音量较小 · 进详情自动关闭 · 可随时开关）
     ============================================================ */
  var bgm = new Audio("assets/audio/liangzhu.mp3");
  bgm.loop = true;
  bgm.volume = 0.18;                 // 声音较小
  bgm.preload = "auto";
  var bgmEnabled = true;             // 用户开关意图（默认开启）
  var bgmBtn = document.getElementById("bgmToggle");
  function bgmPlay() {
    if (!bgmEnabled) return;
    bgm.currentTime = 0;
    bgm.play().catch(function () {});
  }
  function bgmPause() { try { bgm.pause(); } catch (e) {} }
  function bgmUpdateBtn() {
    if (!bgmBtn) return;
    bgmBtn.classList.toggle("off", !bgmEnabled);
    bgmBtn.setAttribute("aria-label", bgmEnabled ? "关闭背景音乐" : "开启背景音乐");
    var lab = bgmBtn.querySelector(".bgm-label");
    if (lab) lab.textContent = I18N.text(bgmEnabled ? "bgmOn" : "bgmOff");
  }
  // 展厅可见且开启时播放（进详情关闭）
  function bgmEnsurePlay() {
    if (bgmEnabled && bgm.paused && els.showcase.classList.contains("active")) bgmPlay();
  }
  if (bgmBtn) {
    bgmBtn.addEventListener("click", function () {
      bgmEnabled = !bgmEnabled;
      if (bgmEnabled) { bgmPlay(); bgmEnsurePlay(); } else { bgmPause(); }
      bgmUpdateBtn();
    });
  }
  // 浏览器自动播放策略：首次用户交互时补播背景音乐
  document.addEventListener("pointerdown", function once() {
    document.removeEventListener("pointerdown", once);
    bgmEnsurePlay();
  }, { passive: true });
  document.addEventListener("keydown", function once() {
    document.removeEventListener("keydown", once);
    bgmEnsurePlay();
  }, { passive: true });

  els.zoomViewport.addEventListener("wheel", function (e) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  var pointers = new Map();
  var drag = null;
  var pinch = null;

  els.zoomViewport.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".zoom-toolbar, .zoom-btn, .zoom-reset")) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      drag = null;
      var p = Array.from(pointers.values());
      pinch = { dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), s0: zoom.s };
    } else {
      pinch = null;
      drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, tx0: zoom.tx, ty0: zoom.ty, moved: false };
    }
    try { els.zoomViewport.setPointerCapture(e.pointerId); } catch (err) {}
  });

  els.zoomViewport.addEventListener("pointermove", function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      var p = Array.from(pointers.values());
      var dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      var mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      var vp = els.zoomViewport.getBoundingClientRect();
      var factor = dist / (pinch.dist || 1);
      var newS = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinch.s0 * factor));
      var k = newS / pinch.s0;
      zoom.tx = (mid.x - vp.left) - ((mid.x - vp.left) - zoom.tx) * k;
      zoom.ty = (mid.y - vp.top) - ((mid.y - vp.top) - zoom.ty) * k;
      zoom.s = newS;
      clampZoom();
      applyZoom(false);
    } else if (drag && drag.id === e.pointerId && zoom.s > 1.001) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) drag.moved = true;
      zoom.tx = drag.tx0 + (e.clientX - drag.startX);
      zoom.ty = drag.ty0 + (e.clientY - drag.startY);
      clampZoom();
      applyZoom(false);
    }
  });

  function vpEnd(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      // 单击乐器图（无拖拽位移）→ 播放 / 暂停特色音乐
      if (drag && !drag.moved) toggleMusic(currentDetail);
      drag = null;
    }
  }
  els.zoomViewport.addEventListener("pointerup", vpEnd);
  els.zoomViewport.addEventListener("pointercancel", vpEnd);

  els.zoomInBtn.addEventListener("click", function () {
    var vp = els.zoomViewport.getBoundingClientRect();
    zoomAt(vp.left + vp.width / 2, vp.top + vp.height / 2, 1.45);
  });
  els.zoomOutBtn.addEventListener("click", function () {
    var vp = els.zoomViewport.getBoundingClientRect();
    zoomAt(vp.left + vp.width / 2, vp.top + vp.height / 2, 1 / 1.45);
  });
  els.zoomReset.addEventListener("click", function () { resetImageZoom(true); });
  els.autoBtn.addEventListener("click", function () {
    if (state.autoTimer) { stopAuto(); } else { startAuto(); }
  });

  function goDetail() {
    var inst = instruments[state.activeIndex];
    location.hash = "#/instrument/" + inst.slug;
  }
  function goDetailAt(index) {
    var inst = instruments[index] || instruments[state.activeIndex];
    location.hash = "#/instrument/" + inst.slug;
  }
  els.enterBtn.addEventListener("click", goDetail);
  els.backBtn.addEventListener("click", function () {
    if (autoplayTimer) { clearTimeout(autoplayTimer); autoplayTimer = null; }
    location.hash = "#/";
  });

  /* 键盘切换展厅乐器（驱动轮播转位） */
  document.addEventListener("keydown", function (e) {
    if (!els.showcase.classList.contains("active")) return;
    if (e.key === "ArrowRight") { selectInstrument(state.activeIndex + 1, false); }
    if (e.key === "ArrowLeft") { selectInstrument(state.activeIndex - 1, false); }
  });

  /* ---------- 启动 ---------- */
  renderStrip();
  initCarousel();
  initFibers();
  initSplash();
  route();

  /* ---------- 语言切换按钮（中 / EN） ---------- */
  var langBtn = document.getElementById("langSwitch");
  if (langBtn) {
    langBtn.addEventListener("click", function () {
      window.setLocale(window.LOCALE === "en" ? "zh" : "en");
      applyI18n();
    });
  }
  applyI18n();
})();
