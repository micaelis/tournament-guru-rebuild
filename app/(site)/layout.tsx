import type { ReactNode } from "react";
import { FlashToast, ToastProvider } from "@/app/components/ui";

/**
 * Public marketing + discovery pages. Wraps every route in the site
 * group with the shared ToastProvider so review/comment actions can
 * push confirmations without each page mounting its own provider.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FlashToast />
      <div className="min-h-dvh bg-slate-50">{children}</div>
    </ToastProvider>
  );
}
