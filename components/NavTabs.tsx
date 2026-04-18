"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { label: "Leads", href: "/leads" },
  { label: "Opportunities", href: "/opportunities" },
  { label: "Campaigns", href: "/campaigns" },
  { label: "Goals", href: "/goals" },
];

const ADMIN_TAB = { label: "Admin", href: "/admin" };

const ADMIN_CACHE_KEY = "hsc:isAdmin:v1";

export function NavTabs() {
  const pathname = usePathname();
  // Read the cached admin flag synchronously on first render so the
  // Admin tab shows without a flash for returning admins. Re-validated
  // in the effect below.
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(ADMIN_CACHE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { isAdmin?: boolean }) => {
        if (cancelled) return;
        const next = !!data.isAdmin;
        setIsAdmin(next);
        try {
          localStorage.setItem(ADMIN_CACHE_KEY, next ? "true" : "false");
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // ignore — leave cached value in place
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <nav className="flex gap-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            pathname === tab.href ||
            (tab.href !== "/" && pathname?.startsWith(tab.href))
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
