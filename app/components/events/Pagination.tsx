"use client";

/* Pagination — windowed page numbers with Prev/Next, matching the prototype.
   Operates on the real total from the search result set. */

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages: (number | "…")[] = [];
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i++)
      pages.push(i);
    if (page < pageCount - 2) pages.push("…");
    pages.push(pageCount);
  }

  const btn = (
    label: React.ReactNode,
    p: number,
    { active = false, disabled = false, key }: { active?: boolean; disabled?: boolean; key: string }
  ) => (
    <button
      key={key}
      disabled={disabled}
      onClick={() => !disabled && onPage(p)}
      aria-current={active ? "page" : undefined}
      className="tg-hover inline-flex items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-semibold"
      style={{
        minWidth: 36,
        height: 36,
        padding: "0 10px",
        background: active ? "var(--color-dark)" : "#fff",
        color: disabled ? "#cbd5e1" : active ? "#fff" : "var(--color-dark)",
        borderColor: active ? "var(--color-dark)" : "var(--color-border)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-[18px]"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
        Showing <b style={{ color: "var(--color-dark)" }}>{start}–{end}</b> of{" "}
        <b style={{ color: "var(--color-dark)" }}>{total}</b> tournaments
      </div>
      <div className="flex items-center gap-1.5">
        {btn(
          <>
            <Chevron dir="left" /> Prev
          </>,
          page - 1,
          { disabled: page === 1, key: "prev" }
        )}
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`e${i}`}
              className="px-1 text-[13px]"
              style={{ color: "var(--color-text-faint)" }}
            >
              …
            </span>
          ) : (
            btn(p, p, { active: p === page, key: `p${p}` })
          )
        )}
        {btn(
          <>
            Next <Chevron dir="right" />
          </>,
          page + 1,
          { disabled: page === pageCount, key: "next" }
        )}
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === "left" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}
