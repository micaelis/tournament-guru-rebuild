/**
 * Validation probes — the app-layer helpers that gate the server
 * actions. These aren't RLS-specific but BUILD-PLAN §2.5 lists them
 * as required per-slice tests.
 */
import { describe, expect, it } from "vitest";
import {
  isAdultDob,
  validateEmail,
  validatePassword,
} from "../../lib/validation";
import { findBannedWords } from "../../lib/reviews/client-check";
import { parseCsvEmails } from "../../lib/promo/csv";

describe("validatePassword", () => {
  it("passes on 8+ chars, upper, digit", () => {
    expect(validatePassword("Password1")).toBeNull();
  });
  it("fails on <8 chars", () => {
    expect(validatePassword("Ab1")).toContain("8 characters");
  });
  it("fails without uppercase", () => {
    expect(validatePassword("password1")).toContain("uppercase");
  });
  it("fails without a digit", () => {
    expect(validatePassword("Password")).toContain("number");
  });
});

describe("validateEmail", () => {
  it("passes valid", () => {
    expect(validateEmail("foo@example.com")).toBeNull();
  });
  it("rejects garbage", () => {
    expect(validateEmail("no-at-sign")).not.toBeNull();
  });
});

describe("isAdultDob", () => {
  it("18+ is adult", () => {
    expect(isAdultDob("1990-01-01")).toBe(true);
  });
  it("under-18 blocked", () => {
    const y = new Date().getFullYear() - 10;
    expect(isAdultDob(`${y}-01-01`)).toBe(false);
  });
});

describe("findBannedWords", () => {
  it("matches word-boundary case-insensitive", () => {
    expect(findBannedWords("This is Crap!", ["crap"])).toEqual(["crap"]);
  });
  it("does not match inside another word", () => {
    expect(findBannedWords("assessment", ["ass"])).toEqual([]);
  });
  it("returns empty on clean text", () => {
    expect(findBannedWords("hello world", ["crap"])).toEqual([]);
  });
});

describe("parseCsvEmails", () => {
  it("parses a valid header + emails", () => {
    const csv = "email\nfoo@example.com\nbar@example.com";
    const r = parseCsvEmails(csv);
    expect(r.rows.map((row) => row.email)).toEqual([
      "foo@example.com",
      "bar@example.com",
    ]);
  });
  it("rejects missing header", () => {
    const r = parseCsvEmails("foo@example.com\nbar@example.com");
    expect(r.errors[0]).toContain("email");
  });
  it("dedupes case-insensitively", () => {
    const r = parseCsvEmails("email\nFoo@Example.com\nfoo@example.com");
    expect(r.rows).toHaveLength(1);
  });
  it("skips invalid emails with an error", () => {
    const r = parseCsvEmails("email\nfoo@example.com\nnot-an-email");
    expect(r.rows.map((r) => r.email)).toEqual(["foo@example.com"]);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
