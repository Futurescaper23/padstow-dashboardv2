export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const start = qs.start;
    const end = qs.end;

    if (!start || !end) {
      return jsonResponse(400, { error: "Missing start or end date" });
    }

    // Hard-coded Padstow tidal level measure
    const measureId =
      "https://environment.data.gov.uk/flood-monitoring/id/measures/49116-level-tidal_level-i-15_min-mAOD";

    const readingsUrl = new URL(`${measureId}/readings`);
    readingsUrl.searchParams.set("_sorted", "");
    readingsUrl.searchParams.set("startdate", start);
    readingsUrl.searchParams.set("enddate", end);

    const readingsRes = await fetch(readingsUrl.toString());

    if (!readingsRes.ok) {
      const text = await readingsRes.text();
      return jsonResponse(502, {
        error: `EA readings fetch failed: ${readingsRes.status}`,
        details: text,
        url: readingsUrl.toString(),
      });
    }

    const readingsJson = await readingsRes.json();
    const items = (readingsJson.items || [])
      .map((r) => ({
        time: r.dateTime,
        value: Number(r.value),
      }))
      .filter((r) => Number.isFinite(r.value));

    return jsonResponse(200, {
      station: "49116",
      measure: measureId,
      label: "Padstow tidal level",
      items,
    });
  } catch (err) {
    return jsonResponse(500, {
      error: err.message || "Unknown server error",
      stack: err.stack || "",
    });
  }
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
