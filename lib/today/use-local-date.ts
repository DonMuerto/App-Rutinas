"use client";

import { useEffect, useState } from "react";

import type { LocalDate } from "@/lib/contracts";

import type { LocalDateObserver } from "./local-date-observer";

export function useObservedLocalDate(observer: LocalDateObserver) {
  const [date, setDate] = useState<LocalDate | null>(null);

  useEffect(() => observer.subscribe(setDate), [observer]);

  return date;
}
