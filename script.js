(function () {
  const SCRIPT_VERSION = "4.0.0";
  console.log("LogoGrabber script loaded. Version:", SCRIPT_VERSION);

  // -------------- CONFIG --------------
  const CLOUD_NAME = "patrickg-assets";
  const UPLOAD_PRESET = "unsignedUpload";
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

  // ASOS-proof proxy
  const PROXY_URL = "https://api.allorigins.win/raw?url=";

  const MAX_CANVAS_DIM = 1024;

  const XLINK = "http://www.w3.org/1999/xlink";
  const $ = (q, r = document) => Array.from(r.querySelectorAll(q));
  const makeNS = n => document.createElementNS("http://www.w3.org/2000/svg", n);

  function alertV(msg) {
    alert(`LogoGrabber v${SCRIPT_VERSION}\n\n${msg}`);
  }

  // ---------------- DOMAIN NAMING ----------------

  function getBaseDomain() {
    let d = location.hostname.toLowerCase();
    d = d.replace(/^www\./, "").replace(/\./g, "_").replace(/[^a-z0-9_]/g, "");
    return d || "site";
  }
  const BASE = getBaseDomain();

  function nextVersion(base) {
    const key = "logoGrab_" + base + "_v";
    let v = parseInt(localStorage.getItem(key) || "0", 10) || 0;
    v++;
    localStorage.setItem(key, v);
    return v;
  }

  function newPublicId() {
    const v = nextVersion(BASE);
    return {
      base: BASE,
      version: v,
      publicId: `${BASE}_logo_v${v}`
    };
  }

  // ---------------- UPLOAD HELPERS ----------------

  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name || "logo.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function cloudinaryFetchUrl(publicId, url, onSuccess, onError) {
    const fd = new FormData();
    fd.append("file", url);
    fd.append("public_id", publicId);
    fd.append("upload_preset", UPLOAD_PRESET);

    fetch(UPLOAD_URL, { method: "POST", body: fd })
      .then(r => r.json())
      .then(json => {
        if (!json || json.error) return onError(json && json.error);
        onSuccess(json);
      })
      .catch(err => onError(err));
  }

  function cloudinaryUploadBlob(publicId, blob, filename, onSuccess, onError) {
    const fd = new FormData();
    fd.
