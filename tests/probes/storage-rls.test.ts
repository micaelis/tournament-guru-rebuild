/**
 * Storage RLS — the mandatory security floor for the upload cutover.
 *
 * The C-1-class requirement (SCOPE-uploads.md): the private promo-csv
 * bucket must be provably isolated. These tests drive the real Storage
 * API on the local stack:
 *   - anon CANNOT read a private CSV object (download OR public URL)
 *   - a non-owner authenticated user CANNOT read another owner's CSV
 *   - a non-owner CANNOT write under another owner's path (any bucket)
 *   - the owner CAN read/write their own; admin CAN reach anything
 *   - bucket-level type + size limits reject wrong-type / oversized
 *     uploads server-side (not just the file-picker `accept`)
 *
 * Paths are keyed by the uploader's user id as the leading folder, so
 * "their own path" == "their own <uid>/ folder".
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { anon, createUser, purge, service } from "../harness";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A fresh object name so a write is a true INSERT, never an upsert that
 * would route through the UPDATE policy and mask an INSERT-policy hole. */
const fresh = (ext: string) => `probe-${randomUUID().slice(0, 8)}.${ext}`;

const users: string[] = [];

let ed: { id: string; client: SupabaseClient };
let otherEd: { id: string; client: SupabaseClient };
let admin: { id: string; client: SupabaseClient };

// A minimal valid PNG (1x1) so image uploads pass the mime sniff.
const PNG_1PX = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100" +
    "05000106a5b0f60000000049454e44ae426082",
  "hex",
);

function csvBody(): Blob {
  return new Blob(["email\ncoach@example.com\n"], { type: "text/csv" });
}

beforeAll(async () => {
  const mkEd = async () => {
    const u = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(u.id);
    return u;
  };
  ed = await mkEd();
  otherEd = await mkEd();
  admin = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    becomeAdmin: true,
    completeOnboarding: true,
    role: "coach",
  });
  users.push(admin.id);
});

afterAll(async () => {
  // Service role wipes every object the probes left behind (fresh names,
  // so list-then-remove the whole per-user folder).
  const svc = service();
  for (const bucket of ["event-images", "org-logos", "promo-csv"]) {
    for (const id of users) {
      const { data } = await svc.storage.from(bucket).list(id);
      if (data?.length) {
        await svc.storage
          .from(bucket)
          .remove(data.map((o) => `${id}/${o.name}`));
      }
    }
  }
  await purge(users);
});

describe("storage · private promo-csv isolation (C-1 class)", () => {
  const objectPath = () => `${ed.id}/probe.csv`;

  it("the owner ED can upload their own CSV", async () => {
    const { error } = await ed.client.storage
      .from("promo-csv")
      .upload(objectPath(), csvBody(), { upsert: true });
    expect(error).toBeNull();
  });

  it("anon CANNOT download the private CSV via the API", async () => {
    const { data, error } = await anon()
      .storage.from("promo-csv")
      .download(objectPath());
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("anon CANNOT read the private CSV via its public URL", async () => {
    const { data } = anon().storage.from("promo-csv").getPublicUrl(objectPath());
    const res = await fetch(data.publicUrl);
    expect(res.ok).toBe(false); // 400/404 — bucket is not public
    // And the body is not the CSV content.
    const text = await res.text();
    expect(text).not.toContain("coach@example.com");
  });

  it("a non-owner ED CANNOT download another ED's CSV", async () => {
    const { data, error } = await otherEd.client.storage
      .from("promo-csv")
      .download(objectPath());
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("a non-owner ED CANNOT list another ED's CSV folder", async () => {
    const { data } = await otherEd.client.storage
      .from("promo-csv")
      .list(ed.id);
    // RLS hides the rows: the listing is empty (or errors), never the object.
    expect((data ?? []).some((o) => o.name === "probe.csv")).toBe(false);
  });

  it("the owner ED CAN download their own CSV", async () => {
    const { data, error } = await ed.client.storage
      .from("promo-csv")
      .download(objectPath());
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(await data!.text()).toContain("coach@example.com");
  });

  it("an admin CAN download any ED's CSV (for review)", async () => {
    const { data, error } = await admin.client.storage
      .from("promo-csv")
      .download(objectPath());
    expect(error).toBeNull();
    expect(await data!.text()).toContain("coach@example.com");
  });

  it("an admin can mint a working signed URL; anon holding it can fetch, but not without it", async () => {
    const { data: signed, error } = await admin.client.storage
      .from("promo-csv")
      .createSignedUrl(objectPath(), 60);
    expect(error).toBeNull();
    const res = await fetch(signed!.signedUrl);
    expect(res.ok).toBe(true);
    expect(await res.text()).toContain("coach@example.com");
  });
});

describe("storage · owner-scoped writes (no cross-path writes)", () => {
  // Every deny test targets a FRESH object name with upsert:false, so the
  // write is a real INSERT. An upsert onto a pre-existing object would
  // route through the UPDATE policy and mask an INSERT-policy hole — which
  // is precisely the masking that let an early version of this probe pass
  // against a widened INSERT policy.
  const png = () => ({ upsert: false, contentType: "image/png" }) as const;

  it("a non-owner CANNOT INSERT under another owner's promo-csv path", async () => {
    const { error } = await otherEd.client.storage
      .from("promo-csv")
      .upload(`${ed.id}/${fresh("csv")}`, csvBody(), { upsert: false });
    expect(error).not.toBeNull();
  });

  it("a non-owner CANNOT INSERT under another owner's event-images path", async () => {
    const { error } = await otherEd.client.storage
      .from("event-images")
      .upload(`${ed.id}/${fresh("png")}`, PNG_1PX, png());
    expect(error).not.toBeNull();
  });

  it("a non-owner CANNOT INSERT under another owner's org-logos path", async () => {
    const { error } = await otherEd.client.storage
      .from("org-logos")
      .upload(`${ed.id}/${fresh("png")}`, PNG_1PX, png());
    expect(error).not.toBeNull();
  });

  it("a non-owner CANNOT DELETE another owner's object", async () => {
    // The DELETE policy is the SOLE guard here — the storage service does
    // not independently block cross-owner deletes the way it blocks
    // overwrites, so without the folder check any ED could wipe another
    // ED's logos/images. `remove` reports no error even when RLS filters
    // the row, so assert the object SURVIVES rather than trusting error.
    const name = `${ed.id}/${fresh("png")}`;
    const seed = await ed.client.storage
      .from("event-images")
      .upload(name, PNG_1PX, png());
    expect(seed.error).toBeNull();

    await otherEd.client.storage.from("event-images").remove([name]);

    const { data } = await service().storage.from("event-images").list(ed.id);
    const stillThere = (data ?? []).some(
      (o) => o.name === name.split("/")[1],
    );
    expect(stillThere).toBe(true);
  });

  it("the owner CAN DELETE their own object", async () => {
    const name = `${ed.id}/${fresh("png")}`;
    await ed.client.storage.from("event-images").upload(name, PNG_1PX, png());
    await ed.client.storage.from("event-images").remove([name]);

    const { data } = await service().storage.from("event-images").list(ed.id);
    const stillThere = (data ?? []).some(
      (o) => o.name === name.split("/")[1],
    );
    expect(stillThere).toBe(false);
  });

  it("anon CANNOT INSERT into any bucket", async () => {
    const a = anon();
    // event-images / org-logos take a PNG; promo-csv takes a CSV so the
    // rejection is the RLS policy, not the bucket's mime allow-list.
    const attempts: [string, Blob | Buffer, { contentType: string }][] = [
      ["event-images", PNG_1PX, { contentType: "image/png" }],
      ["org-logos", PNG_1PX, { contentType: "image/png" }],
      ["promo-csv", csvBody(), { contentType: "text/csv" }],
    ];
    for (const [bucket, body, opts] of attempts) {
      const ext = bucket === "promo-csv" ? "csv" : "png";
      const { error } = await a.storage
        .from(bucket)
        .upload(`${ed.id}/${fresh(ext)}`, body, { upsert: false, ...opts });
      expect(error, bucket).not.toBeNull();
    }
  });

  it("the owner CAN INSERT under their own event-images and org-logos path", async () => {
    const logo = await ed.client.storage
      .from("event-images")
      .upload(`${ed.id}/${fresh("png")}`, PNG_1PX, png());
    expect(logo.error).toBeNull();
    const org = await ed.client.storage
      .from("org-logos")
      .upload(`${ed.id}/${fresh("png")}`, PNG_1PX, png());
    expect(org.error).toBeNull();
  });

  it("an admin CAN INSERT anywhere (on-behalf uploads)", async () => {
    const { error } = await admin.client.storage
      .from("event-images")
      .upload(`${ed.id}/${fresh("png")}`, PNG_1PX, png());
    expect(error).toBeNull();
  });

  it("public image objects are readable by anon (public buckets)", async () => {
    const name = `${ed.id}/${fresh("png")}`;
    await ed.client.storage.from("event-images").upload(name, PNG_1PX, png());
    const { data } = anon().storage.from("event-images").getPublicUrl(name);
    const res = await fetch(data.publicUrl);
    expect(res.ok).toBe(true);
  });
});

describe("storage · server-side type + size limits", () => {
  it("rejects a non-image upload to event-images (mime allow-list)", async () => {
    const { error } = await ed.client.storage
      .from("event-images")
      .upload(`${ed.id}/${fresh("png")}`, new Blob(["hi"], { type: "text/plain" }), {
        upsert: false,
        contentType: "text/plain",
      });
    expect(error).not.toBeNull();
  });

  it("rejects a non-csv upload to promo-csv (mime allow-list)", async () => {
    const { error } = await ed.client.storage
      .from("promo-csv")
      .upload(`${ed.id}/${fresh("csv")}`, PNG_1PX, {
        upsert: false,
        contentType: "image/png",
      });
    expect(error).not.toBeNull();
  });

  it("rejects an oversized upload to org-logos (>5MB size cap)", async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1024, 0); // just over 5MB
    const { error } = await ed.client.storage
      .from("org-logos")
      .upload(`${ed.id}/${fresh("png")}`, big, {
        upsert: false,
        contentType: "image/png",
      });
    expect(error).not.toBeNull();
  });
});
