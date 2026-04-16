"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Tables } from "@/lib/supabase/types";

export type CallAttempt = Tables<"call_attempts">;

/**
 * Reactive hook: fetches this company's call history from the server and
 * exposes optimistic `log` / `remove` helpers. Durable, team-wide, per-user attributed.
 */
export function useCallHistory(companyId: string | null | undefined) {
  const [history, setHistory] = useState<CallAttempt[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!companyId) {
      setHistory([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/call-attempts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { attempts: CallAttempt[] };
      setHistory(data.attempts);
    } catch {
      // silent — surface via toast in the actions instead
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const log = useCallback(async () => {
    if (!companyId) return;
    // Optimistic: insert a placeholder immediately, replace on response
    const tempId = `temp-${Date.now()}`;
    const optimistic: CallAttempt = {
      id: tempId,
      company_id: companyId,
      user_id: "",
      user_email: null,
      user_name: "…",
      ts: new Date().toISOString(),
    };
    setHistory((prev) => [optimistic, ...prev]);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/call-attempts`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = (await res.json()) as CallAttempt;
      setHistory((prev) => prev.map((a) => (a.id === tempId ? saved : a)));
    } catch {
      toast.error("Failed to log call attempt");
      setHistory((prev) => prev.filter((a) => a.id !== tempId));
    }
  }, [companyId]);

  const remove = useCallback(
    async (attemptId: string) => {
      if (!companyId) return;
      // Optimistic remove
      const prev = history;
      setHistory((p) => p.filter((a) => a.id !== attemptId));
      try {
        const res = await fetch(
          `/api/companies/${companyId}/call-attempts/${attemptId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        toast.error("Failed to delete record");
        setHistory(prev); // rollback
      }
    },
    [companyId, history]
  );

  return { history, loading, log, remove };
}
