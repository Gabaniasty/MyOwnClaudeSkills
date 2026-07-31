/* THE BROWSER AUDIT — Gates 20, 21, 22, 23, 24 in one pass.
 *
 * Paste into the page (devtools console, or your browser-automation tool's
 * javascript executor). Returns an object of numbers. Report the numbers.
 *
 *   await pdAudit()                       // whole page, current viewport
 *   await pdAudit({ hero: '.hero-media', grid: '.bento', card: '.wc',
 *                   float: '.wc-dev' })   // name your own selectors
 *
 * PASS ORDER IS LOAD-BEARING (Gate 24). Pixel sampling runs FIRST; anything that
 * mutates global state — the theme flip, injected stylesheets — runs LAST. An
 * earlier version toggled data-theme and back, then read text colours, and
 * reported four hero contrast failures that did not exist because it compared
 * dark-theme text against light-theme pixels.
 */
(function () {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (a) => 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };

  /* color() uses 0-1 floats while rgb() uses 0-255. Parsing both as 0-255 once
     produced 18 phantom failures. */
  function parseColor(s) {
    if (!s) return null;
    const n = (s.match(/-?[\d.]+/g) || []).map(Number);
    if (n.length < 3) return null;
    let [r, g, b] = n;
    if (/^color\(/.test(s)) { r *= 255; g *= 255; b *= 255; }
    return [r, g, b, n.length > 3 ? n[3] : 1];
  }

  function groundOf(el) {
    let e = el;
    while (e && e !== document.documentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage.includes("gradient")) {
        const m = cs.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{6}/i);
        if (m) { const c = parseColor(m[0]); if (c) return c.slice(0, 3); }
      }
      const c = parseColor(cs.backgroundColor);
      if (c && c[3] > 0.85) return c.slice(0, 3);
      e = e.parentElement;
    }
    return [255, 255, 255];
  }

  const needFor = (cs) => {
    const s = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10) || 400;
    return (s >= 24 || (s >= 18.66 && w >= 700)) ? 3 : 4.5;
  };

  /* GLYPH RUNS, not block boxes (Gate 20). A block rect spans the empty space to
     the right of every short line, and sampling it finds dark pixels no letter
     ever touches — that mistake made one fixable hero look impossible. */
  function* glyphRects(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const rect of r.getClientRects()) {
        if (rect.width >= 2 && rect.height >= 2) yield { rect, node: n };
      }
    }
  }

  window.pdAudit = async function (opts = {}) {
    const S = Object.assign({
      hero: ".hero-media", heroText: [".hero h1", ".hero .lede", ".hero .eyebrow",
        ".hero .trust-note", ".hero .trust li"],
      grid: ".bento", card: ".wc", float: ".wc-dev",
      textSel: "p,h1,h2,h3,h4,li,a,label,span,button,input,select,textarea,b,strong,em,small,td,th,option",
      skipInPageAudit: ".hero-top,.hero-bottom,.hero h1,.hero .lede",
    }, opts);
    const out = { viewport: [innerWidth, innerHeight] };

    /* lazy+offscreen is NOT broken (Gate 24) */
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager"));
    await new Promise((r) => setTimeout(r, 250));

    /* ---- 1. HERO TEXT ON REAL PHOTO PIXELS (first, before any mutation) ---- */
    const media = document.querySelector(S.hero);
    const img = media && media.querySelector("img");
    if (img) {
      if (img.decode) await img.decode().catch(() => {});
      const mb = media.getBoundingClientRect();
      const W = Math.round(mb.width), H = Math.round(mb.height);
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const sc = Math.max(W / iw, H / ih);
      const op = getComputedStyle(img).objectPosition.split(" ");
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, -(iw * sc - W) * (parseFloat(op[0]) / 100),
                       -(ih * sc - H) * (parseFloat(op[1]) / 100), iw * sc, ih * sc);

      /* replicate the scrim if there is one, using the browser's own gradient */
      const scrim = parseFloat(getComputedStyle(media).getPropertyValue("--hero-scrim")) || 0;
      const painted = scrim > 0 && getComputedStyle(media, "::after").display !== "none";
      if (painted) {
        const gr = g.createLinearGradient(0, 0, W, 0);
        gr.addColorStop(0, `rgba(255,255,255,${scrim})`);
        gr.addColorStop(0.34, `rgba(255,255,255,${scrim})`);
        gr.addColorStop(0.45, `rgba(255,255,255,${scrim * 0.5})`);
        gr.addColorStop(0.56, "rgba(255,255,255,0)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      const px = g.getImageData(0, 0, W, H).data;

      let fail = 0, lines = 0, tight = Infinity, who = "";
      for (const sel of S.heroText) {
        for (const el of document.querySelectorAll(sel)) {
          const cs = getComputedStyle(el);
          const col = parseColor(cs.color); if (!col) continue;
          const need = needFor(cs);
          for (const { rect, node } of glyphRects(el)) {
            const x0 = Math.max(0, Math.round(rect.left - mb.left));
            const y0 = Math.max(0, Math.round(rect.top - mb.top));
            const x1 = Math.min(W, Math.round(rect.right - mb.left));
            const y1 = Math.min(H, Math.round(rect.bottom - mb.top));
            if (x1 <= x0 || y1 <= y0) continue;
            lines++;
            let worst = Infinity;
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
              const i = (y * W + x) * 4;
              const v = ratio(col.slice(0, 3), [px[i], px[i + 1], px[i + 2]]);
              if (v < worst) worst = v;
            }
            if (worst < need) fail++;
            if (worst - need < tight) { tight = worst - need; who = `${node.textContent.trim().slice(0, 18)} ${worst.toFixed(2)}/${need}`; }
          }
        }
      }
      const panX = Math.round(iw * sc - W), panY = Math.round(ih * sc - H);
      out.hero = {
        linesChecked: lines, failures: fail, tightest: who,
        scrimPainted: painted ? scrim : 0,
        imageScale: +sc.toFixed(2),
        UPSCALING: sc > 1.02,                    // Gate 19
        cropAxis: panX > panY ? "horizontal" : "vertical",
        pannable: { x: panX, y: panY },          // 0 means that axis is inert
        seenPctOfSource: { w: Math.round(W / sc / iw * 100) + "%", h: Math.round(H / sc / ih * 100) + "%" },
        variant: (img.currentSrc || "").split("/").pop(),
      };
    }

    /* ---- 2. BREAKOUT COLLISIONS, at the animation's WORST frame (Gate 21) ---- */
    const grid = document.querySelector(S.grid);
    if (grid) {
      const pin = document.createElement("style");
      pin.textContent = `${S.float} img{animation:none!important;transform:translateY(-6px)!important}`;
      document.head.appendChild(pin);
      void document.body.offsetHeight;

      const cards = [...grid.querySelectorAll(`:scope > ${S.card}`)];
      let collisions = 0; const spills = [];
      cards.forEach((c, ci) => {
        const d = c.querySelector(S.float); if (!d) return;
        const dr = d.getBoundingClientRect(), cr = c.getBoundingClientRect();
        const over = Math.max(cr.left - dr.left, dr.right - cr.right);
        if (over > 1) spills.push({ card: ci + 1, px: +over.toFixed(1) });
        cards.forEach((o, oi) => {
          if (oi === ci) return;
          o.querySelectorAll("h3,p,a,span,[class*=tag],[class*=cat]").forEach((t) => {
            const r = t.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return;
            if (Math.min(dr.right, r.right) - Math.max(dr.left, r.left) > 2 &&
                Math.min(dr.bottom, r.bottom) - Math.max(dr.top, r.top) > 2) collisions++;
          });
        });
      });

      /* rendered size across the set — contain does NOT equalise (Gate 22) */
      const hs = [...grid.querySelectorAll(`${S.float} img`)].map((i) => {
        const b = i.getBoundingClientRect(), r = i.naturalWidth / i.naturalHeight;
        return Math.round(r > b.width / b.height ? b.width / r : b.height);
      });
      pin.remove();
      const mean = hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : 0;
      out.grid = {
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        rowGap: getComputedStyle(grid).rowGap,
        collisionsAtWorstFrame: collisions,
        sideSpills: spills,
        renderedHeights: hs,
        renderedSpreadPct: hs.length ? +(((Math.max(...hs) - Math.min(...hs)) / mean) * 100).toFixed(1) : null,
      };
    }

    /* ---- 3. ANIMATION WIRING (Gate 23) ---- */
    const drivers = [...document.querySelectorAll("[data-par]")];
    out.animation = {
      parallaxTargets: drivers.length,
      parallaxDriven: drivers.filter((e) => {
        const v = getComputedStyle(e).getPropertyValue("--py").trim();
        return v && v !== "0px" && v !== "0";
      }).length,
      strandedReveals: [...document.querySelectorAll(".rv")]
        .filter((e) => getComputedStyle(e).opacity !== "1" && e.offsetParent !== null).length,
    };

    /* ---- 4. ASSETS ---- */
    const imgs = [...document.querySelectorAll("img")];
    out.assets = {
      images: imgs.length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      notYetLoaded: imgs.filter((i) => !i.complete).length,   // NOT the same thing
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };

    /* ---- 5. PAGE CONTRAST — LAST, because it mutates data-theme ---- */
    const kill = document.createElement("style");
    kill.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}";
    document.head.appendChild(kill);
    void document.body.offsetHeight;

    const sweep = () => {
      const fails = [];
      document.querySelectorAll(S.textSel).forEach((el) => {
        if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return;
        if (S.skipInPageAudit && el.closest(S.skipInPageAudit)) return;
        const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
        if (!t) return;
        const cs = getComputedStyle(el);
        const fg = parseColor(cs.color); if (!fg) return;
        const need = needFor(cs);
        const r = ratio(fg.slice(0, 3), groundOf(el));
        if (r < need) fails.push({ text: t.slice(0, 30), got: +r.toFixed(2), need });
      });
      return fails;
    };
    const light = sweep();
    const had = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    void document.body.offsetHeight;
    const dark = sweep();
    if (had) document.documentElement.setAttribute("data-theme", had);
    else document.documentElement.removeAttribute("data-theme");
    void document.body.offsetHeight;
    kill.remove();

    out.contrast = {
      lightFailures: light.length, lightWorst: light.sort((a, b) => a.got - b.got).slice(0, 4),
      darkFailures: dark.length, darkWorst: dark.sort((a, b) => a.got - b.got).slice(0, 4),
    };

    return out;
  };
  return "pdAudit() installed — call: await pdAudit()";
})();
