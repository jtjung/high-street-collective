"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CallOutcomeForm } from "./CallOutcomeForm";
import {
  CheckCircle,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Mail,
  Star,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";

type Company = Tables<"companies">;

interface CompanyModalProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCallLogSaved: () => void;
}

export function CompanyModal({
  company,
  open,
  onOpenChange,
  onCallLogSaved,
}: CompanyModalProps) {
  const [notes, setNotes] = useState("");
  const [existingNotes, setExistingNotes] = useState<
    { content: string; created_at: string }[]
  >([]);

  useEffect(() => {
    if (company && open) {
      setNotes("");
      fetchCompanyDetails(company.id);
    }
  }, [company, open]);

  const fetchCompanyDetails = async (companyId: string) => {
    try {
      const res = await fetch(`/api/companies/${companyId}`);
      const data = await res.json();
      setExistingNotes(data.notes || []);
    } catch (error) {
      console.error("Failed to fetch company details:", error);
    }
  };

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {company.name}
            {company.verified && (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Company Details */}
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {company.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <a
                  href={`tel:${company.phone}`}
                  className="text-blue-600 hover:underline"
                >
                  {company.phone}
                </a>
                {company.phone_carrier_type && (
                  <Badge variant="outline" className="text-xs">
                    {company.phone_carrier_type}
                  </Badge>
                )}
              </div>
            )}
            {company.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <a
                  href={`mailto:${company.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {company.email}
                </a>
              </div>
            )}
            {company.address && (
              <div className="flex items-center gap-2 col-span-2">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{company.address}</span>
              </div>
            )}
            {company.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400" />
                <a
                  href={
                    company.website.startsWith("http")
                      ? company.website
                      : `https://${company.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {company.domain || company.website}
                </a>
              </div>
            )}
            {company.rating && (
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-400" />
                <span>
                  {company.rating} ({company.reviews} reviews)
                </span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {company.subtypes?.map((st) => (
              <Badge key={st} variant="secondary">
                {st}
              </Badge>
            ))}
            {company.is_chain && <Badge variant="outline">Chain</Badge>}
            {company.postal_code && (
              <Badge variant="outline">{company.postal_code}</Badge>
            )}
          </div>

          {/* Social Links */}
          <div className="flex gap-3">
            {company.location_link && (
              <SocialLink href={company.location_link} label="Google Maps" />
            )}
            {company.instagram && (
              <SocialLink href={company.instagram} label="Instagram" />
            )}
            {company.facebook && (
              <SocialLink href={company.facebook} label="Facebook" />
            )}
            {company.linkedin && (
              <SocialLink href={company.linkedin} label="LinkedIn" />
            )}
            {company.x_twitter && (
              <SocialLink href={company.x_twitter} label="X" />
            )}
            {company.youtube && (
              <SocialLink href={company.youtube} label="YouTube" />
            )}
          </div>

          <Separator />

          {/* Previous Notes */}
          {existingNotes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Previous Notes</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {existingNotes.map((note, i) => (
                  <div
                    key={i}
                    className="text-sm bg-gray-50 rounded p-2"
                  >
                    <p>{note.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <Separator className="mt-3" />
            </div>
          )}

          {/* Call Outcome Form */}
          <CallOutcomeForm
            company={company}
            notes={notes}
            onNotesChange={setNotes}
            onSaved={onCallLogSaved}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  );
}
