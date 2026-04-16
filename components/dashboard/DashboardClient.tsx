"use client";

import { useState, useEffect, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import { CompaniesTable } from "./CompaniesTable";
import { CompanyModal } from "./CompanyModal";
import { SyncButton } from "./SyncButton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";

type Company = Tables<"companies">;

const STATUS_OPTIONS = [
  { value: "uncalled", label: "Uncalled" },
  { value: "interested", label: "Interested" },
  { value: "dead_number", label: "Dead Number" },
  { value: "voicemail", label: "Voicemail" },
  { value: "send_website", label: "Send Website" },
  { value: "call_back_later", label: "Call Back Later" },
  { value: "not_interested", label: "Not Interested" },
  { value: "contacted", label: "Contacted" },
];

export function DashboardClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("uncalled");
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: "50",
        ...(search && { search }),
      });
      const res = await fetch(`/api/companies?${params}`);
      const data = await res.json();
      setCompanies(data.companies || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    } finally {
      setLoading(false);
    }
  }, [status, page, search]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const handlePhoneClick = (company: Company) => {
    setSelectedCompany(company);
    setModalOpen(true);
  };

  const handleCallLogSaved = () => {
    fetchCompanies();
    setModalOpen(false);
    setSelectedCompany(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">HSC CRM</h1>
            <p className="text-sm text-gray-500">
              High Street Collective
            </p>
          </div>
          <div className="flex items-center gap-4">
            <SyncButton onSyncComplete={fetchCompanies} />
            <UserButton />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="border-b bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, postal code, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500">
            {total} companies
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        <CompaniesTable
          companies={companies}
          loading={loading}
          onPhoneClick={handlePhoneClick}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() =>
                setPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Company Modal */}
      <CompanyModal
        company={selectedCompany}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCallLogSaved={handleCallLogSaved}
      />
    </div>
  );
}
