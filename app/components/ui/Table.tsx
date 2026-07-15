import type { HTMLAttributes, ReactNode, ThHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Table primitives shared by the ED / Admin data pages (Reviews,
 * Promo Codes, Users, Flagged Content). Deliberately minimal — the
 * shape work (columns, sort, bulk-select) lives on the page level so
 * every table can wire the same data cells with page-specific header
 * behaviour.
 */
export function Table({
  className,
  children,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table
        {...rest}
        className={cn("w-full min-w-[720px] text-left text-sm", className)}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
      {children}
    </thead>
  );
}

export function TR({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      {...rest}
      className={cn(
        "border-b border-slate-100 last:border-none hover:bg-slate-50/60",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  ...rest
}: { children: ReactNode } & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th {...rest} className={cn("px-4 py-3 font-bold", className)}>
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
} & HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...rest} className={cn("px-4 py-3 text-slate-800", className)}>
      {children}
    </td>
  );
}
