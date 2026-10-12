/* MosaicScope site script.
   You never need to edit this file. All words, images and links live in content.json. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- Content ---------------- */
  function loadContent() {
    var inline = document.getElementById("site-content");
    if (inline) {
      try { return Promise.resolve(JSON.parse(inline.textContent)); } catch (e) { /* fall through */ }
    }
    return fetch("content.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("content.json not found");
      return r.json();
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Tagged accounts link straight to their Instagram profiles.
  function igUrl(h) { return "https://www.instagram.com/" + encodeURIComponent(String(h).replace(/^@/, "")) + "/"; }
  function mentionLinks(list) {
    return (list || []).map(function (h) {
      h = String(h).replace(/^@/, "");
      return '<a class="tag-link" href="' + igUrl(h) + '" target="_blank" rel="noopener">@' + esc(h) + "</a>";
    }).join(" ");
  }
  function linkify(text) {
    return esc(text).replace(/(^|[\s(])@([A-Za-z0-9._]{1,30})/g, function (m, pre, h) {
      h = h.replace(/\.+$/, "");
      return pre + '<a class="tag-link" href="' + igUrl(h) + '" target="_blank" rel="noopener">@' + h + "</a>";
    });
  }

  /* ---------------- Placeholder plates ----------------
     Generated art used ONLY where a real image is missing. Every one is labelled PLACEHOLDER. */
  var PALETTES = {
    photo: ["#170403", "#ec2a1c", "#f6b62c"],
    film: ["#05070e", "#f6b62c", "#3d5bff"],
    sound: ["#070a02", "#c6ff3d", "#2b3b05"],
    experiment: ["#120417", "#ff3ec8", "#c6ff3d"],
    hero: ["#140302", "#ec2a1c", "#f6b62c"],
    journal: ["#0d0b0a", "#c6ff3d", "#ec2a1c"]
  };
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var plateCache = {};
  function makePlate(seed, w, h, kind, label, asCanvas) {
    var key = [seed, w, h, kind, label, !!asCanvas].join("|");
    if (plateCache[key]) return plateCache[key];
    var r = rng(seed * 9973 + 17);
    var pal = PALETTES[kind] || PALETTES.photo;
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d");
    g.fillStyle = pal[0]; g.fillRect(0, 0, w, h);

    // light leaks
    for (var i = 0; i < 3; i++) {
      var x = r() * w, y = r() * h, rad = (0.35 + r() * 0.6) * Math.max(w, h);
      var grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, pal[1 + (i % 2)] + "cc");
      grd.addColorStop(1, pal[0] + "00");
      g.globalCompositeOperation = "screen";
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }
    g.globalCompositeOperation = "source-over";

    // hard fragments
    for (var k = 0; k < 9; k++) {
      g.save();
      g.translate(r() * w, r() * h);
      g.rotate((r() - 0.5) * 0.5);
      g.globalAlpha = 0.18 + r() * 0.35;
      g.fillStyle = pal[1 + Math.floor(r() * 2)];
      g.fillRect(-r() * w * 0.3, -r() * h * 0.2, w * (0.1 + r() * 0.4), h * (0.03 + r() * 0.2));
      g.restore();
    }

    // halftone band
    g.fillStyle = pal[2];
    var step = Math.max(6, Math.round(w / 60));
    var by = h * (0.2 + r() * 0.5), bh = h * 0.35;
    for (var yy = by; yy < by + bh; yy += step) {
      for (var xx = 0; xx < w; xx += step) {
        var d = (1 - Math.abs((yy - by) / bh - 0.5) * 2) * (0.5 + 0.5 * Math.sin(xx / w * 6 + r()));
        if (d > 0.05) { g.globalAlpha = 0.55; g.beginPath(); g.arc(xx, yy, d * step * 0.42, 0, 6.283); g.fill(); }
      }
    }
    g.globalAlpha = 1;

    // grain
    var id = g.getImageData(0, 0, w, h), px = id.data;
    for (var p = 0; p < px.length; p += 4) {
      var n = (Math.random() - 0.5) * 38;
      px[p] += n; px[p + 1] += n; px[p + 2] += n;
    }
    g.putImageData(id, 0, 0);

    // scanlines
    g.fillStyle = "rgba(0,0,0,0.18)";
    for (var s = 0; s < h; s += 3) g.fillRect(0, s, w, 1);

    // honest label (the hero plate is labelled by the note box instead)
    if (label === false) { var o0 = asCanvas ? c : c.toDataURL("image/jpeg", 0.82); plateCache[key] = o0; return o0; }
    var fs = Math.max(11, Math.round(w / 34));
    g.font = "500 " + fs + "px 'IBM Plex Mono', monospace";
    g.textBaseline = "top";
    var text = "PLACEHOLDER" + (label ? " · " + label.toUpperCase() : "");
    var tw = g.measureText(text).width;
    g.fillStyle = "rgba(14,11,10,0.8)";
    g.fillRect(fs, h - fs * 3.2, tw + fs, fs * 2);
    g.fillStyle = "#f6b62c";
    g.fillText(text, fs * 1.5, h - fs * 2.75);

    var out = asCanvas ? c : c.toDataURL("image/jpeg", 0.82);
    plateCache[key] = out;
    return out;
  }

  /* ---------------- Render ---------------- */
  var SHAPES = { tall: [600, 750], wide: [900, 600], square: [700, 700] };
  var CAT_LABEL = { photo: "Photo", film: "Film", sound: "Sound", experiment: "Experiment" };

  function renderGallery(data) {
    var gal = $("#gallery");
    gal.innerHTML = "";
    (data.projects || []).forEach(function (p, i) {
      var shape = SHAPES[p.shape] ? p.shape : "tall";
      var dims = SHAPES[shape];
      var img = p.cover || makePlate(i + 1, Math.round(dims[0] * 0.8), Math.round(dims[1] * 0.8), p.category, CAT_LABEL[p.category] || "");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tile tile--" + shape;
      b.setAttribute("data-cat", p.category || "photo");
      b.setAttribute("data-index", i);
      b.setAttribute("aria-label", "Open " + (p.title || "project") + (p.placeholder ? " (placeholder)" : ""));
      var frags = "";
      for (var f = 0; f < 4; f++) {
        var top = f * 25, bottom = 100 - (f + 1) * 25;
        var dx = reduceMotion ? 0 : Math.round((f % 2 ? 1 : -1) * (24 + Math.random() * 60));
        frags += '<span class="frag" style="background-image:url(\'' + img + '\');clip-path:inset(' + top + '% 0 ' + bottom + '% 0);--dx:' + dx + 'px;--s:1.04"></span>';
      }
      var vid = p.videoFile ? '<video class="tile__vid" muted loop playsinline preload="none" src="' + esc(p.videoFile) + '"></video>' : "";
      if (p.videoFile) b.classList.add("has-video");
      b.innerHTML =
        '<span class="tile__media">' + frags + vid +
        '<span class="slate"><span>FR ' + String(i + 1).padStart(2, "0") + '</span><span class="cat-' + esc(p.category) + '">' + esc(CAT_LABEL[p.category] || p.category) + "</span></span>" +
        (p.placeholder ? '<span class="tag-ph">Placeholder</span>' : "") + (p.fromInstagram ? '<span class="tag-ig">From Instagram</span>' : "") +
        "</span>" +
        '<span class="tile__cap"><strong>' + esc(p.title || "Untitled") + "</strong><em>" + esc(p.year || "") + "</em></span>" +
        (p.mentions && p.mentions.length ? '<span class="tile__tags mono">In frame: ' + esc(p.mentions.map(function (m) { return "@" + m; }).join(" ")) + "</span>" : "");
      gal.appendChild(b);
    });
    observeTiles($$(".tile", gal));
    // only show filter buttons that have work in them
    $$(".filter").forEach(function (btn) {
      var f = btn.getAttribute("data-filter");
      if (f === "all") return;
      btn.hidden = !(data.projects || []).some(function (p) { return p.category === f; });
      if (btn.hidden && currentFilter === f) currentFilter = "all";
    });
    applyFilter();
    initTileVideo();
  }

  // Reels in the gallery play silently on hover (or when scrolled into view on phones).
  var tileVideoBound = false;
  function initTileVideo() {
    var gal = $("#gallery");
    if (reduceMotion) return;
    if (!tileVideoBound) {
      tileVideoBound = true;
      gal.addEventListener("pointerover", function (e) {
        var t = e.target.closest && e.target.closest(".tile.has-video");
        if (!t || t.classList.contains("is-playing")) return;
        var v = t.querySelector("video");
        var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
        t.classList.add("is-playing");
      });
      gal.addEventListener("pointerout", function (e) {
        var t = e.target.closest && e.target.closest(".tile.has-video");
        if (!t || t.contains(e.relatedTarget)) return;
        t.querySelector("video").pause();
        t.classList.remove("is-playing");
      });
    }
    if (!finePointer && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          var v = en.target.querySelector("video");
          if (en.isIntersecting) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); en.target.classList.add("is-playing"); }
          else { v.pause(); en.target.classList.remove("is-playing"); }
        });
      }, { threshold: 0.6 });
      $$(".tile.has-video", gal).forEach(function (t) { io.observe(t); });
    }
  }

  function render(data) {
    var site = data.site || {};
    $$("[data-bind]").forEach(function (el) {
      var k = el.getAttribute("data-bind");
      var v = k === "servicesNote" ? data.servicesNote : site[k];
      if (v) el.textContent = v;
    });
    if (site.name) document.title = site.name;
    $("#year").textContent = new Date().getFullYear();
    $("#email-text").textContent = site.email || "";

    renderGallery(data);

    // services
    var sg = $("#services-grid");
    sg.innerHTML = "";
    (data.services || []).forEach(function (s) {
      var d = document.createElement("div");
      d.className = "svc";
      d.innerHTML = "<h3>" + esc(s.title) + "</h3><ul>" +
        (s.items || []).map(function (it) {
          var letters = Array.from(String(it)).map(function (ch, n) {
            return '<span class="lt" style="--i:' + n + '">' + (ch === " " ? "&nbsp;" : esc(ch)) + "</span>";
          }).join("");
          return '<li><span class="sr">' + esc(it) + '</span><span aria-hidden="true">' + letters + '</span><span aria-hidden="true">↗</span></li>';
        }).join("") + "</ul>";
      sg.appendChild(d);
    });

    // socials
    $("#socials").innerHTML = (data.social || []).map(function (s) {
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "<span>" + esc(s.handle || "") + "</span></a></li>";
    }).join("");
  }

  /* ---------------- Hero WebGL ---------------- */
  var VS = "attribute vec2 p;varying vec2 v;void main(){v=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}";
  var FS = [
    "precision mediump float;",
    "varying vec2 v;",
    "uniform sampler2D t;uniform vec2 res;uniform vec2 img;",
    "uniform float time;uniform float assemble;uniform float scroll;uniform vec2 mouse;uniform float vel;",
    "float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "vec2 cover(vec2 uv){float ra=res.x/res.y;float ia=img.x/img.y;vec2 s=ra>ia?vec2(1.0,ia/ra):vec2(ra/ia,1.0);return (uv-0.5)*s+0.5;}",
    "void main(){",
    " vec2 uv=v; float aspect=res.x/res.y;",
    " float rows=7.0; float r=floor(uv.y*rows);",
    " float cols=floor(mix(4.0,12.0,h(vec2(r,3.1))));",
    " float shift=h(vec2(r,7.7));",
    " float c=floor(uv.x*cols+shift); vec2 cell=vec2(c,r); float rnd=h(cell);",
    " vec2 center=vec2((c+0.5-shift)/cols,(r+0.5)/rows);",
    " vec2 dm=(center-mouse)*vec2(aspect,1.0); float md=exp(-dot(dm,dm)*7.0);",
    " float chaos=(1.0-assemble)*1.4+md*(0.45+vel*1.2)+scroll*0.7;",
    " vec2 off=(vec2(h(cell+1.3),h(cell+4.1))-0.5)*0.16*chaos;",
    " off+=vec2(sin(time*0.6+rnd*6.28),cos(time*0.5+rnd*6.28))*0.004*(0.4+md);",
    " float z=1.0+(rnd-0.5)*0.14*chaos;",
    " vec2 suv=(uv-center)/z+center+off;",
    " vec2 tuv=clamp(cover(suv),0.001,0.999);",
    " float sp=0.003+0.012*md+0.01*chaos+vel*0.03*md;",
    " vec3 col=vec3(texture2D(t,tuv+vec2(sp,0.0)).r,texture2D(t,tuv).g,texture2D(t,tuv-vec2(sp,0.0)).b);",
    " float inv=step(0.94,h(cell+floor(time*0.22)));",
    " col=mix(col,1.0-col,inv*0.85);",
    " vec2 f=vec2(fract(uv.x*cols+shift),fract(uv.y*rows));",
    " float e=smoothstep(0.0,0.012,f.x)*smoothstep(0.0,0.012,1.0-f.x)*smoothstep(0.0,0.02,f.y)*smoothstep(0.0,0.02,1.0-f.y);",
    " col*=mix(0.2,1.0,e); col*=0.82+0.32*rnd;",
    " col+=(h(uv*res+fract(time)*91.0)-0.5)*0.09;",
    " vec2 q=uv-0.5; col*=1.0-dot(q,q)*1.15;",
    " gl_FragColor=vec4(col,1.0);",
    "}"
  ].join("\n");

  function setPlateLabel(slides, i) {
    var el = $("#hero-plate");
    if (!el || !slides.length) return;
    el.hidden = false;
    el.href = slides[i].link || "#";
    el.innerHTML = "Plate <b>" + String(i + 1).padStart(2, "0") + "</b> / " + String(slides.length).padStart(2, "0") + " ↗";
    el.setAttribute("aria-label", "Opening photo " + (i + 1) + " of " + slides.length + ", view on Instagram");
  }

  // Cycle the opening mosaic through a list of photos. Each change shatters the mosaic and reassembles it.
  function makeSlideshow(show) {
    var slides = [], idx = 0, timer = null;
    function next() {
      if (slides.length < 2) return;
      idx = (idx + 1) % slides.length;
      show(slides[idx].img); setPlateLabel(slides, idx);
    }
    var hero = $(".hero");
    if (hero && !reduceMotion) {
      hero.addEventListener("click", function (e) {
        if (e.target.closest("a, button")) return;
        next();
        clearInterval(timer);
        timer = setInterval(function () { if (!document.hidden && window.scrollY < window.innerHeight) next(); }, 8000);
      });
    }
    return function setSlides(list) {
      slides = list || []; idx = 0;
      if (!slides.length) return;
      show(slides[0].img); setPlateLabel(slides, 0);
      clearInterval(timer);
      if (slides.length > 1 && !reduceMotion) {
        timer = setInterval(function () {
          if (document.hidden || window.scrollY > window.innerHeight) return;
          idx = (idx + 1) % slides.length;
          show(slides[idx].img); setPlateLabel(slides, idx);
        }, 8000);
      }
    };
  }

  function initHero(site) {
    var canvas = $("#hero-gl");
    var fallback = $("#hero-fallback");
    var hasReal = !!site.heroImage;
    var plate = makePlate(7, 1280, 800, "hero", false, true);
    if (!hasReal) $("#hero-note").hidden = false;

    function useFallback(src) {
      canvas.style.display = "none";
      fallback.style.backgroundImage = "url('" + src + "')";
      var setImg = function (u) { fallback.style.backgroundImage = "url('" + u + "')"; $("#hero-note").hidden = true; };
      return { setImage: setImg, setSlides: makeSlideshow(setImg), restart: function () {} };
    }

    var gl = null;
    try { gl = canvas.getContext("webgl", { antialias: false, alpha: false }) || canvas.getContext("experimental-webgl"); } catch (e) { gl = null; }
    if (!gl) return useFallback(hasReal ? site.heroImage : plate.toDataURL("image/jpeg", 0.85));

    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    } catch (e) { return useFallback(hasReal ? site.heroImage : plate.toDataURL("image/jpeg", 0.85)); }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    var imgSize = [plate.width, plate.height];
    function upload(src) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      imgSize = [src.naturalWidth || src.width, src.naturalHeight || src.height];
    }
    upload(plate);
    // Load a real photo into the mosaic. Images from other sites need CORS; if refused, the plate stays.
    function setImage(src, reassemble) {
      var im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = function () {
        try {
          upload(im);
          $("#hero-note").hidden = true;
          if (reassemble && !reduceMotion) start = performance.now();
        } catch (e) { upload(plate); }
        if (!running) draw(performance.now());
      };
      im.src = src;
    }
    if (hasReal) setImage(site.heroImage);

    var U = {};
    ["res", "img", "time", "assemble", "scroll", "mouse", "t", "vel"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(U.t, 0);

    var mouse = [0.5, 0.45], target = [0.5, 0.45], mvel = 0;
    var start = performance.now();
    var running = false, visible = true;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.25 : 1.75);
      var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    }

    function draw(now) {
      resize();
      var t = (now - start) / 1000;
      var a = reduceMotion ? 1 : Math.min(1, t / 2.4);
      a = 1 - Math.pow(1 - a, 4);
      var dxm = target[0] - mouse[0], dym = target[1] - mouse[1];
      mouse[0] += dxm * 0.08;
      mouse[1] += dym * 0.08;
      mvel = Math.min(1, mvel * 0.92 + Math.hypot(dxm, dym) * 0.6);
      var sc = Math.min(1, Math.max(0, window.scrollY / (canvas.clientHeight || 1)));
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2f(U.img, imgSize[0], imgSize[1]);
      gl.uniform1f(U.time, reduceMotion ? 0 : t);
      gl.uniform1f(U.assemble, a);
      gl.uniform1f(U.scroll, reduceMotion ? 0 : sc);
      gl.uniform2f(U.mouse, mouse[0], mouse[1]);
      gl.uniform1f(U.vel, reduceMotion ? 0 : mvel);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function loop(now) {
      if (!visible || document.hidden) { running = false; return; }
      draw(now);
      requestAnimationFrame(loop);
    }
    function kick() { if (!running && !reduceMotion) { running = true; requestAnimationFrame(loop); } }

    draw(performance.now()); // always paint one frame, even in a background tab
    if (!reduceMotion) kick();
    window.addEventListener("resize", function () { if (reduceMotion || !running) draw(performance.now()); });
    document.addEventListener("visibilitychange", kick);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }).observe(canvas);
    }
    var hero = canvas.parentElement;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      target = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    });
    hero.addEventListener("pointerleave", function () { target = [0.5, 0.45]; });
    return {
      setImage: setImage,
      setSlides: makeSlideshow(function (u) { setImage(u, true); }),
      restart: function () { start = performance.now(); if (!running) draw(start); kick(); }
    };
  }

  /* ---------------- Wordmark ---------------- */
  function initWordmark() {
    var wm = $(".wm");
    var slices = $$(".wm__slice", wm);
    if (reduceMotion) return;
    slices.forEach(function (s, i) { s.style.setProperty("--o", (i % 2 ? 1 : -1) * (40 + Math.random() * 140)); });
    wm.classList.add("is-split");
    requestAnimationFrame(function () {
      setTimeout(function () {
        slices.forEach(function (s) { s.style.setProperty("--o", 0); });
        wm.classList.remove("is-split");
      }, 260);
    });
    var hero = $(".hero");
    var raf = 0;
    hero.addEventListener("pointermove", function (e) {
      if (!finePointer || raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = wm.getBoundingClientRect();
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var near = Math.max(0, 1 - Math.abs(dy) * 1.2);
        slices.forEach(function (s, i) {
          var band = (i + 0.5) / slices.length - 0.5;
          var pull = Math.exp(-Math.pow((dy - band) * 4, 2)) * near;
          s.style.setProperty("--o", Math.round(dx * 60 * pull * (i % 2 ? 1 : -1)));
        });
      });
    });
    hero.addEventListener("pointerleave", function () { slices.forEach(function (s) { s.style.setProperty("--o", 0); }); });
  }

  /* ---------------- Reveal + filters ---------------- */
  var currentFilter = "all";
  var revealIO = null;
  function observeTiles(tiles) {
    if (reduceMotion || !("IntersectionObserver" in window)) { tiles.forEach(function (t) { t.classList.add("is-in"); }); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-in"); revealIO.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -12% 0px" });
    }
    tiles.forEach(function (t) { revealIO.observe(t); });
  }

  function applyFilter(animate) {
    var f = currentFilter, shown = 0;
    $$(".tile").forEach(function (t) {
      var show = f === "all" || t.getAttribute("data-cat") === f;
      t.hidden = !show;
      if (show) {
        shown++;
        if (animate && !reduceMotion) {
          t.classList.remove("is-in");
          void t.offsetWidth;
          requestAnimationFrame(function () { t.classList.add("is-in"); });
        }
      }
    });
    var empty = $("#gallery-empty");
    if (empty) empty.hidden = shown > 0;
  }

  function initFilters() {
    var btns = $$(".filter");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        currentFilter = b.getAttribute("data-filter");
        btns.forEach(function (x) { var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on); });
        applyFilter(true);
      });
    });
  }

  /* ---------------- Instagram (via Behold) ----------------
     Paste your Behold feed link into content.json as beholdFeed. Posts load straight from Instagram. */
  function normalizePosts(json) {
    var list = Array.isArray(json) ? json : (json && json.posts) || [];
    return list.map(function (p) {
      var sizes = p.sizes || {};
      var pick = function (k) { return sizes[k] && sizes[k].mediaUrl; };
      var isVideo = p.mediaType === "VIDEO";
      var img = pick("large") || pick("medium") || (isVideo ? p.thumbnailUrl : p.mediaUrl) || p.thumbnailUrl;
      var kids = (p.children || []).map(function (c) {
        var cs = c.sizes || {};
        return (cs.large && cs.large.mediaUrl) || (cs.medium && cs.medium.mediaUrl) || (c.mediaType === "IMAGE" ? c.mediaUrl : "");
      }).filter(Boolean);
      return {
        img: img,
        thumb: pick("medium") || img,
        link: p.permalink,
        caption: p.prunedCaption || p.caption || "",
        mentions: p.mentions || [],
        date: p.timestamp,
        video: isVideo,
        videoUrl: isVideo ? p.mediaUrl : "",
        album: p.mediaType === "CAROUSEL_ALBUM",
        children: kids
      };
    }).filter(function (p) { return p.img; });
  }

  var igMeta = {};
  // Each visitor's browser keeps the feed for 6 hours, so repeat visits don't use up Behold's free monthly views.
  function loadInstagram(site) {
    if (!site.beholdFeed) return Promise.resolve(null);
    var KEY = "ms-ig2:" + site.beholdFeed, TTL = 6 * 3600 * 1000;
    try {
      var cached = JSON.parse(localStorage.getItem(KEY) || "null");
      if (cached && Date.now() - cached.t < TTL && Array.isArray(cached.posts)) { igMeta = cached.meta || {}; return Promise.resolve(cached.posts); }
    } catch (e) { /* no storage, fetch instead */ }
    return fetch(site.beholdFeed).then(function (r) {
      if (!r.ok) throw new Error("feed");
      return r.json();
    }).then(function (json) {
      var posts = normalizePosts(json);
      igMeta = { followers: json && json.followersCount, username: json && json.username };
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), posts: posts, meta: igMeta })); } catch (e) { /* ignore */ }
      return posts;
    }).catch(function () { return "error"; });
  }

  function firstLine(cap) {
    var line = (cap || "").split("\n")[0]
      .replace(/[#@][\w.]+/g, " ")
      .replace(/\s+/g, " ").trim()
      .replace(/(\s*(and|with|w\/|x|&|ft\.?|feat\.?|,|\+|-))+$/i, "").trim();
    if (line.length < 3) return "";
    return line.length > 60 ? line.slice(0, 57).trim() + "…" : line;
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  }

  function renderInstagram(result, data) {
    var board = $("#ig-board"), note = $("#ig-note");
    var site = data.site || {};
    var handle = ((data.social || []).filter(function (s) { return /instagram/i.test(s.label); })[0] || {});
    var posts = Array.isArray(result) ? result.slice(0, 12) : null;
    board.innerHTML = "";
    if (!posts || !posts.length) {
      note.hidden = false;
      note.textContent = result === "error"
        ? "Instagram didn't load just now. Your posts are always on " + (handle.handle || "Instagram") + "."
        : "Placeholder slides. Your latest Instagram posts appear here once your Behold feed link is added in content.json.";
      posts = [];
      for (var i = 0; i < 8; i++) posts.push({ img: makePlate(200 + i, 520, 520, i % 3 ? "photo" : "film", "Instagram"), link: handle.url || "#", caption: "", date: "", placeholder: true });
    } else {
      note.hidden = true;
    }
    posts.forEach(function (p, i) {
      var a = document.createElement("div");
      a.className = "slide";
      a.style.setProperty("--rot", ((i * 37) % 7 - 3) * 0.55 + "deg");
      a.style.setProperty("--d", (i % 4) * 0.18 + "s");
      var label = p.placeholder ? "Placeholder slide, opens Instagram" : (firstLine(p.caption) || (p.video ? "Reel" : "Instagram post")) + ", opens on Instagram";
      var inner = p.videoUrl
        ? '<span class="slide__img develop is-video" data-src="' + esc(p.img) + '"><video muted loop playsinline preload="none" poster="' + esc(p.img) + '" src="' + esc(p.videoUrl) + '"></video><span class="reel-tag">Reel</span></span>'
        : '<span class="slide__img develop" data-src="' + esc(p.img) + '" style="background-image:url(\'' + esc(p.img) + '\')"></span>';
      a.innerHTML =
        '<a class="slide__mount" href="' + esc(p.link || handle.url || "#") + '" target="_blank" rel="noopener" aria-label="' + esc(label) + '">' + inner + "</a>" +
        '<span class="slide__label mono"><span>' + esc(p.placeholder ? "Placeholder" : fmtDate(p.date) || "Instagram") + "</span><span>" + (p.video ? "Reel" : String(i + 1).padStart(2, "0")) + "</span></span>" +
        (p.mentions && p.mentions.length ? '<span class="slide__tags">' + mentionLinks(p.mentions) + "</span>" : "");
      board.appendChild(a);
    });
    initDevelop($$(".develop", board));
    // reels on the light table play silently while on screen
    if (!reduceMotion && "IntersectionObserver" in window) {
      var vio = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) { var pr = en.target.play(); if (pr && pr.catch) pr.catch(function () {}); } else en.target.pause();
        });
      }, { threshold: 0.5 });
      $$("video", board).forEach(function (v) { vio.observe(v); });
    }
    renderCredits(Array.isArray(result) ? result : []);
    var count = $("#ig-count");
    if (count && igMeta.followers && Array.isArray(result)) count.textContent = Number(igMeta.followers).toLocaleString("en-NZ") + " followers · new work lands there first";
  }

  // Fill empty "Selected work" placeholders with real Instagram photos until real projects are added.
  function fillWorkFromInstagram(data, posts) {
    if (!Array.isArray(posts) || (data.site || {}).instagramFillsWork === false) return false;
    var pool = posts.slice();
    var k = pool.length >= 16 ? 8 : 0, changed = false;
    var shapes = ["tall", "wide", "square", "tall", "wide", "tall", "square", "tall"];
    var projects = data.projects || [];
    projects.forEach(function (p, idx) {
      if (p.placeholder && !p.cover && pool[k]) {
        var ig = pool[k++];
        var mentions = (ig.mentions || []).map(function (m) { return "@" + m; }).join(" ");
        var kind = ig.video ? "Reel" : ig.album ? "Photo set" : "Photo";
        var when = ig.date ? new Date(ig.date).toLocaleDateString("en-NZ", { month: "short", year: "numeric" }) : "";
        p.cover = ig.img;
        var fl = firstLine(ig.caption);
        if (fl.length < 8 && mentions) fl = "";
        p.title = fl || (mentions ? kind + " w/ " + mentions : kind + (when ? " · " + when : ""));
        p.summary = ig.caption;
        p.client = "";
        p.year = ig.date ? String(new Date(ig.date).getFullYear()) : "";
        p.category = ig.video ? "film" : "photo";
        p.shape = ig.video ? "tall" : shapes[idx % shapes.length];
        p.videoFile = ig.videoUrl || "";
        p.images = ig.children && ig.children.length ? ig.children : [];
        p.placeholder = false;
        p.fromInstagram = true;
        p.igLink = ig.link;
        p.mentions = ig.mentions || [];
        changed = true;
      }
    });
    // placeholders that Instagram couldn't fill are hidden rather than shown empty
    if (changed) data.projects = projects.filter(function (p) { return !p.placeholder || p.cover; });
    return changed;
  }

  /* ---------------- Credits: everyone tagged on the feed ----------------
     Rolls like end credits. Hover a name to see the frame they're in. */
  function renderCredits(posts) {
    var sec = $("#credits"), list = $("#credits-list"), peek = $("#peek");
    if (!sec || !list) return;
    var map = {};
    posts.forEach(function (p) {
      (p.mentions || []).forEach(function (m) {
        m = String(m).replace(/^@/, "");
        if (!map[m]) map[m] = { name: m, posts: [] };
        map[m].posts.push(p);
      });
    });
    var people = Object.keys(map).map(function (k) { return map[k]; });
    if (!people.length) { sec.hidden = true; return; }
    sec.hidden = false;
    list.innerHTML = people.map(function (c, i) {
      return '<li><a class="credit" href="' + igUrl(c.name) + '" target="_blank" rel="noopener" data-img="' + esc(c.posts[0].img) + '">' +
        '<span class="credit__no mono">' + String(i + 1).padStart(2, "0") + "</span>" +
        '<span class="credit__name">@' + esc(c.name) + "</span>" +
        '<span class="credit__meta mono">' + c.posts.length + (c.posts.length === 1 ? " frame" : " frames") + " ↗</span></a></li>";
    }).join("");
    if (!finePointer || !peek) return;
    var px = 0, py = 0, tx = 0, ty = 0, on = false;
    list.addEventListener("pointerover", function (e) {
      var a = e.target.closest && e.target.closest(".credit");
      if (!a) return;
      peek.style.backgroundImage = "url('" + a.getAttribute("data-img") + "')";
      peek.classList.add("is-on"); on = true;
    });
    list.addEventListener("pointerleave", function () { peek.classList.remove("is-on"); on = false; });
    list.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; });
    (function follow() {
      px += (tx - px) * 0.15; py += (ty - py) * 0.15;
      if (on) peek.style.transform = "translate3d(" + (px + 24) + "px," + (py - 120) + "px,0) rotate(" + ((tx - px) * 0.05) + "deg)";
      requestAnimationFrame(follow);
    })();
  }

  /* ---------------- Effect: darkroom develop ----------------
     Frames arrive as colour negatives and develop into prints as they come into view. */
  var developIO = null;
  function initDevelop(els) {
    if (reduceMotion || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("is-developed"); }); return; }
    if (!developIO) {
      developIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-developed"); developIO.unobserve(e.target); }
        });
      }, { threshold: 0.45 });
    }
    els.forEach(function (e) { developIO.observe(e); });
  }

  /* ---------------- Effect: loupe ----------------
     On the light table, the cursor becomes a viewing loupe that magnifies the frame under it. */
  function initLoupe() {
    if (!finePointer) return;
    var board = $("#ig-board"), loupe = $("#loupe");
    if (!board || !loupe) return;
    var Z = 2.6, L = 190, nat = {};
    function natural(src, cb) {
      if (nat[src]) return cb(nat[src]);
      var im = new Image();
      im.onload = function () { nat[src] = [im.naturalWidth, im.naturalHeight]; cb(nat[src]); };
      im.src = src;
    }
    board.addEventListener("pointermove", function (e) {
      var el = e.target.closest && e.target.closest(".slide__img");
      if (!el) { loupe.classList.remove("is-on"); return; }
      var src = el.getAttribute("data-src");
      var r = el.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      loupe.style.transform = "translate3d(" + (e.clientX - L / 2) + "px," + (e.clientY - L / 2) + "px,0)";
      loupe.classList.add("is-on");
      $("#cursor").classList.remove("is-on");
      natural(src, function (n) {
        var s = Math.max(r.width / n[0], r.height / n[1]);
        var dw = n[0] * s, dh = n[1] * s, ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;
        loupe.style.backgroundImage = "url('" + src + "')";
        loupe.style.backgroundSize = dw * Z + "px " + dh * Z + "px";
        loupe.style.backgroundPosition = -((x - ox) * Z - L / 2) + "px " + -((y - oy) * Z - L / 2) + "px";
      });
    });
    board.addEventListener("pointerleave", function () { loupe.classList.remove("is-on"); $("#cursor").classList.add("is-on"); });
  }

  /* ---------------- Project viewer ---------------- */
  function embedUrl(link) {
    var m = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
    if (m) return "https://www.youtube-nocookie.com/embed/" + m[1];
    var v = link.match(/vimeo\.com\/(\d+)/);
    if (v) return "https://player.vimeo.com/video/" + v[1];
    return "";
  }

  function initViewer(data) {
    var viewer = $("#viewer"), panel = $("#viewer-panel"), body = $("#viewer-body");
    var lastTile = null;

    function setClip(r) {
      if (!r) { ["--t", "--r", "--b", "--l"].forEach(function (k) { panel.style.setProperty(k, "0px"); }); return; }
      panel.style.setProperty("--t", r.top + "px");
      panel.style.setProperty("--r", (window.innerWidth - r.right) + "px");
      panel.style.setProperty("--b", (window.innerHeight - r.bottom) + "px");
      panel.style.setProperty("--l", r.left + "px");
    }

    function open(i, tile) {
      var p = data.projects[i];
      if (!p) return;
      lastTile = tile;
      var shape = SHAPES[p.shape] ? p.shape : "tall";
      var media = "";
      if (p.videoFile) {
        media += '<video class="v-hero" controls playsinline preload="metadata"' + (p.cover ? ' poster="' + esc(p.cover) + '"' : "") + ' src="' + esc(p.videoFile) + '"></video>';
      } else if (p.cover) {
        media += '<img class="v-hero" src="' + esc(p.cover) + '" alt="' + esc(p.title) + '">';
      } else {
        var big = makePlate(i + 1, 1280, 720, p.category, CAT_LABEL[p.category] || "");
        media += '<div class="v-hero v-hero--ph" role="img" aria-label="Placeholder image" style="background-image:url(\'' + big + '\')"></div>';
      }
      var extra = "";
      if (p.videoLink) {
        var eu = embedUrl(p.videoLink);
        if (eu) extra += '<div class="v-embed"><iframe src="' + esc(eu) + '" title="' + esc(p.title) + ' video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
        extra += '<a class="v-link" href="' + esc(p.videoLink) + '" target="_blank" rel="noopener">Watch the film ↗</a>';
      }
      if (p.igLink) extra += '<a class="v-link" href="' + esc(p.igLink) + '" target="_blank" rel="noopener">View on Instagram ↗</a>';
      if (p.audioFile) extra += '<audio controls preload="none" src="' + esc(p.audioFile) + '"></audio>';
      var grid = (p.images || []).filter(Boolean).map(function (src) {
        return '<img loading="lazy" src="' + esc(src) + '" alt="' + esc(p.title) + '">';
      }).join("");
      var meta = [CAT_LABEL[p.category] || p.category, p.year, p.client, p.role].filter(Boolean).map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("");

      body.innerHTML =
        '<header class="v-head"><p class="v-meta mono">' + meta + '</p><h2 id="viewer-title">' + esc(p.title || "Untitled") + "</h2>" +
        (p.summary ? '<p class="v-summary">' + linkify(p.summary) + "</p>" : "") +
        (p.mentions && p.mentions.length ? '<p class="v-tags mono">In frame ' + mentionLinks(p.mentions) + "</p>" : "") + "</header>" +
        media +
        (extra ? '<div class="v-media">' + extra + "</div>" : "") +
        (grid ? '<div class="v-grid">' + grid + "</div>" : "") +
        (p.placeholder ? '<p class="v-ph mono">This is a placeholder slot. Replace it with a real project in content.json.</p>' : "");

      viewer.hidden = false;
      document.body.style.overflow = "hidden";
      panel.scrollTop = 0;
      if (reduceMotion || !tile) { setClip(null); }
      else {
        panel.style.transition = "none";
        setClip(tile.querySelector(".tile__media").getBoundingClientRect());
        void panel.offsetWidth;
        panel.style.transition = "";
        requestAnimationFrame(function () { setClip(null); });
      }
      $("#viewer-close").focus();
    }

    function close() {
      var finish = function () {
        viewer.hidden = true;
        document.body.style.overflow = "";
        body.innerHTML = "";
        if (lastTile) lastTile.focus();
      };
      if (reduceMotion || !lastTile || lastTile.hidden) return finish();
      setClip(lastTile.querySelector(".tile__media").getBoundingClientRect());
      setTimeout(finish, 650);
    }

    $("#gallery").addEventListener("click", function (e) {
      var t = e.target.closest(".tile");
      if (t) open(+t.getAttribute("data-index"), t);
    });
    $("#viewer-close").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (viewer.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "Tab") { // keep focus inside the viewer
        var f = $$("button, a[href], video, audio, iframe, [tabindex]:not([tabindex='-1'])", viewer);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------------- Cursor ---------------- */
  function initCursor() {
    if (!finePointer || reduceMotion) return;
    var c = $("#cursor"), x = 0, y = 0, cx = 0, cy = 0, on = false;
    document.addEventListener("pointermove", function (e) {
      x = e.clientX; y = e.clientY;
      if (!on) { on = true; cx = x; cy = y; c.classList.add("is-on"); tick(); }
      var t = e.target.closest && e.target.closest(".tile");
      c.classList.toggle("is-view", !!t && $("#viewer").hidden);
    });
    document.addEventListener("pointerleave", function () { c.classList.remove("is-on"); on = false; });
    function tick() {
      if (!on) return;
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      c.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      requestAnimationFrame(tick);
    }
  }

  /* ---------------- Optional sound ----------------
     A quiet generated projector hum. Off by default; starts only when the visitor turns it on. */
  function initSound() {
    var btn = $("#sound"), label = $(".sound__label", btn);
    var ctx = null, master = null;
    function build() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.connect(master);
      [55, 55.4, 82.4].forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = i === 2 ? "sine" : "sawtooth"; o.frequency.value = f;
        var g = ctx.createGain(); g.gain.value = i === 2 ? 0.05 : 0.035; o.connect(g); g.connect(lp); o.start();
      });
      // projector flutter: filtered noise pulsed at 24 frames a second
      var len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      var ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.8;
      var ng = ctx.createGain(); ng.gain.value = 0.0;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 24; var lg = ctx.createGain(); lg.gain.value = 0.02;
      lfo.connect(lg); lg.connect(ng.gain); lfo.start();
      ns.connect(bp); bp.connect(ng); ng.connect(master); ns.start();
      return true;
    }
    btn.addEventListener("click", function () {
      var on = btn.getAttribute("aria-pressed") !== "true";
      if (on && !ctx && !build()) { label.textContent = "No sound support"; return; }
      if (ctx.state === "suspended") ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.4);
      btn.setAttribute("aria-pressed", on);
      label.textContent = on ? "Sound on" : "Sound off";
    });
  }

  /* ---------------- Enquiry form ----------------
     With a Web3Forms key in content.json the form really sends to your email.
     Without one it opens the visitor's email app with the message filled in. It never fakes a success. */
  function initForm(site) {
    var form = $("#form"), status = $("#f-status"), send = $("#f-send");
    var email = site.email || "";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var name = (fd.get("name") || "").trim(), from = (fd.get("email") || "").trim(), msg = (fd.get("message") || "").trim();
      if (!name || !from || !msg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
        status.textContent = "Add your name, a valid email and a message, then send again.";
        return;
      }
      var subject = "Enquiry: " + fd.get("type") + " from " + name;
      var text = "Name: " + name + "\nEmail: " + from + "\nType: " + fd.get("type") + "\nDate: " + (fd.get("date") || "-") + "\n\n" + msg;

      if (site.web3formsKey) {
        send.disabled = true;
        status.textContent = "Sending…";
        fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: site.web3formsKey, subject: subject, from_name: name, email: from, message: text, botcheck: "" })
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (res && res.success) {
            status.textContent = "Sent. I'll reply to " + from + " soon.";
            form.reset();
          } else { throw new Error("rejected"); }
        }).catch(function () {
          status.innerHTML = "That didn't send. Please email me directly at <strong>" + esc(email) + "</strong>.";
        }).finally(function () { send.disabled = false; });
        return;
      }

      var href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
      var a = document.createElement("a");
      a.href = href; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      status.innerHTML = "Your email app should open with this filled in. If nothing opened, email <strong>" + esc(email) + "</strong> directly.";
    });

    $("#copy-email").addEventListener("click", function () {
      var btn = this;
      var done = function (ok) { btn.textContent = ok ? "Copied" : "Select and copy it above"; setTimeout(function () { btn.textContent = "Copy email"; }, 2200); };
      try {
        navigator.clipboard.writeText(email).then(function () { done(true); }, function () { selectEmail(); done(false); });
      } catch (err) { selectEmail(); done(false); }
    });
    function selectEmail() {
      var r = document.createRange(); r.selectNodeContents($("#email-text"));
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  }

  /* ---------------- Film leader intro ----------------
     A 3-2-1 countdown on the first visit of a session. Click, key or scroll skips it. */
  function runLeader() {
    var el = $("#leader");
    var seen = false;
    try { seen = sessionStorage.getItem("ms-leader") === "1"; } catch (e) { seen = false; }
    if (!el || reduceMotion || seen) return Promise.resolve();
    try { sessionStorage.setItem("ms-leader", "1"); } catch (e) { /* ignore */ }
    el.hidden = false;
    var num = $("#leader-num");
    return new Promise(function (resolve) {
      var n = 3, timer = null, done = false;
      function finish() {
        if (done) return; done = true;
        clearTimeout(timer);
        el.classList.add("is-out");
        setTimeout(function () { el.hidden = true; }, 600);
        ["click", "keydown", "wheel", "touchstart"].forEach(function (ev) { window.removeEventListener(ev, finish); });
        resolve();
      }
      function tick() {
        if (n === 0) return finish();
        num.textContent = n;
        el.classList.remove("is-tick"); void el.offsetWidth; el.classList.add("is-tick");
        n--;
        timer = setTimeout(tick, 450);
      }
      ["click", "keydown", "wheel", "touchstart"].forEach(function (ev) { window.addEventListener(ev, finish, { passive: true }); });
      tick();
    });
  }

  /* ---------------- Timecode ----------------
     The bar shows a film timecode that runs with the scroll: hours:minutes:seconds:frames at 24 fps. */
  function initTimecode() {
    var tc = $("#tc");
    if (!tc) return;
    var pad = function (v) { return String(v).padStart(2, "0"); };
    var raf = 0;
    function update() {
      raf = 0;
      var f = Math.round(window.scrollY / 6);
      var ff = f % 24, s = Math.floor(f / 24), mm = Math.floor(s / 60), hh = Math.floor(mm / 60);
      tc.textContent = pad(hh) + ":" + pad(mm % 60) + ":" + pad(s % 60) + ":" + pad(ff);
    }
    window.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ---------------- SoundCloud player ----------------
     Paste a SoundCloud track or playlist link as soundcloudUrl in content.json.
     The sound button and the little record player then play your picks. */
  var sc = null;
  function initSoundCloud(site) {
    var url = site.soundcloudUrl;
    var box = $("#sc");
    if (!url || !box) return false;
    box.hidden = false;
    $("#sc-link").href = url;
    var frame = document.createElement("iframe");
    frame.allow = "autoplay";
    frame.title = "SoundCloud player";
    frame.src = "https://w.soundcloud.com/player/?url=" + encodeURIComponent(url) + "&auto_play=false&visual=false&show_artwork=false&buying=false&sharing=false";
    $("#sc-frame").appendChild(frame);
    var title = $("#sc-title"), playBtn = $("#sc-play"), soundBtn = $("#sound"), soundLabel = $(".sound__label", soundBtn);
    var state = { playing: false };
    function setPlaying(on) {
      state.playing = on;
      box.classList.toggle("is-playing", on);
      playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
      soundBtn.setAttribute("aria-pressed", on);
      soundLabel.textContent = on ? "Sound on" : "Sound off";
    }
    function showTitle() {
      if (!sc) return;
      sc.getCurrentSound(function (snd) {
        if (snd) title.textContent = snd.title + (snd.user && snd.user.username ? " · " + snd.user.username : "");
      });
    }
    var api = document.createElement("script");
    api.src = "https://w.soundcloud.com/player/api.js";
    api.onload = function () {
      if (!window.SC || !window.SC.Widget) return;
      sc = window.SC.Widget(frame);
      var E = window.SC.Widget.Events;
      sc.bind(E.READY, showTitle);
      sc.bind(E.PLAY, function () { setPlaying(true); showTitle(); });
      sc.bind(E.PAUSE, function () { setPlaying(false); });
      sc.bind(E.FINISH, function () { setPlaying(false); });
    };
    api.onerror = function () { title.textContent = "Open on SoundCloud"; };
    document.head.appendChild(api);
    function toggle() { if (sc) sc.toggle(); else window.open(url, "_blank", "noopener"); }
    playBtn.addEventListener("click", toggle);
    $("#sc-next").addEventListener("click", function () { if (sc) { sc.next(); sc.play(); } });
    soundBtn.addEventListener("click", function (e) { e.stopImmediatePropagation(); toggle(); }, true);
    return true;
  }

  /* ---------------- Text effects ---------------- */

  // 1. A band of your commissions that slides along, faster as you scroll and flipping with scroll direction.
  function initMarquee(data) {
    var track = $("#marquee");
    if (!track) return;
    var items = [];
    (data.services || []).forEach(function (s) { (s.items || []).forEach(function (it) { items.push(it); }); });
    if (!items.length) return;
    var html = items.map(function (it, i) {
      var words = esc(it).split(" ");
      if (i % 2 && words.length > 1) words[words.length - 1] = "<i>" + words[words.length - 1].toLowerCase() + "</i>";
      return '<span class="marquee__item">' + words.join(" ") + ' <span class="star">✶</span></span>';
    }).join("");
    track.innerHTML = html + html;
    if (reduceMotion) return;
    var x = 0, dir = -1, vel = 0, lastY = window.scrollY;
    window.addEventListener("scroll", function () {
      var y = window.scrollY, d = y - lastY; lastY = y;
      if (d) dir = d > 0 ? -1 : 1;
      vel = Math.min(40, vel + Math.abs(d) * 0.15);
    }, { passive: true });
    (function step() {
      var half = track.scrollWidth / 2;
      x += dir * (0.6 + vel);
      vel *= 0.9;
      if (x <= -half) x += half;
      if (x > 0) x -= half;
      track.style.transform = "translate3d(" + x + "px,0,0)";
      requestAnimationFrame(step);
    })();
  }

  // 2. The intro paragraph lights up word by word as you scroll through it.
  function initIntroWords() {
    var p = $(".intro__text");
    if (!p) return;
    var text = p.textContent.trim();
    p.setAttribute("aria-label", text);
    p.innerHTML = text.split(/\s+/).map(function (w) { return '<span class="w" aria-hidden="true">' + esc(w) + "</span>"; }).join(" ");
    var words = $$(".w", p);
    if (reduceMotion) { words.forEach(function (w) { w.classList.add("is-lit"); }); return; }
    var raf = 0;
    function update() {
      raf = 0;
      var r = p.getBoundingClientRect(), vh = window.innerHeight;
      var prog = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      var lit = Math.round(prog * words.length);
      words.forEach(function (w, i) { w.classList.toggle("is-lit", i < lit); w.classList.toggle("is-hot", i === lit - 1 && lit < words.length); });
    }
    window.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  // 3. Section headings decode from scrambled characters when they come into view.
  function initScramble() {
    var els = $$(".scramble");
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var glyphs = "MOSAIC#/\\[]<>01—*+";
    function run(el) {
      var final = el.getAttribute("data-final") || el.textContent;
      el.setAttribute("data-final", final);
      el.setAttribute("aria-label", final);
      var frame = 0, total = 22;
      (function tick() {
        var out = "";
        for (var i = 0; i < final.length; i++) {
          var settle = (i / final.length) * total * 0.8;
          out += final[i] === " " || frame >= settle + 4 ? final[i] : glyphs[(Math.random() * glyphs.length) | 0];
        }
        el.textContent = out;
        if (frame++ < total + 4) requestAnimationFrame(tick); else el.textContent = final;
      })();
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  }

  // 5. "Book a shoot" starts as an outline and inks in.
  function initInkFill() {
    var el = $(".ink-fill");
    if (!el) return;
    if (reduceMotion || !("IntersectionObserver" in window)) { el.classList.add("is-filled"); return; }
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { el.classList.add("is-filled"); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(el);
  }

  // 6. The footer wordmark gets heavier near the cursor (variable font weight).
  function initFootWeight() {
    var vf = $("#foot-mark .vf");
    if (!vf) return;
    vf.innerHTML = Array.from(vf.textContent).map(function (ch) { return "<span>" + esc(ch) + "</span>"; }).join("");
    if (!finePointer || reduceMotion) return;
    var letters = $$("span", vf);
    letters.forEach(function (l) { l.style.setProperty("--wt", 200); });
    var foot = $(".foot");
    foot.addEventListener("pointermove", function (e) {
      letters.forEach(function (l) {
        var r = l.getBoundingClientRect();
        var d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        l.style.setProperty("--wt", Math.round(900 - Math.min(700, d * 3)));
      });
    });
    foot.addEventListener("pointerleave", function () { letters.forEach(function (l) { l.style.setProperty("--wt", 200); }); });
  }

  /* ---------------- FX layer ---------------- */

  // Mosaic cursor trail: little tiles in the brand colours fall off the cursor as it moves.
  function initTrail() {
    if (!finePointer || reduceMotion) return;
    var c = $("#trail");
    if (!c) return;
    var g = c.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
    var cols = ["#ec2a1c", "#c6ff3d", "#f6b62c", "#eee4d3"];
    var bits = [], lx = 0, ly = 0, active = false;
    function size() { c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = innerWidth + "px"; c.style.height = innerHeight + "px"; }
    size(); window.addEventListener("resize", size);
    document.addEventListener("pointermove", function (e) {
      var dx = e.clientX - lx, dy = e.clientY - ly, d = Math.hypot(dx, dy);
      lx = e.clientX; ly = e.clientY;
      if (!$("#viewer").hidden || e.target.closest(".board, .contact, input, textarea, select")) return;
      var n = Math.min(4, Math.floor(d / 14));
      for (var i = 0; i < n && bits.length < 120; i++) {
        bits.push({ x: lx - dx * (i / n), y: ly - dy * (i / n), s: 4 + Math.random() * 12, c: cols[(Math.random() * cols.length) | 0], vx: (Math.random() - 0.5) * 1.2, vy: 0.4 + Math.random(), life: 1 });
      }
      if (!active) { active = true; requestAnimationFrame(tick); }
    });
    function tick() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (var i = bits.length - 1; i >= 0; i--) {
        var b = bits[i];
        b.x += b.vx; b.y += b.vy; b.vy += 0.05; b.life -= 0.025;
        if (b.life <= 0) { bits.splice(i, 1); continue; }
        g.globalAlpha = b.life * 0.85;
        g.fillStyle = b.c;
        var s = b.s * (0.4 + b.life * 0.6);
        g.fillRect(Math.round(b.x - s / 2), Math.round(b.y - s / 2), Math.round(s), Math.round(s * 0.66));
      }
      if (bits.length) requestAnimationFrame(tick); else { active = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    }
  }

  // Magnetic buttons: key controls lean toward the cursor.
  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    $$(".enquire, .send, .filter, .copy, .sc__play, .follow, .ig-cta__big").forEach(function (el) {
      el.classList.add("magnet");
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
        el.style.transform = "translate(" + x * 14 + "px," + y * 10 + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  // Gallery tiles tilt in 3D with a moving glare, and the image ripples like liquid while hovered.
  function initTileFX() {
    if (!finePointer || reduceMotion) return;
    var gal = $("#gallery");
    var turb = $("#liquid-turb"), disp = $("#liquid-disp");
    var hovered = null, raf = 0, t0 = 0;
    gal.addEventListener("pointermove", function (e) {
      var t = e.target.closest && e.target.closest(".tile");
      if (!t) return;
      var r = t.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      t.style.setProperty("--ry", ((x - 0.5) * 14).toFixed(2) + "deg");
      t.style.setProperty("--rx", ((0.5 - y) * 10).toFixed(2) + "deg");
      t.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
      t.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
      if (hovered !== t) {
        if (hovered) hovered.classList.remove("is-liquid");
        hovered = t; t.classList.add("is-liquid"); t0 = performance.now();
        if (!raf) raf = requestAnimationFrame(wobble);
      }
    });
    gal.addEventListener("pointerout", function (e) {
      var t = e.target.closest && e.target.closest(".tile");
      if (!t || t.contains(e.relatedTarget)) return;
      t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg");
      t.classList.remove("is-liquid");
      if (hovered === t) hovered = null;
    });
    function wobble(now) {
      if (!hovered) { raf = 0; disp.setAttribute("scale", 0); return; }
      var k = (now - t0) / 1000;
      var settle = Math.max(0.25, 1 - k * 0.6);
      turb.setAttribute("baseFrequency", (0.012 + Math.sin(k * 2.1) * 0.004).toFixed(4) + " " + (0.03 + Math.cos(k * 1.7) * 0.01).toFixed(4));
      disp.setAttribute("scale", (28 * settle).toFixed(1));
      raf = requestAnimationFrame(wobble);
    }
  }

  // Scroll speed bends the gallery: fast scrolling skews the columns, then they spring back.
  function initScrollSkew() {
    if (reduceMotion) return;
    var gal = $("#gallery");
    var last = window.scrollY, skew = 0;
    (function loop() {
      var y = window.scrollY, v = y - last; last = y;
      skew += (Math.max(-6, Math.min(6, v * 0.12)) - skew) * 0.12;
      gal.style.setProperty("--skew", skew.toFixed(2) + "deg");
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- Bar ---------------- */
  function initBar() {
    var bar = $("#bar");
    var on = function () { bar.classList.toggle("is-scrolled", window.scrollY > window.innerHeight * 0.5); };
    window.addEventListener("scroll", on, { passive: true }); on();
  }

  /* ---------------- Boot ---------------- */
  loadContent().then(function (data) {
    var site = data.site || {};
    render(data);
    var hero = initHero(site) || { setImage: function () {}, restart: function () {} };
    initFilters();
    renderInstagram(null, data);
    initLoupe();
    initViewer(data);
    initCursor();
    if (!initSoundCloud(site)) initSound();
    initForm(site);
    initBar();
    initTimecode();
    initMarquee(data);
    initIntroWords();
    initScramble();
    initInkFill();
    initFootWeight();
    initTrail();
    initMagnetic();
    initTileFX();
    initScrollSkew();
    var leader = runLeader();
    leader.then(function () { initWordmark(); hero.restart(); });
    loadInstagram(site).then(function (res) {
      if (res === null) return;
      renderInstagram(res, data);
      if (fillWorkFromInstagram(data, res)) renderGallery(data);
      if (!site.heroImage && Array.isArray(res) && res.length) {
        leader.then(function () { hero.setSlides(res.map(function (p) { return { img: p.img, link: p.link }; })); });
      }
    });
  }).catch(function (err) {
    console.error(err);
    var g = document.getElementById("gallery");
    if (g) g.innerHTML = '<p class="v-ph mono">The content file could not load. If you opened index.html straight from your computer, use the published site or the preview steps in the guide instead.</p>';
    initWordmark();
    initBar();
  });
})();
