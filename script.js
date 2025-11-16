(function() {
  const SCRIPT_VERSION = "2.0.0";
  console.log("LogoGrabber script loaded. Version:", SCRIPT_VERSION);

  const XLINK = "http://www.w3.org/1999/xlink";
  const CLOUD_NAME = "patrickg-assets";
  const UPLOAD_PRESET = "unsignedUpload";
  const UPLOAD_URL = "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/upload";

  const makeNS = n => document.createElementNS("http://www.w3.org/2000/svg", n);
  const $ = (q, r = document) => Array.from(r.querySelectorAll(q));

  function alertV(message) {
    alert("LogoGrabber v" + SCRIPT_VERSION + "\n\n" + message);
  }

  // ---------- Domain + public_id helpers ----------

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
    const baseSlug = getBaseDomain();
    const version = getVersionForBase(baseSlug);
    return {
      baseSlug: baseSlug,
      version: version,
      publicId: baseSlug + "_logo_v" + version
    };
  }

  // ---------- SVG tools ----------

  function copyDefs(svg) {
    const defs = svg.querySelector("defs") || svg.insertBefore(makeNS("defs"), svg.firstChild);
    const seen = new Set(Array.from(defs.children).map(function(n){return n.id;}).filter(Boolean));
    $("svg defs").forEach(function(d) {
      Array.from(d.children).forEach(function(node) {
        if (node.nodeType === 1 && (!node.id || !seen.has(node.id))) {
          defs.appendChild(node.cloneNode(true));
          if (node.id) seen.add(node.id);
        }
      });
    });
  }

  function expandUse(svg) {
    $("use", svg).forEach(function(use) {
      const ref = use.getAttribute("href") ||
                  use.getAttributeNS(XLINK, "href") ||
                  use.getAttribute("xlink:href");
      if (!ref) return;

      const parts = ref.split("#");
      if (parts.length < 2) return;
      const id = parts[1];
      const source = document.getElementById(id);
      if (!source) return;

      const g = makeNS("g");
      use.getAttributeNames().forEach(function(a) {
        if (a !== "href" && a !== "xlink:href") {
          g.setAttribute(a, use.getAttribute(a));
        }
      });

      if (source.tagName.toLowerCase() === "symbol") {
        if (!svg.hasAttribute("viewBox") && source.hasAttribute("viewBox")) {
          svg.setAttribute("viewBox", source.getAttribute("viewBox"));
        }
        Array.from(source.childNodes).forEach(function(n) {
          g.appendChild(n.cloneNode(true));
        });
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

  // ---------- Upload + fallback download ----------

  function triggerDownload(blob, suggestedName) {
    try {
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = suggestedName || "logo_grabber_download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    } catch (e) {
      console.error("Download failed:", e);
      alertV("Local download also failed. See console for details.");
    }
  }

  function handleUploadResponseOrDownload(res, meta, fallbackBlob, fallbackName) {
    // Cloudinary error → fallback to local download
    if (!res || res.error) {
      if (res && res.error) {
        console.error("Cloudinary error:", res.error);
      } else {
        console.error("Cloudinary unknown error:", res);
      }
      alertV("Cloudinary upload failed.\nI’ll download the logo locally instead.");
      if (fallbackBlob) {
        triggerDownload(fallbackBlob, fallbackName || (meta.publicId + ".svg"));
      } else {
        alertV("No fallback blob available to download.");
      }
      return;
    }

    const url = res.secure_url || res.url;
    if (!url) {
      console.error("Cloudinary response without URL:", res);
      alertV("Upload succeeded but no URL returned.\nNo local download used (Cloudinary response has no URL).");
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
        .then(function() {
          alertV(msg + "\n(URL copied to clipboard)");
        })
        .catch(function() {
          alertV(msg);
        });
    } else {
      alertV(msg);
    }
  }

  function uploadBlobWithFallback(blob, filename) {
    const meta = makePublicId();
    const fd = new FormData();
    fd.append("file", blob, filename || (meta.publicId + ".bin"));
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(function(r){ return r.json(); })
      .then(function(res){
        handleUploadResponseOrDownload(res, meta, blob, filename || (meta.publicId + ".bin"));
      })
      .catch(function(err){
        console.error("Cloudinary upload error:", err);
        alertV("Cloudinary upload threw an error.\nAttempting local download.");
        triggerDownload(blob, filename || (meta.publicId + ".bin"));
      });
  }

  // ---------- Element → blob conversions ----------

  function svgElementToBlob(svg) {
    cleanSvg(svg);
    expandUse(svg);
    copyDefs(svg);
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                new XMLSerializer().serializeToString(svg);
    return new Blob([xml], { type: "image/svg+xml" });
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const header = parts[0];
    const data = parts[1];
    const isBase64 = /base64/i.test(header);
    const mimeMatch = header.match(/data:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";

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

  function fetchUrlToBlob(url, typeHint, cb) {
    fetch(url)
      .then(function(r) {
        if (typeHint === "text") return r.text().then(function(txt){
          return new Blob([txt], { type: "image/svg+xml" });
        });
        return r.blob();
      })
      .then(function(blob) {
        cb(null, blob);
      })
      .catch(function(err) {
        cb(err || new Error("fetch failed"));
      });
  }

  // ---------- Upload wrappers ----------

  function uploadSvgElement(svg) {
    try {
      const blob = svgElementToBlob(svg);
      uploadBlobWithFallback(blob, "logo.svg");
    } catch (e) {
      console.error("Failed to process SVG:", e);
      alertV("Failed to process SVG; cannot upload.");
    }
  }

  function uploadImgElement(img) {
    const src = img.currentSrc || img.src;
    if (!src) {
      alertV("Image has no src attribute.");
      return;
    }

    // Case 1: Data URL
    if (src.indexOf("data:") === 0) {
      const blob = dataUrlToBlob(src);
      if (!blob) {
        alertV("Could not parse data URL image.");
        return;
      }
      uploadBlobWithFallback(blob, "logo_image");
      return;
    }

    // Case 2: .svg file URL
    if (src.match(/\.svg(\?|#|$)/i)) {
      fetchUrlToBlob(src, "text", function(err, blob) {
        if (err || !blob) {
          console.error("Error fetching external SVG:", err);
          alertV("Failed to fetch external SVG; cannot upload.");
          return;
        }
        uploadBlobWithFallback(blob, "logo.svg");
      });
      return;
    }

    // Case 3: other image URL (png/jpg/webp/etc.)
    fetchUrlToBlob(src, "blob", function(err, blob) {
      if (err || !blob) {
        console.error("Error fetching image:", err);
        alertV("Failed to fetch image; cannot upload.");
        return;
      }
      uploadBlobWithFallback(blob, "logo_image");
    });
  }

  // ---------- Logo candidate detection ----------

  function scoreCandidate(el) {
    let score = 0;
    const tag = el.tagName.toLowerCase();

    const id = (el.id || "").toLowerCase();
    const cls = (el.className && el.className.toString ? el.className.toString() : "").toLowerCase();
    const alt = (el.getAttribute && el.getAttribute("alt") || "").toLowerCase();
    const src = (el.getAttribute && el.getAttribute("src") || "").toLowerCase();
    const ariaLabel = (el.getAttribute && el.getAttribute("aria-label") || "").toLowerCase();

    function has(word) {
      return id.indexOf(word) >= 0 ||
             cls.indexOf(word) >= 0 ||
             alt.indexOf(word) >= 0 ||
             src.indexOf(word) >= 0 ||
             ariaLabel.indexOf(word) >= 0;
    }

    if (has("logo")) score += 50;
    if (has("brand")) score += 20;
    if (has("header")) score += 10;

    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > 0 && area < 80000) score += 5;  // not too huge
    if (rect.width > rect.height) score += 5;  // often wider than tall

    let parent = el.parentElement;
    let depth = 0;
    while (parent && depth < 5) {
      const tn = parent.tagName.toLowerCase();
      const pid = (parent.id || "").toLowerCase();
      const pcl = (parent.className && parent.className.toString ? parent.className.toString() : "").toLowerCase();
      if (tn === "header" || tn === "nav") score += 30;
      if (pcl.indexOf("header") >= 0 || pcl.indexOf("navbar") >= 0 || pcl.indexOf("topbar") >= 0) score += 20;
      if (pid.indexOf("header") >= 0) score += 20;

      const href = parent.getAttribute && parent.getAttribute("href");
      if (tn === "a" && href && (href === "/" || href === window.location.origin || href === window.location.origin + "/")) {
        score += 30;
      }

      parent = parent.parentElement;
      depth++;
    }

    if (tag === "svg") score += 10;
    if (tag === "img") score += 5;

    return score;
  }

  function findLogoCandidates() {
    const imgEls = $("img");
    const svgEls = $("svg");
    const candidates = [];

    imgEls.forEach(function(el) {
      candidates.push({ el: el, type: "img", score: scoreCandidate(el) });
    });
    svgEls.forEach(function(el) {
      candidates.push({ el: el, type: "svg", score: scoreCandidate(el) });
    });

    const filtered = candidates.filter(function(c){ return c.score > 0; });
    filtered.sort(function(a,b){ return b.score - a.score; });

    return filtered.slice(0, 12); // top N
  }

  // ---------- Floating button overlay (Option D) ----------

  function createButtonForCandidate(candidate, index, onSelect, buttonsContainer) {
    const el = candidate.el;
    const rect = el.getBoundingClientRect();

    const btn = document.createElement("button");
    btn.textContent = "Grab logo #" + (index + 1);
    btn.style.position = "absolute";
    btn.style.zIndex = "999999";
    btn.style.padding = "4px 8px";
    btn.style.fontSize = "11px";
    btn.style.borderRadius = "4px";
    btn.style.border = "1px solid #333";
    btn.style.background = "rgba(0,0,0,0.8)";
    btn.style.color = "#fff";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
    btn.style.top = (window.scrollY + rect.top - 10) + "px";
    btn.style.left = (window.scrollX + rect.left) + "px";

    btn.addEventListener("click", function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      onSelect(candidate);
    });

    buttonsContainer.appendChild(btn);
    return btn;
  }

  function showOverlayButtons(candidates) {
    const existing = document.getElementById("logoGrabber-buttons-overlay");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "logoGrabber-buttons-overlay";
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "0";
    container.style.height = "0";
    container.style.zIndex = "999998";
    document.body.appendChild(container);

    if (!candidates.length) {
      alertV("No good logo candidates found.\nTry clicking the bookmarklet on another page.");
      return;
    }

    alertV(
      "Detected " + candidates.length + " logo candidate(s).\n" +
      "Look for small 'Grab logo #N' buttons near each logo.\n\n" +
      "Press ESC to cancel."
    );

    function cleanup() {
      document.removeEventListener("keydown", escListener, true);
      const overlay = document.getElementById("logoGrabber-buttons-overlay");
      if (overlay) overlay.remove();
    }

    function escListener(ev) {
      if (ev.key === "Escape" || ev.key === "Esc") {
        ev.stopPropagation();
        cleanup();
      }
    }

    document.addEventListener("keydown", escListener, true);

    candidates.forEach(function(c, idx) {
      createButtonForCandidate(c, idx, function(chosen) {
        cleanup();
        if (chosen.type === "svg") {
          uploadSvgElement(chosen.el);
        } else {
          uploadImgElement(chosen.el);
        }
      }, container);
    });
  }

  // ---------- Entry point ----------

  function startLogoGrabber() {
    const candidates = findLogoCandidates();
    if (!candidates.length) {
      alertV("No SVGs or images found that look like logos.");
      return;
    }
    showOverlayButtons(candidates);
  }

  // Run immediately
  startLogoGrabber();
})();
