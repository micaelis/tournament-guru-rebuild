"use client";

import { useId, useRef, useState } from "react";
import { safeImageSrc } from "@/lib/url";
import { uploadImage, type ImageBucket } from "@/lib/storage/upload";
import { SafeImg } from "./SafeImg";
import { Button } from "./Button";
import { RemoveIconButton } from "./RemoveIconButton";
import { cn } from "./cn";

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
function PictureGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  );
}

function PhotoGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7.2 6.8H4a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8.8a2 2 0 0 0-2-2h-3.2L14.5 4z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

function UploadGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function ImageUploadField({
  label,
  value,
  onChange,
  bucket,
  name,
  required,
  error,
  hint,
  thumbSize = "md",
  thumbShape = "square",
  onRemove,
  layout = "row",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  bucket: ImageBucket;
  name?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** "md" = slim column-height thumb; "lg" = fixed square tile (org
   * logos); "sm" = compact fixed square tile (sponsor logos in list
   * rows — square with rounded corners, never a stretchy rectangle). */
  thumbSize?: "sm" | "md" | "lg";
  /**
   * "circle" renders the preview as a fixed circular thumb (profile
   * photos) — the form-side mirror of Avatar's circle-fill rule.
   * Overrides `thumbSize`.
   */
  thumbShape?: "square" | "circle";
  /**
   * Row-removal callback for list usages (event images): renders a
   * "Remove" button right next to Upload so the pair reads as one
   * control cluster, and replaces "Clear" (removing the row strictly
   * supersedes blanking its value).
   */
  onRemove?: () => void;
  /**
   * "tile" (the event-logo treatment, S12.46) stacks a 132px square
   * preview over an Upload + clear row and a compact URL input, all
   * flush with the tile's edges. Same value contract and upload flow
   * as the default side-by-side "row" layout.
   */
  layout?: "row" | "tile";
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

  if (layout === "tile") {
    return (
      <div className="block">
        <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-slate-800">
          {label}
          {required && <span aria-hidden="true" className="text-red-600">*</span>}
        </span>
        <div className="w-[132px] space-y-2">
          <div className="grid h-[132px] w-[132px] place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <SafeImg
              src={preview ?? undefined}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setLoadWarning(true)}
              fallback={
                <span className="flex flex-col items-center justify-center gap-1 p-2 text-center text-slate-400">
                  <span aria-hidden="true" className="text-slate-300">
                    <PictureGlyph />
                  </span>
                  <span className="text-[10px] font-medium">No image</span>
                </span>
              }
            />
          </div>
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
              variant="secondary"
              size="xs"
              className="flex-1"
              loading={busy}
              onClick={() => fileRef.current?.click()}
            >
              {!busy && <UploadGlyph />}
              {busy ? "Uploading…" : "Upload"}
            </Button>
            <RemoveIconButton
              size="sm"
              label={`Clear ${label}`}
              onClick={() => {
                setLoadWarning(false);
                setUploadError(null);
                onChange("");
              }}
            />
          </div>
          <input
            id={inputId}
            name={name}
            type="url"
            className="tg-control tg-control-sm"
            placeholder="https://… or upload"
            value={value}
            onChange={(e) => {
              setLoadWarning(false);
              onChange(e.target.value);
            }}
            aria-invalid={Boolean(error) || undefined}
          />
          {uploadError && (
            <span className="block text-xs font-medium text-red-600">
              {uploadError}
            </span>
          )}
          {error && (
            <span className="block text-xs font-medium text-red-600">
              {error}
            </span>
          )}
          {loadWarning && !uploadError && (
            <span className="block text-xs text-amber-600">
              We couldn&apos;t load that image — it may not display.
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-slate-800">
        {label}
        {required && <span aria-hidden="true" className="text-red-600">*</span>}
      </span>

      <div className="flex items-stretch gap-3.5">
        {/* md stretches to the control column's height so the two edges
            align; lg is a fixed square tile that never widens with the row. */}
        <div
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden border border-slate-200 bg-slate-50",
            thumbShape === "circle"
              ? "h-24 w-24 rounded-full"
              : cn(
                  "rounded-xl",
                  thumbSize === "lg" && "h-36 w-36",
                  thumbSize === "sm" && "h-20 w-20",
                  thumbSize === "md" && "w-[88px]",
                ),
          )}
        >
          <SafeImg
            src={preview ?? undefined}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setLoadWarning(true)}
            fallback={
              // Icon-led empty tile (photo glyph for circle/profile
              // fields, picture glyph otherwise) — never a bare "No
              // image" string floating in the box.
              <span className="flex flex-col items-center justify-center gap-1 p-2 text-center text-slate-400">
                <span aria-hidden="true" className="text-slate-300">
                  {thumbShape === "circle" ? <PhotoGlyph /> : <PictureGlyph />}
                </span>
                <span className="text-[10px] font-medium">
                  {thumbShape === "circle" ? "No photo" : "No image"}
                </span>
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
              variant="secondary"
              size="sm"
              loading={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Uploading…" : "Upload PNG/JPG"}
            </Button>
            {onRemove ? (
              <RemoveIconButton
                size="sm"
                label={`Remove ${label}`}
                onClick={onRemove}
              />
            ) : (
              value && (
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
              )
            )}
          </div>

          {/* Messages sit under the controls, aligned with them — not
              under the thumbnail. */}
          {hint && !error && !uploadError && !loadWarning && (
            <span className="block text-xs text-slate-500">{hint}</span>
          )}
          {uploadError && (
            <span className="block text-xs font-medium text-red-600">
              {uploadError}
            </span>
          )}
          {error && (
            <span className="block text-xs font-medium text-red-600">
              {error}
            </span>
          )}
          {loadWarning && !uploadError && (
            <span className="block text-xs text-amber-600">
              We couldn&apos;t load that image — it may not display.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
