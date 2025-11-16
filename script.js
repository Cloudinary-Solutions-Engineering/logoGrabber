(function() {
  const SCRIPT_VERSION = "1.3.0";
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
        if (source.hasAttribute("viewBox") && !svg.hasAttribute("viewBox")) {
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
      const v = svg.getAttribute("viewBox").split(/\s+/).map(Number);
      if (v.length === 4) {
        svg.setAttribute("width", v[2]);
        svg.setAttribute("height", v[3]);
      }
    }
  }

  // ---------- Domain-based naming ----------

  function getBaseDomain() {
    try {
      let host = window.location.hostname.toLowerCase();
      host = host.replace(/^www\./, "");    // strip www
      host = host.replace(/\./g, "_");      // dots → underscores
      host = host.replace(/[^a-z0-9_]/g, ""); // cleanup
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
      return Date.now(); // fallback if localStorage disabled
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
  const UPLOAD_URL = "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/upload";

  function alertV(message) {
    alert("LogoGrabber v" + SCRIPT_VERSION + "\n\n" + message);
  }

  function handleUploadResponse(res, meta) {
    if (res.error) {
      alertV("Cloudinary error: " + res.error.message);
      console.error("Cloudinary error:", res);
      return;
    }

    const url = res.secure_url || res.url;
    if (!url) {
      alertV("Upload succeeded but no URL returned. See console.");
      console.log(res);
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

  function uploadBlob(blob, filename) {
    const meta = makePublicId();
    const fd = new FormData();
    fd.append("file", blob, filename || meta.publicId + ".bin");
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => handleUploadResponse(res, meta))
      .catch(err => {
        alertV("Upload failed. See console.");
        console.error(err);
      });
  }

  function uploadUrl(url) {
    const meta = makePublicId();
    const fd = new FormData();
    fd.append("file", url);
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => handleUploadResponse(res, meta))
      .catch(err => {
        alertV("Upload failed. See console.");
        console.error(err);
      });
  }

  // ---------- Element uploaders ----------
  
  function uploadSvgElement(svg) {
    cleanSvg(svg);
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    uploadBlob(blob, "logo.svg");
  }

  function uploadImgElement(img) {
    const src = img.currentSrc || img.src;
    if (!src) {
      alertV("Selected image has no src.");
      return;
    }

    // Direct URL upload
    if (!src.startsWith("data:")) {
      uploadUrl(src);
      return;
    }

    // Data URL → Blob
    try {
      const parts = src.split(",");
      const header = parts[0];
      const data = parts[1];
      const isBase64 = /base64/i.test(header);
      const mime = header.split(":")[1].split(";")[0];

      let bytes;
      if (isBase64) {
        const binary = atob(data);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        bytes = arr;
      } else {
        bytes = new TextEncoder().encode(decodeURIComponent(data));
      }

      uploadBlob(new Blob([bytes], { type: mime }), "image");
    } catch (err) {
      console.error("Data URL parse failure:", err);
      uploadUrl(src);
    }
  }

  // ---------- UI + Selection ----------

  function startSelection() {
    const svgs = $("svg");
    const imgs = $("img");

    if (!svgs.length && !imgs.length) {
      alertV("No SVGs or images found on this page.");
      return;
    }

    svgs.forEach(el => { el.style.outline = "2px solid red"; el.style.cursor = "copy"; });
    imgs.forEach(el => { el.style.outline = "2px solid red"; el.style.cursor = "copy"; });

    alertV("Click any highlighted SVG or IMG to upload as {domain}_logo_vN");

    function clear() {
      svgs.forEach(el => { el.style.outline = ""; el.style.cursor = ""; });
      imgs.forEach(el => { el.style.outline = ""; el.style.cursor = ""; });
    }

    function clickHandler(e) {
      const s = e.target.closest("svg");
      const i = e.target.closest("img");

      if (!s && !i) return;

      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener("click", clickHandler, true);
      clear();

      if (s) {
        const clone = s.cloneNode(true);
        expandUse(clone);
        copyDefs(clone);
        uploadSvgElement(clone);
      } else {
        uploadImgElement(i);
      }
    }

    document.addEventListener("click", clickHandler, true);
  }

  startSelection();
})();
