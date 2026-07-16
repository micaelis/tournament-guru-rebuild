#!/usr/bin/env node
/**
 * Backfill event coordinates via the Google Geocoding API.
 *
 * Reads events that have a location_formatted but no location_lat, geocodes
 * each (US-biased), and either:
 *   - applies the updates directly when SUPABASE_SERVICE_ROLE_KEY is set
 *     in the environment (never stored in a file), or
 *   - writes supabase/backfills/geocode-events.sql to paste into the
 *     Supabase Dashboard SQL editor.
 *
 * Env (from .env.local or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   GOOGLE_GEOCODING_KEY, [SUPABASE_SERVICE_ROLE_KEY]
 *
 * Usage:  node scripts/geocode-events.mjs [--dry-run]
 *
 * Note: without the service key the event list is read with the anon key,
 * which only sees ACTIVE events under RLS — drafts are geocoded on their
 * next save through the event form instead.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnvLocal() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEO_KEY = process.env.GOOGLE_GEOCODING_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !ANON_KEY || !GEO_KEY) {
  console.error(
    "Missing env — need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GOOGLE_GEOCODING_KEY (via .env.local or the environment).",
  );
  process.exit(1);
}

const READ_KEY = SERVICE_KEY ?? ANON_KEY;

async function fetchPending() {
  const url =
    `${SUPABASE_URL}/rest/v1/events` +
    `?select=id,location_formatted&location_formatted=not.is.null&location_lat=is.null&limit=1000`;
  const res = await fetch(url, {
    headers: { apikey: READ_KEY, Authorization: `Bearer ${READ_KEY}` },
  });
  if (!res.ok) throw new Error(`events read failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function pick(components, type, form = "long_name") {
  return components.find((c) => c.types.includes(type))?.[form] ?? null;
}

async function geocode(address) {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?" +
    new URLSearchParams({ address, components: "country:US", key: GEO_KEY });
  const res = await fetch(url);
  const body = await res.json();
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status !== "OK") throw new Error(`geocode ${body.status}: ${body.error_message ?? ""}`);
  const r = body.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    place_id: r.place_id,
    city:
      pick(r.address_components, "locality") ??
      pick(r.address_components, "sublocality") ??
      pick(r.address_components, "postal_town"),
    state_full: pick(r.address_components, "administrative_area_level_1"),
    state_abbr: pick(r.address_components, "administrative_area_level_1", "short_name"),
    zip: pick(r.address_components, "postal_code"),
  };
}

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);

async function applyDirect(id, g) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${id}&location_lat=is.null`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      location_lat: g.lat,
      location_lng: g.lng,
      location_place_id: g.place_id,
      location_city: g.city,
      location_state_full: g.state_full,
      location_state_abbr: g.state_abbr?.slice(0, 2) ?? null,
      location_zip: g.zip,
    }),
  });
  if (!res.ok) throw new Error(`update failed: ${res.status} ${await res.text()}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const events = await fetchPending();
console.log(`${events.length} event(s) need coordinates${SERVICE_KEY ? " (direct mode)" : " (SQL-file mode)"}${DRY_RUN ? " [dry run]" : ""}.`);

const sqlLines = [];
let ok = 0,
  misses = 0;

for (const ev of events) {
  await sleep(120); // stay far under Geocoding QPS limits
  let g;
  try {
    g = await geocode(ev.location_formatted);
  } catch (err) {
    console.error(`  ✗ ${ev.location_formatted} — ${err.message}`);
    continue;
  }
  if (!g) {
    misses++;
    console.warn(`  ? no result: ${ev.location_formatted}`);
    continue;
  }
  ok++;
  console.log(`  ✓ ${ev.location_formatted} → ${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}`);
  if (DRY_RUN) continue;
  if (SERVICE_KEY) {
    await applyDirect(ev.id, g);
  } else {
    sqlLines.push(
      `update events set location_lat=${g.lat}, location_lng=${g.lng}, ` +
        `location_place_id=${q(g.place_id)}, location_city=${q(g.city)}, ` +
        `location_state_full=${q(g.state_full)}, location_state_abbr=${q(g.state_abbr?.slice(0, 2))}, ` +
        `location_zip=${q(g.zip)} where id='${ev.id}' and location_lat is null;`,
    );
  }
}

if (sqlLines.length) {
  const dir = join(root, "supabase", "backfills");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "geocode-events.sql");
  writeFileSync(out, sqlLines.join("\n") + "\n");
  console.log(`\nWrote ${sqlLines.length} update(s) → ${out}`);
  console.log("Paste it into the Supabase Dashboard SQL editor to apply.");
}
console.log(`\nDone: ${ok} geocoded, ${misses} without a match.`);
