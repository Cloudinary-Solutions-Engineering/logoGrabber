(function () {
  const SCRIPT_VERSION = "4.0.0";
  console.log("LogoGrabber script loaded. Version:", SCRIPT_VERSION);

  // -------------- CONFIG --------------
  const CLOUD_NAME = "patrickg-assets";
  const UPLOAD_PRESET = "unsignedUpload";
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

  // ASOS-proof proxy
  const PROXY_URL = "https://api.allorigins.win/raw?url=";

  const MAX_CANVAS_DIM = 1024;

  const XLINK = "http://www.w3.org/1999/xlink";
  const $ = (q, r = document) => Array.from(r.querySelectorAll(q));
  const makeNS = n => document.createElementNS("http://www.w3.org/2000/svg", n);

  function alertV(msg) {
    alert(`LogoGrabber v${SCRIPT_VERSION}\n\n${msg}`);
  }

  // ---------------- DOMAIN NAMING ----------------

  function getBaseDomain() {
    let d = location.hostname.toLowerCase();
    d = d.replace(/^www\./, "").replace(/\./g, "_").replace(/[^a-z0-9_]/g, "");
    return d || "site";
  }
  const BASE = getBaseDomain();

  function nextVersion(base) {
    const key = "logoGrab_" + base + "_v";
    let v = parseInt(localStorage.getItem(key) || "0", 10) || 0;
    v++;
    localStorage.setItem(key, v);
    return v;
  }

  function newPublicId() {
    const v = nextVersion(BASE);
    return {
      base: BASE,
      version: v,
      publicId: `${BASE}_logo_v${v}`
    };
  }

  // ---------------- UPLOAD HELPERS ----------------

  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name || "logo.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function cloudinaryFetchUrl(publicId, url, onSuccess, onError) {
    const fd = new FormData();
    fd.append("file", url);
    fd.append("public_id", publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(json => {
        if (!json || json.error) return onError(json && json.error);
        onSuccess(json);
      })
      .catch(err => onError(err));
  }

  function cloudinaryUploadBlob(publicId, blob, filename, onSuccess, onError) {
    const fd = new FormData();
    fd.append("file", blob, filename || publicId);
    fd.append("public_id", publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(json => {
        if (!json || json.error) return onError(json && json.error);
        onSuccess(json);
      })
      .catch(err => onError(err));
  }

  function showSuccess(result, meta) {
    const url = result.secure_url || result.url;
    if (!url) return alertV("Upload worked but no URL received.");

    const msg =
      `Uploaded ✔️  
Domain: ${meta.base}  
Version: v${meta.version}  
public_id: ${meta.publicId}

URL:
${url}`;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => alertV(msg + "\n(URL copied)"))
        .catch(() => alertV(msg));
    } else {
      alertV(msg);
    }
  }

  // ---------------- INLINE SVG → BLOB ----------------

  function copyDefs(svg) {
    const defs = svg.querySelector("defs") || svg.insertBefore(makeNS("defs"), svg.firstChild);
    const seen = new Set(Array.from(defs.children).map(n => n.id));
    $("svg defs").forEach(d => {
      for (const node of d.children) {
        if (node.nodeType === 1 && (!node.id || !seen.has(node.id))) {
          defs.appendChild(node.cloneNode(true));
          if (node.id) seen.add(node.id);
        }
      }
    });
  }

  function expandUse(svg) {
    $("use", svg).forEach(use => {
      const href =
        use.getAttribute("href") ||
        use.getAttributeNS(XLINK, "href") ||
        use.getAttribute("xlink:href");
      if (!href) return;

      const parts = href.split("#");
      if (parts.length < 2) return;
      const id = parts[1];
      const srcEl = document.getElementById(id);
      if (!srcEl) return;

      const g = makeNS("g");
      for (const a of use.getAttributeNames()) {
        if (a !== "href" && a !== "xlink:href") {
          g.setAttribute(a, use.getAttribute(a));
        }
      }

      if (srcEl.tagName.toLowerCase() === "symbol") {
        if (!svg.hasAttribute("viewBox") && srcEl.hasAttribute("viewBox")) {
          svg.setAttribute("viewBox", srcEl.getAttribute("viewBox"));
        }
        srcEl.childNodes.forEach(n => g.appendChild(n.cloneNode(true)));
      } else {
        g.appendChild(srcEl.cloneNode(true));
      }

      use.replaceWith(g);
    });
  }

  function cleanSvg(svg) {
    svg.removeAttribute("style");
    svg.style.outline = "";
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("xmlns:xlink", XLINK);

    const vb = svg.getAttribute("viewBox");
    if (vb && (!svg.getAttribute("width") || !svg.getAttribute("height"))) {
      const [, , w, h] = vb.split(/\s+/).map(Number);
      if (w && h) {
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
      }
    }
  }

  function inlineSvgToBlob(svg) {
    cleanSvg(svg);
    expandUse(svg);
    copyDefs(svg);

    const xml = '<?xml version="1.0"?>\n' + new XMLSerializer().serializeToString(svg);
    return new Blob([xml], { type: "image/svg+xml" });
  }

  // ---------------- CANVAS PNG FALLBACK (ASOS PROOF) ----------------

  function svgUrlToPngBlob(svgUrl, cb) {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = function () {
      let w = img.naturalWidth || img.width || 512;
      let h = img.naturalHeight || img.height || 512;

      const maxSide = Math.max(w, h);
      const scale = MAX_CANVAS_DIM / maxSide;
      w = Math.round(w * scale);
      h = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        b => cb(null, b),
        "image/png"
      );
    };

    img.onerror = err => cb(err);

    img.src = svgUrl; // can trigger taint if CORS blocked
  }

  // ---------------- ELEMENT UPLOAD ----------------

  function uploadInlineSvg(el) {
    try {
      const blob = inlineSvgToBlob(el);
      const meta = newPublicId();
      cloudinaryUploadBlob(meta.publicId, blob, `${meta.publicId}.svg`,
        res => showSuccess(res, meta),
        () => {
          alertV("Upload failed; saving locally.");
          downloadBlob(blob, `${meta.publicId}.svg`);
        });
    } catch (e) {
      alertV("Error processing inline SVG.");
      console.error(e);
    }
  }

  function uploadExternalSvg(el, src) {
    const meta = newPublicId();

    // 1. Try direct Cloudinary server fetch
    cloudinaryFetchUrl(
      meta.publicId,
      src,
      res => showSuccess(res, meta),
      () => {
        // 2. Use proxy (ASOS fix)
        fetch(PROXY_URL + encodeURIComponent(src))
          .then(r => r.text())
          .then(svgText => {
            const proxyBlob = new Blob([svgText], { type: "image/svg+xml" });

            // Attempt cloudinary upload of proxy SVG
            cloudinaryUploadBlob(
              meta.publicId,
              proxyBlob,
              `${meta.publicId}.svg`,
              res => showSuccess(res, meta),
              () => {
                // 3. Proxy SVG → PNG fallback
                const proxyUrl = PROXY_URL + encodeURIComponent(src);
                svgUrlToPngBlob(proxyUrl, (err, pngBlob) => {
                  if (err || !pngBlob) {
                    alertV("SVG blocked even via proxy; downloading PNG locally.");
                    if (pngBlob) downloadBlob(pngBlob, `${meta.publicId}.png`);
                    return;
                  }
                  cloudinaryUploadBlob(
                    meta.publicId,
                    pngBlob,
                    `${meta.publicId}.png`,
                    res => showSuccess(res, meta),
                    () => downloadBlob(pngBlob, `${meta.publicId}.png`)
                  );
                });
              }
            );
          })
          .catch(err => {
            console.error("Proxy failed:", err);
            alertV("ASOS SVG cannot be fetched or proxied.");
          });
      }
    );
  }

  function uploadRasterImage(src) {
    const meta = newPublicId();

    fetch(src)
      .then(r => r.blob())
      .then(blob => {
        cloudinaryUploadBlob(
          meta.publicId,
          blob,
          `${meta.publicId}.png`,
          res => showSuccess(res, meta),
          () => downloadBlob(blob, `${meta.publicId}.png`)
        );
      })
      .catch(err => {
        console.error("Raster fetch fail:", err);
        alertV("Could not fetch raster image.");
      });
  }

  function uploadImg(el) {
    const src = el.currentSrc || el.src;
    if (!src) return alertV("Image has no src.");

    if (/\.svg(\?|#|$)/i.test(src)) {
      uploadExternalSvg(el, src);
      return;
    }

    if (src.startsWith("data:")) {
      const blob = dataUrlToBlob(src);
      const meta = newPublicId();
      cloudinaryUploadBlob(
        meta.publicId,
        blob,
        `${meta.publicId}.png`,
        res => showSuccess(res, meta),
        () => downloadBlob(blob, `${meta.publicId}.png`)
      );
      return;
    }

    uploadRasterImage(src);
  }

  // ---------------- LOGO DETECTION ----------------

  function score(el) {
    let s = 0;
    const tag = el.tagName.toLowerCase();
    const id = (el.id || "").toLowerCase();
    const cls = (el.className || "").toString().toLowerCase();
    const alt = (el.getAttribute?.("alt") || "").toLowerCase();
    const src = (el.getAttribute?.("src") || "").toLowerCase();

    const hit = w => id.includes(w) || cls.includes(w) || alt.includes(w) || src.includes(w);

    if (hit("logo")) s += 60;
    if (hit("brand")) s += 30;
    if (hit("header") || hit("nav")) s += 20;
    if (alt.includes(BASE) || src.includes(BASE)) s += 40;

    const rect = el.getBoundingClientRect();
    if (rect.width * rect.height > 50) s += 10;
    if (rect.width > rect.height) s += 5;

    let p = el.parentElement, depth = 0;
    while (p && depth < 5) {
      const pcls = (p.className || "").toString().toLowerCase();
      const pid = (p.id || "").toLowerCase();
      if (p.tagName.toLowerCase() === "header") s += 40;
      if (pcls.includes("header") || pcls.includes("navbar")) s += 30;
      if (pid.includes("header")) s += 20;

      const href = p.getAttribute && p.getAttribute("href");
      if (href && (href === "/" || href === "")) s += 50;

      p = p.parentElement;
      depth++;
    }

    if (tag === "svg") s += 15;
    if (tag === "img") s += 10;

    return s;
  }

  function findCandidates() {
    const list = [...$("img"), ...$("svg")].map(el => ({
      el,
      type: el.tagName.toLowerCase(),
      score: score(el)
    }));

    return list.filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
  }

  // ---------------- BUTTON OVERLAY ----------------

  function showButtons(candidates) {
    const exist = document.getElementById("logoGrabber-buttons-overlay");
    if (exist) exist.remove();

    if (!candidates.length) {
      return alertV("No logos found on this page.");
    }

    const overlay = document.createElement("div");
    overlay.id = "logoGrabber-buttons-overlay";
    overlay.style.position = "absolute";
    overlay.style.zIndex = "999999";
    document.body.appendChild(overlay);

    alertV(`Detected ${candidates.length} logo candidate(s). Press ESC to cancel.`);

    function cleanup() {
      document.removeEventListener("keydown", escHandler, true);
      overlay.remove();
    }

    function escHandler(e) {
      if (e.key === "Escape") cleanup();
    }

    document.addEventListener("keydown", escHandler, true);

    candidates.forEach((c, i) => {
      const rect = c.el.getBoundingClientRect();
      const btn = document.createElement("button");

      btn.textContent = "Grab #" + (i + 1);
      Object.assign(btn.style, {
        position: "absolute",
        top: window.scrollY + rect.top + "px",
        left: window.scrollX + rect.left + "px",
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: "3px 6px",
        borderRadius: "4px",
        border: "1px solid #333",
        fontSize: "11px",
        cursor: "pointer",
        zIndex: 1000000
      });

      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        cleanup();

        if (c.type === "svg") uploadInlineSvg(c.el);
        else uploadImg(c.el);
      };

      overlay.appendChild(btn);
    });
  }

  // ---------------- ENTRY ----------------

  function start() {
    const cands = findCandidates();
    showButtons(cands);
  }

  start();
})();
