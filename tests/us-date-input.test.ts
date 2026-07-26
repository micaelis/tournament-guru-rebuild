/**
 * Round-2 #4 — pure helpers behind the masked mm/dd/yyyy input that
 * replaced locale-dependent native date fields (onboarding DOB +
 * search filter dates). The mask must format progressively, and the
 * ISO conversion must accept only complete REAL dates.
 */
import { describe, expect, it } from "vitest";
import {
  isoFromUs,
  isoOfDate,
  maskUsDate,
  monthGrid,
  usFromIso,
} from "@/app/components/ui/USDateInput";

describe("maskUsDate", () => {
  it("formats digits progressively into mm/dd/yyyy", () => {
    expect(maskUsDate("0")).toBe("0");
    expect(maskUsDate("06")).toBe("06");
    expect(maskUsDate("061")).toBe("06/1");
    expect(maskUsDate("0615")).toBe("06/15");
    expect(maskUsDate("06151")).toBe("06/15/1");
    expect(maskUsDate("06151990")).toBe("06/15/1990");
  });

  it("strips non-digits and caps at 8 digits", () => {
    expect(maskUsDate("06/15/1990")).toBe("06/15/1990");
    expect(maskUsDate("6a1b")).toBe("61");
    expect(maskUsDate("061519901234")).toBe("06/15/1990");
  });

  it("supports deletion without trapping a trailing slash", () => {
    // Backspace from "06/15" gives "06/1" → digits "061" → "06/1".
    expect(maskUsDate("06/1")).toBe("06/1");
    // Backspace from "06/" gives "06" → stays "06", no re-appended slash.
    expect(maskUsDate("06")).toBe("06");
  });
});

describe("isoFromUs", () => {
  it("converts a complete real date", () => {
    expect(isoFromUs("06/15/1990")).toBe("1990-06-15");
    expect(isoFromUs("12/31/2026")).toBe("2026-12-31");
    expect(isoFromUs("02/29/2024")).toBe("2024-02-29"); // leap day
  });

  it("returns empty for incomplete or impossible dates", () => {
    expect(isoFromUs("")).toBe("");
    expect(isoFromUs("06/15/199")).toBe("");
    expect(isoFromUs("13/01/2020")).toBe(""); // month 13
    expect(isoFromUs("02/30/2023")).toBe(""); // no Feb 30
    expect(isoFromUs("00/10/2020")).toBe("");
  });
});

describe("usFromIso", () => {
  it("round-trips with isoFromUs", () => {
    expect(usFromIso("1990-06-15")).toBe("06/15/1990");
    expect(isoFromUs(usFromIso("2024-02-29"))).toBe("2024-02-29");
  });

  it("returns empty for non-ISO input", () => {
    expect(usFromIso("")).toBe("");
    expect(usFromIso("06/15/1990")).toBe("");
  });
});

describe("calendar grid (S12.22)", () => {
  it("stamps local dates without a UTC shift", () => {
    expect(isoOfDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(isoOfDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("builds whole Sunday-first weeks padded with neighbor days", () => {
    // July 2026 starts on a Wednesday → 3 lead days, 35 cells.
    const july = monthGrid(2026, 6);
    expect(july).toHaveLength(35);
    expect(july[0].iso).toBe("2026-06-28"); // the Sunday before
    expect(july[0].inMonth).toBe(false);
    expect(july[3].iso).toBe("2026-07-01");
    expect(july[3].inMonth).toBe(true);
    expect(july[34].iso).toBe("2026-08-01");
    expect(july.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it("covers a leap February", () => {
    const feb = monthGrid(2024, 1);
    expect(feb.some((c) => c.iso === "2024-02-29" && c.inMonth)).toBe(true);
    expect(feb.filter((c) => c.inMonth)).toHaveLength(29);
    expect(feb.length % 7).toBe(0);
  });

  it("needs no padding when the month starts on Sunday and fits exactly", () => {
    // Feb 2026: starts Sunday, 28 days → exactly 4 clean weeks.
    const feb = monthGrid(2026, 1);
    expect(feb).toHaveLength(28);
    expect(feb.every((c) => c.inMonth)).toBe(true);
  });
});
