/* ============================================================
 * SplashCursor · 原生移植（window.SplashCursor 工厂 → { destroy }）
 * 来源：用户提供的 React WebGL2 流体鼠标彩墨拖尾组件。
 * 改动：去掉 React hooks，改为原生工厂；配色换成网站风格色
 *       （汤红 #b83a2a / 米金 #e8c9a0 / 石蓝 #6f8797 / 暖橘 #c96a4a），
 *       rainbow 关闭，theme=dark，保留全部 shader 与物理机制。
 * ============================================================ */
(function () {
  "use strict";

  var QUALITY = {
    low: { sim: 64, dye: 512, iterations: 10 },
    medium: { sim: 96, dye: 1024, iterations: 16 },
    high: { sim: 128, dye: 1440, iterations: 20 }
  };
  var BLOOM_RESOLUTION = 256;
  var BLOOM_ITERATIONS = 4;
  var BLOOM_THRESHOLD = 0.3;
  var BLOOM_KNEE = 0.7;
  var ROOT = "splash-cursor";
  var CANVAS = "splash-cursor__canvas";

  var VERTEX = "#version 300 es\nprecision highp float;\nin vec2 aPosition;\nuniform vec2 texelSize;\nout vec2 vUv;\nout vec2 vL;\nout vec2 vR;\nout vec2 vT;\nout vec2 vB;\nvoid main() {\n  vUv = aPosition * 0.5 + 0.5;\n  vL = vUv - vec2(texelSize.x, 0.0);\n  vR = vUv + vec2(texelSize.x, 0.0);\n  vT = vUv + vec2(0.0, texelSize.y);\n  vB = vUv - vec2(0.0, texelSize.y);\n  gl_Position = vec4(aPosition, 0.0, 1.0);\n}";

  var HEADER = "#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nin vec2 vUv;\nin vec2 vL;\nin vec2 vR;\nin vec2 vT;\nin vec2 vB;\nout vec4 outColor;\n";

  var SHADERS = {
    copy: "uniform sampler2D uTexture;\nvoid main() {\n  outColor = texture(uTexture, vUv);\n}",
    clear: "uniform sampler2D uTexture;\nuniform float value;\nvoid main() {\n  outColor = value * texture(uTexture, vUv);\n}",
    splat: "uniform sampler2D uTarget;\nuniform float aspectRatio;\nuniform vec3 color;\nuniform vec2 pointA;\nuniform vec2 pointB;\nuniform float radius;\nvoid main() {\n  vec2 scale = vec2(aspectRatio, 1.0);\n  vec2 pa = (vUv - pointA) * scale;\n  vec2 ba = (pointB - pointA) * scale;\n  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);\n  vec2 d = pa - ba * h;\n  vec3 base = texture(uTarget, vUv).xyz;\n  outColor = vec4(base + exp(-dot(d, d) / radius) * color, 1.0);\n}",
    burst: "uniform sampler2D uTarget;\nuniform float aspectRatio;\nuniform vec2 point;\nuniform float radius;\nuniform float strength;\nuniform float seed;\nvoid main() {\n  vec2 d = (vUv - point) * vec2(aspectRatio, 1.0);\n  float distance = length(d);\n  vec2 direction = d / max(distance, 0.00001);\n  float angle = atan(d.y, d.x);\n  float petals = 0.78 + 0.22 * sin(angle * 5.0 + seed) * sin(angle * 3.0 - seed * 1.7);\n  vec2 twist = vec2(-direction.y, direction.x) * 0.3 * sin(angle * 4.0 + seed * 2.3);\n  float falloff = exp(-dot(d, d) / radius) * distance / sqrt(radius);\n  outColor = vec4(texture(uTarget, vUv).xy + (direction * petals + twist) * falloff * strength, 0.0, 1.0);\n}",
    crown: "uniform sampler2D uTarget;\nuniform float aspectRatio;\nuniform vec2 point;\nuniform float radius;\nuniform vec3 colorA;\nuniform vec3 colorB;\nuniform float seed;\nvoid main() {\n  vec2 d = (vUv - point) * vec2(aspectRatio, 1.0);\n  vec3 ink = exp(-dot(d, d) / (radius * 0.45)) * colorA;\n  for (int i = 0; i < 7; i++) {\n    float index = float(i);\n    float angle = seed + index * 0.8975979 + sin(seed * 3.0 + index * 1.9) * 0.35;\n    float reach = sqrt(radius) * (0.75 + 0.45 * fract(sin(seed * 7.1 + index * 3.7) * 43.7));\n    float drop = radius * (0.08 + 0.12 * fract(sin(seed * 2.9 + index * 5.3) * 31.9));\n    vec2 q = d - vec2(cos(angle), sin(angle)) * reach;\n    ink += exp(-dot(q, q) / drop) * mix(colorA, colorB, fract(index * 0.37 + 0.2));\n  }\n  outColor = vec4(texture(uTarget, vUv).xyz + ink, 1.0);\n}",
    advection: "uniform sampler2D uVelocity;\nuniform sampler2D uSource;\nuniform vec2 texelSize;\nuniform float dt;\nuniform float dissipation;\nvoid main() {\n  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;\n  outColor = texture(uSource, coord) / (1.0 + dissipation * dt);\n}",
    divergence: "uniform sampler2D uVelocity;\nvoid main() {\n  float L = texture(uVelocity, vL).x;\n  float R = texture(uVelocity, vR).x;\n  float T = texture(uVelocity, vT).y;\n  float B = texture(uVelocity, vB).y;\n  vec2 C = texture(uVelocity, vUv).xy;\n  if (vL.x < 0.0) L = -C.x;\n  if (vR.x > 1.0) R = -C.x;\n  if (vT.y > 1.0) T = -C.y;\n  if (vB.y < 0.0) B = -C.y;\n  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);\n}",
    curl: "uniform sampler2D uVelocity;\nvoid main() {\n  float L = texture(uVelocity, vL).y;\n  float R = texture(uVelocity, vR).y;\n  float T = texture(uVelocity, vT).x;\n  float B = texture(uVelocity, vB).x;\n  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);\n}",
    vorticity: "uniform sampler2D uVelocity;\nuniform sampler2D uCurl;\nuniform float curl;\nuniform float dt;\nvoid main() {\n  float L = texture(uCurl, vL).x;\n  float R = texture(uCurl, vR).x;\n  float T = texture(uCurl, vT).x;\n  float B = texture(uCurl, vB).x;\n  float C = texture(uCurl, vUv).x;\n  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));\n  force /= length(force) + 0.0001;\n  force *= curl * C;\n  force.y *= -1.0;\n  vec2 velocity = texture(uVelocity, vUv).xy + force * dt;\n  outColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);\n}",
    pressure: "uniform sampler2D uPressure;\nuniform sampler2D uDivergence;\nvoid main() {\n  float L = texture(uPressure, vL).x;\n  float R = texture(uPressure, vR).x;\n  float T = texture(uPressure, vT).x;\n  float B = texture(uPressure, vB).x;\n  float divergence = texture(uDivergence, vUv).x;\n  outColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);\n}",
    gradient: "uniform sampler2D uPressure;\nuniform sampler2D uVelocity;\nvoid main() {\n  float L = texture(uPressure, vL).x;\n  float R = texture(uPressure, vR).x;\n  float T = texture(uPressure, vT).x;\n  float B = texture(uPressure, vB).x;\n  vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);\n  outColor = vec4(velocity, 0.0, 1.0);\n}",
    prefilter: "uniform sampler2D uTexture;\nuniform vec3 curve;\nuniform float threshold;\nvoid main() {\n  vec3 c = texture(uTexture, vUv).rgb;\n  float br = max(c.r, max(c.g, c.b));\n  float rq = clamp(br - curve.x, 0.0, curve.y);\n  rq = curve.z * rq * rq;\n  c *= max(rq, br - threshold) / max(br, 0.0001);\n  outColor = vec4(c, 0.0);\n}",
    blur: "uniform sampler2D uTexture;\nuniform float intensity;\nvoid main() {\n  vec4 sum = texture(uTexture, vL) + texture(uTexture, vR) + texture(uTexture, vT) + texture(uTexture, vB);\n  outColor = sum * 0.25 * intensity;\n}",
    display: "uniform sampler2D uTexture;\nuniform sampler2D uBloom;\nuniform vec2 texelSize;\nuniform float shading;\nuniform float bloom;\nuniform float light;\nfloat hash(vec2 p) {\n  vec3 q = fract(vec3(p.xyx) * 0.1031);\n  q += dot(q, q.yzx + 33.33);\n  return fract((q.x + q.y) * q.z);\n}\nvoid main() {\n  vec3 c = texture(uTexture, vUv).rgb;\n  if (shading > 0.0) {\n    float dx = length(texture(uTexture, vR).rgb) - length(texture(uTexture, vL).rgb);\n    float dy = length(texture(uTexture, vT).rgb) - length(texture(uTexture, vB).rgb);\n    vec3 n = normalize(vec3(dx, dy, length(texelSize)));\n    c *= mix(1.0, clamp(n.z + 0.7, 0.7, 1.0), shading);\n  }\n  if (bloom > 0.0) {\n    c += max(texture(uBloom, vUv).rgb, 0.0) * bloom;\n  }\n  c = max(c, 0.0);\n  float peak = max(c.r, max(c.g, c.b));\n  float grain = (hash(gl_FragCoord.xy) - 0.5) / 255.0 * smoothstep(0.0, 0.03, peak);\n  if (light > 0.5) {\n    vec3 transmit = exp(-2.4 * c);\n    float low = min(transmit.r, min(transmit.g, transmit.b));\n    float alpha = clamp(1.0 - low + grain, 0.0, 1.0);\n    outColor = vec4(min(transmit - low, vec3(alpha)), alpha);\n  } else {\n    c = max(c + grain, 0.0);\n    float alpha = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);\n    outColor = vec4(min(c, vec3(alpha)), alpha);\n  }\n}"
  };

  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };
  var parseColor = function (value) {
    var hex = String(value).replace("#", "").trim();
    if (hex.length === 3) hex = hex.split("").map(function (ch) { return ch + ch; }).join("");
    var number = parseInt(hex.slice(0, 6), 16);
    if (Number.isNaN(number)) return [1, 1, 1];
    return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
  };
  var hsv = function (h, s, v) {
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    var sector = ((i % 6) + 6) % 6;
    if (sector === 0) return [v, t, p];
    if (sector === 1) return [q, v, p];
    if (sector === 2) return [p, v, t];
    if (sector === 3) return [p, q, v];
    if (sector === 4) return [t, p, v];
    return [v, p, q];
  };

  var DEFAULT_COLORS = ["#b83a2a", "#e8c9a0", "#6f8797", "#c96a4a"];

  window.SplashCursor = function (container, options) {
    options = options || {};

    var settings = {
      palette: (Array.isArray(options.colors) && options.colors.length ? options.colors : DEFAULT_COLORS).map(parseColor),
      rainbow: !!options.rainbow,
      colorSpeed: Math.max(0, options.colorSpeed != null ? options.colorSpeed : 1),
      intensity: Math.max(0, options.intensity != null ? options.intensity : 1),
      size: Math.max(0.05, options.size != null ? options.size : 1),
      force: Math.max(0, options.force != null ? options.force : 1),
      swirl: Math.max(0, options.swirl != null ? options.swirl : 3),
      trail: Math.max(0.05, options.trail != null ? options.trail : 1),
      momentum: Math.max(0.05, options.momentum != null ? options.momentum : 1),
      shading: clamp(options.shading != null ? options.shading : 1, 0, 1),
      glow: clamp(options.glow != null ? options.glow : 0, 0, 1),
      quality: QUALITY[options.quality] ? options.quality : "high",
      clickSplash: options.clickSplash !== false,
      contained: !!options.contained,
      light: options.theme === "light"
    };
    var introEnabled = options.intro !== false;

    var canvas = document.createElement("canvas");
    canvas.className = CANVAS;
    container.appendChild(canvas);

    var disposed = false;
    var cleanup = null;

    var start = function () {
      var gl = canvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false
      });
      if (!gl) return function () {};

      gl.getExtension("EXT_color_buffer_float");
      gl.getExtension("EXT_color_buffer_half_float");

      var renderable = function (internal, format) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, format, gl.HALF_FLOAT, null);
        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        var complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(texture);
        return complete;
      };

      var rgba = { internal: gl.RGBA16F, format: gl.RGBA };
      if (!renderable(rgba.internal, rgba.format)) return function () {};
      var rg = renderable(gl.RG16F, gl.RG) ? { internal: gl.RG16F, format: gl.RG } : rgba;
      var r = renderable(gl.R16F, gl.RED) ? { internal: gl.R16F, format: gl.RED } : rg;

      var compile = function (type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
      };

      var vertex = compile(gl.VERTEX_SHADER, VERTEX);
      var programs = {};
      var broken = false;
      Object.keys(SHADERS).forEach(function (name) {
        var body = SHADERS[name];
        var fragment = compile(gl.FRAGMENT_SHADER, HEADER + body);
        var program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.bindAttribLocation(program, 0, "aPosition");
        gl.linkProgram(program);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) broken = true;
        var uniforms = {};
        var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < count; i++) {
          var info = gl.getActiveUniform(program, i);
          if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
        }
        programs[name] = { program: program, uniforms: uniforms };
      });
      gl.deleteShader(vertex);

      var buffer = gl.createBuffer();
      var vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      var targets = new Set();
      var released = false;
      var lost = false;

      var release = function () {
        released = true;
        if (gl.isContextLost()) return;
        targets.forEach(function (target) {
          gl.deleteFramebuffer(target.fbo);
          gl.deleteTexture(target.texture);
        });
        targets.clear();
        Object.keys(programs).forEach(function (name) {
          gl.deleteProgram(programs[name].program);
        });
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
      };

      if (broken) { release(); return function () {}; }

      var use = function (name) {
        var item = programs[name];
        gl.useProgram(item.program);
        return item.uniforms;
      };
      var blit = function (target) {
        if (target) {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        } else {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      var createTarget = function (width, height, format, filter) {
        gl.activeTexture(gl.TEXTURE0);
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, format.internal, width, height, 0, format.format, gl.HALF_FLOAT, null);
        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        var target = {
          texture: texture, fbo: fbo, width: width, height: height,
          texelX: 1 / width, texelY: 1 / height,
          attach: function (unit) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return unit;
          }
        };
        targets.add(target);
        return target;
      };
      var destroyTarget = function (target) {
        if (!target) return;
        gl.deleteFramebuffer(target.fbo);
        gl.deleteTexture(target.texture);
        targets.delete(target);
      };
      var reshape = function (target, width, height, format) {
        gl.bindTexture(gl.TEXTURE_2D, target.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, format.internal, width, height, 0, format.format, gl.HALF_FLOAT, null);
        target.width = width;
        target.height = height;
        target.texelX = 1 / width;
        target.texelY = 1 / height;
      };
      var createDouble = function (width, height, format, filter) {
        var pair = {
          read: createTarget(width, height, format, filter),
          write: createTarget(width, height, format, filter),
          width: width, height: height,
          texelX: 1 / width, texelY: 1 / height,
          swap: function () {
            var current = pair.read;
            pair.read = pair.write;
            pair.write = current;
          }
        };
        return pair;
      };
      var resizeDouble = function (pair, width, height, format, filter, keep) {
        if (keep) {
          var next = createTarget(width, height, format, filter);
          var u = use("copy");
          gl.uniform1i(u.uTexture, pair.read.attach(0));
          blit(next);
          destroyTarget(pair.read);
          pair.read = next;
        } else {
          reshape(pair.read, width, height, format);
        }
        reshape(pair.write, width, height, format);
        pair.width = width;
        pair.height = height;
        pair.texelX = 1 / width;
        pair.texelY = 1 / height;
      };
      var resolution = function (base) {
        var width = gl.drawingBufferWidth;
        var height = gl.drawingBufferHeight;
        var aspect = Math.max(width, height) / Math.max(1, Math.min(width, height));
        var short = Math.round(base);
        var long = Math.round(base * aspect);
        return width > height ? { width: long, height: short } : { width: short, height: long };
      };
      var fit = function () {
        var ratio = Math.min(window.devicePixelRatio || 1, 2);
        var width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
        var height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
        if (canvas.width === width && canvas.height === height) return;
        canvas.width = width;
        canvas.height = height;
      };
      var sizes = function () {
        var q = QUALITY[settings.quality];
        var shortSide = Math.min(gl.drawingBufferWidth, gl.drawingBufferHeight);
        return { sim: resolution(q.sim), ink: resolution(Math.max(q.sim, Math.min(q.dye, shortSide))) };
      };

      fit();
      var initial = sizes();
      var dye = createDouble(initial.ink.width, initial.ink.height, rgba, gl.LINEAR);
      var velocity = createDouble(initial.sim.width, initial.sim.height, rg, gl.LINEAR);
      var pressure = createDouble(initial.sim.width, initial.sim.height, r, gl.NEAREST);
      var divergence = createTarget(initial.sim.width, initial.sim.height, r, gl.NEAREST);
      var curl = createTarget(initial.sim.width, initial.sim.height, r, gl.NEAREST);
      var bloom = null;
      var bloomChain = [];
      var dropBloom = function () {
        destroyTarget(bloom);
        bloomChain.forEach(destroyTarget);
        bloom = null;
        bloomChain = [];
      };
      var ensureBloom = function () {
        if (bloom) return bloom;
        var size = resolution(BLOOM_RESOLUTION);
        var created = createTarget(size.width, size.height, rgba, gl.LINEAR);
        for (var i = 0; i < BLOOM_ITERATIONS; i++) {
          var width = size.width >> (i + 1);
          var height = size.height >> (i + 1);
          if (width < 2 || height < 2) break;
          bloomChain.push(createTarget(width, height, rgba, gl.LINEAR));
        }
        bloom = created;
        return created;
      };
      var resize = function () {
        fit();
        var next = sizes();
        if (dye.width !== next.ink.width || dye.height !== next.ink.height) {
          resizeDouble(dye, next.ink.width, next.ink.height, rgba, gl.LINEAR, true);
        }
        if (velocity.width !== next.sim.width || velocity.height !== next.sim.height) {
          resizeDouble(velocity, next.sim.width, next.sim.height, rg, gl.LINEAR, true);
          resizeDouble(pressure, next.sim.width, next.sim.height, r, gl.NEAREST, false);
          reshape(divergence, next.sim.width, next.sim.height, r);
          reshape(curl, next.sim.width, next.sim.height, r);
        }
        var glowSize = resolution(BLOOM_RESOLUTION);
        if (bloom && (bloom.width !== glowSize.width || bloom.height !== glowSize.height)) dropBloom();
      };

      var radiusFor = function (scale) {
        var aspect = canvas.width / canvas.height;
        return ((0.2 * settings.size * scale) / 100) * (aspect > 1 ? aspect : 1);
      };
      var splat = function (ax, ay, bx, by, vx, vy, color, radius) {
        var u = use("splat");
        gl.uniform1i(u.uTarget, velocity.read.attach(0));
        gl.uniform1f(u.aspectRatio, canvas.width / canvas.height);
        gl.uniform2f(u.pointA, ax, ay);
        gl.uniform2f(u.pointB, bx, by);
        gl.uniform3f(u.color, vx, vy, 0);
        gl.uniform1f(u.radius, radius);
        blit(velocity.write);
        velocity.swap();
        gl.uniform1i(u.uTarget, dye.read.attach(0));
        gl.uniform3f(u.color, color[0], color[1], color[2]);
        blit(dye.write);
        dye.swap();
      };
      var colorAt = function (offset, now) {
        var phase = (((offset + (now / 1000) * settings.colorSpeed * 0.6) % 1) + 1) % 1;
        if (settings.rainbow) return hsv(phase, 1, 1);
        var palette = settings.palette;
        if (palette.length === 1) return palette[0];
        var position = phase * palette.length;
        var from = palette[Math.floor(position) % palette.length];
        var to = palette[(Math.floor(position) + 1) % palette.length];
        var t = position - Math.floor(position);
        var blend = t * t * (3 - 2 * t);
        return [
          from[0] + (to[0] - from[0]) * blend,
          from[1] + (to[1] - from[1]) * blend,
          from[2] + (to[2] - from[2]) * blend
        ];
      };
      var inkFor = function (color, amount) {
        return color.map(function (channel) {
          return (settings.light ? 1 - channel : channel) * amount;
        });
      };
      var flush = function (pointer, dt, now) {
        var aspect = canvas.width / canvas.height;
        var length = Math.hypot((pointer.x - pointer.px) * aspect, pointer.y - pointer.py);
        if (length > 0.35) {
          pointer.px = pointer.x;
          pointer.py = pointer.y;
          return;
        }
        var dx = pointer.x - pointer.px;
        var dy = pointer.y - pointer.py;
        if (aspect < 1) dx *= aspect;
        else dy /= aspect;
        var radius = radiusFor(1);
        var spread = 1 + length / (1.77 * Math.sqrt(radius));
        var push = (6000 * settings.force) / Math.sqrt(spread);
        var amount = (0.15 * settings.intensity * Math.min(dt * 60, 1)) / Math.sqrt(spread);
        var color = inkFor(colorAt(pointer.offset, now), amount);
        splat(pointer.px, pointer.py, pointer.x, pointer.y, dx * push, dy * push, color, radius);
        pointer.px = pointer.x;
        pointer.py = pointer.y;
      };
      var burst = function (x, y, now) {
        var seed = Math.random() * Math.PI * 2;
        var aspect = canvas.width / canvas.height;
        var u = use("burst");
        gl.uniform1i(u.uTarget, velocity.read.attach(0));
        gl.uniform1f(u.aspectRatio, aspect);
        gl.uniform2f(u.point, x, y);
        gl.uniform1f(u.radius, radiusFor(3));
        gl.uniform1f(u.strength, 1100 * settings.force);
        gl.uniform1f(u.seed, seed);
        blit(velocity.write);
        velocity.swap();
        var offset = Math.random();
        var amount = 1.6 * settings.intensity;
        var first = inkFor(colorAt(offset, now), amount);
        var second = inkFor(colorAt(offset + 0.3, now), amount);
        u = use("crown");
        gl.uniform1i(u.uTarget, dye.read.attach(0));
        gl.uniform1f(u.aspectRatio, aspect);
        gl.uniform2f(u.point, x, y);
        gl.uniform1f(u.radius, radiusFor(1.6));
        gl.uniform3f(u.colorA, first[0], first[1], first[2]);
        gl.uniform3f(u.colorB, second[0], second[1], second[2]);
        gl.uniform1f(u.seed, seed);
        blit(dye.write);
        dye.swap();
      };
      var step = function (dt) {
        var iterations = QUALITY[settings.quality].iterations;
        gl.disable(gl.BLEND);
        var u = use("curl");
        gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
        gl.uniform1i(u.uVelocity, velocity.read.attach(0));
        blit(curl);
        u = use("vorticity");
        gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
        gl.uniform1i(u.uVelocity, velocity.read.attach(0));
        gl.uniform1i(u.uCurl, curl.attach(1));
        gl.uniform1f(u.curl, settings.swirl);
        gl.uniform1f(u.dt, dt);
        blit(velocity.write);
        velocity.swap();
        u = use("divergence");
        gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
        gl.uniform1i(u.uVelocity, velocity.read.attach(0));
        blit(divergence);
        u = use("clear");
        gl.uniform1i(u.uTexture, pressure.read.attach(0));
        gl.uniform1f(u.value, 0.1);
        blit(pressure.write);
        pressure.swap();
        u = use("pressure");
        gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
        gl.uniform1i(u.uDivergence, divergence.attach(0));
        for (var i = 0; i < iterations; i++) {
          gl.uniform1i(u.uPressure, pressure.read.attach(1));
          blit(pressure.write);
          pressure.swap();
        }
        u = use("gradient");
        gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
        gl.uniform1i(u.uPressure, pressure.read.attach(0));
        gl.uniform1i(u.uVelocity, velocity.read.attach(1));
        blit(velocity.write);
        velocity.swap();
        u = use("advection");
        gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
        gl.uniform1i(u.uVelocity, velocity.read.attach(0));
        gl.uniform1i(u.uSource, velocity.read.attach(0));
        gl.uniform1f(u.dt, dt);
        gl.uniform1f(u.dissipation, 2 / settings.momentum);
        blit(velocity.write);
        velocity.swap();
        gl.uniform1i(u.uVelocity, velocity.read.attach(0));
        gl.uniform1i(u.uSource, dye.read.attach(1));
        gl.uniform1f(u.dissipation, 3.5 / settings.trail);
        blit(dye.write);
        dye.swap();
      };
      var applyBloom = function (amount) {
        var base = ensureBloom();
        if (!bloomChain.length) return;
        gl.disable(gl.BLEND);
        var u = use("prefilter");
        var knee = BLOOM_THRESHOLD * BLOOM_KNEE + 0.0001;
        gl.uniform3f(u.curve, BLOOM_THRESHOLD - knee, knee * 2, 0.25 / knee);
        gl.uniform1f(u.threshold, BLOOM_THRESHOLD);
        gl.uniform1i(u.uTexture, dye.read.attach(0));
        blit(base);
        u = use("blur");
        gl.uniform1f(u.intensity, 1);
        var last = base;
        bloomChain.forEach(function (target) {
          gl.uniform2f(u.texelSize, last.texelX, last.texelY);
          gl.uniform1i(u.uTexture, last.attach(0));
          blit(target);
          last = target;
        });
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.enable(gl.BLEND);
        for (var i = bloomChain.length - 2; i >= 0; i--) {
          var target = bloomChain[i];
          gl.uniform2f(u.texelSize, last.texelX, last.texelY);
          gl.uniform1i(u.uTexture, last.attach(0));
          blit(target);
          last = target;
        }
        gl.disable(gl.BLEND);
        gl.uniform1f(u.intensity, amount);
        gl.uniform2f(u.texelSize, last.texelX, last.texelY);
        gl.uniform1i(u.uTexture, last.attach(0));
        blit(base);
      };
      var render = function () {
        if (settings.glow > 0) applyBloom(2 * settings.glow);
        gl.disable(gl.BLEND);
        var u = use("display");
        gl.uniform2f(u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
        gl.uniform1i(u.uTexture, dye.read.attach(0));
        gl.uniform1i(u.uBloom, (bloom || dye.read).attach(1));
        gl.uniform1f(u.shading, settings.shading);
        gl.uniform1f(u.bloom, settings.glow > 0 ? 1 : 0);
        gl.uniform1f(u.light, settings.light ? 1 : 0);
        blit(null);
      };
      var clearScreen = function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      };

      var pointers = new Map();
      var bursts = [];
      var reduced = (typeof window.matchMedia !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || false;
      var introPointer = { x: 0, y: 0, px: 0, py: 0, ready: false, moved: false, offset: Math.random() };
      var introStart = (introEnabled && !reduced) ? performance.now() + 150 : -1;
      var raf = 0;
      var last = 0;
      var lastActivity = performance.now();

      var advanceIntro = function (now) {
        if (introStart < 0) return;
        var progress = (now - introStart) / 1100;
        if (progress < 0) return;
        var t = Math.min(progress, 1);
        var eased = t * t * (3 - 2 * t);
        var x = 0.2 + 0.6 * eased;
        var y = 0.5 + 0.12 * Math.sin(eased * Math.PI * 2);
        if (!introPointer.ready) {
          introPointer.x = introPointer.px = x;
          introPointer.y = introPointer.py = y;
          introPointer.ready = true;
        } else {
          introPointer.x = x;
          introPointer.y = y;
          introPointer.moved = true;
        }
        if (t >= 1) introStart = -1;
        lastActivity = now;
      };
      var frame = function (now) {
        raf = 0;
        if (released || lost || disposed) return;
        var dt = clamp((now - last) / 1000, 0, 1 / 60);
        last = now;
        resize();
        advanceIntro(now);
        if (introPointer.moved) {
          introPointer.moved = false;
          flush(introPointer, dt, now);
        }
        pointers.forEach(function (pointer) {
          if (!pointer.moved) return;
          pointer.moved = false;
          flush(pointer, dt, now);
        });
        bursts.splice(0).forEach(function (point) {
          burst(point.x, point.y, now);
        });
        step(dt);
        render();
        var quiet = (2.2 * settings.trail + 0.4) * 1000;
        if (introStart >= 0 || now - lastActivity < quiet) raf = requestAnimationFrame(frame);
        else clearScreen();
      };
      var wake = function () {
        lastActivity = performance.now();
        if (raf || released || lost || disposed) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      };
      var locate = function (clientX, clientY) {
        var rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        var x = (clientX - rect.left) / rect.width;
        var y = 1 - (clientY - rect.top) / rect.height;
        if (settings.contained && (x < 0 || x > 1 || y < 0 || y > 1)) return null;
        return { x: x, y: y };
      };
      var track = function (id, clientX, clientY) {
        var point = locate(clientX, clientY);
        var pointer = pointers.get(id);
        if (!point) {
          if (pointer) pointer.ready = false;
          return;
        }
        if (!pointer) {
          pointer = { x: 0, y: 0, px: 0, py: 0, ready: false, moved: false, offset: Math.random() };
          pointers.set(id, pointer);
        }
        if (!pointer.ready) {
          pointer.x = pointer.px = point.x;
          pointer.y = pointer.py = point.y;
          pointer.ready = true;
          return;
        }
        pointer.x = point.x;
        pointer.y = point.y;
        pointer.moved = true;
        wake();
      };
      var press = function (clientX, clientY) {
        if (!settings.clickSplash) return;
        var point = locate(clientX, clientY);
        if (!point) return;
        bursts.push(point);
        wake();
      };

      var onPointerMove = function (event) {
        if (event.pointerType !== "touch") track("p" + event.pointerId, event.clientX, event.clientY);
      };
      var onPointerDown = function (event) {
        if (event.pointerType !== "touch") press(event.clientX, event.clientY);
      };
      var onTouchStart = function (event) {
        Array.from(event.changedTouches).forEach(function (touch) {
          pointers.delete("t" + touch.identifier);
          track("t" + touch.identifier, touch.clientX, touch.clientY);
          press(touch.clientX, touch.clientY);
        });
      };
      var onTouchMove = function (event) {
        Array.from(event.changedTouches).forEach(function (touch) {
          track("t" + touch.identifier, touch.clientX, touch.clientY);
        });
      };
      var onTouchEnd = function (event) {
        Array.from(event.changedTouches).forEach(function (touch) {
          pointers.delete("t" + touch.identifier);
        });
      };
      var onLeave = function () {
        pointers.forEach(function (pointer) { pointer.ready = false; });
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
      window.addEventListener("touchcancel", onTouchEnd, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);

      resize();
      if (introStart >= 0) wake();

      var terminate = function () {
        if (released) return;
        released = true;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
        document.documentElement.removeEventListener("pointerleave", onLeave);
        release();
      };
      return terminate;
    };

    /* WebGL context 丢失 / 恢复：恢复时重建全部 GL 资源 */
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      if (cleanup) { cleanup(); cleanup = null; }
    });
    canvas.addEventListener("webglcontextrestored", function () {
      if (disposed) return;
      if (cleanup) { cleanup(); cleanup = null; }
      cleanup = start();
    });

    cleanup = start();

    return {
      canvas: canvas,
      destroy: function () {
        disposed = true;
        if (cleanup) { cleanup(); cleanup = null; }
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  };
})();
