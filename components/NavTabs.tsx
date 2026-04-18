"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Leads", href: "/leads" },
  { label: "Opportunities", href: "/opportunities" },
  { label: "Campaigns", href: "/campaigns" },
  { label: "Goals", href: "/goals" },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-0.5">
      {TABS.map((tab) => (
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
