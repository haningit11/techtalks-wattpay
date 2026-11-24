"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Modal from "@/ui/components/overlays/Modal";

type Props = { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" };

// Add focus containment for the shared modal without changing other features.
export default function TariffModal({ title, onClose, children, footer, size }: Props) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = content.current?.closest<HTMLElement>("[role=dialog]");
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0);
    (dialog.querySelector<HTMLElement>("input:not([disabled])") ?? focusable()[0])?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
      else document.getElementById("filter-status")?.focus();
    };
  }, []);
  return <Modal isOpen onClose={onClose} title={title} footer={footer} size={size}><div ref={content}>{children}</div></Modal>;
}
