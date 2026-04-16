"use client";

import { useCallback, useEffect, useState } from "react";

export type CallAttempt = {
  id: string;
  ts: string; // ISO timestamp
};

type Store = Record<string, CallAttempt[]>;

const KEY = "hsc:callHistory:v1";
const MAX_PER_COMPANY = 200;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    // Notify same-tab subscribers (storage event only fires cross-tab)
    window.dispatchEvent(new CustomEvent("hsc:callHistoryChange"));
  } catch {
    // ignore quota
  }
}

function randomId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

export function recordCall(companyId: string): CallAttempt {
  const store = read();
  const entry: CallAttempt = {
    id: randomId(),
    ts: new Date().toISOString(),
  };
  const prev = store[companyId] ?? [];
  store[companyId] = [entry, ...prev].slice(0, MAX_PER_COMPANY);
  write(store);
  return entry;
}

export function deleteCall(companyId: string, attemptId: string) {
  const store = read();
  const prev = store[companyId] ?? [];
  store[companyId] = prev.filter((a) => a.id !== attemptId);
  if (store[companyId].length === 0) delete store[companyId];
  write(store);
}

export function clearHistory(companyId: string) {
  const store = read();
  delete store[companyId];
  write(store);
}

/** Reactive hook that returns the current company's call history and stays in sync. */
export function useCallHistory(companyId: string | null | undefined) {
  const [history, setHistory] = useState<CallAttempt[]>(() =>
    companyId ? read()[companyId] ?? [] : []
  );

  const refresh = useCallback(() => {
    if (!companyId) {
      setHistory([]);
      return;
    }
    setHistory(read()[companyId] ?? []);
  }, [companyId]);

  useEffect(() => {
    refresh();
    if (typeof window === "undefined") return;
    const onChange = () => refresh();
    window.addEventListener("hsc:callHistoryChange", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("hsc:callHistoryChange", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return history;
}
