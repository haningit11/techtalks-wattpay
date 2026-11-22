
"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export default function Accordion({
  title,
  children,
  defaultOpen = false,
  className = "",
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--color-border)] ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)]"
        aria-expanded={isOpen}
      >
        {title}

        <ChevronDown
          size={18}
          className={`shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-[var(--color-border)] p-4">
          {children}
        </div>
      )}
    </div>
  );
}
