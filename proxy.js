export async function onRequest({ request }) {
  try {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("Missing ?url=", { status: 400 });
    }

    // Fetch real SVG (ASOS, etc.) — Cloudflare has no CORS restrictions
    const resp = await fetch(target, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (LogoGrabber/4.0)",
        "Accept": "*/*"
      }
    });

    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") || "application/octet-stream";

    // Return file with permissive CORS
    return new Response(buffer, {
      status: resp.status,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "no-store"
      }
    });

  } catch (err) {
    return new Response("Proxy error: " + err, { status: 500 });
  }
}
