(function() {
  const SCRIPT_VERSION = "1.2.0";
  console.log("LogoGrabber script loaded. Version:", SCRIPT_VERSION);

  const XLINK = "http://www.w3.org/1999/xlink";
  const makeNS = n => document.createElementNS("http://www.w3.org/2000/svg", n);
  const $ = (q, r = document) => Array.from(r.querySelectorAll(q));

  // ---------- SVG helpers ----------

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

  // ---------- Naming helpers ----------

  function getSiteName() {
    try {
      const ogSite = document.querySelector('meta[property="og:site_name"]');
      if (ogSite && ogSite.content) return ogSite.content;

      const appName = document.querySelector('meta[name="application-name"]');
      if (appName && appName.content) return appName.content;

      if (document.title && document.title.trim()) return document.title.trim();

      return window.location.hostname || "site";
    } catch (e) {
      return "site";
    }
  }

  function slugify(str) {
    return (str || "site")
      .toLowerCase()
      .replace(/https?:\/\//g, "")
      .replace(/www\./g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "site";
  }

  function getVersionForBase(baseSlug) {
    const key = "logoGrabber_" + baseSlug + "_version";
    try {
      const current = parseInt(localStorage.getItem(key) || "0", 10) || 0;
      const next = current + 1;
      localStorage.setItem(key, String(next));
      return next;
    } catch (e) {
      // Fallback if localStorage blocked: use timestamp
      return Date.now();
    }
  }

  function makePublicId() {
    const siteName = getSiteName();
    const baseSlug = slugify(siteName);
    const version = getVersionForBase(baseSlug);
    return {
      siteName,
      baseSlug,
      version,
      publicId: baseSlug + "_logo_v" + version
    };
  }

  // ---------- Upload helpers ----------

  const CLOUD_NAME = "patrickg-assets";
  const UPLOAD_PRESET = "unsignedUpload";
  const UPLOAD_URL = "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/upload";

  function alertWithVersion(message) {
    alert("LogoGrabber v" + SCRIPT_VERSION + "\n\n" + message);
  }

  function handleUploadResponse(res, meta) {
    if (res.error) {
      alertWithVersion("Cloudinary error: " + res.error.message);
      console.error("Cloudinary error:", res);
      return;
    }

    const url = res.secure_url || res.url;
    if (!url) {
      alertWithVersion("Upload succeeded but no URL returned. Check console.");
      console.log(res);
      return;
    }

    const msg =
      "Uploaded ✅\n" +
      "Site: " + meta.baseSlug + "\n" +
      "Version: v" + meta.version + "\n" +
      "public_id: " + meta.publicId + "\n\n" +
      "URL:\n" + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => alertWithVersion(msg + "\n(URL copied to clipboard)"))
        .catch(() => alertWithVersion(msg));
    } else {
      alertWithVersion(msg);
    }

    console.log("Uploaded to Cloudinary:", res);
  }

  function uploadBlobToCloudinary(blob, filename) {
    const meta = makePublicId();
    const fd = new FormData();
    fd.append("file", blob, filename || (meta.publicId + ".bin"));
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => handleUploadResponse(res, meta))
      .catch(err => {
        alertWithVersion("Upload failed. See console.");
        console.error("Upload error:", err);
      });
  }

  function uploadUrlToCloudinary(url) {
    const meta = makePublicId();
    const fd = new FormData();
    // Cloudinary will fetch this remote URL
    fd.append("file", url);
    fd.append("public_id", meta.publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => handleUploadResponse(res, meta))
      .catch(err => {
        alertWithVersion("Upload failed. See console.");
        console.error("Upload error:", err);
      });
  }

  function uploadSvgElement(svg) {
    cleanSvg(svg);
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    uploadBlobToCloudinary(blob, "logo.svg");
  }

  function uploadImgElement(img) {
    // If it's a data URL, turn it into a Blob; otherwise, let Cloudinary fetch the remote URL.
    const src = img.currentSrc || img.src;
    if (!src) {
      alertWithVersion("Selected image has no src.");
      return;
    }

    if (src.startsWith("data:")) {
      try {
        const parts = src.split(",");
        const header = parts[0];
        const data = parts[1];
        const isBase64 = /;base64$/i.test(header.split(";")[1] || "");
        const mime = header.split(":")[1].split(";")[0] || "application/octet-stream";

        let bytes;
        if (isBase64) {
          const binary = atob(data);
          const len = binary.length;
          const arr = new Uint8Array(len);
          for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
          bytes = arr;
        } else {
          bytes = new TextEncoder().encode(decodeURIComponent(data));
        }

        const blob = new Blob([bytes], { type: mime });
        uploadBlobToCloudinary(blob, "logo_image");
      } catch (e) {
        console.error("Failed to parse data URL, falling back to direct URL upload:", e);
        uploadUrlToCloudinary(src);
      }
    } else {
      uploadUrlToCloudinary(src);
    }
  }

  // ---------- Selection UI ----------

  function startSelection() {
    const svgs = $("svg");
    const imgs = $("img");

    if (!svgs.length && !imgs.length) {
      alertWithVersion("No SVGs or images found on this page.");
      return;
    }

    svgs.forEach(s => {
      s.style.outline = "2px solid red";
      s.style.cursor = "copy";
    });
    imgs.forEach(i => {
      i.style.outline = "2px solid red";
      i.style.cursor = "copy";
    });

    alertWithVersion("Click any highlighted SVG or image to upload as {site}_logo_vN.");

    function clearHighlights() {
      svgs.forEach(s => { s.style.outline = ""; s.style.cursor = ""; });
      imgs.forEach(i => { i.style.outline = ""; i.style.cursor = ""; });
    }

    function clickHandler(e) {
      const targetSvg = e.target.closest("svg");
      const targetImg = e.target.closest("img");

      if (!targetSvg && !targetImg) return;

      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener("click", clickHandler, true);
      clearHighlights();

      if (targetSvg) {
        const clone = targetSvg.cloneNode(true);
        expandUse(clone);
        copyDefs(clone);
        uploadSvgElement(clone);
      } else if (targetImg) {
        uploadImgElement(targetImg);
      }
    }

    document.addEventListener("click", clickHandler, true);
  }

  // Start immediately
  startSelection();

})();
