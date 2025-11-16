(function () {
  const SCRIPT_VERSION = "3.0.0";
  console.log("LogoGrabber script loaded. Version:", SCRIPT_VERSION);

  const XLINK = "http://www.w3.org/1999/xlink";
  const CLOUD_NAME = "patrickg-assets";
  const UPLOAD_PRESET = "unsignedUpload";
  const UPLOAD_URL = "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/upload";
  const MAX_CANVAS_DIM = 1024; // option C: fit longest edge to 1024px

  const makeNS = n => document.createElementNS("http://www.w3.org/2000/svg", n);
  const $ = (q, r = document) => Array.from(r.querySelectorAll(q));

  function alertV(msg) {
    alert("LogoGrabber v" + SCRIPT_VERSION + "\n\n" + msg);
  }

  // ---------------- DOMAIN NAMING & VERSIONING ----------------

  function getBaseDomain() {
    try {
      let host = window.location.hostname.toLowerCase();
      host = host.replace(/^www\./, "");
      host = host.replace(/\./g, "_");
      host = host.replace(/[^a-z0-9_]/g, "");
      return host || "site";
    } catch (e) {
      return "site";
    }
  }

  const BASE_DOMAIN_SLUG = getBaseDomain();

  function getVersionForBase(baseSlug) {
    const key = "logoGrabber_" + baseSlug + "_version";
    try {
      const current = parseInt(localStorage.getItem(key) || "0", 10) || 0;
      const next = current + 1;
      localStorage.setItem(key, String(next));
      return next;
    } catch (e) {
      return Date.now();
    }
  }

  function makePublicId() {
    const baseSlug = BASE_DOMAIN_SLUG;
    const version = getVersionForBase(baseSlug);
    return {
      baseSlug,
      version,
      publicId: baseSlug + "_logo_v" + version
    };
  }

  // ---------------- GENERIC UPLOAD + FALLBACK ----------------

  function triggerDownload(blob, fileName) {
    try {
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = fileName || "logo_grabber_download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.error("Download failed:", e);
      alertV("Local download failed (see console).");
    }
  }

  function showUploadSuccess(res, meta) {
    const url = res.secure_url || res.url;
    if (!url) {
      alertV("Upload succeeded but no URL returned from Cloudinary.");
      console.log("Cloudinary response without URL:", res);
      return;
    }

    const msg =
      "Uploaded ✔️\n" +
      "Domain: " + meta.baseSlug + "\n" +
      "Version: v" + meta.version + "\n" +
      "public_id: " + meta.publicId + "\n\n" +
      "URL:\n" + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => alertV(msg + "\n(URL copied to clipboard)"))
        .catch(() => alertV(msg));
    } else {
      alertV(msg);
    }
  }

  function uploadBlobWithExistingMeta(meta, blob, filename, allowDownloadFallback) {
    const fd = new FormData();
    fd.append("file", blob, filename || meta.publicId);
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => {
        if (!res || res.error) {
          console.error("Cloudinary blob upload error:", res && res.error);
          if (allowDownloadFallback && blob) {
            alertV("Cloudinary upload failed.\nDownloading logo locally instead.");
            triggerDownload(blob, filename || (meta.publicId + ".png"));
          } else {
            alertV("Cloudinary upload failed and no fallback available.");
          }
        } else {
          showUploadSuccess(res, meta);
        }
      })
      .catch(err => {
        console.error("Cloudinary blob upload crash:", err);
        if (allowDownloadFallback && blob) {
          alertV("Upload crashed.\nDownloading logo locally instead.");
          triggerDownload(blob, filename || (meta.publicId + ".png"));
        } else {
          alertV("Upload crashed and no fallback available.");
        }
      });
  }

  function uploadBlobNewMeta(blob, filename, allowDownloadFallback) {
    const meta = makePublicId();
    uploadBlobWithExistingMeta(meta, blob, filename, allowDownloadFallback);
  }

  function uploadUrlWithMeta(meta, url, onError) {
    const fd = new FormData();
    fd.append("file", url); // Cloudinary will fetch this server-side
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => {
        if (!res || res.error) {
          console.error("Cloudinary URL upload error:", res && res.error);
          if (typeof onError === "function") onError(res && res.error);
        } else {
          showUploadSuccess(res, meta);
        }
      })
      .catch(err => {
        console.error("Cloudinary URL upload crash:", err);
        if (typeof onError === "function") onError(err);
      });
  }

  // ---------------- SVG PROCESSING ----------------

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
      const source = document.getElementById(id);
      if (!source) return;

      const g = makeNS("g");
      use.getAttributeNames().forEach(a => {
        if (a !== "href" && a !== "xlink:href") {
          g.setAttribute(a, use.getAttribute(a));
        }
      });

      if (source.tagName.toLowerCase() === "symbol") {
        if (!svg.hasAttribute("viewBox") && source.hasAttribute("viewBox")) {
          svg.setAttribute("viewBox", source.getAttribute("viewBox"));
        }
        Array.from(source.childNodes).forEach(n => g.appendChild(n.cloneNode(true)));
      } else {
        g.appendChild(source.cloneNode(true));
      }

      use.replaceWith(g);
    });
  }

  function cleanSvg(svg) {
    svg.style.outline = "";
    svg.removeAttribute("style");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("xmlns:xlink", XLINK);

    if (!svg.getAttribute("width") &&
        !svg.getAttribute("height") &&
        svg.hasAttribute("viewBox")) {
      const vals = svg.getAttribute("viewBox").split(/\s+/).map(Number);
      if (vals.length === 4) {
        const w = vals[2];
        const h = vals[3];
        if (w > 0 && h > 0) {
          svg.setAttribute("width", w);
          svg.setAttribute("height", h);
        }
      }
    }
  }

  function svgElementToBlob(svg) {
    cleanSvg(svg);
    expandUse(svg);
    copyDefs(svg);
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                new XMLSerializer().serializeToString(svg);
    return new Blob([xml], { type: "image/svg+xml" });
  }

  // ---------------- DATA URL → BLOB ----------------

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const header = parts[0];
    const data = parts[1];
    const mimeMatch = header.match(/data:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const isBase64 = /base64/i.test(header);

    if (isBase64) {
      const binary = atob(data);
      const len = binary.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } else {
      const decoded = decodeURIComponent(data);
      const bytes = new TextEncoder().encode(decoded);
      return new Blob([bytes], { type: mime });
    }
  }

  // ---------------- CANVAS PNG FALLBACK (for blocked SVG URLs) ----------------

  function canvasSvgToPngBlob(src, callback) {
    const img = new Image();
    // crossOrigin hint – may or may not be honoured by server
    img.crossOrigin = "anonymous";

    img.onload = function () {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (!w || !h) {
        w = 512;
        h = 512;
      }

      const maxSide = Math.max(w, h);
      const scale = MAX_CANVAS_DIM / maxSide;
      const outW = Math.round(w * scale);
      const outH = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, outW, outH);

      canvas.toBlob(function (blob) {
        if (!blob) {
          callback(new Error("Canvas toBlob() returned null"), null);
        } else {
          callback(null, blob);
        }
      }, "image/png");
    };

    img.onerror = function (e) {
      callback(new Error("Image load error"), null);
    };

    try {
      img.src = src;
    } catch (e) {
      callback(e, null);
    }
  }

  // ---------------- ELEMENT UPLOAD FLOW ----------------

  function uploadSvgElement(svg) {
    try {
      const blob = svgElementToBlob(svg);
      uploadBlobNewMeta(blob, "logo.svg", true);
    } catch (e) {
      console.error("SVG processing error:", e);
      alertV("Failed to process inline SVG.");
    }
  }

  function uploadExternalSvgWithFallback(imgEl, src) {
    // For external SVGs, try Cloudinary URL-upload first, then canvas PNG if that fails
    const meta = makePublicId();

    uploadUrlWithMeta(meta, src, function () {
      // URL upload failed → try canvas PNG fallback
      alertV("Cloudinary couldn't fetch the SVG directly.\nTrying PNG fallback via canvas.");
      canvasSvgToPngBlob(src, function (err, pngBlob) {
        if (err || !pngBlob) {
          console.error("Canvas PNG fallback failed:", err);
          alertV(
            "PNG fallback via canvas also failed.\n" +
            "This is likely due to strict CORS or image protection.\n" +
            "You may need to screenshot this logo manually."
          );
          return;
        }
        // Reuse same meta: upload as PNG with fallback-to-download
        uploadBlobWithExistingMeta(meta, pngBlob, meta.publicId + ".png", true);
      });
    });
  }

  function uploadImgElement(img) {
    const src = img.currentSrc || img.src;
    if (!src) {
      alertV("Selected image has no src.");
      return;
    }

    // External SVG file
    if (/\.svg(\?|#|$)/i.test(src)) {
      uploadExternalSvgWithFallback(img, src);
      return;
    }

    // Data URL
    if (src.indexOf("data:") === 0) {
      const blob = dataUrlToBlob(src);
      if (!blob) {
        alertV("Could not parse data URL for this image.");
        return;
      }
      uploadBlobNewMeta(blob, "logo_image", true);
      return;
    }

    // Normal raster URL (png, jpg, webp, etc.)
    fetch(src)
      .then(r => r.blob())
      .then(blob => uploadBlobNewMeta(blob, "logo_image", true))
      .catch(err => {
        console.error("Image fetch failed:", err);
        alertV("Fetching this image failed; cannot upload.");
      });
  }

  // ---------------- LOGO DETECTION (improved for AwayResorts etc.) ----------------

  function scoreCandidate(el) {
    let score = 0;
    const tag = el.tagName.toLowerCase();
    const id = (el.id || "").toLowerCase();
    const classes = (el.className && el.className.toString ? el.className.toString() : "").toLowerCase();
    const alt = (el.getAttribute && el.getAttribute("alt") || "").toLowerCase();
    const src = (el.getAttribute && el.getAttribute("src") || "").toLowerCase();
    const aria = (el.getAttribute && el.getAttribute("aria-label") || "").toLowerCase();

    function has(word) {
      return id.includes(word) || classes.includes(word) || alt.includes(word) || src.includes(word) || aria.includes(word);
    }

    // Strong logo/brand hints
    if (has("logo")) score += 60;
    if (has("brand")) score += 30;
    if (has("icon")) score += 10;

    // Contains domain slug text (e.g. awayresorts)
    if (BASE_DOMAIN_SLUG && (alt.includes(BASE_DOMAIN_SLUG) || src.includes(BASE_DOMAIN_SLUG) || classes.includes(BASE_DOMAIN_SLUG))) {
      score += 40;
    }

    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > 32 && area < 500000) score += 10;
    if (rect.width > rect.height) score += 5;

    // Header/nav/home-link context
    let parent = el.parentElement;
    let depth = 0;
    while (parent && depth < 6) {
      const tn = parent.tagName.toLowerCase();
      const pid = (parent.id || "").toLowerCase();
      const pcl = (parent.className && parent.className.toString ? parent.className.toString() : "").toLowerCase();

      if (tn === "header" || tn === "nav") score += 40;
      if (pcl.includes("header") || pcl.includes("navbar") || pcl.includes("topbar") || pcl.includes("site-header")) {
        score += 30;
      }
      if (pid.includes("header") || pid.includes("logo")) score += 25;

      if (tn === "a") {
        const href = parent.getAttribute("href") || "";
        const normHref = href.replace(window.location.origin, "");
        if (normHref === "/" || normHref === "" || /^\/[a-z]{2}(-[A-Z]{2})?\/?$/.test(normHref)) {
          score += 50; // very strong: home link
        }
      }

      parent = parent.parentElement;
      depth++;
    }

    if (tag === "svg") score += 15;
    if (tag === "img") score += 10;

    return score;
  }

  function detectLogoCandidates() {
    const imgs = $("img");
    const svgs = $("svg");
    const all = [];

    imgs.forEach(el => all.push({ el, type: "img", score: scoreCandidate(el) }));
    svgs.forEach(el => all.push({ el, type: "svg", score: scoreCandidate(el) }));

    all.sort((a, b) => b.score - a.score);
    // Keep some even if score is small, but not negatives
    const filtered = all.filter(c => c.score > 0).slice(0, 12);
    return filtered;
  }

  // ---------------- FLOATING "Grab" BUTTON UI ----------------

  function showGrabButtons(candidates) {
    const existing = document.getElementById("logoGrabber-buttons-overlay");
    if (existing) existing.remove();

    if (!candidates.length) {
      alertV("No logo-like SVGs or images found on this page.");
      return;
    }

    const container = document.createElement("div");
    container.id = "logoGrabber-buttons-overlay";
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "0";
    container.style.height = "0";
    container.style.zIndex = "999999";
    document.body.appendChild(container);

    alertV(
      "Detected " + candidates.length + " logo candidate(s).\n" +
      "Look for small 'Grab #N' buttons over logos.\n\n" +
      "Press ESC to cancel."
    );

    function cleanup() {
      document.removeEventListener("keydown", escListener, true);
      if (container.parentNode) container.parentNode.removeChild(container);
    }

    function escListener(ev) {
      if (ev.key === "Escape" || ev.key === "Esc") {
        ev.stopPropagation();
        cleanup();
      }
    }

    document.addEventListener("keydown", escListener, true);

    candidates.forEach((c, idx) => {
      const rect = c.el.getBoundingClientRect();
      const btn = document.createElement("button");
      btn.textContent = "Grab #" + (idx + 1);
      btn.style.position = "absolute";
      btn.style.top = window.scrollY + rect.top + "px";
      btn.style.left = window.scrollX + rect.left + "px";
      btn.style.zIndex = "1000000";
      btn.style.padding = "3px 6px";
      btn.style.fontSize = "11px";
      btn.style.borderRadius = "4px";
      btn.style.border = "1px solid #333";
      btn.style.background = "rgba(0,0,0,0.85)";
      btn.style.color = "#fff";
      btn.style.cursor = "pointer";
      btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";

      btn.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        cleanup();
        if (c.type === "svg") {
          uploadSvgElement(c.el);
        } else {
          uploadImgElement(c.el);
        }
      });

      container.appendChild(btn);
    });
  }

  // ---------------- ENTRY POINT ----------------

  function startLogoGrabber() {
    const candidates = detectLogoCandidates();
    showGrabButtons(candidates);
  }

  startLogoGrabber();
})();
