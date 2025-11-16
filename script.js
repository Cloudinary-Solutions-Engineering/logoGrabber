(function() {
  const SCRIPT_VERSION = "1.4.0";
  console.log("LogoGrabber script loaded. Version:", SCRIPT_VERSION);

  const XLINK = "http://www.w3.org/1999/xlink";
  const makeNS = n => document.createElementNS("http://www.w3.org/2000/svg", n);
  const $ = (q, r = document) => Array.from(r.querySelectorAll(q));

  // ---------- SVG handling ----------

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
      const [x,y,w,h] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
      if (w > 0 && h > 0) {
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
      }
    }
  }

  // ---------- Domain-based naming ----------

  function getBaseDomain() {
    let host = window.location.hostname.toLowerCase();
    host = host.replace(/^www\./, "");
    host = host.replace(/\./g, "_");
    host = host.replace(/[^a-z0-9_]/g, "");
    return host || "site";
  }

  function getVersionForBase(baseSlug) {
    const key = "logoGrabber_" + baseSlug + "_version";
    try {
      const curr = parseInt(localStorage.getItem(key) || "0", 10) || 0;
      const next = curr + 1;
      localStorage.setItem(key, String(next));
      return next;
    } catch {
      return Date.now();
    }
  }

  function makePublicId() {
    const baseSlug = getBaseDomain();
    const version = getVersionForBase(baseSlug);
    return {
      baseSlug,
      version,
      publicId: baseSlug + "_logo_v" + version
    };
  }

  // ---------- Cloudinary Upload ----------

  const CLOUD_NAME = "patrickg-assets";
  const UPLOAD_PRESET = "unsignedUpload";
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

  function alertV(msg) {
    alert(`LogoGrabber v${SCRIPT_VERSION}\n\n${msg}`);
  }

  function handleResult(res, meta) {
    if (res.error) {
      alertV("Cloudinary error: " + res.error.message);
      console.error(res);
      return;
    }

    const url = res.secure_url;
    if (!url) {
      alertV("Upload succeeded, but no URL returned.");
      return;
    }

    const output =
      `Uploaded ✔️\n` +
      `Domain: ${meta.baseSlug}\n` +
      `Version: v${meta.version}\n` +
      `public_id: ${meta.publicId}\n\n` +
      `URL:\n${url}`;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => alertV(output + "\n(URL copied)"))
        .catch(() => alertV(output));
    } else {
      alertV(output);
    }
  }

  function uploadBlob(blob, filename) {
    const meta = makePublicId();
    const fd = new FormData();
    fd.append("file", blob, filename || meta.publicId);
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => handleResult(res, meta))
      .catch(err => alertV("Upload failed: " + err));
  }

  async function uploadExternalSvg(url) {
    try {
      const resp = await fetch(url);
      const text = await resp.text(); // valid SVG content
      const blob = new Blob([text], { type: "image/svg+xml" });
      uploadBlob(blob, "logo.svg");
    } catch (e) {
      console.error("SVG fetch failed, fallback to URL upload:", e);
      uploadUrl(url);
    }
  }

  function uploadUrl(url) {
    const meta = makePublicId();
    const fd = new FormData();
    fd.append("file", url);
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => handleResult(res, meta))
      .catch(err => alertV("Upload failed: " + err));
  }

  // ---------- Upload element types ----------

  function uploadSvgElement(svg) {
    cleanSvg(svg);
    expandUse(svg);
    copyDefs(svg);

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    uploadBlob(blob, "logo.svg");
  }

  function uploadImgElement(img) {
    const src = img.currentSrc || img.src;
    if (!src) {
      alertV("Image has no src attribute");
      return;
    }

    if (src.endsWith(".svg") || src.includes(".svg?")) {
      uploadExternalSvg(src);   // FIXED path for ASOS and others
      return;
    }

    if (!src.startsWith("data:")) {
      uploadUrl(src);
      return;
    }

    // handle data URLs
    try {
      const [, data] = src.split(",");
      const isBase64 = src.match(/base64/i);
      const mime = src.match(/data:(.*?);/)[1];
      let bytes;

      if (isBase64) {
        const bin = atob(data);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        bytes = arr;
      } else {
        bytes = new TextEncoder().encode(decodeURIComponent(data));
      }

      uploadBlob(new Blob([bytes], { type: mime }), "image");
    } catch (e) {
      console.error("data URL parsing failed", e);
      uploadUrl(src);
    }
  }

  // ---------- Selection UI ----------

  function startSelection() {
    const svgs = $("svg");
    const imgs = $("img");

    if (!svgs.length && !imgs.length) {
      alertV("No SVGs or images found.");
      return;
    }

    [...svgs, ...imgs].forEach(el => {
      el.style.outline = "2px solid red";
      el.style.cursor = "copy";
    });

    alertV("Click any highlighted SVG or IMG to upload as {domain}_logo_vN");

    function clear() {
      [...svgs, ...imgs].forEach(el => {
        el.style.outline = "";
        el.style.cursor = "";
      });
    }

    function clickHandler(e) {
      const s = e.target.closest("svg");
      const i = e.target.closest("img");

      if (!s && !i) return;

      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener("click", clickHandler, true);
      clear();

      if (s) uploadSvgElement(s);
      else if (i) uploadImgElement(i);
    }

    document.addEventListener("click", clickHandler, true);
  }

  startSelection();
})();
