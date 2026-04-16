"use client";

import { useState, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import { CompaniesTable } from "./CompaniesTable";
import { CompanyPanel } from "./CompanyPanel";
import { SyncButton } from "./SyncButton";
import { RefreshCw } from "lucide-react";
import { useCompanies, type Company } from "@/lib/use-companies";

export function DashboardClient() {
  const { companies, loading, refresh, updateCompany } = useCompanies();
  const [selected, setSelected] = useState<Company | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"details" | "maps">("details");

  const handlePhoneClick = useCallback((c: Company) => {
    setSelected(c);
    setViewMode("details");
    setPanelOpen(true);
  }, []);

  const handleMapsClick = useCallback((c: Company) => {
    setSelected(c);
    setViewMode("maps");
    setPanelOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">HSC CRM</h1>
            <p className="text-xs text-muted-foreground">
              {companies.length} companies · cached locally
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-accent"
              title="Refresh from server"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
            <SyncButton onSyncComplete={refresh} />
            <UserButton />
          </div>
        </div>
      </header>

      <div className="p-4">
        <CompaniesTable
          companies={companies}
          loading={loading}
          onPhoneClick={handlePhoneClick}
          onMapsClick={handleMapsClick}
        />
      </div>

      <CompanyPanel
        company={selected}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        viewMode={viewMode}
        onUpdated={updateCompany}
      />
    </div>
  );
}
