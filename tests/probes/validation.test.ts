/**
 * Validation probes — the app-layer helpers that gate the server
 * actions. These aren't RLS-specific but BUILD-PLAN §2.5 lists them
 * as required per-slice tests.
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  isAdultDob,
  validateEmail,
  validatePassword,
} from "../../lib/validation";
import { findBannedWords } from "../../lib/reviews/client-check";
import { parseCsvEmails } from "../../lib/promo/csv";
import { createUser, purge, service } from "../harness";

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

const users: string[] = [];
afterAll(() => purge(users));

describe("event date constraints (DB)", () => {
  it("rejects null end_date on INSERT", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const svc = service();
    const { data: t } = await svc
      .from("tournaments")
      .insert({
        title: "Probe T",
        owner_id: ed.id,
        created_by: ed.id,
        claimed: true,
      })
      .select("id")
      .single();
    const { error } = await svc.from("events").insert({
      tournament_id: t!.id,
      owner_id: ed.id,
      created_by: ed.id,
      claimed: true,
      title: "No End Date",
      start_date: "2026-08-01",
      lifecycle: "draft",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/end_date|not-null|null/i);
  });

  it("rejects end_date < start_date via CHECK", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const svc = service();
    const { data: t } = await svc
      .from("tournaments")
      .insert({
        title: "Probe T2",
        owner_id: ed.id,
        created_by: ed.id,
        claimed: true,
      })
      .select("id")
      .single();
    const { error } = await svc.from("events").insert({
      tournament_id: t!.id,
      owner_id: ed.id,
      created_by: ed.id,
      claimed: true,
      title: "Bad Dates",
      start_date: "2026-08-10",
      end_date: "2026-08-05",
      lifecycle: "draft",
    });
    expect(error).not.toBeNull();
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
