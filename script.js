(function () {
  const SCRIPT_VERSION = "5.0.0";
  console.log("LogoGrabber script loaded. Version:", SCRIPT_VERSION);

  const CLOUD_NAME = "patrickg-assets";
  const UPLOAD_PRESET = "unsignedUpload";
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
  const PROXY_URL = "https://api.allorigins.win/raw?url=";

  const XLINK = "http://www.w3.org/1999/xlink";
  const $ = (q, r = document) => Array.from(r.querySelectorAll(q));
  const makeNS = n => document.createElementNS("http://www.w3.org/2000/svg", n);

  function alertV(msg) {
    alert(`LogoGrabber v${SCRIPT_VERSION}\n\n${msg}`);
  }

  // ---------------- DOMAIN NAMING ----------------

  function getBaseDomain() {
    try {
      let d = location.hostname.toLowerCase();
      d = d.replace(/^www\./, "").replace(/\./g, "_").replace(/[^a-z0-9_]/g, "");
      return d || "site";
    } catch {
      return "site";
    }
  }

  const BASE = getBaseDomain();

  function nextVersion(base) {
    const key = "logoGrab_" + base + "_v";
    try {
      let v = parseInt(localStorage.getItem(key) || "0", 10) || 0;
      v++;
      localStorage.setItem(key, String(v));
      return v;
    } catch {
      return Date.now();
    }
  }

  function newPublicId() {
    const version = nextVersion(BASE);
    return {
      base: BASE,
      version,
      publicId: `${BASE}_logo_v${version}`
    };
  }

  // ---------------- GENERIC UPLOAD HELPERS ----------------

  function downloadBlob(blob, name) {
    try {
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = name || "logo";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error("Download failed:", e);
      alertV("Local download failed (see console).");
    }
  }

  function cloudinaryUploadBlob(meta, blob, filename, onDone) {
    const fd = new FormData();
    fd.append("file", blob, filename || meta.publicId);
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(json => {
        if (!json || json.error) {
          console.error("Cloudinary error:", json && json.error);
          alertV("Cloudinary upload failed.\nI'll download the file locally instead.");
          downloadBlob(blob, filename || (meta.publicId + ".svg"));
        } else {
          showSuccess(json, meta);
        }
        if (onDone) onDone(json);
      })
      .catch(err => {
        console.error("Cloudinary crash:", err);
        alertV("Cloudinary upload crashed.\nI'll download the file locally instead.");
        downloadBlob(blob, filename || (meta.publicId + ".svg"));
        if (onDone) onDone(null);
      });
  }

  function showSuccess(result, meta) {
    const url = result.secure_url || result.url;
    if (!url) {
      alertV("Upload succeeded but no URL returned.");
      console.log("Cloudinary response:", result);
      return;
    }

    const msg =
      `Uploaded ✔️
Domain: ${meta.base}
Version: v${meta.version}
public_id: ${meta.publicId}

URL:
${url}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => alertV(msg + "\n(URL copied to clipboard)"))
        .catch(() => alertV(msg));
    } else {
      alertV(msg);
    }
  }

  // ---------------- INLINE SVG PROCESSING ----------------

  function copyDefs(svg) {
    const defs = svg.querySelector("defs") || svg.insertBefore(makeNS("defs"), svg.firstChild);
    const seen = new Set(Array.from(defs.children).map(n => n.id).filter(Boolean));
    $("svg defs").forEach(d => {
      Array.from(d.children).forEach(node => {
        if (node.nodeType === 1 && (!node.id || !seen.has(node.id))) {
          defs.appendChild(node.cloneNode(true));
          if (node.id) seen.add(node.id);
        }
      });
    });
  }

  function expandUse(svg) {
    $("use", svg).forEach(use => {
      const ref =
        use.getAttribute("href") ||
        use.getAttributeNS(XLINK, "href") ||
        use.getAttribute("xlink:href");
      if (!ref) return;

      const parts = ref.split("#");
      if (parts.length < 2) return;
      const id = parts[1];
      const srcEl = document.getElementById(id);
      if (!srcEl) return;

      const g = makeNS("g");
      use.getAttributeNames().forEach(a => {
        if (a !== "href" && a !== "xlink:href") {
          g.setAttribute(a, use.getAttribute(a));
        }
      });

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
    svg.style.outline = "";
    svg.removeAttribute("style");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("xmlns:xlink", XLINK);

    const vb = svg.getAttribute("viewBox");
    if (vb && (!svg.getAttribute("width") || !svg.getAttribute("height"))) {
      const vals = vb.split(/\s+/).map(Number);
      if (vals.length === 4) {
        const w = vals[2], h = vals[3];
        if (w > 0 && h > 0) {
          svg.setAttribute("width", w);
          svg.setAttribute("height", h);
        }
      }
    }
  }

  function inlineSvgToBlob(svg) {
    cleanSvg(svg);
    expandUse(svg);
    copyDefs(svg);
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                new XMLSerializer().serializeToString(svg);
    return new Blob([xml], { type: "image/svg+xml" });
  }

  function uploadInlineSvg(el) {
    try {
      const meta = newPublicId();
      const blob = inlineSvgToBlob(el);
      cloudinaryUploadBlob(meta, blob, `${meta.publicId}.svg`);
    } catch (e) {
      console.error("Inline SVG error:", e);
      alertV("Failed to process inline SVG.");
    }
  }

  // ---------------- EXTERNAL SVG (ASOS, etc.) ----------------

  function uploadExternalSvg(src) {
    const meta = newPublicId();

    // Always use proxy → SVG text → blob → upload
    const proxied = PROXY_URL + encodeURIComponent(src);

    fetch(proxied)
      .then(r => {
        if (!r.ok) throw new Error("Proxy HTTP " + r.status);
        return r.text();
      })
      .then(svgText => {
        const blob = new Blob([svgText], { type: "image/svg+xml" });
        cloudinaryUploadBlob(meta, blob, `${meta.publicId}.svg`);
      })
      .catch(err => {
        console.error("Proxy fetch for SVG failed:", err);
        alertV("Could not fetch SVG via proxy; nothing more I can do on this site.");
      });
  }

  // ---------------- RASTER IMAGES ----------------

  function dataUrlToBlob(dataUrl) {
    const [header, data] = dataUrl.split(",");
    const mimeMatch = header.match(/data:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const isBase64 = /base64/i.test(header);

    if (isBase64) {
      const bin = atob(data);
      const len = bin.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } else {
      const decoded = decodeURIComponent(data);
      const bytes = new TextEncoder().encode(decoded);
      return new Blob([bytes], { type: mime });
    }
  }

  function uploadRasterImage(src) {
    const meta = newPublicId();
    fetch(src)
      .then(r => r.blob())
      .then(blob => {
        cloudinaryUploadBlob(meta, blob, `${meta.publicId}.png`);
      })
      .catch(err => {
        console.error("Raster fetch failed:", err);
        alertV("Failed to fetch raster image; cannot upload.");
      });
  }

  function uploadImg(el) {
    const src = el.currentSrc || el.src;
    if (!src) {
      alertV("Selected image has no src.");
      return;
    }

    if (/\.svg(\?|#|$)/i.test(src)) {
      uploadExternalSvg(src);
      return;
    }

    if (src.startsWith("data:")) {
      const blob = dataUrlToBlob(src);
      const meta = newPublicId();
      cloudinaryUploadBlob(meta, blob, `${meta.publicId}.png`);
      return;
    }

    uploadRasterImage(src);
  }

  // ---------------- LOGO DETECTION ----------------

  function scoreCandidate(el) {
    let score = 0;
    const tag = el.tagName.toLowerCase();
    const rect = el.getBoundingClientRect();

    // ignore tiny icons
    if (rect.width < 24 || rect.height < 24) return 0;

    const id = (el.id || "").toLowerCase();
    const cls = (el.className || "").toString().toLowerCase();
    const alt = (el.getAttribute?.("alt") || "").toLowerCase();
    const src = (el.getAttribute?.("src") || "").toLowerCase();
    const aria = (el.getAttribute?.("aria-label") || "").toLowerCase();

    const hit = w => id.includes(w) || cls.includes(w) || alt.includes(w) || src.includes(w) || aria.includes(w);

    if (hit("logo")) score += 80;
    if (hit("brand")) score += 40;
    if (hit("icon")) score += 10;

    if (BASE && (src.includes(BASE) || alt.includes(BASE) || cls.includes(BASE))) {
      score += 40;
    }

    const area = rect.width * rect.height;
    if (area > 200) score += 10;
    if (rect.width > rect.height) score += 10;

    let p = el.parentElement;
    let depth = 0;
    while (p && depth < 6) {
      const tn = p.tagName.toLowerCase();
      const pcl = (p.className || "").toString().toLowerCase();
      const pid = (p.id || "").toLowerCase();

      if (tn === "header" || tn === "nav") score += 40;
      if (pcl.includes("header") || pcl.includes("navbar") || pcl.includes("site-header")) {
        score += 30;
      }
      if (pid.includes("header") || pid.includes("logo")) score += 30;

      const href = p.getAttribute && p.getAttribute("href");
      if (href && (href === "/" || href === "")) score += 60;

      p = p.parentElement;
      depth++;
    }

    if (tag === "svg") score += 20;
    if (tag === "img") score += 10;

    return score;
  }

  function findCandidates() {
    const all = [...$("img"), ...$("svg")].map(el => ({
      el,
      type: el.tagName.toLowerCase(),
      score: scoreCandidate(el)
    }));

    return all
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  // ---------------- FLOATING BUTTON UI ----------------

  function showButtons(candidates) {
    const existing = document.getElementById("logoGrabber-buttons-overlay");
    if (existing) existing.remove();

    if (!candidates.length) {
      alertV("No logo-like images/SVGs found on this page.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "logoGrabber-buttons-overlay";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.zIndex = "999999";
    document.body.appendChild(overlay);

    alertV(`Detected ${candidates.length} logo candidate(s).\nClick any "Grab #N" button, ESC to cancel.`);

    function cleanup() {
      document.removeEventListener("keydown", escHandler, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function escHandler(ev) {
      if (ev.key === "Escape" || ev.key === "Esc") {
        ev.stopPropagation();
        cleanup();
      }
    }

    document.addEventListener("keydown", escHandler, true);

    candidates.forEach((c, idx) => {
      const rect = c.el.getBoundingClientRect();
      const btn = document.createElement("button");
      btn.textContent = "Grab #" + (idx + 1);
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

      btn.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        cleanup();

        if (c.type === "svg") uploadInlineSvg(c.el);
        else uploadImg(c.el);
      });

      overlay.appendChild(btn);
    });
  }

  // ---------------- ENTRY ----------------

  function startLogoGrabber() {
    const candidates = findCandidates();
    showButtons(candidates);
  }

  startLogoGrabber();
})();
