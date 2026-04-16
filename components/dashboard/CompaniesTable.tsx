"use client";

import type { Tables } from "@/lib/supabase/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  ExternalLink,
  Phone,
  Loader2,
} from "lucide-react";

type Company = Tables<"companies">;

interface CompaniesTableProps {
  companies: Company[];
  loading: boolean;
  onPhoneClick: (company: Company) => void;
}

export function CompaniesTable({
  companies,
  loading,
  onPhoneClick,
}: CompaniesTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        No companies found
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Postal Code</TableHead>
            <TableHead className="w-32">Subtypes</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-20">Verified</TableHead>
            <TableHead className="w-36">Phone</TableHead>
            <TableHead className="w-48">Email</TableHead>
            <TableHead className="w-16 text-center">Maps</TableHead>
            <TableHead className="w-12 text-center">IG</TableHead>
            <TableHead className="w-12 text-center">FB</TableHead>
            <TableHead className="w-12 text-center">LI</TableHead>
            <TableHead className="w-12 text-center">X</TableHead>
            <TableHead className="w-12 text-center">YT</TableHead>
            <TableHead>Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow key={company.id} className="hover:bg-gray-50">
              <TableCell className="font-mono text-sm">
                {company.postal_code || "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {company.subtypes?.slice(0, 2).map((st) => (
                    <Badge key={st} variant="secondary" className="text-xs">
                      {st}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="font-medium max-w-48 truncate">
                {company.name}
              </TableCell>
              <TableCell>
                {company.verified && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </TableCell>
              <TableCell>
                {company.phone ? (
                  <button
                    onClick={() => onPhoneClick(company)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm"
                  >
                    <Phone className="h-3 w-3" />
                    {company.phone}
                  </button>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm truncate max-w-48">
                {company.email ? (
                  <a
                    href={`mailto:${company.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {company.email}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {company.location_link && (
                  <a
                    href={company.location_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-800"
                  >
                    <ExternalLink className="h-4 w-4 mx-auto" />
                  </a>
                )}
              </TableCell>
              <SocialCell url={company.instagram} label="IG" />
              <SocialCell url={company.facebook} label="FB" />
              <SocialCell url={company.linkedin} label="LI" />
              <SocialCell url={company.x_twitter} label="X" />
              <SocialCell url={company.youtube} label="YT" />
              <TableCell className="text-sm text-gray-600 max-w-64 truncate">
                {company.address || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SocialCell({
  url,
  label,
}: {
  url: string | null;
  label: string;
}) {
  if (!url) return <TableCell />;

  const href = url.startsWith("http") ? url : `https://${url}`;
  return (
    <TableCell className="text-center">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline"
      >
        {label}
      </a>
    </TableCell>
  );
}
