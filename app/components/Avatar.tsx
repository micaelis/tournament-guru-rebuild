const PALETTE = [
  "#0f766e",
  "#1d4ed8",
  "#7c2d12",
  "#9333ea",
  "#0e7490",
  "#be123c",
  "#15803d",
];

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const hash = [...(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = PALETTE[hash % PALETTE.length];

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
