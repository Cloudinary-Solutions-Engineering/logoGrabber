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
    const fd = new Form
