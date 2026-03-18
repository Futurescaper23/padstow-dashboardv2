export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const start = qs.start;
    const end = qs.end;
    const lat = qs.lat || "50.5400";
    const lon = qs.lon || "-4.9400";

    const apiKey = process.env.WORLDTIDES_API_KEY;

    if (!apiKey) {
      return jsonResponse(500, { error: "Missing WORLDTIDES_API_KEY" });
    }

    if (!start || !end) {
      return jsonResponse(400, { error: "Missing start or end date" });
    }

    const startTs = toUnix(`${start}T00:00:00Z`);
    const endTs = toUnix(`${end}T23:59:59Z`);

    const url = new URL("https://www.worldtides.info/api/v3");
    url.searchParams.set("heights", "");
    url.searchParams.set("extremes", "");
    url.searchParams.set("datum", "CD");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("start", String(startTs));
    url.searchParams.set("end", String(endTs));
    url.searchParams.set("step", "900"); // 15 min
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
      const text = await res.text();
      return jsonResponse(502, {
        error: `WorldTides fetch failed: ${res.status}`,
        details: text,
      });
    }

    const data = await res.json();

    const items = (data.heights || [])
      .map((r) => ({
        time: new Date(r.dt * 1000).toISOString(),
        value: Number(r.height),
      }))
      .filter((r) => Number.isFinite(r.value));

    const extremes = (data.extremes || []).map((r) => ({
      time: new Date(r.dt * 1000).toISOString(),
      value: Number(r.height),
      type: r.type,
    }));

    return jsonResponse(200, {
      source: "worldtides",
      station: "Padstow (predicted)",
      items,
      extremes,
      lat,
      lon,
    });
  } catch (err) {
    return jsonResponse(500, {
      error: err.message || "Unknown server error",
      stack: err.stack || "",
    });
  }
}

function toUnix(iso) {
  return Math.floor(new Date(iso).getTime() / 1000);
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(body),
  };
}
