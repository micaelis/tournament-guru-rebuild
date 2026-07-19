/**
 * Client-side uploads to Supabase Storage.
 *
 * The browser authenticated client uploads directly to a bucket; storage
 * RLS (migration 20260719000004) enforces that the object lands under the
 * caller's own `<uid>/` folder, and the bucket's file_size_limit +
 * allowed_mime_types are the server-side type/size backstop. The values
 * checked here are UX only — a fast, friendly rejection before the round
 * trip — never the security boundary.
 *
 * Image uploads return a public URL (the buckets are public); the CSV
 * upload returns the object PATH (the promo-csv bucket is private, so
 * there is no public URL — the admin queue mints a signed URL server-side).
 */
import { createClient } from "@/lib/supabase/client";

/** Public image buckets and their client-side size ceilings (mirrors the
 * bucket file_size_limit; the bucket is authoritative). */
export const IMAGE_BUCKETS = {
  "event-images": 10 * 1024 * 1024,
  "org-logos": 5 * 1024 * 1024,
} as const;

export type ImageBucket = keyof typeof IMAGE_BUCKETS;

const IMAGE_EXTS = ["png", "jpg", "jpeg"];

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Upload an image, returning its public URL (or a friendly error). */
export async function uploadImage(
  bucket: ImageBucket,
  file: File,
): Promise<{ url?: string; error?: string }> {
  const ext = extOf(file.name);
  if (!IMAGE_EXTS.includes(ext)) {
    return { error: "Use a PNG or JPG image." };
  }
  if (file.size > IMAGE_BUCKETS[bucket]) {
    const mb = Math.round(IMAGE_BUCKETS[bucket] / (1024 * 1024));
    return { error: `That image is over the ${mb} MB limit.` };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to upload." };

  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Upload a CSV to the private promo-csv bucket, returning its object path. */
export async function uploadPromoCsv(
  file: File,
): Promise<{ path?: string; error?: string }> {
  if (extOf(file.name) !== "csv") {
    return { error: "Upload a .csv file." };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to upload." };

  const path = `${user.id}/${crypto.randomUUID()}.csv`;
  const { error } = await supabase.storage
    .from("promo-csv")
    .upload(path, file, { contentType: "text/csv", upsert: false });
  if (error) return { error: error.message };
  return { path };
}
