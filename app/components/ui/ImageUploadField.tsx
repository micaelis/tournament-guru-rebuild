"use client";

import { useId, useRef, useState } from "react";
import { safeImageSrc } from "@/lib/url";
import { uploadImage, type ImageBucket } from "@/lib/storage/upload";
import { SafeImg } from "./SafeImg";
import { Button } from "./Button";

/**
 * Image field with BOTH real upload and paste-a-URL (SCOPE-uploads.md):
 * pick a PNG/JPG to upload straight to Storage, or paste a hosted URL.
 * Either way the field's value is a string (public URL or path) that the
 * form submits and the app later renders through `safeImageSrc`.
 *
 * Controlled: the parent owns `value`/`onChange`. Pass `name` to also emit
 * a hidden input so an uncontrolled `<form>` submits the value by name.
 *
 * Broken/blank URLs never paint the browser's broken-image glyph — the
 * preview is a `SafeImg` that falls back to a neutral placeholder, and a
 * failed load shows a soft, non-blocking warning (URLs can die later; this
 * is best-effort, never a hard gate).
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  bucket,
  name,
  required,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  bucket: ImageBucket;
  name?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState(false);

  const preview = safeImageSrc(value);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setLoadWarning(false);
    setBusy(true);
    const { url, error: upErr } = await uploadImage(bucket, file);
    setBusy(false);
    if (upErr || !url) {
      setUploadError(upErr ?? "Upload failed.");
      return;
    }
    onChange(url);
    if (fileRef.current) fileRef.current.value = ""; // allow re-picking same file
  }

  return (
    <div className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-slate-800">
        {label}
        {required && <span aria-hidden="true" className="text-red-600">*</span>}
      </span>

      <div className="flex items-start gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <SafeImg
            src={preview ?? undefined}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setLoadWarning(true)}
            fallback={
              <span className="text-[10px] font-medium text-slate-400">
                No image
              </span>
            }
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            id={inputId}
            name={name}
            type="url"
            className="tg-control"
            placeholder="https://… or upload →"
            value={value}
            onChange={(e) => {
              setLoadWarning(false);
              onChange(e.target.value);
            }}
            aria-invalid={Boolean(error) || undefined}
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0])}
              aria-label={`Upload ${label}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Uploading…" : "Upload PNG/JPG"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLoadWarning(false);
                  setUploadError(null);
                  onChange("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {hint && !error && !uploadError && !loadWarning && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
      {uploadError && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {uploadError}
        </span>
      )}
      {error && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
      {loadWarning && !uploadError && (
        <span className="mt-1 block text-xs text-amber-600">
          We couldn&apos;t load that image — it may not display.
        </span>
      )}
    </div>
  );
}
