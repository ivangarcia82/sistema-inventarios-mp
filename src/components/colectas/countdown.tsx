// src/components/colectas/countdown.tsx
"use client";

import { useEffect, useState } from "react";
import { getCountdownState } from "@/lib/colectas-logic";

const LEVEL_CLS: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

export function Countdown({ deadlineISO, className = "" }: { deadlineISO: string; className?: string }) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  if (nowMs === null) return null; // evita desajuste de hidratación

  const s = getCountdownState(deadlineISO, nowMs);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${LEVEL_CLS[s.level]} ${className}`}>
      {s.label}
    </span>
  );
}
