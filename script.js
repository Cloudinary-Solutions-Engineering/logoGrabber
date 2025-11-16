(function() {
  console.log("LogoGrabber script loaded.");

  const XLINK = "http://www.w3.org/1999/xlink";
  const makeNS = n => document.createElementNS("http://www.w3.org/2000/svg", n);
  const $ = (q, r = document) => Array.from(r.querySelectorAll(q));

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

  // ---- Naming helpers ----

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
      baseSlug,
      version,
      publicId: baseSlug + "_logo_v" + version
    };
  }

  function uploadToCloudinary(svg) {
    cleanSvg(svg);

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });

    const { baseSlug, version, publicId } = makePublicId();

    const fd = new FormData();
    fd.append("file", blob, publicId + ".svg");
    fd.append("public_id", publicId);
    // no overwrite: each version is unique
    fd.append("upload_preset", "unsignedUpload");

    const endpoint = "https://api.cloudinary.com/v1_1/patrickg-assets/upload";

    fetch(endpoint, { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => {
        if (res.error) {
          alert("Cloudinary error: " + res.error.message);
          console.error("Cloudinary error:", res);
          return;
        }

        const url = res.secure_url;
        if (!url) {
          alert("Upload succeeded but no URL returned. Check console.");
          console.log(res);
          return;
        }

        const msg = 
          "Uploaded ✅\n" +
          "Site: " + baseSlug + "\n" +
          "Version: v" + version + "\n" +
          "public_id: " + publicId + "\n\n" +
          "URL:\n" + url;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url)
            .then(() => alert(msg + "\n(URL copied to clipboard)"))
            .catch(() => alert(msg));
        } else {
          alert(msg);
        }

        console.log("Uploaded to Cloudinary:", res);
      })
      .catch(err => {
        alert("Upload failed. See console.");
        console.error("Upload error:", err);
      });
  }

  function startSelection() {
    const svgs = $("svg");

    if (!svgs.length) {
      alert("No inline SVGs found on this page.");
      return;
    }

    svgs.forEach(s => {
      s.style.outline = "2px solid red";
      s.style.cursor = "copy";
    });

    alert("LogoGrabber: Click any highlighted SVG to upload as {site}_logo_vN.");

    function clickHandler(e) {
      const svg = e.target.closest("svg");
      if (!svg) return;

      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener("click", clickHandler, true);

      const clone = svg.cloneNode(true);
      expandUse(clone);
      copyDefs(clone);
      uploadToCloudinary(clone);
    }

    document.addEventListener("click", clickHandler, true);
  }

  // Start immediately
  startSelection();

})();
