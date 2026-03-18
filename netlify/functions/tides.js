export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const start = qs.start;
    const end = qs.end;
    const station = qs.station || "49116";

    if (!start || !end) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Missing start or end date" }),
      };
    }

    // Look up the available measures for the station
    const measuresUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations/${station}/measures.json`;
    const measuresRes = await fetch(measuresUrl);

    if (!measuresRes.ok) {
      return fail(`EA measures lookup failed: ${measuresRes.status}`);
    }

    const measuresJson = await measuresRes.json();
    const measures = measuresJson.items || [];

    // Prefer a tidal level measure if available
    const preferred =
      measures.find(
        (m) =>
          (m.parameterName || "").toLowerCase().includes("tidal level") &&
          (m.qualifier || "").toLowerCase().includes("downstream")
      ) ||
      measures.find((m) =>
        (m.parameterName || "").toLowerCase().includes("tidal level")
      ) ||
      measures[0];

    if (!preferred || !preferred["@id"]) {
      return fail("No suitable tide measure found");
    }

    // Fetch readings for the requested period
    const readingsUrl = new URL(`${preferred["@id"]}/readings`);
    readingsUrl.searchParams.set("_sorted", "");
    readingsUrl.searchParams.set("since", `${start}T00:00:00Z`);
    readingsUrl.searchParams.set("until", `${end}T23:59:59Z`);

    const readingsRes = await fetch(readingsUrl.toString());

    if (!readingsRes.ok) {
      return fail(`EA readings fetch failed: ${readingsRes.status}`);
    }

    const readingsJson = await readingsRes.json();
    const items = (readingsJson.items || [])
      .map((r) => ({
        time: r.dateTime,
        value: Number(r.value),
      }))
      .filter((r) => Number.isFinite(r.value));

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        station,
        measure: preferred["@id"],
        label: preferred.label || preferred.parameterName || "Tidal level",
        items,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: err.message || "Unknown server error",
      }),
    };
  }
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function fail(message) {
  return {
    statusCode: 502,
    headers: corsHeaders(),
    body: JSON.stringify({ error: message }),
  };
}
