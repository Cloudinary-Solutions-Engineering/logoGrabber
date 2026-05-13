(() => {
  const CLOUD_NAME = "patrickg-assets";
  const UPLOAD_PRESET = "unsignedUpload";
  const UPLOAD_FOLDER = "";

  const old = document.getElementById("lg-picker");
  if (old) old.remove();

  const found = [];
  const seen = new Set();

  const esc = s => String(s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

  const add = (el, type, src) => {
    const key = src || el;
    if (seen.has(key)) return;
    seen.add(key);

    const r = el.getBoundingClientRect?.() || {};
    let data = src;

    if (!src && el.tagName?.toLowerCase() === "svg") {
      const c = el.cloneNode(true);

      if (!c.getAttribute("xmlns")) {
        c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }

      if (!c.getAttribute("viewBox") && r.width && r.height) {
        c.setAttribute("viewBox", `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
      }

      data = "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(new XMLSerializer().serializeToString(c));
    }

    const txt = [
      el.id,
      typeof el.className === "string" ? el.className : "",
      el.getAttribute?.("alt"),
      el.getAttribute?.("title"),
      el.getAttribute?.("aria-label"),
      el.closest?.("[class]")?.getAttribute("class"),
      el.closest?.("[id]")?.getAttribute("id")
    ].filter(Boolean).join(" ");

    let score = 0;
    if (/logo|brand|header|nav|masthead|identity/i.test(txt)) score += 50;
    if (r.top < 200) score += 20;
    if (r.width > 30 && r.height > 10) score += 20;
    if (/icon|sprite|social|facebook|twitter|linkedin|instagram/i.test(txt)) score -= 20;

    found.push({ el, type, data, txt, r, score });
  };

  const scan = root => {
    root.querySelectorAll?.("svg").forEach(el => add(el, "inline SVG"));

    root.querySelectorAll?.("img[src],object[data],embed[src]").forEach(el => {
      const src =
        el.src ||
        el.data ||
        el.getAttribute("src") ||
        el.getAttribute("data");

      if (/\.svg($|[?#])/i.test(src) || /^data:image\/svg/i.test(src)) {
        add(el, "SVG file", src);
      }
    });

    root.querySelectorAll?.("use[href],use[xlink\\:href]").forEach(el => {
      const href = el.getAttribute("href") || el.getAttribute("xlink:href");
      const svg = el.closest("svg");

      if (svg) add(svg, "inline SVG symbol");
      if (href && /\.svg($|[?#])/i.test(href)) add(el, "SVG sprite", new URL(href, location.href).href);
    });

    root.querySelectorAll?.("*").forEach(el => {
      if (el.shadowRoot) scan(el.shadowRoot);
    });
  };

  scan(document);
  found.sort((a, b) => b.score - a.score);

  if (!found.length) {
    alert("No SVGs found");
    return;
  }

  const box = document.createElement("div");
  box.id = "lg-picker";

  box.innerHTML = `
    <style>
      #lg-picker {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: #0009;
        font: 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #111;
      }

      #lg-picker * {
        box-sizing: border-box;
      }

      #lg-picker .p {
        position: absolute;
        inset: 30px;
        background: white;
        border-radius: 14px;
        overflow: auto;
        padding: 20px;
        box-shadow: 0 20px 80px #0008;
      }

      #lg-picker .h {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }

      #lg-picker .g {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 12px;
      }

      #lg-picker .c {
        border: 1px solid #ddd;
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
      }

      #lg-picker .v {
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background:
          linear-gradient(45deg, #f5f5f5 25%, transparent 25%),
          linear-gradient(-45deg, #f5f5f5 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #f5f5f5 75%),
          linear-gradient(-45deg, transparent 75%, #f5f5f5 75%);
        background-size: 20px 20px;
        background-position: 0 0, 0 10px, 10px -10px, -10px 0;
      }

      #lg-picker img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      #lg-picker .m {
        padding: 10px;
        font-size: 12px;
        color: #555;
        min-height: 76px;
      }

      #lg-picker .m b {
        color: #111;
      }

      #lg-picker .a {
        display: flex;
        gap: 8px;
        padding: 0 10px 10px;
      }

      #lg-picker .a a,
      #lg-picker .a button,
      #lg-picker #lg-close {
        border: 0;
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        font: 12px system-ui;
        text-decoration: none;
      }

      #lg-picker .a a,
      #lg-picker .a button {
        flex: 1;
        text-align: center;
        background: #111;
        color: #fff;
      }

      #lg-picker .a button {
        background: #0078ff;
      }

      #lg-picker .a button:disabled {
        opacity: .7;
        cursor: wait;
      }

      #lg-picker #lg-close {
        background: #eee;
        color: #111;
      }
    </style>

    <div class="p">
      <div class="h">
        <b>${found.length} SVG candidate${found.length === 1 ? "" : "s"} found</b>
        <button id="lg-close">Close</button>
      </div>
      <div class="g"></div>
    </div>
  `;

  const grid = box.querySelector(".g");

  found.forEach((x, i) => {
    const card = document.createElement("div");
    card.className = "c";

    card.innerHTML = `
      <div class="v">
        <img src="${esc(x.data)}" alt="SVG candidate ${i + 1}">
      </div>

      <div class="m">
        <b>${i === 0 ? "Best guess — " : ""}${esc(x.type)}</b><br>
        ${Math.round(x.r.width || 0)} × ${Math.round(x.r.height || 0)}px<br>
        ${esc(x.txt).slice(0, 120)}
      </div>

      <div class="a">
        <a href="${esc(x.data)}" download="logo-${i + 1}.svg" target="_blank" rel="noopener">Download</a>
        <button data-i="${i}">Upload</button>
      </div>
    `;

    grid.appendChild(card);
  });

  async function uploadToCloudinary(x, i, btn) {
    btn.textContent = "Uploading…";
    btn.disabled = true;

    try {
      let blob;

      if (x.data.startsWith("data:image/svg")) {
        const svgText = decodeURIComponent(x.data.split(",")[1]);
        blob = new Blob([svgText], { type: "image/svg+xml" });
      } else {
        const res = await fetch(x.data);
        if (!res.ok) throw new Error("Could not fetch external SVG");
        blob = await res.blob();
      }

      const file = new File([blob], `logo-${i + 1}.svg`, {
        type: "image/svg+xml"
      });

      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      fd.append("folder", UPLOAD_FOLDER);
      fd.append("tags", "logo-grabber,svg,logo");

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: fd
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Cloudinary upload failed");
      }

      btn.textContent = "Uploaded ✓";
      btn.disabled = false;
      btn.onclick = () => window.open(json.secure_url, "_blank");
    } catch (e) {
      btn.textContent = "Upload failed";
      btn.disabled = false;
      alert(e.message);
    }
  }

  box.querySelectorAll("button[data-i]").forEach(btn => {
    btn.onclick = () => {
      const i = Number(btn.dataset.i);
      uploadToCloudinary(found[i], i, btn);
    };
  });

  box.querySelector("#lg-close").onclick = () => box.remove();

  box.onclick = e => {
    if (e.target === box) box.remove();
  };

  document.addEventListener("keydown", function escClose(e) {
    if (e.key === "Escape") {
      box.remove();
      document.removeEventListener("keydown", escClose);
    }
  });

  document.body.append(box);
})();
