"use client";

import { useCallback, useEffect, useState } from "react";
import type { Tables } from "@/lib/supabase/types";

export type Contact = Tables<"contacts">;

export type Company = Tables<"companies"> & {
  last_reached_out: string | null;
  latest_note_content: string | null;
  contact: Contact | null;
  campaigns: Array<{ id: string; name: string }>;
};

const CACHE_KEY = "hsc:companies";
const CACHE_VERSION = "v10"; // prototype_url + campaigns
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

type Cached = {
  version: string;
  ts: number;
  companies: Company[];
};

function readCache(): Company[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (parsed.version !== CACHE_VERSION) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.companies;
  } catch {
    return null;
  }
}

function writeCache(companies: Company[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: Cached = {
      version: CACHE_VERSION,
      ts: Date.now(),
      companies,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // quota exceeded or SSR; silent
  }
}

export function clearCompaniesCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached) {
        setCompanies(cached);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { companies: Company[] };
      setCompanies(data.companies);
      writeCache(data.companies);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Apply a partial update locally without refetching
  const updateCompany = useCallback(
    (id: string, patch: Partial<Company>) => {
      setCompanies((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
        writeCache(next);
        return next;
      });
    },
    []
  );

  const refresh = useCallback(() => {
    clearCompaniesCache();
    fetchCompanies(true);
  }, [fetchCompanies]);

  return {
    companies,
    loading,
    error,
    refresh,
    updateCompany,
  };
}
