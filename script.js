(() => {
  const old = document.getElementById("lg-picker");
  if (old) old.remove();

  const found = [];
  const seen = new Set();

  const esc = s => String(s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const add = (el, type, src) => {
    const key = src || el;
    if (seen.has(key)) return;
    seen.add(key);

    const r = el.getBoundingClientRect?.() || {};
    let data = src;

    if (!src && el.tagName?.toLowerCase() === "svg") {
      const c = el.cloneNode(true);
      if (!c.getAttribute("xmlns")) c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      data = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(c));
    }

    const txt = [
      el.id,
      el.className,
      el.getAttribute?.("alt"),
      el.getAttribute?.("title"),
      el.getAttribute?.("aria-label"),
      el.closest?.("[class]")?.className,
      el.closest?.("[id]")?.id
    ].filter(Boolean).join(" ");

    let score = 0;
    if (/logo|brand|header|nav/i.test(txt)) score += 50;
    if (r.top < 200) score += 20;
    if (r.width > 30 && r.height > 10) score += 20;
    if (/icon|sprite|social/i.test(txt)) score -= 20;

    found.push({ el, type, data, txt, r, score });
  };

  const scan = root => {
    root.querySelectorAll?.("svg").forEach(el => add(el, "inline"));
    root.querySelectorAll?.("img[src],object[data],embed[src]").forEach(el => {
      const src = el.src || el.data || el.getAttribute("src") || el.getAttribute("data");
      if (/\.svg($|[?#])/i.test(src) || /^data:image\/svg/i.test(src)) add(el, "file", src);
    });
    root.querySelectorAll?.("*").forEach(el => el.shadowRoot && scan(el.shadowRoot));
  };

  scan(document);
  found.sort((a, b) => b.score - a.score);

  if (!found.length) return alert("No SVGs found");

  const box = document.createElement("div");
  box.id = "lg-picker";
  box.innerHTML = `
    <style>
      #lg-picker{position:fixed;inset:0;z-index:999999999;background:#0009;font:14px system-ui}
      #lg-picker .p{position:absolute;inset:30px;background:white;border-radius:14px;overflow:auto;padding:20px}
      #lg-picker .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
      #lg-picker .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
      #lg-picker .c{border:1px solid #ddd;border-radius:10px;overflow:hidden;background:#fff}
      #lg-picker .v{height:120px;display:flex;align-items:center;justify-content:center;padding:16px;background:#f7f7f7}
      #lg-picker img{max-width:100%;max-height:100%;object-fit:contain}
      #lg-picker .m{padding:10px;font-size:12px;color:#555}
      #lg-picker a{display:block;margin:0 10px 10px;padding:8px;border-radius:7px;background:#111;color:white;text-align:center;text-decoration:none}
      #lg-picker button{border:0;border-radius:99px;padding:8px 12px;cursor:pointer}
    </style>
    <div class="p">
      <div class="h">
        <b>${found.length} SVG candidate${found.length === 1 ? "" : "s"} found</b>
        <button id="lg-close">Close</button>
      </div>
      <div class="g"></div>
    </div>`;

  const grid = box.querySelector(".g");

  found.forEach((x, i) => {
    const c = document.createElement("div");
    c.className = "c";
    c.innerHTML = `
      <div class="v"><img src="${esc(x.data)}"></div>
      <div class="m">
        <b>${i === 0 ? "Best guess — " : ""}${x.type}</b><br>
        ${Math.round(x.r.width || 0)} × ${Math.round(x.r.height || 0)}px<br>
        ${esc(x.txt).slice(0, 120)}
      </div>
      <a href="${esc(x.data)}" download="logo-${i + 1}.svg" target="_blank">Download / open</a>`;
    grid.appendChild(c);
  });

  box.querySelector("#lg-close").onclick = () => box.remove();
  box.onclick = e => { if (e.target === box) box.remove(); };
  document.body.append(box);
})();
