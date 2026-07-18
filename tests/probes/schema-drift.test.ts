/**
 * Schema-drift probe — every `.from(table).select(columns)` pair in the
 * app source is replayed against the live database with `limit(0)`.
 * PostgREST parses the select string natively, so a renamed or dropped
 * column fails with 42703 (undefined column) here rather than silently
 * at runtime.
 *
 * This exists because the DB boundary is untyped: `.from()` takes a
 * plain string and the result is usually cast with `as unknown as`, so
 * `tsc` cannot see column drift at all. A dropped column
 * (`faqs.body` → `content`) shipped to production behind a swallowed
 * error and an empty state that looked intentional.
 *
 * Selects built from template literals or variables are skipped — they
 * can't be resolved statically. Those are listed in the output so the
 * blind spot stays visible rather than looking like full coverage.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { service } from "../harness";

const ROOTS = ["app", "lib"];

type Site = { file: string; line: number; table: string; select: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

function collect(): { sites: Site[]; skipped: string[] } {
  const sites: Site[] = [];
  const skipped: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const src = readFileSync(file, "utf8");
      // .from("table") ... .select("cols") within a short window.
      const re =
        /\.from\(\s*["'`](\w+)["'`]\s*\)([\s\S]{0,400}?)\.select\(\s*([`"'])([\s\S]*?)\3/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const [, table, , quote, select] = m;
        const line = src.slice(0, m.index).split("\n").length;
        // Template literals with interpolation can't be resolved here.
        if (quote === "`" && select.includes("${")) {
          skipped.push(`${file}:${line} ${table} (dynamic select)`);
          continue;
        }
        sites.push({ file, line, table, select: select.replace(/\s+/g, "") });
      }
    }
  }
  return { sites, skipped };
}

const { sites, skipped } = collect();

describe("schema drift · every .select() resolves against the live schema", () => {
  it("found select sites to check", () => {
    // Guards against the regex silently matching nothing, which would
    // make every assertion below vacuous.
    expect(sites.length).toBeGreaterThan(20);
    if (skipped.length) {
      console.info(
        `[schema-drift] ${skipped.length} dynamic select(s) not statically checkable:\n  ` +
          skipped.join("\n  "),
      );
    }
  });

  it.each(sites)("$file:$line — $table", async ({ table, select }) => {
    const { error } = await service().from(table).select(select).limit(0);
    if (error) {
      // 42703 = undefined column, 42P01 = undefined table. Anything else
      // (RLS, filters, embedded-resource quirks) isn't schema drift.
      expect(
        ["42703", "42P01"],
        `${table}: ${error.code} ${error.message}`,
      ).not.toContain(error.code);
    }
  });
});
