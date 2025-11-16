(function() {
  const SCRIPT_VERSION = "2.1.0";
  console.log("LogoGrabber script loaded. Version:", SCRIPT_VERSION);

  const XLINK = "http://www.w3.org/1999/xlink";
  const CLOUD_NAME = "patrickg-assets";
  const UPLOAD_PRESET = "unsignedUpload";
  const UPLOAD_URL = "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/upload";

  const makeNS = n => document.createElementNS("http://www.w3.org/2000/svg", n);
  const $ = (q, r = document) => Array.from(r.querySelectorAll(q));

  function alertV(msg) {
    alert("LogoGrabber v" + SCRIPT_VERSION + "\n\n" + msg);
  }

  // ---------------- DOMAIN NAMING ----------------

  function getBaseDomain() {
    let host = location.hostname.toLowerCase();
    host = host.replace(/^www\./, "");
    host = host.replace(/\./g, "_");
    host = host.replace(/[^a-z0-9_]/g, "");
    return host || "site";
  }

  function getVersionForBase(base) {
    const key = "logoGrabber_" + base + "_version";
    try {
      const cur = parseInt(localStorage.getItem(key) || "0", 10);
      const next = cur + 1;
      localStorage.setItem(key, next);
      return next;
    } catch {
      return Date.now();
    }
  }

  function makePublicId() {
    const base = getBaseDomain();
    const v = getVersionForBase(base);
    return {
      baseSlug: base,
      version: v,
      publicId: base + "_logo_v" + v
    };
  }

  // ---------------- UPLOAD & FALLBACK ----------------

  function triggerDownload(blob, name) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name || "logo.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function handleResult(res, meta, fallbackBlob, fallbackName) {
    if (!res || res.error) {
      console.error("Cloudinary error:", res?.error);
      alertV("Cloudinary failed — downloading locally.");

      if (fallbackBlob) {
        triggerDownload(fallbackBlob, fallbackName || (meta.publicId + ".svg"));
      } else {
        alertV("No fallback available.");
      }
      return;
    }

    const url = res.secure_url;
    if (!url) {
      alertV("Upload succeeded but no URL returned.");
      return;
    }

    const msg =
      `Uploaded ✔️\n` +
      `Domain: ${meta.baseSlug}\n` +
      `Version: v${meta.version}\n` +
      `public_id: ${meta.publicId}\n\n` +
      `URL:\n${url}`;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => alertV(msg + "\n(URL copied)"))
        .catch(() => alertV(msg));
    } else {
      alertV(msg);
    }
  }

  function uploadBlobWithFallback(blob, filename) {
    const meta = makePublicId();
    const fd = new FormData();
    fd.append("file", blob, filename || meta.publicId);
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => handleResult(res, meta, blob, filename))
      .catch(err => {
        console.error("Upload error:", err);
        alertV("Upload crashed — downloading locally.");
        triggerDownload(blob, filename);
      });
  }

  // ---------------- SVG PROCESSING ----------------

  function copyDefs(svg) {
    const defs = svg.querySelector("defs") || svg.insertBefore(makeNS("defs"), svg.firstChild);
    const seen = new Set(Array.from(defs.children).map(n => n.id).filter(Boolean));
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
      const ref =
        use.getAttribute("href") ||
        use.getAttributeNS(XLINK, "href") ||
        use.getAttribute("xlink:href");
      if (!ref) return;

      const parts = ref.split("#");
      if (parts.length < 2) return;

      const id = parts[1];
      const src = document.getElementById(id);
      if (!src) return;

      const g = makeNS("g");

      for (const a of use.getAttributeNames()) {
        if (a !== "href" && a !== "xlink:href") {
          g.setAttribute(a, use.getAttribute(a));
        }
      }

      if (src.tagName.toLowerCase() === "symbol") {
        if (!svg.hasAttribute("viewBox") && src.hasAttribute("viewBox"))
          svg.setAttribute("viewBox", src.getAttribute("viewBox"));
        src.childNodes.forEach(n => g.appendChild(n.cloneNode(true)));
      } else {
        g.appendChild(src.cloneNode(true));
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
      const [ , , w, h ] = vb.split(/\s+/).map(Number);
      if (w && h) {
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
      }
    }
  }

  function svgElementToBlob(svg) {
    cleanSvg(svg);
    expandUse(svg);
    copyDefs(svg);
    const xml = '<?xml version="1.0"?>\n' + new XMLSerializer().serializeToString(svg);
    return new Blob([xml], { type: "image/svg+xml" });
  }

  // ---------------- ELEMENT UPLOAD LOGIC ----------------

  // SPECIAL: ASOS fix — if URL ends in `.svg`, ALWAYS upload URL directly
  function uploadExternalSvgUrl(src) {
    const meta = makePublicId();
    const fd = new FormData();
    fd.append("file", src);        // Cloudinary fetches server-side — NO CORS
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => handleResult(res, meta, null, null)) // no fallback blob — we don't fetch locally
      .catch(err => {
        console.error("Cloudinary fetch-upload error:", err);
        alertV("Cloudinary failed to fetch the SVG URL.\n(No local fallback possible due to CORS.)");
      });
  }

  function uploadSvgElement(svg) {
    const blob = svgElementToBlob(svg);
    uploadBlobWithFallback(blob, "logo.svg");
  }

  function uploadImgElement(img) {
    const src = img.currentSrc || img.src;
    if (!src) return alertV("Image has no src.");

    // If it's an external SVG → Cloudinary fetch
    if (src.match(/\.svg(\?|$)/i)) {
      uploadExternalSvgUrl(src);
      return;
    }

    // If it's a data URL → convert to blob
    if (src.startsWith("data:")) {
      const blob = dataUrlToBlob(src);
      uploadBlobWithFallback(blob, "logo_image");
      return;
    }

    // For PNG/JPG → fetch → blob → upload
    fetch(src)
      .then(r => r.blob())
      .then(blob => uploadBlobWithFallback(blob, "logo_image"))
      .catch(err => {
        alertV("Fetching image failed. Cannot upload.");
        console.error(err);
      });
  }

  function dataUrlToBlob(dataUrl) {
    const [header, data] = dataUrl.split(",");
    const mime = header.match(/data:(.*?);/)[1];
    const isBase64 = /base64/i.test(header);

    if (isBase64) {
      const bin = atob(data);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } else {
      return new Blob([decodeURIComponent(data)], { type: mime });
    }
  }

  // ---------------- LOGO DETECTION ----------------

  function scoreCandidate(el) {
    let score = 0;
    const id = (el.id || "").toLowerCase();
    const cls = (el.className || "").toString().toLowerCase();
    const alt = (el.getAttribute?.("alt") || "").toLowerCase();
    const src = (el.getAttribute?.("src") || "").toLowerCase();

    const hit = w =>
      id.includes(w) || cls.includes(w) || alt.includes(w) || src.includes(w);

    if (hit("logo")) score += 50;
    if (hit("brand")) score += 20;

    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) score += 5;
    if (rect.width > rect.height) score += 5;

    let p = el.parentElement;
    let depth = 0;
    while (p && depth < 4) {
      const pc = (p.className || "").toString().toLowerCase();
      const pid = (p.id || "").toLowerCase();
      if (pc.includes("header") || pc.includes("nav") || pid.includes("header"))
        score += 25;
      p = p.parentElement;
      depth++;
    }

    return score;
  }

  function detectCandidates() {
    const all = [...$("img"), ...$("svg")];
    const scored = all
      .map(el => ({ el, score: scoreCandidate(el), type: el.tagName.toLowerCase() }))
      .filter(c => c.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10);
  }

  // ---------------- FLOATING BUTTON UI ----------------

  function showButtons(candidates) {
    const old = document.getElementById("logoGrabber-buttons-overlay");
    if (old) old.remove();

    const container = document.createElement("div");
    container.id = "logoGrabber-buttons-overlay";
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.zIndex = "999999";
    document.body.appendChild(container);

    alertV(
      "Detected " + candidates.length + " logo candidate(s).\n" +
      "Click any floating button to upload.\n\n" +
      "ESC = cancel"
    );

    function cleanup() {
      document.removeEventListener("keydown", esc);
      container.remove();
    }

    function esc(ev) {
      if (ev.key === "Escape") cleanup();
    }

    document.addEventListener("keydown", esc, true);

    candidates.forEach((c, i) => {
      const rect = c.el.getBoundingClientRect();

      const btn = document.createElement("button");
      btn.textContent = "Grab #" + (i + 1);
      Object.assign(btn.style, {
        position: "absolute",
        top: window.scrollY + rect.top + "px",
        left: window.scrollX + rect.left + "px",
        zIndex: 999999,
        background: "rgba(0,0,0,0.8)",
        color: "#fff",
        padding: "3px 6px",
        fontSize: "11px",
        border: "1px solid #333",
        borderRadius: "4px",
        cursor: "pointer"
      });

      btn.onclick = ev => {
        ev.stopPropagation();
        ev.preventDefault();
        cleanup();

        if (c.type === "svg") uploadSvgElement(c.el);
        else uploadImgElement(c.el);
      };

      container.appendChild(btn);
    });
  }

  // ---------------- ENTRY ----------------

  function start() {
    const candidates = detectCandidates();
    if (!candidates.length) {
      alertV("No suitable logos found.");
      return;
    }
    showButtons(candidates);
  }

  start();
})();
