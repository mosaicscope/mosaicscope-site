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
      fl.querySelectorAll("details").forEach(function (d) { d.querySelector("summary").addEventListener("click", function () { if (!d.open) document.dispatchEvent(new CustomEvent("crew", { detail: "faq" })); }); });
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
    // phones: the mosaic follows your finger, and drifts on its own so it never sits flat
    if (!finePointer && !reduceMotion) {
      var heroT = canvas.parentElement, heroOn = true;
      var nudge = function (x, y) { target = [x, y]; hoverTarget = 1; if (!easing) { easing = true; requestAnimationFrame(easeLoop); } };
      heroT.addEventListener("pointermove", function (e) { var r = heroT.getBoundingClientRect(); nudge((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height); }, { passive: true });
      heroT.addEventListener("touchmove", function (e) { var t = e.touches[0], r = heroT.getBoundingClientRect(); if (t) nudge((t.clientX - r.left) / r.width, 1 - (t.clientY - r.top) / r.height); }, { passive: true });
      if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { heroOn = es[0].isIntersecting; }).observe(heroT);
      var drift = 0;
      setInterval(function () {
        if (!heroOn || document.hidden) return;
        drift += 1;
        nudge(0.5 + Math.sin(drift * 0.9) * 0.28, 0.5 + Math.cos(drift * 0.6) * 0.22);
      }, 2600);
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
      document.dispatchEvent(new CustomEvent("crew", { detail: "photo" }));
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
            if (window.hype) window.hype.rain();
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
      if (window.hype) window.hype.rain();
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
      if (window.hype) window.hype.set(on);
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
      sc.bind(E.READY, function () { buildList(); setInitialVol(); });
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
    // volume
    var vol = $("#scp-vol"), volNum = $("#scp-volnum"), mute = $("#scp-mute"), lastVol = 80;
    try { var sv = parseInt(localStorage.getItem("ms-vol"), 10); if (!isNaN(sv)) lastVol = sv; } catch (e) { /* ignore */ }
    function setVol(v, remember) {
      v = Math.max(0, Math.min(100, Math.round(v)));
      vol.value = v; volNum.textContent = v;
      vol.style.setProperty("--v", v + "%");
      mute.textContent = v === 0 ? "Muted" : "Vol";
      mute.setAttribute("aria-label", v === 0 ? "Unmute" : "Mute");
      if (sc) sc.setVolume(v);
      if (remember && v > 0) { lastVol = v; try { localStorage.setItem("ms-vol", v); } catch (e) { /* ignore */ } }
    }
    vol.addEventListener("input", function () { setVol(+vol.value, true); });
    mute.addEventListener("click", function () { setVol(+vol.value === 0 ? (lastVol || 80) : 0, false); });
    var setInitialVol = function () { setVol(lastVol, false); };
    window.hypeToggle = toggle;
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
    if (reduceMotion) return;
    // phones have no hover, so the tile crossing the middle of the screen gets the hover look
    if (!finePointer) {
      if (!("IntersectionObserver" in window)) return;
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle("is-focus", e.isIntersecting); }); }, { rootMargin: "-42% 0px -42% 0px" });
      var watch = function () { $$("#gallery .tile, .slide").forEach(function (t) { if (!t._io) { t._io = 1; io.observe(t); } }); };
      watch();
      var mo = new MutationObserver(watch);
      ["#gallery", "#ig-board"].forEach(function (id) { var n = $(id); if (n) mo.observe(n, { childList: true }); });
      return;
    }
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
    form.addEventListener("change", function () { update(); document.dispatchEvent(new CustomEvent("crew", { detail: "quote" })); });
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

  /* =====================================================================
     Easter egg: THE MOSAICS
     A crew that lives in the black strip at the very bottom of the page.
     - Tiles is the main guy. Glitter is his girl. Eight friends arrive over time.
     - Music off: they live their lives. The longer someone stays, the more the scene builds
       (boombox, string lights, disco ball, a banner, and a sign for their world, coming soon).
     - Music on: each crew (a guy and a girl, or two guys and a girl) gets its own patch. Tiles' crew makes it rain,
       every other crew does a different set (money gun, grind, drop it low, booty pop, wine). Then the
       boys put their hands up, two of them spray money guns.
     - They react to the page: open a photo and they do a mock photoshoot, build a quote and
       Tiles counts his cash, open the FAQ and someone has a think, send an enquiry and it rains.
     ===================================================================== */
  // crews (g): each is a guy and a girl, or two guys and a girl
  var CAST = [
    { name: "Tiles", kind: "guy", color: "#c6ff3d", accent: "#ec2a1c", hat: "bandana", main: true, g: 0 },
    { name: "Glitter", kind: "girl", color: "#ff7ad9", accent: "#f6b62c", hair: "big", glam: true, g: 0 },
    { name: "Kodak", kind: "guy", color: "#f6b62c", accent: "#eee4d3", hat: "cap", g: 1 },
    { name: "Nova", kind: "girl", color: "#3dd6ff", accent: "#ff7ad9", hair: "bun", g: 1 },
    { name: "Grain", kind: "guy", color: "#eee4d3", accent: "#ec2a1c", hat: "none", g: 1 },
    { name: "Flash", kind: "guy", color: "#b48cff", accent: "#f6b62c", hat: "cap", g: 2 },
    { name: "Ruby", kind: "girl", color: "#ec2a1c", accent: "#c6ff3d", hair: "big", g: 2 },
    { name: "Bando", kind: "guy", color: "#ff9a3d", accent: "#3dd6ff", hat: "bandana", g: 3 },
    { name: "Lux", kind: "girl", color: "#c6ff3d", accent: "#3dd6ff", hair: "bun", g: 3 },
    { name: "Static", kind: "guy", color: "#8fe3c0", accent: "#ff7ad9", hat: "cap", g: 3 }
  ];
  // everyone moves their own way when the music's on
  var STYLE = { Tiles: "swagger", Glitter: "smooth", Kodak: "bouncy", Nova: "loose", Grain: "sharp", Flash: "hype", Ruby: "smooth", Bando: "bouncy", Lux: "loose", Static: "sharp" };
  var IDLE = ["walk", "walk", "walk", "chill", "chill", "smoke", "sit", "drink", "wave", "phone", "selfie", "stretch", "look", "crouch", "pushup", "sleep", "box", "flip"];
  var GLAM_IDLE = ["walk", "flip", "selfie", "phone", "flip", "chill", "drink", "wave", "walk", "selfie"];
  var MAIN_IDLE = ["walk", "chill", "smoke", "sit", "drink", "phone", "look", "chill", "wave"];
  // dance pools: everyday party moves first, showy moves rarer
  var DANCE_POOL = ["twostep", "bounce", "bodyroll", "shimmy", "tutting", "popping", "jerk", "dougie", "naenae", "whip", "millyrock", "hitdemfolks", "sway", "clap", "sidestep", "bop", "heeltoe", "krump",
    "twostep", "bounce", "sway", "bop", "clap", "goff", "robot", "shuffle", "sprinkler", "dab", "floss", "runman", "moon", "jacks", "spin"];
  var GIRL_HYPE = ["hipshake", "bootypop", "drop", "wine", "bodyroll"];
  var GUY_HYPE = ["handsup", "handsup", "bounce", "clap", "jerk", "naenae"];
  var STAGES = [
    { at: 60, prop: "boombox" },
    { at: 120, prop: "lights" },
    { at: 180, prop: "disco" },
    { at: 300, prop: "banner" },
    { at: 0, prop: "sign" }, // the door to the Mosaics' world is there from the start
    { at: 600, prop: "neon" }
  ];
  var POSE_CLASSES = [];
  IDLE.concat(["rave", "throw", "count", "think", "posecool", "posegirl", "shoot", "camera", "cheer", "gag", "guitar", "hug"]).forEach(function (p) { POSE_CLASSES.push("is-" + p); });
  DANCE_POOL.concat(GIRL_HYPE, GUY_HYPE, ["worm", "throw", "shoot", "grind", "grindguy", "lean", "twirlguy", "spin"]).forEach(function (d) { if (POSE_CLASSES.indexOf("d-" + d) < 0) POSE_CLASSES.push("d-" + d); });

  /* ---- things they hold: [arm angle, wobble, speed, item svg drawn upright at the hand, what it gives off] ---- */
  var GAGS = {
    mic: { arm: -105, amp: 8, spd: .42, emit: "adlib", every: 900, item: '<rect x="-1.4" y="-9" width="2.8" height="9" rx="1" fill="#2a2420" stroke="#9a8d80" stroke-width=".8"/><circle cx="0" cy="-10.5" r="2.8" fill="#9a8d80" stroke="none"/>' },
    guitar: { guitar: true, emit: "notes", every: 520 },
    champagne: { arm: -125, amp: 10, spd: .5, emit: "spray", every: 110, item: '<path d="M-2 2 h4 v-9 l-1 -3 v-3 h-2 v3 l-1 3 Z" fill="#2d6b24" stroke="#c6ff3d" stroke-width=".8"/><rect x="-1.2" y="-13" width="2.4" height="2" fill="#f6b62c" stroke="none"/>' },
    sparkler: { arm: -115, amp: 25, spd: .35, emit: "spark", every: 70, item: '<path d="M0 2 V-14" stroke="#9a8d80" stroke-width="1"/><circle cx="0" cy="-14" r="1.8" fill="#fff6c8" stroke="none"/>' },
    bubbles: { arm: -65, amp: 12, spd: .7, emit: "bubble", every: 380, item: '<path d="M0 0 V-8" stroke="#ff7ad9" stroke-width="1.2"/><circle cx="0" cy="-11" r="3" fill="none" stroke="#ff7ad9" stroke-width="1.2"/>' },
    airhorn: { arm: -110, amp: 4, spd: .2, emit: "rings", every: 700, item: '<rect x="-2" y="-4" width="4" height="6" fill="#ec2a1c" stroke="none"/><path d="M-1 -4 L-5 -12 H5 L1 -4 Z" fill="#eee4d3" stroke="none"/>' },
    popper: { arm: -100, amp: 6, spd: .3, emit: "confetti", every: 1400, item: '<path d="M-2 2 L2 2 L4 -9 L-4 -9 Z" fill="#f6b62c" stroke="#ec2a1c" stroke-width=".8"/>' },
    fan: { arm: -60, amp: 28, spd: .22, item: '<path d="M0 0 L-8 -10 Q0 -15 8 -10 Z" fill="#ff7ad9" fill-opacity=".8" stroke="#eee4d3" stroke-width=".7"/>' },
    tambourine: { arm: -125, amp: 16, spd: .18, emit: "clink", every: 900, item: '<circle cx="0" cy="-6" r="5.5" fill="none" stroke="#f6b62c" stroke-width="1.6"/><circle cx="-5" cy="-6" r="1.2" fill="#eee4d3" stroke="none"/><circle cx="5" cy="-6" r="1.2" fill="#eee4d3" stroke="none"/>' },
    maracas: { arm: -95, amp: 22, spd: .16, item: '<path d="M0 1 V-5" stroke="#9a5a1c" stroke-width="1.4"/><ellipse cx="0" cy="-8.5" rx="3" ry="4" fill="#ec2a1c" stroke="#f6b62c" stroke-width=".8"/>' },
    foamfinger: { arm: -150, amp: 8, spd: .84, item: '<path d="M-4 2 h8 v-8 h-2 v-8 h-4 v8 h-2 Z" fill="#c6ff3d" stroke="#2d6b24" stroke-width=".8"/>' },
    flag: { arm: -150, amp: 18, spd: .55, item: '<path d="M0 2 V-18" stroke="#9a8d80" stroke-width="1"/><rect x="0" y="-18" width="11" height="7" fill="#ec2a1c" stroke="none"/><rect x="2" y="-16.5" width="2" height="2" fill="#f6b62c"/>' },
    glowwand: { arm: -135, amp: 45, spd: .45, item: '<path d="M0 2 V-16" stroke="#3dd6ff" stroke-width="2.4" style="filter:drop-shadow(0 0 3px #3dd6ff)"/>' },
    pizza: { arm: -95, amp: 4, spd: 1, item: '<path d="M-4 0 L4 0 L0 -10 Z" fill="#f6b62c" stroke="#9a5a1c" stroke-width=".8"/><circle cx="0" cy="-4" r="1" fill="#ec2a1c" stroke="none"/>' },
    icecream: { arm: -95, amp: 4, spd: .9, item: '<path d="M-3 -6 L3 -6 L0 2 Z" fill="#f6b62c" stroke="none"/><circle cx="0" cy="-8" r="3.2" fill="#ff7ad9" stroke="none"/>' },
    balloondog: { arm: -60, amp: 6, spd: 1.2, item: '<g fill="#3dd6ff" stroke="none"><ellipse cx="0" cy="-6" rx="6" ry="2.2"/><ellipse cx="6" cy="-10" rx="2" ry="3"/><ellipse cx="-4" cy="-2" rx="1.2" ry="3"/><ellipse cx="4" cy="-2" rx="1.2" ry="3"/></g>' },
    phonelight: { arm: -150, amp: 14, spd: 1.6, emit: "glint", every: 1200, item: '<rect x="-2.5" y="-6" width="5" height="8" rx="1" fill="#0e0b0a" stroke="#eee4d3" stroke-width=".8"/><circle cx="0" cy="-8" r="3" fill="#fff6c8" stroke="none" style="filter:blur(1px)"/>' },
    lighter: { arm: -150, amp: 14, spd: 1.6, item: '<rect x="-1.5" y="-4" width="3" height="6" fill="#ec2a1c" stroke="none"/><path d="M0 -5 Q-2 -8 0 -11 Q2 -8 0 -5" fill="#f6b62c" stroke="none"/>' },
    cup: { arm: -75, amp: 5, spd: .6, item: '<path d="M-3 -7 h6 l-1 8 h-4 Z" fill="#ec2a1c" stroke="#eee4d3" stroke-width=".7"/>' },
    rose: { arm: -60, amp: 3, spd: 1, item: '<path d="M0 2 V-9" stroke="#2d6b24" stroke-width="1.2"/><circle cx="0" cy="-10.5" r="2.6" fill="#ec2a1c" stroke="none"/>' },
    megaphone: { arm: -95, amp: 4, spd: .3, emit: "rings", every: 800, item: '<path d="M-2 0 L-2 -4 L8 -9 L8 5 Z" fill="#eee4d3" stroke="#ec2a1c" stroke-width=".8"/>' },
    drumsticks: { arm: -60, amp: 30, spd: .18, item: '<path d="M0 0 L9 -6" stroke="#f6b62c" stroke-width="1.4"/>' },
    cowbell: { arm: -70, amp: 12, spd: .21, emit: "clink", every: 840, item: '<path d="M-3 -2 L3 -2 L4 -9 L-4 -9 Z" fill="#9a8d80" stroke="#eee4d3" stroke-width=".7"/>' },
    watergun: { arm: -62, amp: 6, spd: .3, emit: "water", every: 110, item: '<path d="M-3 0 h10 v-4 h-10 Z M-3 0 v4 h3 v-4" fill="#3dd6ff" stroke="#f6b62c" stroke-width=".8"/>' },
    sign: { arm: -150, amp: 6, spd: .84, item: '<path d="M0 2 V-10" stroke="#9a8d80" stroke-width="1"/><rect x="-8" y="-19" width="16" height="9" fill="#eee4d3" stroke="none"/><text x="0" y="-12.4" font-size="6" font-family="monospace" font-weight="700" text-anchor="middle" fill="#ec2a1c" stroke="none">LIT</text>' },
    trumpet: { arm: -95, amp: 4, spd: .42, emit: "notes", every: 600, item: '<path d="M-1 0 H9 M9 -3 L13 -5 V5 L9 3 Z" stroke="#f6b62c" stroke-width="1.6" fill="#f6b62c"/>' },
    keytar: { arm: -62, amp: 5, spd: .3, emit: "notes", every: 560, item: '<rect x="-10" y="-3" width="18" height="5" rx="1" fill="#ec2a1c" stroke="#eee4d3" stroke-width=".7"/><path d="M-8 -3 v3 M-5 -3 v3 M-2 -3 v3 M1 -3 v3 M4 -3 v3" stroke="#eee4d3" stroke-width=".6"/>' },
    vinyl: { arm: -62, amp: 8, spd: .25, item: '<g class="spin"><circle cx="0" cy="-6" r="6" fill="#0e0b0a" stroke="#9a8d80" stroke-width=".8"/><circle cx="0" cy="-6" r="1.8" fill="#ec2a1c" stroke="none"/></g>' }
  };
  // after-hours treats (all made up): what they hold, then how it hits them
  Object.assign(GAGS, {
    grapejuice: { arm: -112, amp: 8, spd: .6, item: '<path d="M-2.5 2 h5 v-8 l-1.5 -2 v-4 h-2 v4 l-1.5 2 Z" fill="#7a2bd6" stroke="#ff7ad9" stroke-width=".8"/><rect x="-2.5" y="-4" width="5" height="3" fill="#ff7ad9" stroke="none"/>' },
    cocotin: { arm: -100, amp: 6, spd: .25, emit: "puff", every: 500, item: '<rect x="-4" y="-7" width="8" height="8" rx="1.5" fill="#eee4d3" stroke="#9a5a1c" stroke-width=".8"/><text x="0" y="-1.6" font-size="3.4" font-family="monospace" font-weight="700" text-anchor="middle" fill="#9a5a1c" stroke="none">COCO</text>' },
    gummies: { arm: -85, amp: 6, spd: .5, emit: "heart", every: 600, item: '<path d="M-4 2 h8 v-8 l-2 -2 h-4 l-2 2 Z" fill="#ff7ad9" stroke="#eee4d3" stroke-width=".8"/><path d="M0 -1.5 l-1.6 -1.6 a1 1 0 0 1 1.6 -1.2 a1 1 0 0 1 1.6 1.2 Z" fill="#ec2a1c" stroke="none"/>' },
    syrup: { arm: -95, amp: 3, spd: 1.4, item: '<path d="M-3 -7 h6 l-1 8 h-4 Z" fill="#eee4d3" stroke="#9a8d80" stroke-width=".6"/><path d="M-2.6 -3 h5.2 l-.6 4 h-4 Z" fill="#7a2bd6" stroke="none"/>' }
  });
  var TREATS = { grapejuice: "woozy", cocotin: "zoomy", gummies: "lovey", syrup: "slow" };
  var HATS = {
    partyhat: '<path d="M43 17 L57 17 L50 1 Z" fill="#ff7ad9" stroke="#f6b62c" stroke-width="1"/><circle cx="50" cy="1" r="1.8" fill="#f6b62c" stroke="none"/>',
    crown: '<path d="M42 17 L42 9 L46 13 L50 6 L54 13 L58 9 L58 17 Z" fill="#f6b62c" stroke="#9a5a1c" stroke-width="1"/>',
    headphones: '<path d="M39 27 Q39 13 50 13 Q61 13 61 27" fill="none" stroke="#0e0b0a" stroke-width="2.4"/><rect x="36" y="23" width="5" height="8" rx="2" fill="#ec2a1c" stroke="none"/><rect x="59" y="23" width="5" height="8" rx="2" fill="#ec2a1c" stroke="none"/>'
  };
  var PARTY_GAGS = ["champagne", "sparkler", "bubbles", "airhorn", "popper", "fan", "tambourine", "maracas", "foamfinger", "flag", "glowwand", "phonelight", "lighter", "megaphone", "drumsticks", "cowbell", "watergun", "sign", "trumpet", "keytar", "vinyl", "cup"];
  var IDLE_GAGS = ["pizza", "icecream", "balloondog", "fan", "bubbles", "cup", "sign", "vinyl", "foamfinger", "phonelight"];
  var ADLIBS = ["uh", "yeah", "ayy", "lets go", "run it back", "mosaic!", "skrrt", "say less", "woo", "lights up", "on beat", "ok ok"];

  /* ---- one shared particle layer: sparks, bubbles, notes, fireworks ---- */
  var FX = (function () {
    var cv = null, g = null, ps = [], running = false, dpr = 1;
    function ensure() {
      if (cv) return true;
      var host = document.getElementById("cash");
      if (!host || !host.getContext && !document.createElement("canvas").getContext) return false;
      cv = document.createElement("canvas");
      cv.className = "fxcanvas";
      cv.setAttribute("aria-hidden", "true");
      host.appendChild(cv);
      g = cv.getContext("2d");
      size(); window.addEventListener("resize", size);
      return !!g;
    }
    function size() { if (!cv) return; dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
    function add(p) {
      p.life = 0; p.max = p.max || 60; p.g = p.g == null ? 0.06 : p.g; p.drag = p.drag || 0.985; p.size = p.size || 2; p.a = p.a == null ? 1 : p.a;
      ps.push(p);
      if (!running) { running = true; requestAnimationFrame(loop); }
    }
    function loop() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (var i = ps.length - 1; i >= 0; i--) {
        var p = ps[i];
        p.life++;
        p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
        p.x += p.vx; p.y += p.vy;
        if (p.spin) p.rot = (p.rot || 0) + p.spin;
        var t = p.life / p.max, al = p.a * (t > 0.7 ? (1 - t) / 0.3 : 1);
        if (p.strobe && (p.life >> 2) % 2) al *= 0.2;
        if (p.twinkle) al *= 0.5 + Math.random() * 0.5;
        g.globalAlpha = Math.max(0, al);
        g.fillStyle = g.strokeStyle = p.c || "#f6b62c";
        var k = p.k;
        if (k === "spark") { g.lineWidth = p.size; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); g.stroke(); }
        else if (k === "ring") { g.lineWidth = 1.2; g.beginPath(); g.arc(p.x, p.y, p.size + p.life * (p.grow || 0.6), 0, 6.283); g.stroke(); }
        else if (k === "bubble") { g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.283); g.stroke(); }
        else if (k === "text") { g.font = (p.bold ? "700 " : "") + (p.size || 10) + "px ui-monospace, monospace"; g.fillText(p.text, p.x, p.y); }
        else if (k === "sq") { g.save(); g.translate(p.x, p.y); g.rotate(p.rot || 0); g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.h || 1)); g.restore(); }
        else if (k === "smoke") { g.globalAlpha = Math.max(0, al * 0.25); g.beginPath(); g.arc(p.x, p.y, p.size + p.life * 0.1, 0, 6.283); g.fill(); }
        else { g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.283); g.fill(); }
        if (p.life >= p.max) { ps.splice(i, 1); if (p.then) p.then(p); }
      }
      g.globalAlpha = 1;
      if (ps.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    }
    var COL = ["#c6ff3d", "#ff7ad9", "#3dd6ff", "#f6b62c", "#ec2a1c", "#eee4d3", "#b48cff"];
    function pick() { return COL[(Math.random() * COL.length) | 0]; }
    function burst(x, y, n, sp, o) {
      o = o || {};
      for (var i = 0; i < n; i++) {
        var a = o.even ? i / n * 6.283 : Math.random() * 6.283, v = o.even ? sp : sp * (0.4 + Math.random() * 0.6);
        add({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, k: o.k || "dot", c: o.c || (o.multi ? pick() : o.col), max: o.max || 55 + Math.random() * 20, g: o.g, drag: o.drag || 0.95, size: o.size || 1.8, strobe: o.strobe, twinkle: o.twinkle, then: o.then });
      }
    }
    function shell(x, y, top, cb, col) {
      add({ x: x, y: y, vx: (Math.random() - 0.5) * 0.6, vy: -Math.sqrt(2 * 0.06 * (y - top)) , k: "spark", c: col || "#fff6c8", size: 1.2, g: 0.06, drag: 1, max: Math.max(10, Math.round(Math.sqrt(2 * (y - top) / 0.06))), then: function (p) { cb(p.x, p.y); } });
    }
    // 20 kinds, all kept small so they sit in the footer and don't take over the page
    var KINDS = {
      peony: function (x, y, t) { var c = pick(); shell(x, y, t, function (a, b) { burst(a, b, 36, 2.4, { col: c }); }); },
      chrysanthemum: function (x, y, t) { var c = pick(); shell(x, y, t, function (a, b) { burst(a, b, 44, 2.6, { k: "spark", col: c, size: 1.2 }); }); },
      willow: function (x, y, t) { shell(x, y, t, function (a, b) { burst(a, b, 36, 1.8, { k: "spark", col: "#f6b62c", g: 0.025, drag: 0.97, max: 110, size: 1 }); }); },
      palm: function (x, y, t) { var c = pick(); shell(x, y, t, function (a, b) { burst(a, b, 8, 2.6, { even: true, k: "spark", col: c, size: 2.4, max: 60 }); }); },
      ring: function (x, y, t) { var c = pick(); shell(x, y, t, function (a, b) { burst(a, b, 30, 2.2, { even: true, col: c, g: 0.02 }); }); },
      crossette: function (x, y, t) { var c = pick(); shell(x, y, t, function (a, b) { burst(a, b, 6, 2.2, { even: true, col: c, max: 26, then: function (p) { burst(p.x, p.y, 4, 1.4, { even: true, col: c, max: 30 }); } }); }); },
      crackle: function (x, y, t) { shell(x, y, t, function (a, b) { burst(a, b, 26, 2, { col: "#eee4d3", max: 34, then: function (p) { if (Math.random() < 0.6) burst(p.x, p.y, 3, 0.8, { col: "#fff", max: 10, size: 1.2 }); } }); }); },
      strobe: function (x, y, t) { shell(x, y, t, function (a, b) { burst(a, b, 22, 2, { col: "#eee4d3", strobe: true, g: 0.02, max: 80 }); }); },
      heart: function (x, y, t) { shell(x, y, t, function (a, b) { for (var i = 0; i < 28; i++) { var q = i / 28 * 6.283, hx = 16 * Math.pow(Math.sin(q), 3), hy = -(13 * Math.cos(q) - 5 * Math.cos(2 * q) - 2 * Math.cos(3 * q) - Math.cos(4 * q)); add({ x: a, y: b, vx: hx * 0.12, vy: hy * 0.12, c: "#ff7ad9", g: 0.01, drag: 0.95, max: 60, size: 1.8 }); } }); },
      star: function (x, y, t) { var c = pick(); shell(x, y, t, function (a, b) { for (var i = 0; i < 30; i++) { var q = i / 30 * 6.283, r = (i % 6 < 3 ? 1 : 0.45) * 2.4; add({ x: a, y: b, vx: Math.cos(q) * r, vy: Math.sin(q) * r, c: c, g: 0.015, drag: 0.95, max: 55, size: 1.6 }); } }); },
      fountain: function (x, y) { for (var i = 0; i < 70; i++) (function (i) { setTimeout(function () { add({ x: x, y: y, vx: (Math.random() - 0.5) * 1.6, vy: -2.6 - Math.random() * 1.4, k: "spark", c: Math.random() < 0.5 ? "#f6b62c" : "#fff6c8", g: 0.07, max: 40, size: 1 }); }, i * 28); })(i); },
      roman: function (x, y) { for (var i = 0; i < 5; i++) (function (i) { setTimeout(function () { var c = pick(); add({ x: x, y: y, vx: (Math.random() - 0.5) * 0.8, vy: -3.6 - Math.random(), c: c, size: 2.6, g: 0.06, drag: 1, max: 45, then: function (p) { burst(p.x, p.y, 6, 0.8, { col: c, max: 16 }); } }); }, i * 380); })(i); },
      spinner: function (x, y) { for (var i = 0; i < 80; i++) (function (i) { setTimeout(function () { var a = i * 0.5; add({ x: x + Math.cos(a) * 6, y: y - 14 + Math.sin(a) * 6, vx: -Math.sin(a) * 2.2, vy: Math.cos(a) * 2.2, k: "spark", c: i % 2 ? "#3dd6ff" : "#c6ff3d", g: 0.03, max: 22, size: 1 }); }, i * 22); })(i); },
      firecrackers: function (x, y) { for (var i = 0; i < 12; i++) (function (i) { setTimeout(function () { var px = x + i * 7 - 40; burst(px, y - 3, 6, 1.4, { col: "#fff6c8", max: 10, size: 1.2 }); add({ x: px, y: y - 4, vx: 0, vy: -0.3, k: "smoke", c: "#eee4d3", g: 0, max: 50, size: 3 }); }, i * 90 + Math.random() * 60); })(i); },
      popper: function (x, y) { for (var i = 0; i < 30; i++) add({ x: x, y: y - 6, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3, k: "sq", c: pick(), size: 3, h: 0.6, spin: 0.3, g: 0.06, drag: 0.97, max: 80 }); },
      smokeball: function (x, y) { var c = pick(); for (var i = 0; i < 14; i++) add({ x: x + (Math.random() - 0.5) * 10, y: y - 8, vx: (Math.random() - 0.5) * 0.8, vy: -0.4 - Math.random() * 0.6, k: "smoke", c: c, g: -0.002, drag: 0.99, max: 90, size: 3 + Math.random() * 3 }); },
      comet: function (x, y, t) { shell(x, y, t, function (a, b) { burst(a, b, 12, 0.9, { col: "#fff6c8", max: 26, size: 1 }); }, "#c6ff3d"); },
      brocade: function (x, y, t) { shell(x, y, t, function (a, b) { burst(a, b, 40, 2, { k: "spark", col: "#f6b62c", twinkle: true, g: 0.03, drag: 0.96, max: 90, size: 1 }); }); },
      glitter: function (x, y, t) { shell(x, y, t, function (a, b) { burst(a, b, 50, 1.8, { col: "#eee4d3", twinkle: true, g: 0.015, max: 80, size: 1 }); }); },
      mosaic: function (x, y, t) { shell(x, y, t, function (a, b) { for (var i = 0; i < 24; i++) { var q = Math.random() * 6.283, v = 1 + Math.random() * 1.6; add({ x: a, y: b, vx: Math.cos(q) * v, vy: Math.sin(q) * v, k: "sq", c: ["#ec2a1c", "#f6b62c", "#c6ff3d"][i % 3], size: 4, spin: 0.1, g: 0.03, drag: 0.96, max: 70 }); } }); }
    };
    function rect(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    // little things coming off what people hold
    function emitAt(el, kind, lines) {
      if (!ensure() || reduceMotion || document.hidden) return;
      var r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
      var x = r.left + r.width / 2, y = r.top + r.height / 2, d = Math.random() < 0.5 ? -1 : 1;
      if (kind === "adlib") add({ x: x - 10, y: y - 14, vx: d * 0.2, vy: -0.5, k: "text", text: (lines || ADLIBS)[(Math.random() * (lines || ADLIBS).length) | 0], c: "#c6ff3d", bold: true, size: 10, g: 0, drag: 1, max: 70 });
      else if (kind === "notes") add({ x: x, y: y - 6, vx: d * 0.35, vy: -0.6, k: "text", text: Math.random() < 0.5 ? "♪" : "♫", c: pick(), size: 12, g: 0, drag: 1, max: 75 });
      else if (kind === "spray") for (var i = 0; i < 4; i++) add({ x: x, y: y - 8, vx: (Math.random() - 0.3) * 2, vy: -2 - Math.random() * 2, c: "#fff6c8", size: 1.2, g: 0.08, max: 40 });
      else if (kind === "spark") for (var j = 0; j < 3; j++) add({ x: x, y: y - 10, vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.7) * 2.4, k: "spark", c: "#fff6c8", size: 0.8, g: 0.04, max: 16 });
      else if (kind === "bubble") add({ x: x, y: y - 10, vx: (Math.random() - 0.5) * 0.6, vy: -0.4 - Math.random() * 0.4, k: "bubble", c: "#3dd6ff", size: 2 + Math.random() * 3, g: -0.003, drag: 0.995, max: 110, a: 0.8 });
      else if (kind === "rings") add({ x: x, y: y - 8, vx: 0, vy: 0, k: "ring", c: "#eee4d3", size: 3, grow: 0.5, g: 0, max: 30, a: 0.7 });
      else if (kind === "confetti") KINDS.popper(x, y);
      else if (kind === "clink") burst(x, y - 8, 6, 1, { col: "#fff6c8", max: 14, size: 1.2 });
      else if (kind === "water") add({ x: x + 6, y: y - 2, vx: 2.6 + Math.random(), vy: -0.6 - Math.random() * 0.6, c: "#3dd6ff", size: 1.4, g: 0.08, max: 34 });
      else if (kind === "hic") add({ x: x + 6, y: y - 12, vx: 0.2, vy: -0.4, k: "text", text: Math.random() < 0.7 ? "hic" : "*hic*", c: "#b48cff", size: 9, g: 0, drag: 1, max: 60 });
      else if (kind === "heart") add({ x: x + (Math.random() - 0.5) * 10, y: y - 12, vx: (Math.random() - 0.5) * 0.4, vy: -0.5, k: "text", text: "♥", c: Math.random() < 0.5 ? "#ff7ad9" : "#ec2a1c", size: 11, g: 0, drag: 1, max: 70 });
      else if (kind === "zoom") add({ x: x + 8, y: y - 10, vx: 0.6, vy: -0.6, k: "text", text: Math.random() < 0.5 ? "!!" : "zoom", c: "#eee4d3", bold: true, size: 9, g: 0, drag: 1, max: 34 });
      else if (kind === "slowz") add({ x: x + 6, y: y - 10, vx: 0.1, vy: -0.25, k: "text", text: "~", c: "#7a2bd6", size: 14, g: 0, drag: 1, max: 90 });
      else if (kind === "puff") for (var q = 0; q < 3; q++) add({ x: x, y: y - 8, vx: (Math.random() - 0.5) * 0.6, vy: -0.4, k: "smoke", c: "#eee4d3", g: -0.002, max: 40, size: 1.6 });
      else if (kind === "glint") add({ x: x, y: y - 10, vx: 0, vy: 0, k: "ring", c: "#fff6c8", size: 2, grow: 0.3, g: 0, max: 24, a: 0.5 });
    }
    function firework(stageEl, kind) {
      if (!ensure() || reduceMotion || document.hidden) return;
      var r = stageEl.getBoundingClientRect();
      var x = r.left + 30 + Math.random() * (r.width - 60), y = r.bottom - 6;
      var top = r.top - 10 - Math.random() * 50;
      kind = kind || Object.keys(KINDS)[(Math.random() * 20) | 0];
      KINDS[kind](x, y, top);
      return kind;
    }
    return { emitAt: emitAt, firework: firework, kinds: Object.keys(KINDS) };
  })();

  function figSVG(c) {
    var C = c.color, A = c.accent, girl = c.kind === "girl";
    var hair = "";
    if (girl && c.hair === "big") hair = '<path class="rv__hair" d="M38 32 Q28 20 37 12 Q44 2 54 7 Q66 5 66 17 Q73 26 64 34 Q70 42 61 44 M39 32 Q30 41 38 45" fill="' + C + '" fill-opacity=".22" stroke-width="2.4"/>';
    if (girl && c.hair === "bun") hair = '<circle cx="50" cy="11" r="6.5" fill="' + C + '" fill-opacity=".22" stroke-width="2.4"/><path d="M40 22 Q50 13 60 22" stroke-width="2.4"/><path d="M60 22 Q66 34 62 42" stroke-width="2.2"/>';
    var hat = "";
    if (c.hat === "bandana") hat = '<path d="M39.6 23 Q50 12 60.4 23 Z" fill="' + A + '" stroke="' + A + '" stroke-width="2"/><path d="M60 22 l7 -4 M60 22 l7 2" stroke="' + A + '" stroke-width="2.4"/>';
    if (c.hat === "cap") hat = '<path d="M39.5 23 Q50 11 60.5 23 Z" fill="' + A + '" stroke="' + A + '" stroke-width="2"/><path d="M58 22 H70" stroke="' + A + '" stroke-width="3"/>';
    var outfit = girl
      ? '<path d="M43 52 H57 V60 H43 Z" fill="' + A + '" fill-opacity=".9" stroke="' + A + '" stroke-width="1.6"/><path class="rv__skirt" d="M42 72 H58 L62 84 H38 Z" fill="' + A + '" fill-opacity=".9" stroke="' + A + '" stroke-width="1.6"/>'
      : '<path d="M42 52 H58 L59 78 H41 Z" stroke-width="2.4"/>' + (c.main ? '<path d="M45 52 Q50 62 55 52" stroke="#f6b62c" stroke-width="1.8"/>' : "");
    var boot = function (x) {
      return girl ? '<path d="M' + x + ' 121 h9 v6 h-9 Z" fill="' + A + '" stroke="' + A + '" stroke-width="1.5"/>' : '<path d="M' + (x - 1) + ' 126 h10" stroke="' + A + '" stroke-width="6"/>';
    };
    var glam = c.glam ? '<path d="M40 25 l-2 -2 M60 25 l2 -2" stroke-width="1.6"/><circle cx="39" cy="35" r="3.2" stroke-width="1.6"/><circle cx="61" cy="35" r="3.2" stroke-width="1.6"/>' : "";
    var face = glam + (girl ? '<circle cx="39" cy="32" r="2.2" stroke-width="1.4"/><circle cx="61" cy="32" r="2.2" stroke-width="1.4"/><path d="M47 34.5 Q50 36.5 53 34.5" stroke="' + A + '" stroke-width="2.2"/>' : '<path d="M46 34 Q50 36.5 54 34" stroke-width="2"/>');
    return '<svg class="raver__fig" viewBox="0 0 100 140" aria-hidden="true">' +
      '<g class="rv__chair" fill="none" stroke="#9a8d80" stroke-width="3" stroke-linecap="round"><path d="M28 104 H58 M30 104 L28 132 M56 104 L58 132 M30 104 L26 70"/></g>' +
      '<g class="rv" fill="none" stroke="' + C + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<g class="rv__legL"><path d="M50 82 L42 104 L40 122"/>' + boot(35) + '</g>' +
        '<g class="rv__legR"><path d="M50 82 L58 104 L62 122"/>' + boot(58) + '</g>' +
        '<g class="rv__top"><path d="M50 40 L50 82"/>' + outfit +
          '<g class="rv__guitar"><path d="M21 48 L48 64" stroke="#9a5a1c" stroke-width="2.4"/><ellipse cx="54" cy="67" rx="8.5" ry="6.5" transform="rotate(32 54 67)" fill="#b0641c" stroke="#6b3a12" stroke-width="1.2"/><circle cx="54" cy="67" r="1.8" fill="#0e0b0a" stroke="none"/></g>' +
          '<g class="rv__armL"><path d="M50 47 L38 60 L34 72"/><rect class="rv__beer" x="30" y="70" width="7" height="11" rx="1.5" fill="#f6b62c" stroke="#f6b62c" stroke-width="1"/>' +
            '<path class="rv__glow" d="M33 71 L29 81" stroke="' + A + '" stroke-width="2.8"/>' +
            '<rect class="rv__wad" x="29" y="69" width="9" height="6" rx="1" fill="#7bd36b" stroke="#2d6b24" stroke-width="1"/></g>' +
          '<g class="rv__armR"><path d="M50 47 L62 60 L66 72"/>' +
            '<path class="rv__cig" d="M66 72 L73 70" stroke="#eee4d3" stroke-width="2"/><circle class="rv__cig" cx="73.5" cy="69.8" r="1.4" fill="#ec2a1c" stroke="none"/>' +
            '<path class="rv__gun" d="M66 72 L73 70 M66 72 L66 66" stroke-width="2.6"/>' +
            '<rect class="rv__phone" x="64" y="66" width="6" height="10" rx="1.2" fill="#0e0b0a" stroke-width="1.6"/>' +
            '<g class="rv__mgun"><path d="M61 66 h18 v7 h-9 v8 h-5 v-8 h-4 Z" fill="#7bd36b" stroke="#2d6b24" stroke-width="1"/><rect x="66" y="62" width="9" height="4" fill="#eee4d3" stroke="#2d6b24" stroke-width=".6"/></g>' +
            '<g class="rv__item"></g>' +
            '<g class="rv__cam"><rect x="61" y="63" width="12" height="8" rx="1.2" fill="#0e0b0a" stroke-width="1.6"/><circle cx="67" cy="67" r="2.2" stroke-width="1.4"/></g>' +
            '<circle class="rv__flash" cx="67" cy="66" r="7" fill="#fff" stroke="none"/>' +
            '<rect class="rv__note" x="68" y="64" width="9" height="5" rx="1" fill="#7bd36b" stroke="#2d6b24" stroke-width="1"/>' +
          '</g>' +
          '<g class="rv__head">' + hair + '<circle cx="50" cy="27" r="10.5"/>' + hat + '<g class="rv__hat2"></g>' +
            '<path d="M40 25.5 H49 V30.5 Q44.5 32 40 30.5 Z M51 25.5 H60 V30.5 Q55.5 32 51 30.5 Z" fill="#0e0b0a" stroke-width="1.6"/><path d="M49 27 H51" stroke-width="1.6"/>' + face +
          '</g>' +
        '</g>' +
      '</g></svg>' +
      '<span class="raver__smoke" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="raver__zz mono" aria-hidden="true"><i>z</i><i>z</i></span>' +
      '<span class="raver__bubble" aria-hidden="true">?</span>';
  }

  var crewApi = null, treatHook = function () { return false; };
  function initHype() {
    var stage = $("#stage"), cash = $("#cash");
    if (!stage) return;
    var hasMusic = !$("#sc").hidden;
    var max = innerWidth < 420 ? 5 : innerWidth < 900 ? 7 : 10;
    var raving = false, visible = false, crew = [], pending = null, busy = false;
    var cycleTimer = null, partyTimers = [];

    // how long this visitor has hung out with the crew, across visits
    var hung = 0;
    try { hung = parseInt(localStorage.getItem("ms-crew-time"), 10) || 0; } catch (e) { hung = 0; }
    var props = {};
    var label = document.createElement("p");
    label.className = "stage__label mono";
    stage.appendChild(label);

    function rnd(a) { return a[(Math.random() * a.length) | 0]; }
    function stageW() { return stage.clientWidth; }

    /* ---- one person ---- */
    function Person(cfg, i) {
      var el = document.createElement("button");
      el.type = "button";
      el.className = "raver is-chill st-" + (STYLE[cfg.name] || "bouncy");
      el.setAttribute("data-name", cfg.name);
      el.setAttribute("aria-label", cfg.name + (hasMusic ? ", play music" : ""));
      el.innerHTML = figSVG(cfg);
      stage.appendChild(el);
      var me = { el: el, cfg: cfg, i: i, x: 0, timer: null, lock: false };
      var itemEl = el.querySelector(".rv__item"), hatEl = el.querySelector(".rv__hat2"), gtrEl = el.querySelector(".rv__guitar");
      me.pose = function (p) {
        if (me.emitT) { clearInterval(me.emitT); me.emitT = null; itemEl.innerHTML = ""; }
        POSE_CLASSES.forEach(function (c) { el.classList.remove(c); });
        p.split(" ").forEach(function (c) { if (c) el.classList.add(c); });
      };
      // hold something and use it
      me.gag = function (name, base) {
        var G = GAGS[name]; if (!G) return;
        me.pose(base || "is-chill");
        el.classList.add(G.guitar ? "is-guitar" : "is-gag");
        if (!G.guitar) {
          el.style.setProperty("--arm", G.arm + "deg"); el.style.setProperty("--amp", (G.amp || 0) + "deg"); el.style.setProperty("--spd", (G.spd || 1) + "s");
          itemEl.innerHTML = '<g transform="translate(66 72) rotate(' + (-G.arm) + ')">' + G.item + "</g>";
        }
        var src = G.guitar ? gtrEl : itemEl;
        me.emitT = setInterval(function () { if (G.emit && !document.hidden && visible) FX.emitAt(src, G.emit); }, G.every || 999999);
        if (G.emit) setTimeout(function () { if (me.emitT) FX.emitAt(src, G.emit); }, 400);
      };
      // how a treat hits them: woozy, zoomy, lovey or slow. It lasts a while, then wears off
      var BUZZ_EMIT = { woozy: ["hic", 1800], zoomy: ["zoom", 900], lovey: ["heart", 700], slow: ["slowz", 1500] };
      me.buzz = function (kind, ms) {
        me.unbuzz();
        me.buzzed = kind;
        el.classList.add("fx-" + kind);
        var head = el.querySelector(".rv__head");
        me.buzzT = setInterval(function () { if (visible && !document.hidden) FX.emitAt(head, BUZZ_EMIT[kind][0]); }, BUZZ_EMIT[kind][1]);
        me.buzzEnd = setTimeout(me.unbuzz, ms);
      };
      me.unbuzz = function () {
        clearInterval(me.buzzT); clearTimeout(me.buzzEnd);
        if (me.buzzed) el.classList.remove("fx-" + me.buzzed);
        me.buzzed = null;
      };
      me.hat = function (name) { hatEl.innerHTML = name ? HATS[name] : ""; };
      me.place = function (x, dur) { el.style.transitionDuration = (dur || 0) + "s"; me.x = x; el.style.setProperty("--x", Math.round(x) + "px"); };
      me.maxX = function () { return Math.max(0, stageW() - el.offsetWidth); };
      me.face = function (tx) { el.classList.toggle("is-left", tx < me.x); };
      me.walkTo = function (tx, cb, speed) {
        tx = Math.max(0, Math.min(me.maxX(), tx));
        var dist = Math.abs(tx - me.x);
        if (dist < 6) { if (cb) cb(); return; }
        me.face(tx);
        var sp = speed || (38 + Math.random() * 18);
        if (me.buzzed === "woozy") sp *= 0.6; else if (me.buzzed === "slow") sp *= 0.45; else if (me.buzzed === "zoomy") sp *= 1.8;
        var dur = dist / sp;
        me.pose("is-walk");
        me.place(tx, dur);
        clearTimeout(me.timer);
        me.timer = setTimeout(function () { if (raving) me.dance(rnd(["bounce", "twostep", "sway", "bop"])); else me.pose("is-chill"); if (cb) cb(); }, dur * 1000);
      };
      me.next = function () {
        clearTimeout(me.timer); me.timer = null;
        if (raving || !visible || me.lock || busy) return;
        if (reduceMotion) { me.pose("is-chill"); return; }
        var pool = cfg.main ? MAIN_IDLE : cfg.glam ? GLAM_IDLE : IDLE;
        var act = rnd(pool);
        if (me.buzzed === "zoomy" && Math.random() < 0.6) act = "walk";
        if (Math.random() < 0.05 && treatHook(me)) return;
        if (Math.random() < 0.16) {
          var mate = crew.filter(function (o) { return o !== me && o.cfg.g === cfg.g && !o.lock && Math.abs(o.x - me.x) < 160; })[0];
          if (mate && Math.random() < 0.35) {
            // a little moment with their partner: a toast, or a rose
            var both = cfg.kind !== mate.cfg.kind && cfg.kind === "guy" && Math.random() < 0.5 ? "rose" : "cup";
            var mid = (me.x + mate.x) / 2;
            clearTimeout(mate.timer);
            me.walkTo(mid - 16, function () { me.face(mate.x); me.gag(both); me.timer = setTimeout(me.next, 4200); }, 45);
            mate.walkTo(mid + 16, function () { mate.face(me.x); mate.gag(both === "rose" ? "cup" : "cup"); if (both === "rose") mate.pose("is-wave"); mate.timer = setTimeout(mate.next, 4200); }, 45);
            if (both === "cup") setTimeout(function () { if (me.emitT) FX.emitAt(me.el.querySelector(".rv__item"), "clink"); }, 2200);
            return;
          }
          var gname = cfg.name === "Grain" && Math.random() < 0.4 ? "mic" : cfg.name === "Flash" && Math.random() < 0.4 ? "guitar" : rnd(IDLE_GAGS);
          me.gag(gname);
          me.timer = setTimeout(me.next, 4500 + Math.random() * 2500);
          return;
        }
        // the crew drifts towards Tiles now and then
        if (act === "walk") {
          var to = Math.random() < 0.6 ? home(cfg.g) + (Math.random() - 0.5) * 120 : Math.random() * me.maxX();
          me.walkTo(to, function () { me.timer = setTimeout(me.next, 700 + Math.random() * 1400); });
          return;
        }
        // only one person asleep or doing push-ups at a time, so nobody looks dropped
        if ((act === "sleep" || act === "pushup") && crew.some(function (m) { return m !== me && (m.el.classList.contains("is-sleep") || m.el.classList.contains("is-pushup")); })) act = "chill";
        me.pose("is-" + act);
        var t = { sit: 11000, sleep: 9000, smoke: 8000, drink: 6000, phone: 7000, pushup: 5000 }[act] || 4000;
        me.timer = setTimeout(me.next, t + Math.random() * 2500);
      };
      me.dance = function (d) { clearTimeout(me.timer); me.timer = null; me.pose("is-rave d-" + d); };
      el.addEventListener("click", function () {
        el.classList.add("is-tag");
        clearTimeout(el._tag); el._tag = setTimeout(function () { el.classList.remove("is-tag"); }, 1600);
        if (window.hypeToggle) window.hypeToggle();
      });
      return me;
    }

    function addPerson(i, arrive) {
      var p = Person(CAST[i], i);
      crew.push(p);
      if (arrive) {
        var fromLeft = Math.random() < 0.5;
        p.place(fromLeft ? -70 : stageW() + 10);
        requestAnimationFrame(function () {
          p.walkTo(home(p.cfg.g) + (Math.random() - 0.5) * 60, function () {
            p.timer = setTimeout(p.next, 1200);
            if (p.cfg.name && visible && !raving) wave(p);
          });
        });
      } else {
        p.place(Math.max(0, stageW() - 60) * ((i + 0.5) / Math.max(2, Math.min(max, 2 + Math.floor(hung / 12)))) + (Math.random() - 0.5) * 20);
        p.timer = setTimeout(p.next, 600 + i * 500);
      }
      updateLabel();
      return p;
    }
    function wave(p) { p.pose("is-wave"); clearTimeout(p.timer); p.timer = setTimeout(p.next, 2200); }

    /* ---- the scene grows the longer you stay ---- */
    var temps = {};
    function buildProp(name, temp) {
      if (props[name]) return;
      // a prop that came out for a party becomes permanent once it's earned
      if (temps[name] && !temp) { props[name] = temps[name]; props[name].classList.add("is-in"); updateLabel(); return; }
      if (temp && temps[name]) return temps[name];
      var el;
      if (name === "boombox") {
        el = document.createElement("button");
        el.type = "button";
        el.className = "prop prop--boombox";
        el.setAttribute("aria-label", "Boombox, play music");
        el.innerHTML = '<span class="bb__handle"></span><span class="bb__body"><i></i><b></b><i></i></span>';
        el.addEventListener("click", function () { if (window.hypeToggle) window.hypeToggle(); egg.boombox++; });
      } else if (name === "lights") {
        el = document.createElement("div");
        el.className = "prop prop--lights";
        var b = "";
        for (var k = 0; k < 28; k++) b += '<i style="--k:' + k + '"></i>';
        el.innerHTML = b;
      } else if (name === "disco") {
        el = document.createElement("div");
        el.className = "prop prop--disco";
        el.innerHTML = '<span class="disco__string"></span><span class="disco__ball"></span>';
      } else if (name === "banner") {
        el = document.createElement("div");
        el.className = "prop prop--banner mono";
        el.textContent = "THE MOSAICS";
      } else if (name === "sign") {
        // the sign is the door to the Mosaics' world (a separate page at /world/, nothing loads until clicked)
        el = document.createElement("a");
        el.href = "/world/";
        el.className = "prop prop--sign mono";
        el.innerHTML = "Our world<br>enter &rarr;";
        el.setAttribute("aria-label", "Enter the Mosaics' world");
      } else if (name === "neon") {
        el = document.createElement("div");
        el.className = "prop prop--neon mono";
        el.textContent = "after hours";
      }
      el.setAttribute("aria-hidden", name === "boombox" || name === "sign" ? "false" : "true");
      stage.appendChild(el);
      if (temp) { temps[name] = el; return el; }
      props[name] = el;
      requestAnimationFrame(function () { el.classList.add("is-in"); });
      if (name === "neon") { stage.classList.add("is-after"); }
      updateLabel();
    }
    function spicy() { return hung >= 600; }
    function updateLabel() {
      var n = crew.length;
      var lvl = STAGES.filter(function (s) { return props[s.prop]; }).length;
      label.textContent = "The Mosaics · " + n + "/" + max + " here" + (lvl ? " · lvl " + (lvl + 1) : "") + (spicy() ? " · after hours" : "");
      egg.crew = Math.max(egg.crew, n); egg.level = Math.max(egg.level, lvl + 1);
    }
    function tick() {
      if (!visible || document.hidden) return;
      hung += 1;
      if (hung % 5 === 0) { try { localStorage.setItem("ms-crew-time", hung); } catch (e) { /* ignore */ } }
      var want = Math.min(max, 2 + Math.floor(hung / 12));
      if (crew.length < want) addPerson(crew.length, true);
      STAGES.forEach(function (s) { if (hung >= s.at) buildProp(s.prop); });
      if (pending && !busy) { var p = pending; pending = null; react(p); }
    }

    /* ---- money ---- */
    function bills(fromEl, n, opts) {
      if (reduceMotion || document.hidden) return;
      opts = opts || {};
      var r = fromEl.getBoundingClientRect();
      var left = fromEl.classList.contains("is-left");
      var high = !!opts.high;
      for (var k = 0; k < n; k++) {
        var d = document.createElement("span");
        d.className = "cash__note" + (opts.conf ? " cash__note--conf" : "");
        if (opts.conf) d.style.background = rnd(["#c6ff3d", "#ff7ad9", "#3dd6ff", "#f6b62c", "#ec2a1c", "#eee4d3"]);
        d.style.left = (r.left + r.width * (left ? 0.15 : 0.85)) + "px";
        d.style.top = (r.top + r.height * 0.45) + "px";
        var dx = (left ? -1 : 1) * (20 + Math.random() * (opts.spray ? 140 : 70)) + (Math.random() - 0.5) * 40;
        var up = high && Math.random() < 0.6 ? -(260 + Math.random() * 380) : -(50 + Math.random() * 90);
        d.style.setProperty("--dx", dx.toFixed(0) + "px");
        d.style.setProperty("--up", up.toFixed(0) + "px");
        d.style.setProperty("--rot", ((Math.random() - 0.5) * 540).toFixed(0) + "deg");
        d.style.setProperty("--dur", (high ? 2.6 : 1.7) + Math.random() * 0.8 + "s");
        d.style.animationDelay = (k * 0.06).toFixed(2) + "s";
        cash.appendChild(d);
        (function (d) { setTimeout(function () { d.remove(); }, 4200); })(d);
      }
    }

    /* ---- crews: each has its own patch of the strip, so sets never overlap ---- */
    function groups() {
      var gs = [];
      crew.forEach(function (m) { (gs[m.cfg.g] = gs[m.cfg.g] || []).push(m); });
      return gs.filter(Boolean);
    }
    function home(g) {
      var n = Math.max(1, groups().length), w = stageW();
      // the main crew (0) gets the middle, under the disco ball
      var order = [0]; for (var k = 1; k < 4; k++) order.push(k);
      var slots = [];
      for (var i = 0; i < n; i++) slots.push(w * (i + 0.5) / n);
      slots.sort(function (a, b) { return Math.abs(a - w / 2) - Math.abs(b - w / 2); });
      var idx = groups().map(function (gr) { return gr[0].cfg.g; }).sort().indexOf(g);
      return Math.max(56, Math.min(w - 70, (slots[idx < 0 ? 0 : idx] || w / 2) - 25));
    }
    function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function later(fn, ms) { partyTimers.push(setTimeout(fn, ms)); }
    function every(fn, ms) { var t = setInterval(fn, ms); partyTimers.push(t); return t; }
    function stopParty() { partyTimers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); partyTimers = []; }
    // put one person somewhere, then do something when they get there
    function go(m, x, face, act) {
      var fin = function () { if (face) m.face(face === "L" ? -1e4 : face === "R" ? 1e4 : face); act(); };
      // close enough: stay put and just turn, so nobody shuffles around for no reason
      if (Math.abs(x - m.x) < 22) { fin(); return; }
      later(function () { if (raving) m.walkTo(x, fin, 55 + Math.random() * 35); }, Math.random() * 450);
    }
    var gdir = {};

    // one crew, one set. dir = which way the set faces
    function doSet(gr, set) {
      var gk = gr[0].cfg.g;
      if (!gdir[gk] || Math.random() < 0.2) gdir[gk] = gdir[gk] ? -gdir[gk] : (Math.random() < 0.5 ? 1 : -1);
      var c = home(gk), dir = gdir[gk];
      var girl = gr.filter(function (m) { return m.cfg.kind === "girl"; })[0];
      var guys = gr.filter(function (m) { return m.cfg.kind !== "girl"; });
      var g1 = guys[0], g2 = guys[1];
      var D = function (m, d) { return function () { if (raving) m.dance(d); }; };
      if (set === "throw" && g1 && Math.random() < 0.35) set = "spray";
      if (set === "throw" && g1) {
        go(g1, c - 22 * dir, c, D(g1, "throw"));
        if (girl) go(girl, c + 18 * dir, spicy() ? (dir > 0 ? "R" : "L") : c - 400 * dir, D(girl, spicy() ? rnd(["hipshake", "bootypop"]) : rnd(["shimmy", "bodyroll", "dougie"])));
        if (g2) go(g2, c + 60 * dir, c, D(g2, "handsup"));
        var t = every(function () { if (!raving) return; if (g1.el.classList.contains("d-throw")) bills(g1.el, 3, { high: Math.random() < 0.12 }); }, 420);
        later(function () { clearInterval(t); }, 3000);
        egg.throws++;
      } else if (set === "spray" && g1) {
        go(g1, c - 34 * dir, c, D(g1, "shoot"));
        if (girl) go(girl, c + 14 * dir, c - 400 * dir, D(girl, spicy() ? rnd(["drop", "hipshake"]) : rnd(["handsup", "shimmy"])));
        if (g2) go(g2, c + 56 * dir, c, D(g2, "handsup"));
        var t2 = every(function () { if (!raving) return; if (g1.el.classList.contains("d-shoot")) bills(g1.el, 3, { spray: true, high: Math.random() < 0.15 }); }, 300);
        later(function () { clearInterval(t2); }, 2600);
      } else if (set === "hype") {
        if (girl) go(girl, c, null, D(girl, rnd(["bodyroll", "shimmy", "dougie", "sway"])));
        guys.forEach(function (m, k) { go(m, c + (k ? 1 : -1) * (30 + Math.random() * 10), c, D(m, rnd(["handsup", "bounce", "clap"]))); });
      } else if (set === "twirl" && g1 && girl) {
        go(girl, c + 10 * dir, null, D(girl, "spin"));
        go(g1, c - 14 * dir, c + 400 * dir, D(g1, "twirlguy"));
        if (g2) go(g2, c + 52 * dir, c, D(g2, "clap"));
      } else if (set === "grind" && g1 && girl) {
        // she's in front with her back to him, both facing the same way
        go(girl, c + 9 * dir, dir > 0 ? "R" : "L", D(girl, "grind"));
        go(g1, c - 9 * dir, dir > 0 ? "R" : "L", D(g1, "grindguy"));
        if (g2) go(g2, c - 60 * dir, c, D(g2, "lean"));
      } else if (set === "wine" && girl) {
        go(girl, c, g1 ? c - 400 * dir : null, D(girl, "wine"));
        if (g1) go(g1, c - 30 * dir, c, D(g1, "lean"));
        if (g2) go(g2, c + 34 * dir, c, D(g2, "clap"));
      } else if (set === "drop" && girl) {
        go(girl, c, null, D(girl, "drop"));
        guys.forEach(function (m, k) { go(m, c + (k ? 1 : -1) * 34, c, D(m, rnd(["clap", "handsup"]))); });
      } else if (set === "bootypop" && girl) {
        // she faces away from the boys
        go(girl, c + 16 * dir, dir > 0 ? "R" : "L", D(girl, "bootypop"));
        guys.forEach(function (m, k) { go(m, c - (24 + k * 32) * dir, c, D(m, "handsup")); });
      } else {
        // the crew does one move in sync
        var mv = rnd(DANCE_POOL);
        gr.forEach(function (m, k) { go(m, c + (k - (gr.length - 1) / 2) * 30, c + 400 * dir, D(m, mv)); });
      }
    }
    // the spicy sets are a reward: they only come out after someone has hung around 10 minutes
    function moneySets() { return spicy() ? ["spray", "grind", "drop", "bootypop", "wine"] : ["spray", "hype", "twirl", "sync"]; }
    function freeSets() { return spicy() ? ["grind", "wine", "drop", "bootypop", "twirl", "sync"] : ["hype", "twirl", "sync", "sync"]; }
    function moneyMoment() {
      if (!raving) return;
      stopParty();
      var gs = groups(), sets = shuffle(moneySets());
      if (Math.random() < 0.5 && crew.length) bills(rnd(crew).el, 16, { conf: true, high: Math.random() < 0.2 });
      // Tiles' crew always makes it rain; every other crew does something different
      gs.forEach(function (gr, i) { doSet(gr, gr[0].cfg.main ? "throw" : sets[i % sets.length]); });
    }
    function freeDance() {
      if (!raving) return;
      stopParty();
      var gs = groups(), sets = shuffle(freeSets());
      later(stunt, 1500 + Math.random() * 2000);
      later(extras, 1600 + Math.random() * 800);
      var used = {};
      gs.forEach(function (gr, i) {
        var set = sets[i % sets.length];
        if (set !== "sync" && used[set]) set = "sync";
        used[set] = 1;
        doSet(gr, set);
      });
    }
    // music starts: people react on their own, then drift over and find their crew
    function warmUp() {
      stopParty();
      crew.forEach(function (m) {
        clearTimeout(m.timer); m.timer = null;
        later(function () { if (raving) m.dance(rnd(["bop", "bounce", "sway", "clap", "twostep"])); }, 120 + Math.random() * 1700);
      });
      groups().forEach(function (gr) {
        var c = home(gr[0].cfg.g);
        var girl = gr.filter(function (m) { return m.cfg.kind === "girl"; })[0];
        var guys = gr.filter(function (m) { return m.cfg.kind !== "girl"; });
        var t0 = 1800 + Math.random() * 1600;
        if (girl) later(function () { if (raving) girl.walkTo(c + (Math.random() - 0.5) * 24, function () { girl.dance(rnd(["sway", "bodyroll", "bop"])); }, 45 + Math.random() * 25); }, t0);
        guys.forEach(function (m, k) {
          later(function () {
            if (!raving) return;
            m.walkTo(c + (k ? 1 : -1) * (30 + Math.random() * 14), function () {
              if (girl) {
                // a little "hey" before he starts dancing with her
                m.face(girl.x); m.pose("is-wave");
                later(function () { if (raving) m.dance(rnd(["bounce", "twostep", "bop"])); }, 600 + Math.random() * 600);
              } else m.dance("bounce");
            }, 55 + Math.random() * 50);
          }, t0 + 400 + Math.random() * 1400 + k * 700);
        });
      });
    }
    // now and then someone shows off
    function stunt() {
      if (!raving || !crew.length) return;
      var m = rnd(crew);
      if (m.buzzed || m.el.matches(".d-grind, .d-grindguy, .d-throw, .d-shoot")) return;
      var x = rnd(["x-flip", "x-spin", "x-split", "x-flip"]);
      m.el.classList.add(x);
      setTimeout(function () { m.el.classList.remove(x); }, 1200);
    }
    // after hours only: someone has a treat, then it kicks in
    treatHook = function (m) { return treat(m); };
    function treat(m, name, then) {
      if (!spicy() || reduceMotion || m.buzzed || crew.filter(function (o) { return o.buzzed; }).length >= 3) return false;
      name = name || rnd(Object.keys(TREATS));
      var kind = TREATS[name];
      clearTimeout(m.timer);
      m.gag(name, raving ? "is-rave d-sway" : null);
      egg.treats = (egg.treats || 0) + 1;
      setTimeout(function () {
        m.buzz(kind, 16000 + Math.random() * 10000);
        if (kind === "lovey") {
          // love gummies get shared with their person, then a hug
          var mate = crew.filter(function (o) { return o !== m && o.cfg.g === m.cfg.g && !o.buzzed; })[0];
          if (mate) {
            mate.buzz("lovey", 14000 + Math.random() * 6000);
            var mid = (m.x + mate.x) / 2;
            clearTimeout(mate.timer);
            m.walkTo(mid - 9, function () { m.face(mate.x); m.pose(raving ? "is-rave is-hug" : "is-hug"); }, 40);
            mate.walkTo(mid + 9, function () { mate.face(m.x); mate.pose(raving ? "is-rave is-hug" : "is-hug"); mate.timer = setTimeout(mate.next, 5500); }, 40);
            m.timer = setTimeout(then || m.next, 5500);
            return;
          }
        }
        if (raving) m.dance(rnd(["sway", "bounce", "bop"])); else m.timer = setTimeout(then || m.next, 300);
      }, 2600);
      return true;
    }
    function extras() {
      if (!raving) return;
      var named = function (n) { return crew.filter(function (m) { return m.cfg.name === n; })[0]; };
      var r = Math.random(), star = null;
      // Grain spits a few bars, or Flash plays guitar, while their crew vibes around them
      if (r < 0.3 && named("Grain")) { star = named("Grain"); star.gag("mic", "is-rave d-bounce"); }
      else if (r < 0.55 && named("Flash")) { star = named("Flash"); star.gag("guitar", "is-rave d-sway"); }
      if (star) crew.forEach(function (m) { if (m !== star && m.cfg.g === star.cfg.g) m.face(star.x); });
      var others = shuffle(crew.filter(function (m) { return m !== star && !m.el.matches(".d-grind, .d-grindguy, .d-throw, .d-shoot"); }));
      others.slice(0, Math.random() < 0.5 ? 1 : 2).forEach(function (m) {
        if (spicy() && Math.random() < 0.45 && treat(m)) return;
        m.gag(rnd(PARTY_GAGS), "is-rave d-" + rnd(["bounce", "bop", "twostep", "sway"]));
      });
    }
    var fwTimer = null;
    function fireworks(on) {
      clearTimeout(fwTimer);
      if (!on) return;
      (function next() {
        fwTimer = setTimeout(function () { if (!raving) return; if (visible) FX.firework(stage); next(); }, 6000 + Math.random() * 6000);
      })();
    }
    function partyFx(on) {
      fireworks(on);
      crew.forEach(function (m) { m.hat(on ? (m.cfg.main ? "crown" : m.cfg.name === "Static" ? "headphones" : Math.random() < 0.4 ? "partyhat" : null) : null); });
      ["lights", "disco"].forEach(function (n) {
        if (props[n]) return;
        var el = buildProp(n, true);
        if (el) requestAnimationFrame(function () { el.classList.toggle("is-in", on); });
      });
      crew.forEach(function (m) { m.el.classList.toggle("has-glow", on && Math.random() < 0.6); });
      if (on && !reduceMotion) {
        for (var i = 0; i < 4; i++) {
          var b = document.createElement("span");
          b.className = "balloon";
          b.style.left = (8 + Math.random() * 84) + "%";
          b.style.setProperty("--c", rnd(["#ec2a1c", "#c6ff3d", "#ff7ad9", "#3dd6ff", "#f6b62c"]));
          b.style.animationDelay = (i * 0.9 + Math.random()) + "s";
          stage.appendChild(b);
          (function (b) { setTimeout(function () { b.remove(); }, 14000); })(b);
        }
      }
    }
    var fx = document.createElement("div");
    fx.className = "stage__fx";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML = '<i class="wash wash--a"></i><i class="wash wash--b"></i><i class="wash wash--c"></i><i class="haze"></i>';
    stage.appendChild(fx);

    /* ---- animals that turn up to party now and then ---- */
    var CRITTERS = {
      giraffe: { vb: "14 2 80 132", s: 0.85, svg: '<g fill="none" stroke="#f6b62c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><g class="cr__legB"><path d="M38 92 L36 132 M64 92 L66 132"/></g><g class="cr__legA"><path d="M44 94 L46 132 M58 94 L56 132"/></g><ellipse cx="50" cy="84" rx="22" ry="11" fill="#f6b62c" fill-opacity=".18"/><path d="M28 80 l-9 12"/><g class="cr__neck"><path d="M66 78 L76 22" stroke-width="5"/><ellipse cx="80" cy="18" rx="9" ry="5.5" fill="#f6b62c" fill-opacity=".18"/><path d="M75 13 l-2 -7 M80 13 l1 -7"/><circle cx="81" cy="16" r="1" fill="#0e0b0a" stroke="none"/></g></g><g fill="#b0641c"><circle cx="42" cy="82" r="3"/><circle cx="54" cy="87" r="2.5"/><circle cx="60" cy="79" r="2.2"/><circle cx="71" cy="50" r="2"/></g>' },
      flamingo: { vb: "30 10 50 124", s: 0.62, svg: '<g fill="none" stroke="#ff7ad9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><g class="cr__legA"><path d="M50 80 L50 132"/></g><g class="cr__legB"><path d="M50 80 L50 104 L60 96"/></g><ellipse cx="48" cy="72" rx="15" ry="9" fill="#ff7ad9" fill-opacity=".2"/><g class="cr__wing"><path d="M40 70 Q48 62 58 70"/></g><g class="cr__neck"><path d="M60 66 Q74 50 62 38 Q54 26 64 20"/><circle cx="65" cy="18" r="4.5"/><path d="M69 18 l6 5" stroke="#0e0b0a" stroke-width="2.4"/></g></g>' },
      dog: { vb: "16 74 70 60", s: 0.62, svg: '<g fill="none" stroke="#eee4d3" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><g class="cr__legA"><path d="M36 110 L34 132 M60 110 L62 132"/></g><g class="cr__legB"><path d="M42 110 L44 132 M54 110 L52 132"/></g><ellipse cx="48" cy="104" rx="19" ry="8" fill="#eee4d3" fill-opacity=".15"/><g class="cr__tail"><path d="M30 100 l-9 -10"/></g><g class="cr__neck"><circle cx="70" cy="90" r="8"/><path d="M66 84 l-3 -8 l7 4 M77 92 h4" /><circle cx="72" cy="88" r="1" fill="#0e0b0a" stroke="none"/></g></g>' },
      penguin: { vb: "22 58 58 76", s: 0.6, svg: '<g stroke-linecap="round" stroke-linejoin="round"><g class="cr__legA"><path d="M42 130 h8" stroke="#f6b62c" stroke-width="3"/></g><g class="cr__legB"><path d="M54 130 h8" stroke="#f6b62c" stroke-width="3"/></g><ellipse cx="50" cy="104" rx="16" ry="25" fill="#0e0b0a" stroke="#eee4d3" stroke-width="3"/><ellipse cx="53" cy="108" rx="9" ry="17" fill="#eee4d3" fill-opacity=".35"/><g class="cr__wing"><path d="M35 96 l-9 16 M65 96 l9 16" stroke="#eee4d3" stroke-width="3"/></g><g class="cr__neck"><circle cx="50" cy="72" r="10" fill="#0e0b0a" stroke="#eee4d3" stroke-width="3"/><path d="M58 71 l8 2 l-8 2 z" fill="#f6b62c" stroke="none"/><circle cx="53" cy="70" r="1.2" fill="#eee4d3"/></g></g>' }
    };
    var critterOut = false;
    function critter() {
      if (critterOut || reduceMotion || !visible || document.hidden) return;
      critterOut = true; egg.animals = (egg.animals || 0) + 1;
      var kind = rnd(Object.keys(CRITTERS)), k = CRITTERS[kind];
      var vb = k.vb.split(" ").map(Number), sc = k.s * (innerWidth < 520 ? 0.8 : 1);
      k = { w: Math.round(vb[2] * sc), h: Math.round(vb[3] * sc), svg: k.svg, vb: k.vb };
      var el = document.createElement("div");
      el.className = "critter critter--" + kind + " is-walk";
      el.setAttribute("aria-hidden", "true");
      el.style.width = k.w + "px"; el.style.height = k.h + "px";
      el.innerHTML = '<svg viewBox="' + k.vb + '">' + k.svg + '</svg>';
      stage.appendChild(el);
      var w = stageW(), fromLeft = Math.random() < 0.5, x = fromLeft ? -k.w - 10 : w + 10;
      var move = function (tx, cb) {
        var dur = Math.abs(tx - x) / 45; x = tx;
        el.classList.toggle("is-left", tx < parseFloat(el.style.getPropertyValue("--x") || 0));
        el.classList.add("is-walk"); el.classList.remove("is-dance");
        el.style.transitionDuration = dur + "s";
        el.style.setProperty("--x", Math.round(tx) + "px");
        setTimeout(cb, dur * 1000);
      };
      el.style.transitionDuration = "0s";
      el.style.setProperty("--x", Math.round(x) + "px");
      requestAnimationFrame(function () {
        move(w * (0.25 + Math.random() * 0.5), function () {
          el.classList.remove("is-walk"); el.classList.toggle("is-dance", raving);
          setTimeout(function () {
            move(fromLeft ? w + 10 : -k.w - 10, function () { el.remove(); critterOut = false; });
          }, raving ? 7000 + Math.random() * 4000 : 3500);
        });
      });
    }
    setInterval(function () {
      if (!visible || document.hidden) return;
      if (raving ? Math.random() < 0.4 : Math.random() < 0.08) critter();
    }, 20000);

    function partyLoop() {
      if (!raving) return;
      moneyMoment();
      cycleTimer = setTimeout(function () {
        freeDance();
        cycleTimer = setTimeout(function () { freeDance(); cycleTimer = setTimeout(partyLoop, 4200); }, 4200);
      }, 3800);
    }

    /* ---- photoshoot: every crew runs its own set, no two the same ---- */
    function photoSet(gr, set) {
      var c = home(gr[0].cfg.g);
      var girl = gr.filter(function (m) { return m.cfg.kind === "girl"; })[0];
      var guys = gr.filter(function (m) { return m.cfg.kind !== "girl"; });
      var P = function (m, p) { return function () { m.pose(p); }; };
      var model = function (m) { return m.cfg.kind === "girl" ? "is-posegirl" : "is-posecool"; };
      if (set === "guyshoots" && guys[0]) {
        go(guys[0], c + 44, c, P(guys[0], "is-camera"));
        gr.filter(function (m) { return m !== guys[0]; }).forEach(function (m, k) { go(m, c - 20 - k * 30, c + 400, P(m, model(m))); });
      } else if (set === "girlshoots" && girl) {
        go(girl, c - 44, c, P(girl, "is-camera"));
        guys.forEach(function (m, k) { go(m, c + 20 + k * 30, c - 400, P(m, "is-posecool")); });
      } else if (set === "selfie") {
        gr.forEach(function (m, k) { go(m, c + (k - (gr.length - 1) / 2) * 22, "R", P(m, k === 0 ? "is-selfie" : model(m))); });
      } else {
        // posing for you, front on
        gr.forEach(function (m, k) { go(m, c + (k - (gr.length - 1) / 2) * 26, k % 2 ? "L" : "R", P(m, model(m))); });
      }
    }

    /* ---- reacting to the page ---- */
    function react(kind) {
      if (raving || !crew.length) return;
      if (!visible || busy) { if (!pending || kind === "photo" || kind === "send") pending = kind; return; }
      busy = true;
      crew.forEach(function (m) { clearTimeout(m.timer); });
      var done = function (ms) { setTimeout(function () { busy = false; crew.forEach(function (m) { m.next(); }); }, ms); };
      if (kind === "photo") {
        egg.photos++;
        var ps = shuffle(["guyshoots", "girlshoots", "selfie", "front"]);
        groups().forEach(function (gr, i) { photoSet(gr, ps[i % ps.length]); });
        done(7500);
      } else if (kind === "quote") {
        var main = crew[0];
        main.pose("is-count");
        bills(main.el, 2, {});
        crew.slice(1, 3).forEach(function (m) { m.face(main.x); m.pose("is-look"); });
        done(3500);
      } else if (kind === "faq") {
        var who = rnd(crew.slice(1).length ? crew.slice(1) : crew);
        who.pose("is-think");
        done(4000);
      } else if (kind === "send") {
        crew.forEach(function (m) { m.pose("is-cheer"); });
        done(4000);
      }
    }
    document.addEventListener("crew", function (e) { react(e.detail); });

    /* ---- public hooks used by the music player and the form ---- */
    window.hype = {
      critter: function () { critter(); },
      firework: function (k) { return FX.firework(stage, k); },
      treat: function (i, n) { return crew[i] ? treat(crew[i], n) : false; },
      gag: function (i, n) { if (crew[i]) crew[i].gag(n, raving ? "is-rave d-bounce" : null); },
      set: function (on) {
        raving = on;
        clearTimeout(cycleTimer); stopParty();
        busy = false;
        crew.forEach(function (m) { clearTimeout(m.timer); m.el.setAttribute("aria-label", m.cfg.name + (on ? ", pause music" : ", play music")); });
        stage.classList.toggle("is-party", on);
        if (on) {
          if (reduceMotion) { crew.forEach(function (m) { m.dance("bounce"); }); return; }
          partyFx(true);
          warmUp();
          cycleTimer = setTimeout(partyLoop, 7500);
          if (Math.random() < 0.35) setTimeout(critter, 9000);
        } else {
          partyFx(false);
          crew.forEach(function (m, i) { m.pose("is-chill"); m.timer = setTimeout(m.next, 800 + i * 350); });
        }
      },
      rain: function () {
        egg.rains++;
        react("send");
        if (reduceMotion) return;
        for (var i = 0; i < 46; i++) {
          (function (i) {
            setTimeout(function () {
              var d = document.createElement("span");
              d.className = "cash__bill cash__bill--rain";
              d.textContent = "$";
              d.style.left = (Math.random() * 100) + "vw";
              d.style.setProperty("--rot", ((Math.random() - 0.5) * 120).toFixed(0) + "deg");
              d.style.setProperty("--dur", (1.8 + Math.random() * 1.4).toFixed(2) + "s");
              d.style.fontSize = (18 + Math.random() * 26).toFixed(0) + "px";
              cash.appendChild(d);
              setTimeout(function () { d.remove(); }, 3400);
            }, i * 45);
          })(i);
        }
      }
    };

    // start: Tiles and Glitter are always there; returning visitors find more of the crew
    var start = Math.min(max, 2 + Math.floor(hung / 12));
    for (var i = 0; i < start; i++) addPerson(i, false);
    STAGES.forEach(function (s) { if (hung >= s.at) buildProp(s.prop); });

    window.addEventListener("resize", function () { crew.forEach(function (m) { if (m.x > m.maxX()) m.place(m.maxX()); }); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        stage.classList.toggle("is-paused", !visible);
        if (visible && !raving) {
          if (pending) { var p = pending; pending = null; setTimeout(function () { react(p); }, 600); }
          else crew.forEach(function (m) { if (!m.timer) m.next(); });
        }
      }).observe(stage);
    }
    setInterval(tick, 1000);
    initEggStats(stage);
  }

  /* ---------------- Easter egg stats ----------------
     Counts how many visitors find the crew, how long they watch, how often they click,
     and whether the crew got the music going. Sent once when the visitor leaves the page
     to /api/egg (a free Cloudflare function). See your numbers at /api/egg. */
  var egg = { seen: 0, ms: 0, clicks: 0, plays: 0, rains: 0, since: 0, photos: 0, throws: 0, boombox: 0, crew: 0, level: 0 };
  function initEggStats(stage) {
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { egg.seen = 1; egg.since = performance.now(); }
      else if (egg.since) { egg.ms += performance.now() - egg.since; egg.since = 0; }
    }, { threshold: 0.4 }).observe(stage);
    stage.addEventListener("click", function (e) { if (e.target.closest(".raver")) { egg.clicks++; if (!$("#sc").classList.contains("is-playing")) egg.plays++; } });
    var sent = false;
    function send() {
      if (sent || !egg.seen) return;
      if (egg.since) { egg.ms += performance.now() - egg.since; egg.since = 0; }
      sent = true;
      var body = JSON.stringify({ seen: 1, seconds: Math.round(egg.ms / 1000), clicks: egg.clicks, plays: egg.plays, rains: egg.rains, photos: egg.photos, throws: egg.throws, boombox: egg.boombox, crew: egg.crew, level: egg.level });
      try {
        if (navigator.sendBeacon) navigator.sendBeacon("/api/egg", new Blob([body], { type: "application/json" }));
        else fetch("/api/egg", { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "application/json" } });
      } catch (e) { /* stats are optional */ }
    }
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") send(); });
    window.addEventListener("pagehide", send);
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
    initHype();
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
