/**
 * Typhoon Watch - HND/NRT airport status proxy
 * Cloudflare Worker + AeroDataBox (RapidAPI)
 *
 * Required secret:
 *   AERODATABOX_KEY
 *
 * Optional vars:
 *   ALLOWED_ORIGIN=https://linaonao.github.io
 *   CACHE_SECONDS=1800
 */

const API_HOST = "aerodatabox.p.rapidapi.com";
const AIRPORTS = ["HND", "NRT"];

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(data, status, env, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...cors(env),
      ...extra
    }
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function routeText(f, direction) {
  const other = direction === "出发"
    ? (f.arrival?.airport || f.movement?.airport)
    : (f.departure?.airport || f.movement?.airport);
  if (!other) return "";
  return other.iata || other.icao || other.name || "";
}

function summarize(code, payload) {
  const departures = Array.isArray(payload.departures) ? payload.departures : [];
  const arrivals = Array.isArray(payload.arrivals) ? payload.arrivals : [];
  const all = [
    ...departures.map(f => ({...f, _direction:"出发"})),
    ...arrivals.map(f => ({...f, _direction:"到达"}))
  ];

  const delayedStatuses = new Set(["Delayed"]);
  const cancelledStatuses = new Set(["Canceled", "CanceledUncertain"]);
  const divertedStatuses = new Set(["Diverted"]);

  const delayed = all.filter(f => delayedStatuses.has(f.status)).length;
  const cancelled = all.filter(f => cancelledStatuses.has(f.status)).length;
  const diverted = all.filter(f => divertedStatuses.has(f.status)).length;

  const incidents = all
    .filter(f =>
      delayedStatuses.has(f.status) ||
      cancelledStatuses.has(f.status) ||
      divertedStatuses.has(f.status)
    )
    .slice(0, 12)
    .map(f => ({
      number: f.number || f.callSign || "",
      status: f.status || "Unknown",
      direction: f._direction,
      route: routeText(f, f._direction)
    }));

  return {
    code,
    totalFlights: all.length,
    delayed,
    cancelled,
    diverted,
    incidents,
    windowMinutes: 360
  };
}

async function fetchAirport(code, env) {
  const url = new URL(`https://${API_HOST}/flights/airports/iata/${code}`);
  url.searchParams.set("offsetMinutes", "-120");
  url.searchParams.set("durationMinutes", "360");
  url.searchParams.set("direction", "Both");
  url.searchParams.set("withLeg", "true");
  url.searchParams.set("withCancelled", "true");
  url.searchParams.set("withCodeshared", "false");
  url.searchParams.set("withCargo", "false");
  url.searchParams.set("withPrivate", "false");
  url.searchParams.set("withLocation", "false");

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": env.AERODATABOX_KEY,
      "X-RapidAPI-Host": API_HOST
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${code}: provider HTTP ${res.status} ${body.slice(0,180)}`);
  }
  return summarize(code, await res.json());
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {status:204, headers:cors(env)});
    }

    const u = new URL(request.url);
    if (request.method !== "GET" || u.pathname !== "/api/airports") {
      return json({error:"Not found"}, 404, env);
    }

    if (!env.AERODATABOX_KEY) {
      return json({error:"AERODATABOX_KEY is not configured"}, 500, env);
    }

    const cache = caches.default;
    const cacheKey = new Request(u.origin + "/api/airports", request);
    const hit = await cache.match(cacheKey);
    if (hit) {
      const obj = await hit.clone().json();
      obj.cached = true;
      return json(obj, 200, env, {
        "Cache-Control": hit.headers.get("Cache-Control") || "public, max-age=300"
      });
    }

    try {
      // Basic RapidAPI plan is rate-limited, so avoid parallel provider calls.
      const hnd = await fetchAirport("HND", env);
      await sleep(1100);
      const nrt = await fetchAirport("NRT", env);

      const body = {
        generatedAt: new Date().toISOString(),
        cached: false,
        airports: [hnd, nrt]
      };

      const ttl = Math.max(300, Number(env.CACHE_SECONDS || 1800));
      const response = json(body, 200, env, {
        "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}`
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      return json({error: String(err?.message || err)}, 502, env);
    }
  }
};
