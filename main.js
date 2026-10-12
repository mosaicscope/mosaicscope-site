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
        var dx = reduceMotion ? 0 : (f % 2 ? 1 : -1) * 18;
        frags += '<span class="frag" style="background-image:url(\'' + img + '\');clip-path:inset(' + top + '% 0 ' + bottom + '% 0);--dx:' + dx + 'px;--s:1.04"></span>';
      }
      var vid = p.videoFile ? '<video class="tile__vid" muted loop playsinline preload="none" src="' + esc(p.videoFile) + '"></video>' : "";
      if (p.videoFile) b.classList.add("has-video");
      if (p.fromYouTube) { b.classList.add("is-yt"); b.setAttribute("data-yt", p.ytId); }
      b.innerHTML =
        '<span class="tile__media">' + frags + vid +
        '<span class="slate"><span>FR ' + String(i + 1).padStart(2, "0") + '</span><span class="cat-' + esc(p.category) + '">' + esc(CAT_LABEL[p.category] || p.category) + "</span></span>" +
        (p.placeholder ? '<span class="tag-ph">Placeholder</span>' : "") + (p.fromYouTube ? '<span class="tag-yt">YouTube</span>' : "") +
        "</span>" +
        '<span class="tile__cap"><strong>' + esc(p.title || "Untitled") + "</strong><em>" + esc(p.year || "") + "</em></span>" +
        "";
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
    initYouTubePreviews();
  }

  // YouTube tiles play a few silent seconds, like a short, when they scroll into view (and again on hover).
  function playYouTubePreview(t) {
    if (reduceMotion || t.querySelector(".tile__yt")) return;
    var id = t.getAttribute("data-yt");
    if (!/^[\w-]{11}$/.test(id)) return;
    var f = document.createElement("iframe");
    f.className = "tile__yt";
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.allow = "autoplay; encrypted-media";
    f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&mute=1&controls=0&playsinline=1&modestbranding=1&rel=0&disablekb=1&iv_load_policy=3&fs=0&loop=1&playlist=" + id;
    t.querySelector(".tile__media").appendChild(f);
    setTimeout(function () { f.classList.add("is-on"); }, 900);
    setTimeout(function () { stopYouTubePreview(t); }, 9000);
  }
  function stopYouTubePreview(t) {
    var f = t.querySelector(".tile__yt");
    if (!f) return;
    f.classList.remove("is-on");
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 600);
  }
  var ytIO = null;
  function initYouTubePreviews() {
    var tiles = $$(".tile.is-yt");
    if (reduceMotion || !tiles.length) return;
    if (!ytIO && "IntersectionObserver" in window) {
      ytIO = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) playYouTubePreview(en.target); else stopYouTubePreview(en.target);
        });
      }, { threshold: 0.6 });
    }
    tiles.forEach(function (t) {
      if (ytIO) ytIO.observe(t);
      if (finePointer && !t.getAttribute("data-yt-bound")) {
        t.setAttribute("data-yt-bound", "1");
        t.addEventListener("pointerenter", function () { playYouTubePreview(t); });
      }
    });
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
      var v = k === "availNote" ? (data.availability || {}).note : (k === "servicesNote" || k === "ratesNote" || k === "ratesAddons") ? data[k] : site[k];
      if (v) el.textContent = v;
    });
    $("#year").textContent = new Date().getFullYear();
    $("#email-text").textContent = site.email || "";

    renderGallery(data);

    // rates
    var rl = $("#rates-list");
    if (rl) {
      rl.innerHTML = (data.rates || []).map(function (r, i) {
        return '<li class="rate"><span class="rate__no mono">' + String(i + 1).padStart(2, "0") + '</span>' +
          '<span class="rate__what"><strong>' + esc(r.title) + '</strong><em>' + esc(r.detail || "") + "</em></span>" +
          '<span class="rate__price">' + esc(r.price) + (r.unit ? '<small class="mono">' + esc(r.unit) + "</small>" : "") + "</span></li>";
      }).join("");
      $("#rates").hidden = !(data.rates || []).length;
    }

    // booking steps + fine print
    var st = $("#steps");
    if (st) {
      var b = data.booking || {};
      st.innerHTML = (b.steps || []).map(function (x, i) {
        return '<li class="step"><span class="step__no mono">' + String(i + 1).padStart(2, "0") + '</span><strong>' + esc(x.title) + "</strong><p>" + esc(x.text) + "</p></li>";
      }).join("");
      $("#terms").innerHTML = (b.terms || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
      $("#booking").hidden = !(b.steps || []).length;
    }

    // FAQ (also tells Google the answers)
    var fl = $("#faq-list");
    if (fl) {
      var faq = data.faq || [];
      fl.innerHTML = faq.map(function (f, i) {
        return '<details class="qa"' + (i === 0 ? " open" : "") + '><summary><span class="qa__q">' + esc(f.q) + '</span><span class="qa__icon" aria-hidden="true">+</span></summary><p>' + esc(f.a) + "</p></details>";
      }).join("");
      $("#faq").hidden = !faq.length;
      if (faq.length) {
        var ld = document.createElement("script");
        ld.type = "application/ld+json";
        ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(function (f) { return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }; }) });
        document.head.appendChild(ld);
      }
    }

    // next free dates
    var dl = $("#dates-list");
    if (dl) {
      var dates = ((data.availability || {}).dates || []).filter(Boolean);
      dl.innerHTML = dates.length
        ? dates.map(function (d) { return '<li><span class="dot" aria-hidden="true"></span>' + esc(d) + "</li>"; }).join("")
        : '<li class="dates__none">Ask me. I\'ll tell you straight.</li>';
    }

    // Instagram DM button
    if (site.instagramDm && $("#dm")) $("#dm").href = site.instagramDm;

    // quote builder prices
    var q = data.quote || {};
    $$("[data-q]").forEach(function (el) { var n = q[el.getAttribute("data-q")]; el.textContent = n ? "$" + n + (el.getAttribute("data-suffix") || "") : ""; });

    // raw vs edited sliders
    var gl = $("#grade-list");
    var pairs = (data.beforeAfter || []).filter(function (p) { return p && p.before && p.after; });
    if (gl && pairs.length) {
      $("#grade").hidden = false;
      gl.innerHTML = pairs.map(function (p, i) {
        return '<figure class="ba" style="--pos:50%">' +
          '<img class="ba__after" src="' + esc(p.after) + '" alt="Edited: ' + esc(p.caption || "") + '" loading="lazy">' +
          '<img class="ba__before" src="' + esc(p.before) + '" alt="Raw: ' + esc(p.caption || "") + '" loading="lazy">' +
          '<span class="ba__tag ba__tag--l mono">Raw</span><span class="ba__tag ba__tag--r mono">Lightroom</span>' +
          '<span class="ba__handle" aria-hidden="true"></span>' +
          '<input class="ba__range" type="range" min="0" max="100" value="50" aria-label="Compare raw and edited photo ' + (i + 1) + '">' +
          (p.caption ? '<figcaption class="mono">' + esc(p.caption) + "</figcaption>" : "") + "</figure>";
      }).join("");
      $$(".ba__range", gl).forEach(function (r) {
        r.addEventListener("input", function () { r.parentNode.style.setProperty("--pos", r.value + "%"); });
      });
    }

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

  /* ---------------- Hero: still mosaic, slow tile-by-tile crossfade ----------------
     The photo sits in a fixed mosaic grid. Every 10 seconds the next Instagram photo
     replaces it one tile at a time. No camera shake, no mouse effects. */
  var VS = "attribute vec2 p;varying vec2 v;void main(){v=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}";
  var FS = [
    "precision mediump float;",
    "varying vec2 v;",
    "uniform sampler2D t;uniform sampler2D t2;uniform vec2 res;uniform vec2 img;uniform vec2 img2;uniform float mixv;uniform float grain;uniform vec2 mouse;uniform float hover;",
    "float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "vec2 cover(vec2 uv,vec2 s0){float ra=res.x/res.y;float ia=s0.x/s0.y;vec2 s=ra>ia?vec2(1.0,ia/ra):vec2(ra/ia,1.0);return (uv-0.5)*s+0.5;}",
    "vec3 tap(sampler2D tx,vec2 uv,vec2 s0,float sp){vec2 u=clamp(cover(uv,s0),0.001,0.999);return vec3(texture2D(tx,u+vec2(sp,0.0)).r,texture2D(tx,u).g,texture2D(tx,u-vec2(sp,0.0)).b);}",
    "void main(){",
    " vec2 uv=v;",
    " float rows=7.0; float r=floor(uv.y*rows);",
    " float cols=floor(mix(4.0,12.0,h(vec2(r,3.1))));",
    " float shift=h(vec2(r,7.7));",
    " float c=floor(uv.x*cols+shift); vec2 cell=vec2(c,r); float rnd=h(cell);",
    " vec2 center=vec2((c+0.5-shift)/cols,(r+0.5)/rows);",
    " vec2 off=(vec2(h(cell+1.3),h(cell+4.1))-0.5)*0.01;",
    " vec2 dm=(center-mouse)*vec2(res.x/res.y,1.0); float md=exp(-dot(dm,dm)*5.0)*hover;",
    " vec2 away=normalize(dm+vec2(0.0001))*md*0.045;",
    " vec2 suv=(uv-center)/(1.0+(rnd-0.5)*0.03+md*0.06)+center+off-away*(0.6+rnd*0.8);",
    " vec3 a=tap(t,suv,img,0.0015); vec3 b=tap(t2,suv,img2,0.0015);",
    " float m=clamp(mixv*1.8-rnd*0.8,0.0,1.0); m=m*m*(3.0-2.0*m);",
    " vec3 col=mix(a,b,m);",
    " vec2 f=vec2(fract(uv.x*cols+shift),fract(uv.y*rows));",
    " float e=smoothstep(0.0,0.008,f.x)*smoothstep(0.0,0.008,1.0-f.x)*smoothstep(0.0,0.014,f.y)*smoothstep(0.0,0.014,1.0-f.y);",
    " col*=mix(0.12,1.0,e+md*0.4); col*=0.9+0.16*rnd+md*0.16;",
    " col+=(h(uv*res+grain)-0.5)*0.05;",
    " vec2 q=uv-0.5; col*=1.0-dot(q,q)*1.2;",
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

  function makeSlideshow(show) {
    var slides = [], idx = 0, timer = null;
    var hero = $(".hero");
    if (hero) hero.addEventListener("click", function (e) {
      if (e.target.closest("a, button") || slides.length < 2) return;
      idx = (idx + 1) % slides.length;
      show(slides[idx].img); setPlateLabel(slides, idx);
    });
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
        }, 10000);
      }
    };
  }

  function initHero(site) {
    var canvas = $("#hero-gl");
    var fallback = $("#hero-fallback");
    var hasReal = !!site.heroImage;
    var plate = makePlate(7, 800, 500, "hero", false, true);
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

    var U = {};
    ["res", "img", "img2", "mixv", "grain", "t", "t2", "mouse", "hover"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(U.t, 0); gl.uniform1i(U.t2, 1);

    function mkTex() {
      var tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tx;
    }
    var texA = mkTex(), texB = mkTex();
    var sizeA = [plate.width, plate.height], sizeB = sizeA.slice();
    function upload(tx, src) {
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      return [src.naturalWidth || src.width, src.naturalHeight || src.height];
    }
    sizeA = upload(texA, plate); sizeB = upload(texB, plate);

    var mixv = 0, fading = false;
    // Gentle hover: tiles under the cursor lift and brighten slightly, eased slowly.
    var mouse = [0.5, 0.5], target = [0.5, 0.5], hover = 0, hoverTarget = 0, easing = false;
    function easeLoop() {
      mouse[0] += (target[0] - mouse[0]) * 0.07;
      mouse[1] += (target[1] - mouse[1]) * 0.07;
      hover += (hoverTarget - hover) * 0.06;
      if (!fading) draw();
      if (Math.abs(target[0] - mouse[0]) + Math.abs(target[1] - mouse[1]) + Math.abs(hoverTarget - hover) > 0.002) requestAnimationFrame(easeLoop);
      else easing = false;
    }
    if (finePointer && !reduceMotion) {
      var heroEl = canvas.parentElement;
      heroEl.addEventListener("pointermove", function (e) {
        var r = heroEl.getBoundingClientRect();
        target = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
        hoverTarget = 1;
        if (!easing) { easing = true; requestAnimationFrame(easeLoop); }
      });
      heroEl.addEventListener("pointerleave", function () {
        hoverTarget = 0;
        if (!easing) { easing = true; requestAnimationFrame(easeLoop); }
      });
    }
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.25 : 1.75);
      var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    }
    function draw() {
      resize();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2f(U.img, sizeA[0], sizeA[1]);
      gl.uniform2f(U.img2, sizeB[0], sizeB[1]);
      gl.uniform1f(U.mixv, mixv);
      gl.uniform1f(U.grain, 1.0);
      gl.uniform2f(U.mouse, mouse[0], mouse[1]);
      gl.uniform1f(U.hover, hover);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Crossfade: the new photo goes into texture B, tiles flip over 1.8 s, then B becomes A.
    function setImage(src, instant) {
      var im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = function () {
        try { sizeB = upload(texB, im); } catch (e) { return; }
        $("#hero-note").hidden = true;
        if (instant || reduceMotion || document.hidden) { swap(); return; }
        var t0 = performance.now(); fading = true;
        (function step(now) {
          mixv = Math.min(1, (now - t0) / 1800);
          draw();
          if (mixv < 1) requestAnimationFrame(step); else swap();
        })(t0);
      };
      im.src = src;
    }
    function swap() {
      var tmp = texA; texA = texB; texB = tmp;
      var ts = sizeA; sizeA = sizeB; sizeB = ts;
      mixv = 0; fading = false; draw();
    }
    if (hasReal) setImage(site.heroImage, true);

    draw();
    window.addEventListener("resize", function () { if (!fading) draw(); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden && !fading) draw(); });

    return { setImage: setImage, setSlides: makeSlideshow(setImage), restart: function () { draw(); } };
  }

  /* ---------------- Wordmark ---------------- */
  function initWordmark() {
    var wm = $(".wm");
    var slices = $$(".wm__slice", wm);
    if (reduceMotion) return;
    slices.forEach(function (s, i) { s.style.setProperty("--o", (i % 2 ? 1 : -1) * (12 + Math.random() * 28)); });
    wm.classList.add("is-split");
    requestAnimationFrame(function () {
      setTimeout(function () {
        slices.forEach(function (s) { s.style.setProperty("--o", 0); });
        wm.classList.remove("is-split");
      }, 260);
    });
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
    var featured = ((data.site && data.featuredPosts) || data.featuredPosts || []).map(function (l) { return String(l).split("?")[0].replace(/\/$/, ""); });
    var pool = posts.slice().sort(function (a, b) {
      var fa = featured.indexOf(String(a.link || "").split("?")[0].replace(/\/$/, "")), fb = featured.indexOf(String(b.link || "").split("?")[0].replace(/\/$/, ""));
      return (fa < 0 ? 999 : fa) - (fb < 0 ? 999 : fb);
    });
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
      natural(src, function (n) {
        var s = Math.max(r.width / n[0], r.height / n[1]);
        var dw = n[0] * s, dh = n[1] * s, ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;
        loupe.style.backgroundImage = "url('" + src + "')";
        loupe.style.backgroundSize = dw * Z + "px " + dh * Z + "px";
        loupe.style.backgroundPosition = -((x - ox) * Z - L / 2) + "px " + -((y - oy) * Z - L / 2) + "px";
      });
    });
    board.addEventListener("pointerleave", function () { loupe.classList.remove("is-on"); });
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
      } else if (p.videoLink && embedUrl(p.videoLink)) {
        media += "";
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
        extra += '<a class="v-link" href="' + esc(p.videoLink) + '" target="_blank" rel="noopener">' + (/youtu/.test(p.videoLink) ? "Watch on YouTube ↗" : "Watch the film ↗") + '</a>';
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
  // Invert lens: a white circle that flips the colours under it. Swells over photos, shrinks over links.
  function initCursor() {
    if (!finePointer || reduceMotion) return;
    var lens = $("#lens");
    if (!lens) return;
    document.documentElement.classList.add("has-lens");
    var x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, size = 18, target = 18, shown = false, running = false;
    function want(el) {
      if (!el || !el.closest) return 18;
      if (el.closest("input, textarea, select, .scp, .board .slide__img")) return 0;
      if (el.closest(".tile, .hero, .v-hero, .v-grid img")) return 120;
      if (el.closest("a, button, [role=slider]")) return 46;
      return 18;
    }
    function tick() {
      cx += (x - cx) * 0.18; cy += (y - cy) * 0.18;
      size += (target - size) * 0.14;
      lens.style.transform = "translate3d(" + (cx - size / 2).toFixed(1) + "px," + (cy - size / 2).toFixed(1) + "px,0)";
      lens.style.width = lens.style.height = size.toFixed(1) + "px";
      if (Math.abs(x - cx) + Math.abs(y - cy) + Math.abs(target - size) > 0.3) requestAnimationFrame(tick); else running = false;
    }
    document.addEventListener("pointermove", function (e) {
      x = e.clientX; y = e.clientY;
      target = want(e.target);
      if (!shown) { shown = true; cx = x; cy = y; lens.classList.add("is-on"); }
      lens.classList.toggle("is-off", target === 0);
      if (!running) { running = true; requestAnimationFrame(tick); }
    });
    document.addEventListener("pointerleave", function () { lens.classList.remove("is-on"); shown = false; });
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
    var opened = Date.now();
    var email = site.email || "";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      // bots fill hidden boxes and submit instantly; people don't
      if (fd.get("botcheck") || Date.now() - opened < 3000) {
        status.textContent = "Give it a second and try again.";
        return;
      }
      var name = (fd.get("name") || "").trim(), from = (fd.get("email") || "").trim(), msg = (fd.get("message") || "").trim();
      if (!name || !from || !msg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
        status.textContent = "Add your name, a valid email and a message, then send again.";
        return;
      }
      var subject = "Enquiry: " + fd.get("type") + " from " + name;
      var text = "Name: " + name + "\nEmail: " + from + "\nType: " + fd.get("type") + "\nDate: " + (fd.get("date") || "-") + "\nReference pics: " + (fd.get("refs") || "-") + "\n\n" + msg;

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
    var wrap = $("#loader-tiles");
    var cols = ["#ec2a1c", "#c6ff3d", "#f6b62c", "#eee4d3"];
    var html = "";
    for (var i = 0; i < 25; i++) {
      var a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 220;
      html += '<span style="--x:' + Math.round(Math.cos(a) * r) + "px;--y:" + Math.round(Math.sin(a) * r) + "px;--r:" + Math.round((Math.random() - 0.5) * 180) + "deg;--c:" + cols[i % 4] + ";--d:" + (i * 22) + 'ms"></span>';
    }
    wrap.innerHTML = html;
    el.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-go"); }); });
    return new Promise(function (resolve) {
      var done = false, timer = setTimeout(finish, 1900);
      function finish() {
        if (done) return; done = true;
        clearTimeout(timer);
        el.classList.add("is-out");
        setTimeout(function () { el.hidden = true; }, 650);
        ["click", "keydown", "wheel", "touchstart"].forEach(function (ev) { window.removeEventListener(ev, finish); });
        resolve();
      }
      ["click", "keydown", "wheel", "touchstart"].forEach(function (ev) { window.addEventListener(ev, finish, { passive: true }); });
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
    var box = $("#sc"), panel = $("#scp");
    if (!url || !box || !panel) return false;
    box.hidden = false;
    $("#sound").hidden = true;
    $("#scp-out").href = url;
    var frame = document.createElement("iframe");
    frame.allow = "autoplay";
    frame.title = "SoundCloud player";
    frame.src = "https://w.soundcloud.com/player/?url=" + encodeURIComponent(url) + "&auto_play=false&visual=false&show_artwork=true&buying=false&sharing=false";
    $("#sc-frame").appendChild(frame);

    var barTitle = $("#sc-title"), disc = $("#sc-play"), toggleBtn = $("#scp-toggle");
    var nameEl = $("#scp-name"), artistEl = $("#scp-artist"), art = $("#scp-art"), list = $("#scp-list");
    var fill = $("#scp-fill"), bar = $("#scp-bar"), posEl = $("#scp-pos"), durEl = $("#scp-dur");
    var duration = 0, current = -1, playing = false;
    function mmss(ms) { var t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); }
    function setPlaying(on) {
      playing = on;
      box.classList.toggle("is-playing", on);
      panel.classList.toggle("is-playing", on);
      toggleBtn.textContent = on ? "Pause" : "Play";
      disc.setAttribute("aria-label", on ? "Pause music" : "Play music");
    }
    function showCurrent() {
      if (!sc) return;
      sc.getCurrentSound(function (snd) {
        if (!snd) return;
        var who = snd.user && snd.user.username || "";
        nameEl.textContent = snd.title || "Untitled";
        artistEl.textContent = who;
        barTitle.textContent = (snd.title || "Untitled") + (who ? " · " + who : "");
        var img = snd.artwork_url || (snd.user && snd.user.avatar_url) || "";
        art.style.backgroundImage = img ? "url('" + img.replace("-large", "-t300x300") + "')" : "";
        duration = snd.duration || duration;
        durEl.textContent = mmss(duration);
      });
      sc.getCurrentSoundIndex(function (i) {
        current = i;
        $$("li", list).forEach(function (li, n) { li.classList.toggle("is-current", n === i); });
      });
    }
    function buildList() {
      sc.getSounds(function (sounds) {
        list.innerHTML = (sounds || []).map(function (snd, i) {
          var t = snd && snd.title ? snd.title : "Track " + (i + 1);
          var who = snd && snd.user && snd.user.username ? snd.user.username : "";
          return '<li><button type="button" data-i="' + i + '"><span class="mono">' + String(i + 1).padStart(2, "0") + "</span><span>" + esc(t) + (who ? ' <em>' + esc(who) + "</em>" : "") + "</span></button></li>";
        }).join("");
        showCurrent();
      });
    }
    var api = document.createElement("script");
    api.src = "https://w.soundcloud.com/player/api.js";
    api.onload = function () {
      if (!window.SC || !window.SC.Widget) return;
      sc = window.SC.Widget(frame);
      var E = window.SC.Widget.Events;
      sc.bind(E.READY, function () { buildList(); });
      sc.bind(E.PLAY, function () { setPlaying(true); showCurrent(); });
      sc.bind(E.PAUSE, function () { setPlaying(false); });
      sc.bind(E.FINISH, function () { setPlaying(false); });
      sc.bind(E.PLAY_PROGRESS, function (e) {
        fill.style.width = (e.relativePosition * 100).toFixed(2) + "%";
        bar.setAttribute("aria-valuenow", Math.round(e.relativePosition * 100));
        posEl.textContent = mmss(e.currentPosition);
      });
    };
    api.onerror = function () { nameEl.textContent = "Player couldn't load. Open it on SoundCloud."; };
    document.head.appendChild(api);

    function toggle() { if (sc) sc.toggle(); }
    function openPanel(on) {
      panel.hidden = !on;
      barTitle.setAttribute("aria-expanded", on);
      if (on && sc) showCurrent();
    }
    disc.addEventListener("click", toggle);
    toggleBtn.addEventListener("click", toggle);
    barTitle.addEventListener("click", function (e) { e.stopPropagation(); openPanel(panel.hidden); });
    $("#scp-next").addEventListener("click", function () { if (sc) { sc.next(); sc.play(); } });
    $("#scp-prev").addEventListener("click", function () { if (sc) { sc.prev(); sc.play(); } });
    list.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-i]");
      if (b && sc) { sc.skip(+b.getAttribute("data-i")); sc.play(); }
    });
    function seek(clientX) {
      var r = bar.getBoundingClientRect();
      var ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      if (sc && duration) sc.seekTo(duration * ratio);
    }
    bar.addEventListener("click", function (e) { seek(e.clientX); });
    bar.addEventListener("keydown", function (e) {
      if (!sc || !duration) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        sc.getPosition(function (p) { sc.seekTo(Math.max(0, p + (e.key === "ArrowRight" ? 5000 : -5000))); });
      }
    });
    document.addEventListener("click", function (e) { if (!panel.hidden && !panel.contains(e.target) && !box.contains(e.target)) openPanel(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) openPanel(false); });
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
    var x = 0;
    (function step() {
      var half = track.scrollWidth / 2;
      x -= 0.35;
      if (x <= -half) x += half;
      track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
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
    els.forEach(function (el) {
      var text = el.textContent;
      el.setAttribute("aria-label", text);
      el.innerHTML = Array.from(text).map(function (ch, i) {
        return '<span class="rise" aria-hidden="true" style="--i:' + i + '">' + (ch === " " ? "&nbsp;" : esc(ch)) + "</span>";
      }).join("");
    });
    if (reduceMotion || !("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-up"); }); return; }
    els.forEach(function (el) { el.classList.add("rise-ready"); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-up"); io.unobserve(e.target); } });
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

  // Mosaic cursor trail: a few small tiles fade out where the cursor has been. They don't move.
  function initTrail() {
    if (!finePointer || reduceMotion) return;
    var c = $("#trail");
    if (!c) return;
    var g = c.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
    var cols = ["#ec2a1c", "#c6ff3d", "#f6b62c", "#eee4d3"];
    var bits = [], lx = 0, ly = 0, acc = 0, active = false;
    function size() { c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = innerWidth + "px"; c.style.height = innerHeight + "px"; }
    size(); window.addEventListener("resize", size);
    document.addEventListener("pointermove", function (e) {
      var d = Math.hypot(e.clientX - lx, e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
      if (!$("#viewer").hidden || e.target.closest(".board, .contact, input, textarea, select, .tile")) return;
      acc += d;
      if (acc < 28 || bits.length > 40) return;
      acc = 0;
      var s = 6 + Math.random() * 6;
      bits.push({ x: Math.round(lx / 8) * 8, y: Math.round(ly / 8) * 8, s: s, c: cols[(Math.random() * cols.length) | 0], life: 1 });
      if (!active) { active = true; requestAnimationFrame(tick); }
    });
    function tick() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (var i = bits.length - 1; i >= 0; i--) {
        var b = bits[i];
        b.life -= 0.018;
        if (b.life <= 0) { bits.splice(i, 1); continue; }
        g.globalAlpha = b.life * 0.5;
        g.fillStyle = b.c;
        g.fillRect(b.x - b.s / 2, b.y - b.s / 2, b.s, b.s * 0.7);
      }
      if (bits.length) requestAnimationFrame(tick); else { active = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    }
  }

  // Magnetic buttons: key controls lean a few pixels toward the cursor.
  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    $$(".enquire, .send, .filter, .copy, .follow, .ig-cta__big").forEach(function (el) {
      el.classList.add("magnet");
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
        el.style.transform = "translate(" + (x * 6).toFixed(1) + "px," + (y * 4).toFixed(1) + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  // Gallery tiles tip slightly toward the cursor with a soft light sheen.
  function initTileFX() {
    if (!finePointer || reduceMotion) return;
    var gal = $("#gallery");
    gal.addEventListener("pointermove", function (e) {
      var t = e.target.closest && e.target.closest(".tile");
      if (!t) return;
      var r = t.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      t.style.setProperty("--ry", ((x - 0.5) * 5).toFixed(2) + "deg");
      t.style.setProperty("--rx", ((0.5 - y) * 4).toFixed(2) + "deg");
      t.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
      t.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    });
    gal.addEventListener("pointerout", function (e) {
      var t = e.target.closest && e.target.closest(".tile");
      if (!t || t.contains(e.relatedTarget)) return;
      t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg");
    });
  }

  /* ---------------- Ambient drift ----------------
     A few faint mosaic pieces float very slowly behind the dark sections. */
  function initAmbient() {
    var c = $("#ambient");
    if (!c || reduceMotion) { if (c) c.hidden = true; return; }
    var g = c.getContext("2d"), dpr = Math.min(1.5, window.devicePixelRatio || 1);
    var cols = ["#ec2a1c", "#c6ff3d", "#f6b62c", "#eee4d3"];
    var pieces = [];
    function size() { c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = innerWidth + "px"; c.style.height = innerHeight + "px"; }
    size(); window.addEventListener("resize", size);
    var n = innerWidth < 720 ? 7 : 14;
    for (var i = 0; i < n; i++) {
      pieces.push({
        x: Math.random() * innerWidth, y: Math.random() * innerHeight,
        w: 20 + Math.random() * 90, h: 12 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 0.12, vy: -0.04 - Math.random() * 0.1,
        c: cols[i % cols.length], a: 0.035 + Math.random() * 0.05, par: 0.2 + Math.random() * 0.5
      });
    }
    var lastY = window.scrollY;
    (function loop() {
      if (!document.hidden) {
        var dy = window.scrollY - lastY; lastY = window.scrollY;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, innerWidth, innerHeight);
        pieces.forEach(function (p) {
          p.x += p.vx; p.y += p.vy - dy * p.par * 0.15;
          if (p.y < -p.h) p.y = innerHeight + p.h; if (p.y > innerHeight + p.h) p.y = -p.h;
          if (p.x < -p.w) p.x = innerWidth; if (p.x > innerWidth) p.x = -p.w;
          g.globalAlpha = p.a; g.fillStyle = p.c;
          g.fillRect(p.x, p.y, p.w, p.h);
        });
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- YouTube ----------------
     Set youtubeChannelId in content.json. The site asks /api/youtube (a free Cloudflare function in the
     functions folder) for the latest videos, and adds them to the work gallery like Instagram posts.
     You can also list video links by hand in youtubeVideos. */
  function ytId(link) {
    var m = String(link || "").match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
    return m ? m[1] : "";
  }
  function loadYouTube(site) {
    var manual = (site.youtubeVideos || []).map(function (l) { var id = ytId(l); return id ? { id: id, title: "", url: "https://www.youtube.com/watch?v=" + id, thumb: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg" } : null; }).filter(Boolean);
    if (!site.youtubeChannelId) return Promise.resolve(manual);
    var KEY = "ms-yt:" + site.youtubeChannelId, TTL = 6 * 3600 * 1000;
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || "null");
      if (c && Date.now() - c.t < TTL) return Promise.resolve(mergeVideos(c.videos, manual));
    } catch (e) { /* fetch */ }
    return fetch("/api/youtube?channel=" + encodeURIComponent(site.youtubeChannelId)).then(function (r) {
      if (!r.ok) throw new Error("yt");
      return r.json();
    }).then(function (j) {
      var vids = (j && j.videos) || [];
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), videos: vids })); } catch (e) { /* ignore */ }
      return mergeVideos(vids, manual);
    }).catch(function () { return manual; });
  }
  function mergeVideos(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (v) { if (v && v.id && !seen[v.id]) { seen[v.id] = 1; out.push(v); } });
    return out;
  }
  function addYouTubeToWork(data, videos) {
    if (!videos || !videos.length) return false;
    var have = {};
    (data.projects || []).forEach(function (p) { if (p.ytId) have[p.ytId] = 1; });
    var added = false;
    videos.forEach(function (v) {
      if (have[v.id]) return;
      data.projects.push({
        title: v.title || "Film", category: "film", shape: "wide",
        year: v.published ? String(new Date(v.published).getFullYear()) : "",
        summary: "", cover: v.thumb, images: [], videoFile: "", videoLink: v.url, audioFile: "",
        placeholder: false, fromYouTube: true, ytId: v.id
      });
      added = true;
    });
    // real work first: drop leftover placeholders once there is real content
    data.projects = data.projects.filter(function (p) { return !p.placeholder; });
    return added;
  }

  /* ---------------- Quote builder ----------------
     Visitors tick what they want, see the estimate, and the booking form fills itself in. */
  function initQuote(data) {
    var form = $("#qb"), sumEl = $("#qb-sum");
    if (!form) return;
    var q = data.quote || {};
    function n(name) { var el = form.elements[name]; return el ? Math.max(0, Math.floor(+el.value || 0)) : 0; }
    function picked() {
      var photo = (form.querySelector("input[name=photo]:checked") || {}).value;
      var video = (form.querySelector("input[name=video]:checked") || {}).value;
      var items = [], total = 0;
      function add(label, amount) { items.push(label); total += amount; }
      if (photo === "raw") add("Photoshoot (unedited)", +q.photoshoot || 0);
      if (photo === "edits") add("Photoshoot with Lightroom edits", +q.photoshootEdits || 0);
      if (video === "shoot") add("Music video shoot", +q.videoShoot || 0);
      if (video === "edit") add("Music video edit", +q.videoEdit || 0);
      if (video === "package") add("Music video shoot + edit", +q.videoPackage || 0);
      if (n("eventHours")) add(n("eventHours") + "h event coverage", n("eventHours") * (+q.eventHour || 0));
      if (n("shorts")) add(n("shorts") + " short-form edit" + (n("shorts") > 1 ? "s" : ""), n("shorts") * (+q.shortForm || 0));
      if (n("extraHours")) add("+" + n("extraHours") + " extra hour" + (n("extraHours") > 1 ? "s" : ""), n("extraHours") * (+q.extraHour || 0));
      if (n("extraLocs")) add("+" + n("extraLocs") + " extra location" + (n("extraLocs") > 1 ? "s" : ""), n("extraLocs") * (+q.extraLocation || 0));
      return { items: items, total: total };
    }
    function update() {
      var p = picked();
      sumEl.textContent = "$" + p.total;
      $("#qb-list").textContent = p.items.join(" + ");
      $("#qb-go").disabled = !p.items.length;
    }
    form.addEventListener("change", update);
    form.addEventListener("input", update);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var p = picked();
      if (!p.items.length) return;
      var type = $("#f-type");
      if (type) {
        var hasVid = p.items.some(function (x) { return /video/i.test(x); }), hasPhoto = p.items.some(function (x) { return /Photoshoot/.test(x); }), hasEvent = p.items.some(function (x) { return /event/i.test(x); });
        type.value = hasEvent && !hasVid && !hasPhoto ? "Event" : hasVid && !hasPhoto ? "Music video" : hasPhoto && !hasVid ? "Photography" : "Something else";
      }
      var msg = $("#f-msg");
      if (msg) msg.value = "Quote: " + p.items.join(" + ") + " (estimate $" + p.total + " NZD).\n\n" + (msg.value || "");
      var c = $("#contact");
      c.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      setTimeout(function () { var n = $("#f-name"); if (n) n.focus({ preventScroll: true }); }, reduceMotion ? 0 : 700);
    });
    update();
  }

  /* ---------------- Swipe gallery ----------------
     Photos inside a project open full screen. Swipe on phones, arrows or keys on desktop. */
  function initLightbox() {
    var lb = $("#lb"), track = $("#lb-track"), count = $("#lb-count");
    if (!lb) return;
    var lastFocus = null, total = 0;
    function current() { return Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); }
    function label() { count.textContent = (current() + 1) + " / " + total; }
    window.openLightbox = function (srcs, start, alt) {
      total = srcs.length;
      track.innerHTML = srcs.map(function (src, i) {
        return '<figure class="lb__slide"><img src="' + esc(src) + '" alt="' + esc((alt || "Photo") + " " + (i + 1) + " of " + srcs.length) + '"' + (Math.abs(i - start) > 1 ? ' loading="lazy"' : "") + "></figure>";
      }).join("");
      lastFocus = document.activeElement;
      lb.hidden = false;
      document.documentElement.classList.add("lb-open");
      requestAnimationFrame(function () { track.scrollLeft = start * track.clientWidth; label(); });
      $("#lb-close").focus();
    };
    function close() {
      lb.hidden = true; track.innerHTML = "";
      document.documentElement.classList.remove("lb-open");
      if (lastFocus) lastFocus.focus();
    }
    function go(d) { track.scrollBy({ left: d * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" }); }
    track.addEventListener("scroll", function () { label(); }, { passive: true });
    $("#lb-prev").addEventListener("click", function () { go(-1); });
    $("#lb-next").addEventListener("click", function () { go(1); });
    $("#lb-close").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }, true);
    // open from any photo inside the project viewer
    $("#viewer-body").addEventListener("click", function (e) {
      var img = e.target.closest("img.v-hero, .v-grid img");
      if (!img) return;
      var imgs = $$("img.v-hero, .v-grid img", $("#viewer-body"));
      var srcs = imgs.map(function (i) { return i.getAttribute("src"); });
      window.openLightbox(srcs, imgs.indexOf(img), $("#viewer-title") ? $("#viewer-title").textContent : "Photo");
    });
  }

  /* ---------------- Gentle section reveals ---------------- */
  function initReveals() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var secs = $$("main > section:not(.hero), main > .marquee");
    document.documentElement.classList.add("reveal-on");
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-shown"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    secs.forEach(function (s) { s.classList.add("reveal"); io.observe(s); });
  }

  /* ---------------- Install as an app ---------------- */
  function initPWA() {
    if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
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
    if (!initSoundCloud(site)) initSound();
    initForm(site);
    initBar();
    initTimecode();
    initCursor();
    initMarquee(data);
    initIntroWords();
    initScramble();
    initInkFill();
    initFootWeight();
    initMagnetic();
    initTileFX();
    initAmbient();
    initQuote(data);
    initLightbox();
    initReveals();
    initPWA();
    var leader = runLeader();
    leader.then(function () { initWordmark(); hero.restart(); });
    var igP = loadInstagram(site), ytP = loadYouTube(site);
    igP.then(function (res) {
      if (res === null) return;
      renderInstagram(res, data);
      if (!site.heroImage && Array.isArray(res) && res.length) {
        leader.then(function () { hero.setSlides(res.map(function (p) { return { img: p.img, link: p.link }; })); });
      }
    });
    Promise.all([igP, ytP]).then(function (r) {
      var changed = fillWorkFromInstagram(data, r[0]);
      changed = addYouTubeToWork(data, r[1]) || changed;
      if (changed) renderGallery(data);
    });
  }).catch(function (err) {
    console.error(err);
    var g = document.getElementById("gallery");
    if (g) g.innerHTML = '<p class="v-ph mono">The content file could not load. If you opened index.html straight from your computer, use the published site or the preview steps in the guide instead.</p>';
    initWordmark();
    initBar();
  });
})();
