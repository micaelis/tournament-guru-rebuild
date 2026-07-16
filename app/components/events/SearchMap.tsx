"use client";

/* SearchMap — Leaflet + OpenStreetMap (no API key). Plots only events that
   have resolved coordinates; events without a geo point stay in the results
   list and simply don't appear here. Because each event carries its own
   lat/lng (mostly NULL today, filled in as geocoding runs), the map lights up
   automatically over time with no code change. Loaded via next/dynamic
   ssr:false from the client orchestrator — Leaflet needs `window`. */

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { EventRow } from "@/app/components/types";
import { fmtDateRange } from "@/app/components/card-bits";

type Pinned = EventRow & { lat: number; lng: number };

function ballIcon(color: string) {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="tgb"><circle cx="12" cy="12" r="10.25"/></clipPath></defs>
    <circle cx="12" cy="12" r="10.25" fill="#ffffff" stroke="${color}" stroke-width="1.7"/>
    <g clip-path="url(#tgb)" fill="${color}">
      <path d="M12 8.4 15.42 10.89 14.12 14.91 9.88 14.91 8.58 10.89Z"/>
      <path d="M12 5 9.15 2.93 10.24 -0.43 13.76 -0.43 14.85 2.93Z"/>
      <path d="M18.66 9.84 19.75 6.48 23.27 6.48 24.36 9.84 21.51 11.91Z"/>
      <path d="M16.12 17.66 19.64 17.66 20.73 21.02 17.88 23.09 15.03 21.02Z"/>
      <path d="M7.88 17.66 8.97 21.02 6.12 23.09 3.27 21.02 4.36 17.66Z"/>
      <path d="M5.34 9.84 2.49 11.91 -0.36 9.84 0.73 6.48 4.25 6.48Z"/>
    </g>
  </svg>`;
}

const ACCENT = "#dc2626";
const DARK = "#0f172a";

export default function SearchMap({
  events,
  activeId,
  hoverId,
  onActiveChange,
  fullscreen = false,
  onToggleFullscreen,
  onCollapse,
  resizeNonce,
}: {
  events: EventRow[];
  activeId: string | null;
  hoverId: string | null;
  onActiveChange: (id: string | null) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onCollapse?: () => void;
  resizeNonce?: string | number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const activeIdRef = useRef<string | null>(activeId);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);

  const pinned = events.filter(
    (e): e is Pinned => typeof e.lat === "number" && typeof e.lng === "number"
  );
  const pinnedKey = pinned.map((p) => p.id).join(",");
  const active = pinned.find((p) => p.id === activeId) ?? null;

  /* Mount the map once. */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [39.5, -98.35], // continental US
      zoom: 4,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
      subdomains: "abc",
      detectRetina: true,
    }).addTo(map);
    mapRef.current = map;

    const updatePreview = () => {
      const id = activeIdRef.current;
      const marker = id ? markersRef.current[id] : null;
      if (!marker) {
        setPreviewPos(null);
        return;
      }
      const pt = map.latLngToContainerPoint(marker.getLatLng());
      setPreviewPos({ x: pt.x, y: pt.y });
    };
    map.on("move zoom", updatePreview);

    return () => {
      map.off("move zoom", updatePreview);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* (Re)build markers when the pinned set changes; fit bounds to them. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    pinned.forEach((t) => {
      const isActive = activeIdRef.current === t.id;
      const html = `<div class="tg-pin ${isActive ? "tg-pin--active" : ""}">
        <span class="tg-pin-badge">${ballIcon(isActive ? ACCENT : DARK)}</span>
        <span class="tg-pin-label">${isActive ? '<span class="tg-pin-reddot"></span>' : ""}${escapeHtml(t.title)}</span>
      </div>`;
      const icon = L.divIcon({ html, className: "tg-pin-icon", iconSize: [46, 46], iconAnchor: [23, 23] });
      const marker = L.marker([t.lat, t.lng], { icon, riseOnHover: true }).addTo(map);
      marker.on("click", () => onActiveChange(activeIdRef.current === t.id ? null : t.id));
      markersRef.current[t.id] = marker;
    });

    if (pinned.length > 1) {
      map.fitBounds(L.latLngBounds(pinned.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [56, 56],
        maxZoom: 9,
      });
    } else if (pinned.length === 1) {
      map.setView([pinned[0].lat, pinned[0].lng], 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedKey]);

  /* Reflect active/hover state onto markers + reposition the preview. */
  useEffect(() => {
    activeIdRef.current = activeId;
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const el = marker.getElement()?.querySelector<HTMLElement>(".tg-pin");
      if (!el) return;
      el.classList.toggle("tg-pin--active", id === activeId);
      el.classList.toggle("tg-pin--hover", id === hoverId && id !== activeId);
      marker.setZIndexOffset(id === activeId ? 1000 : id === hoverId ? 500 : 0);
    });

    const map = mapRef.current;
    if (!map) return;
    if (activeId && markersRef.current[activeId]) {
      const marker = markersRef.current[activeId];
      map.panTo(marker.getLatLng(), { animate: true, duration: 0.35 });
      requestAnimationFrame(() => {
        const pt = map.latLngToContainerPoint(marker.getLatLng());
        setPreviewPos({ x: pt.x, y: pt.y });
      });
    } else {
      setPreviewPos(null);
    }
  }, [activeId, hoverId]);

  /* Invalidate size when the container reflows (fullscreen / show-hide). */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 240);
    return () => clearTimeout(t);
  }, [resizeNonce, fullscreen]);

  const zoom = (d: number) => {
    const map = mapRef.current;
    if (map) map.setZoom(map.getZoom() + d);
  };

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "#e8eef3" }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* edge vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 450,
          background:
            "radial-gradient(125% 95% at 50% 42%, transparent 56%, rgba(15,23,42,.20) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Empty-coords state — the list still works; the map fills in later. */}
      {pinned.length === 0 && (
        <div className="absolute inset-0 z-[460] flex items-center justify-center p-6">
          <div
            className="max-w-[280px] rounded-2xl border bg-white/95 p-5 text-center backdrop-blur"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="mb-1 text-[26px]" aria-hidden="true">
              🗺️
            </div>
            <div className="text-[14px] font-bold" style={{ color: "var(--color-dark)" }}>
              Map pins are on their way
            </div>
            <div className="mt-1 text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
              These events don&rsquo;t have precise coordinates yet — every result still
              appears in the list on the left.
            </div>
          </div>
        </div>
      )}

      {/* "N of M on the map" note */}
      {pinned.length > 0 && pinned.length < events.length && (
        <div
          className="absolute left-3 top-3 z-[500] rounded-full border bg-white/95 px-3 py-1.5 text-[11.5px] font-semibold backdrop-blur"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
        >
          {pinned.length} of {events.length} on the map
        </div>
      )}

      {active && previewPos && (
        <MapPreview event={active} pos={previewPos} onClose={() => onActiveChange(null)} />
      )}

      {/* controls */}
      <div className="absolute right-3.5 top-3.5 z-[500] flex flex-col gap-1.5">
        {onToggleFullscreen && (
          <MapBtn title={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={onToggleFullscreen}>
            {fullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="round" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" /></svg>
            )}
          </MapBtn>
        )}
        {onCollapse && !fullscreen && (
          <MapBtn title="Hide map" onClick={onCollapse}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </MapBtn>
        )}
        <div className="overflow-hidden rounded-[10px] bg-white" style={{ boxShadow: "0 2px 10px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.06)" }}>
          <MapBtn title="Zoom in" onClick={() => zoom(1)} flat>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          </MapBtn>
          <div className="h-px" style={{ background: "var(--color-border)" }} />
          <MapBtn title="Zoom out" onClick={() => zoom(-1)} flat>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M5 12h14" strokeLinecap="round" /></svg>
          </MapBtn>
        </div>
      </div>
    </div>
  );
}

function MapBtn({
  children,
  onClick,
  title,
  flat,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  flat?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="tg-hover flex h-[34px] w-[34px] items-center justify-center bg-white"
      style={{
        color: "var(--color-dark)",
        borderRadius: flat ? 0 : 10,
        boxShadow: flat ? "none" : "0 2px 10px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.06)",
      }}
    >
      {children}
    </button>
  );
}

function MapPreview({
  event,
  pos,
  onClose,
}: {
  event: Pinned;
  pos: { x: number; y: number };
  onClose: () => void;
}) {
  const ages = (event.event_ages ?? []).map((a) => a.age.toUpperCase()).sort();
  const ageLabel = ages.length > 1 ? `${ages[0]}–${ages[ages.length - 1]}` : ages[0];
  return (
    <div
      className="absolute z-[600] w-[248px] overflow-hidden rounded-2xl bg-white"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, calc(-100% - 28px))",
        boxShadow: "0 12px 36px rgba(15,23,42,.22), 0 2px 8px rgba(15,23,42,.12)",
        animation: "tgFadeUp .14s ease-out",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close preview"
        className="absolute right-2 top-2 z-[5] flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/95 transition-colors hover:bg-white hover:text-[var(--color-accent)]"
        style={{ color: "var(--color-dark)", boxShadow: "0 2px 6px rgba(15,23,42,.16)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <a
        href={`/events/${event.id}`}
        className="block no-underline transition-colors hover:bg-[var(--color-surface-alt)]"
        style={{ color: "inherit" }}
      >
        <div className="p-3.5">
          <div className="font-heading text-[13.5px] font-bold leading-tight" style={{ color: "var(--color-dark)", letterSpacing: "-0.01em" }}>
            {event.title}
          </div>
          <div className="mt-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
            {[event.location_text || event.state, fmtDateRange(event.start_date, event.end_date)]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            {ageLabel && <TagDot>{ageLabel}</TagDot>}
            {event.event_fields?.[0] && <TagDot>{cap(event.event_fields[0].surface)}</TagDot>}
            {event.general_rating != null && event.general_rating > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-gold)" aria-hidden="true"><path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" /></svg>
                <b style={{ color: "var(--color-dark)" }}>{Number(event.general_rating).toFixed(1)}</b>
              </span>
            )}
          </div>
        </div>
      </a>
      <div
        className="absolute left-1/2 h-3.5 w-3.5 rotate-45 bg-white"
        style={{ bottom: -7, marginLeft: -7, boxShadow: "4px 4px 6px rgba(15,23,42,.08)" }}
        aria-hidden="true"
      />
    </div>
  );
}

function TagDot({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ background: "var(--color-surface-alt)", color: "#334155" }}
    >
      {children}
    </span>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}
