import * as XLSX from "xlsx";
import type { TablesInsert, Json } from "@/lib/supabase/types";

type CompanyInsert = TablesInsert<"companies">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRow = Record<string, any>;

const COLUMN_MAP: Record<string, keyof CompanyInsert> = {
  name: "name",
  subtypes: "subtypes",
  category: "category",
  phone: "phone",
  email: "email",
  address: "address",
  street: "street",
  city: "city",
  postal_code: "postal_code",
  country_code: "country_code",
  verified: "verified",
  rating: "rating",
  reviews: "reviews",
  location_link: "location_link",
  website: "website",
  domain: "domain",
  company_instagram: "instagram",
  company_facebook: "facebook",
  company_linkedin: "linkedin",
  company_x: "x_twitter",
  company_youtube: "youtube",
  working_hours: "working_hours",
  business_status: "business_status",
  "company_insights.employees": "employee_count",
  "company_insights.revenue": "revenue",
  "company_insights.founded_year": "founded_year",
  "company_insights.industry": "industry",
  "phone.phones_enricher.carrier_type": "phone_carrier_type",
  "chain_info.chain": "is_chain",
  place_id: "outscraper_place_id",
};

function parseSubtypes(value: unknown): string[] | null {
  if (!value) return null;
  const str = String(value);
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const str = String(value).toLowerCase();
  return str === "true" || str === "1" || str === "yes";
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseWorkingHours(value: unknown): Json | null {
  if (!value) return null;
  if (typeof value === "object") return value as Json;
  try {
    return JSON.parse(String(value)) as Json;
  } catch {
    return null;
  }
}

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  return str === "None" || str === "none" || str === "null" ? null : str;
}

function mapRowToCompany(
  row: RawRow,
  taskId: string
): CompanyInsert | null {
  const name = cleanString(row["name"]);
  if (!name) return null;

  return {
    name,
    subtypes: parseSubtypes(row["subtypes"]),
    category: cleanString(row["category"]),
    phone: cleanString(row["phone"]),
    email: cleanString(row["email"]),
    address: cleanString(row["address"]),
    street: cleanString(row["street"]),
    city: cleanString(row["city"]),
    postal_code: cleanString(row["postal_code"]),
    country_code: cleanString(row["country_code"]) || "GB",
    verified: parseBool(row["verified"]),
    rating: parseNumber(row["rating"]),
    reviews: parseNumber(row["reviews"]) as number | null,
    location_link: cleanString(row["location_link"]),
    website: cleanString(row["website"] ?? row["site"]),
    domain: cleanString(row["domain"]),
    instagram: cleanString(row["company_instagram"]),
    facebook: cleanString(row["company_facebook"]),
    linkedin: cleanString(row["company_linkedin"]),
    x_twitter: cleanString(row["company_x"]),
    youtube: cleanString(row["company_youtube"]),
    working_hours: parseWorkingHours(row["working_hours"]),
    business_status: cleanString(row["business_status"]),
    employee_count: cleanString(row["company_insights.employees"]),
    revenue: cleanString(row["company_insights.revenue"]),
    founded_year: parseNumber(row["company_insights.founded_year"]) as
      | number
      | null,
    industry: cleanString(row["company_insights.industry"]),
    phone_carrier_type: cleanString(
      row["phone.phones_enricher.carrier_type"]
    ),
    is_chain: parseBool(row["chain_info.chain"]),
    outscraper_place_id: cleanString(row["place_id"]),
    outscraper_task_id: taskId,
    status: "uncalled",
  };
}

export function parseOutscraperXlsx(
  buffer: ArrayBuffer,
  taskId: string
): CompanyInsert[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: RawRow[] = XLSX.utils.sheet_to_json(sheet);

  const companies: CompanyInsert[] = [];
  for (const row of rows) {
    const company = mapRowToCompany(row, taskId);
    if (company) {
      companies.push(company);
    }
  }

  return companies;
}
