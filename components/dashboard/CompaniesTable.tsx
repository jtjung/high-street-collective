"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  PaginationState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Column,
  Header,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Check,
  Columns3,
  ExternalLink,
  GripVertical,
  Pencil,
} from "lucide-react";
import { outcomeLabel } from "@/lib/outcomes";
import type { Company } from "@/lib/use-companies";

const OUTCOME_COLORS: Record<string, string> = {
  send_website: "bg-green-100 text-green-800 border-green-200",
  not_interested: "bg-red-100 text-red-800 border-red-200",
  interested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  dead_number: "bg-gray-100 text-gray-600 border-gray-200",
  voicemail: "bg-orange-100 text-orange-800 border-orange-200",
  follow_up: "bg-orange-100 text-orange-800 border-orange-200",
};

const COLUMN_WIDTHS_KEY = "hsc:columnWidths:v3";
const COLUMN_ORDER_KEY = "hsc:columnOrder:v3";
const COLUMN_VISIBILITY_KEY = "hsc:columnVisibility:v2";
const PAGE_SIZE_KEY = "hsc:pageSize:v1";

const COLUMN_LABELS: Record<string, string> = {
  area: "Area",
  neighborhood: "Neighbourhood",
  postal_code: "Postal",
  subtypes: "Type",
  name: "Name",
  verified: "Verified",
  phone: "Phone",
  email: "Email",
  website: "Website",
  maps: "Maps",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x_twitter: "X / Twitter",
  youtube: "YouTube",
  address: "Address",
  outcomes: "Outcomes",
  latest_note_content: "Latest Note",
  rating: "Rating",
  reviews: "Reviews",
  contact_name: "Contact",
};

/**
 * Coerce a filter value (string | string[] | undefined) to a non-empty
 * string array, or null (= no filter active).
 */
function toFilterArray(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    const arr = raw.filter((x) => typeof x === "string" && x !== "") as string[];
    return arr.length ? arr : null;
  }
  if (typeof raw === "string" && raw !== "" && raw !== "__all__") return [raw];
  return null;
}

/** UK outward code — the token before the space in a postal code. */
function outwardCode(pc: string | null | undefined): string | null {
  if (!pc) return null;
  const trimmed = pc.trim().toUpperCase();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  return parts[0] ?? null;
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);
  return [value, setValue] as const;
}

function SortIcon<T>({ column }: { column: Column<T, unknown> }) {
  if (!column.getCanSort()) return null;
  const sorted = column.getIsSorted();
  if (sorted === "asc") return <ArrowUp className="h-3 w-3 shrink-0" />;
  if (sorted === "desc") return <ArrowDown className="h-3 w-3 shrink-0" />;
  return <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-30" />;
}

function ColumnResizer({ header }: { header: Header<Company, unknown> }) {
  const handler = header.getResizeHandler();
  return (
    <div
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        e.stopPropagation();
        handler(e);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        handler(e);
      }}
      onDoubleClick={() => header.column.resetSize()}
      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/30 ${
        header.column.getIsResizing() ? "bg-primary" : ""
      }`}
    />
  );
}

function SocialBtn({
  href,
  label,
  bg,
  color,
}: {
  href: string | null;
  label: string;
  bg: string;
  color: string;
}) {
  if (!href) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-semibold hover:opacity-80 transition-opacity"
      style={{ background: bg, color }}
      title={label}
    >
      {label}
    </a>
  );
}

type InlineEditCellProps = {
  value: string | null;
  placeholder?: string;
  monospace?: boolean;
  inputType?: "text" | "tel" | "email" | "url";
  onSave: (next: string | null) => Promise<void> | void;
};

/**
 * Click-to-edit cell. Enter commits; Escape cancels; blur also commits.
 * Displays value (or em-dash) with a subtle pencil affordance on hover.
 */
function InlineEditCell({
  value,
  placeholder = "—",
  monospace,
  inputType = "text",
  onSave,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next === (value ?? null)) {
      setEditing(false);
      return;
    }
    try {
      await onSave(next);
    } catch {
      // onSave handles toast
    } finally {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        className={`w-full h-6 px-1 text-xs border rounded outline-none focus:ring-1 focus:ring-primary bg-background ${monospace ? "font-mono" : ""}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className="group w-full text-left inline-flex items-center gap-1 min-w-0 hover:bg-accent rounded px-1 py-0.5 -mx-1 -my-0.5"
      title="Click to edit"
    >
      <span
        className={`truncate flex-1 ${monospace ? "font-mono text-xs" : "text-xs"} ${
          !value ? "text-muted-foreground" : ""
        }`}
      >
        {value ?? placeholder}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 shrink-0" />
    </button>
  );
}

interface CompaniesTableProps {
  companies: Company[];
  loading: boolean;
  globalFilter: string;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  onColumnFiltersChange: (v: ColumnFiltersState) => void;
  onSortingChange: (v: SortingState) => void;
  onPhoneClick: (company: Company) => void;
  onTypeClick: (type: string) => void;
  onAreaClick: (area: string) => void;
  onNeighborhoodClick: (neighborhood: string) => void;
  /** Apply a partial update locally after an inline edit saves. */
  onCompanyUpdated: (id: string, patch: Partial<Company>) => void;
  /** Optional DOM node to render the Columns toolbar into (via portal). */
  toolbarEl?: HTMLElement | null;
  /** Currently selected company ids (shared with map view). */
  selectedIds?: Set<string>;
  /** Toggle a single company's selection. */
  onToggleSelect?: (id: string) => void;
  /** Replace the entire selection (used by "select all visible" / clear). */
  onSetSelection?: (next: Set<string>) => void;
}

export function CompaniesTable({
  companies,
  loading,
  globalFilter,
  columnFilters,
  sorting,
  onColumnFiltersChange,
  onSortingChange,
  onPhoneClick,
  onTypeClick,
  onAreaClick,
  onNeighborhoodClick,
  onCompanyUpdated,
  toolbarEl,
  selectedIds,
  onToggleSelect,
  onSetSelection,
}: CompaniesTableProps) {
  const selectionEnabled = !!(selectedIds && onToggleSelect && onSetSelection);
  const [columnSizing, setColumnSizing] = useLocalStorageState<
    Record<string, number>
  >(COLUMN_WIDTHS_KEY, {});
  const [columnOrder, setColumnOrder] = useLocalStorageState<ColumnOrderState>(
    COLUMN_ORDER_KEY,
    []
  );
  const [columnVisibility, setColumnVisibility] =
    useLocalStorageState<VisibilityState>(COLUMN_VISIBILITY_KEY, {});
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useLocalStorageState<number>(
    PAGE_SIZE_KEY,
    50
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  // Keep pagination.pageSize in sync with stored setting
  useEffect(() => {
    setPagination((p) => ({ ...p, pageSize }));
  }, [pageSize]);

  // Reset to first page when filters/sort/search change
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [columnFilters, sorting, globalFilter]);

  /** PATCH a single company field, then reflect it locally. */
  const saveField = async (
    id: string,
    patch: Partial<Company>
  ): Promise<void> => {
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onCompanyUpdated(id, patch);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      throw err;
    }
  };

  /** PUT contact (upsert). Reflects returned row into the local company. */
  const saveContact = async (
    id: string,
    patch: { name?: string | null; email?: string | null; phone?: string | null; notes?: string | null },
    existing: Company["contact"]
  ): Promise<void> => {
    const payload = {
      name: existing?.name ?? null,
      email: existing?.email ?? null,
      phone: existing?.phone ?? null,
      notes: existing?.notes ?? null,
      ...patch,
    };
    try {
      const res = await fetch(`/api/companies/${id}/contact`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contact = await res.json();
      onCompanyUpdated(id, { contact });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save contact");
      throw err;
    }
  };

  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      ...(selectionEnabled
        ? [
            {
              id: "__select__",
              header: ({ table }) => {
                const pageRows = table.getRowModel().rows;
                const allChecked =
                  pageRows.length > 0 &&
                  pageRows.every((r) => selectedIds!.has(r.original.id));
                const someChecked = pageRows.some((r) =>
                  selectedIds!.has(r.original.id)
                );
                return (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={allChecked}
                      indeterminate={!allChecked && someChecked}
                      onCheckedChange={(v) => {
                        const next = new Set(selectedIds!);
                        if (v) {
                          pageRows.forEach((r) => next.add(r.original.id));
                        } else {
                          pageRows.forEach((r) => next.delete(r.original.id));
                        }
                        onSetSelection!(next);
                      }}
                      aria-label="Select all on page"
                    />
                  </div>
                );
              },
              cell: ({ row }) => {
                const id = row.original.id;
                const checked = selectedIds!.has(id);
                return (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggleSelect!(id)}
                      aria-label={`Select ${row.original.name}`}
                    />
                  </div>
                );
              },
              size: 36,
              enableSorting: false,
              enableHiding: false,
              enableResizing: false,
            } satisfies ColumnDef<Company>,
          ]
        : []),
      {
        accessorKey: "area",
        header: "Area",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          if (!v) return <span className="text-muted-foreground">—</span>;
          return (
            <button onClick={(e) => { e.stopPropagation(); onAreaClick(v); }} title={`Filter by "${v}"`}>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors">
                {v}
              </Badge>
            </button>
          );
        },
        size: 140,
        filterFn: (row, id, value) => {
          const vals = toFilterArray(value);
          if (!vals) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return vals.some((val) => v.toLowerCase() === val.toLowerCase());
        },
      },
      {
        accessorKey: "neighborhood",
        header: "Neighbourhood",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          if (!v) return <span className="text-muted-foreground">—</span>;
          return (
            <button onClick={(e) => { e.stopPropagation(); onNeighborhoodClick(v); }} title={`Filter by "${v}"`}>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors">
                {v}
              </Badge>
            </button>
          );
        },
        size: 160,
        filterFn: (row, id, value) => {
          const vals = toFilterArray(value);
          if (!vals) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return vals.some((val) => v.toLowerCase() === val.toLowerCase());
        },
      },
      {
        accessorKey: "postal_code",
        header: "Postal",
        cell: ({ row }) => (
          <InlineEditCell
            value={row.original.postal_code}
            monospace
            onSave={(next) => saveField(row.original.id, { postal_code: next })}
          />
        ),
        size: 100,
        filterFn: (row, id, value) => {
          const vals = toFilterArray(value);
          if (!vals) return true;
          const pc = String(row.getValue(id) ?? "").toUpperCase();
          const outward = outwardCode(pc);
          return vals.some((val) => {
            const target = val.toUpperCase();
            return outward === target || pc.startsWith(target);
          });
        },
      },
      {
        accessorKey: "subtypes",
        header: "Type",
        cell: ({ getValue }) => {
          const subs = getValue() as string[] | null;
          if (!subs?.length)
            return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-0.5">
              {subs.slice(0, 2).map((s) => (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTypeClick(s);
                  }}
                  title={`Filter by "${s}"`}
                >
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1 py-0 font-normal cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {s}
                  </Badge>
                </button>
              ))}
              {subs.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{subs.length - 2}
                </span>
              )}
            </div>
          );
        },
        size: 150,
        filterFn: (row, id, value) => {
          const vals = toFilterArray(value);
          if (!vals) return true;
          const subs = (row.getValue(id) as string[] | null) ?? [];
          return vals.some((val) => {
            const needle = val.toLowerCase();
            return subs.some(
              (s) => s.toLowerCase() === needle || s.toLowerCase().includes(needle)
            );
          });
        },
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <NameCell
            company={row.original}
            onOpen={() => onPhoneClick(row.original)}
            onSave={(next) =>
              next ? saveField(row.original.id, { name: next }) : undefined
            }
          />
        ),
        size: 220,
      },
      {
        accessorKey: "verified",
        header: "✓",
        cell: ({ getValue }) =>
          getValue() ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        size: 50,
        filterFn: (row, id, value) => {
          if (value === "true") return row.getValue(id) === true;
          if (value === "false") return row.getValue(id) !== true;
          return true;
        },
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <InlineEditCell
            value={row.original.phone}
            inputType="tel"
            monospace
            onSave={(next) => saveField(row.original.id, { phone: next })}
          />
        ),
        size: 150,
        filterFn: (row, id, value) => {
          const v = row.getValue(id) as string | null;
          if (value === "__empty__") return !v;
          if (value === "__nonempty__") return !!v;
          return v ? v.includes(String(value)) : false;
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <InlineEditCell
            value={row.original.email}
            inputType="email"
            onSave={(next) => saveField(row.original.id, { email: next })}
          />
        ),
        size: 200,
        filterFn: (row, id, value) => {
          const v = row.getValue(id) as string | null;
          if (value === "__empty__") return !v;
          if (value === "__nonempty__") return !!v;
          return v
            ? v.toLowerCase().includes(String(value).toLowerCase())
            : false;
        },
      },
      {
        accessorKey: "website",
        header: "Website",
        cell: ({ row }) => (
          <InlineEditCell
            value={row.original.website}
            inputType="url"
            onSave={(next) => saveField(row.original.id, { website: next })}
          />
        ),
        size: 180,
        filterFn: (row, id, value) => {
          const v = row.getValue(id) as string | null;
          if (value === "__empty__") return !v;
          if (value === "__nonempty__") return !!v;
          return v
            ? v.toLowerCase().includes(String(value).toLowerCase())
            : false;
        },
      },
      {
        id: "maps",
        accessorKey: "location_link",
        header: "Maps",
        cell: ({ getValue }) => {
          const link = getValue() as string | null;
          if (!link) return <span className="text-muted-foreground">—</span>;
          return (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline text-xs inline-flex items-center gap-1"
            >
              Open
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          );
        },
        size: 70,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "instagram",
        header: "IG",
        cell: ({ getValue }) => (
          <SocialBtn
            href={getValue() as string | null}
            label="IG"
            bg="linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)"
            color="#fff"
          />
        ),
        size: 50,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "facebook",
        header: "FB",
        cell: ({ getValue }) => (
          <SocialBtn
            href={getValue() as string | null}
            label="FB"
            bg="#1877F2"
            color="#fff"
          />
        ),
        size: 50,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "linkedin",
        header: "LI",
        cell: ({ getValue }) => (
          <SocialBtn
            href={getValue() as string | null}
            label="LI"
            bg="#0A66C2"
            color="#fff"
          />
        ),
        size: 50,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "x_twitter",
        header: "X",
        cell: ({ getValue }) => (
          <SocialBtn
            href={getValue() as string | null}
            label="X"
            bg="#000"
            color="#fff"
          />
        ),
        size: 50,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "youtube",
        header: "YT",
        cell: ({ getValue }) => (
          <SocialBtn
            href={getValue() as string | null}
            label="YT"
            bg="#FF0000"
            color="#fff"
          />
        ),
        size: 50,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ row }) => (
          <InlineEditCell
            value={row.original.address}
            onSave={(next) => saveField(row.original.id, { address: next })}
          />
        ),
        size: 240,
      },
      {
        accessorKey: "outcomes",
        header: "Outcomes",
        cell: ({ getValue }) => {
          const outs = (getValue() as string[]) ?? [];
          if (!outs.length)
            return (
              <Badge
                variant="outline"
                className="text-[10px] font-normal"
              >
                uncalled
              </Badge>
            );
          return (
            <div className="flex flex-wrap gap-0.5">
              {outs.map((o) => (
                <Badge
                  key={o}
                  className={`text-[10px] px-1 py-0 font-normal border ${OUTCOME_COLORS[o] ?? ""}`}
                >
                  {outcomeLabel(o)}
                </Badge>
              ))}
            </div>
          );
        },
        size: 170,
        filterFn: (row, id, value) => {
          const outs = (row.getValue(id) as string[]) ?? [];
          const vals = toFilterArray(value);
          if (!vals) return true;
          if (vals.includes("__uncalled__")) return outs.length === 0;
          if (vals.includes("__any__")) return outs.length > 0;
          return vals.some((v) =>
            outs.some((o) => outcomeLabel(o).toLowerCase().includes(v.toLowerCase()))
          );
        },
      },
      {
        accessorKey: "latest_note_content",
        header: "Latest Note",
        cell: ({ getValue }) => {
          const note = getValue() as string | null;
          if (!note) return <span className="text-muted-foreground">—</span>;
          const truncated = note.length > 60 ? note.slice(0, 60) + "…" : note;
          return (
            <span className="text-xs text-muted-foreground truncate block" title={note}>
              {truncated}
            </span>
          );
        },
        size: 220,
        enableSorting: false,
      },
      {
        accessorKey: "rating",
        header: "Rating",
        cell: ({ getValue }) => {
          const r = getValue() as number | null;
          if (!r) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-xs font-medium">
              ★ {r.toFixed(1)}
            </span>
          );
        },
        size: 70,
      },
      {
        accessorKey: "reviews",
        header: "Reviews",
        cell: ({ getValue }) => {
          const n = getValue() as number | null;
          if (!n) return <span className="text-muted-foreground">—</span>;
          return <span className="text-xs">{n.toLocaleString()}</span>;
        },
        size: 80,
      },
      {
        id: "contact_name",
        accessorFn: (row) => row.contact?.name ?? null,
        header: "Contact",
        cell: ({ row }) => (
          <InlineEditCell
            value={row.original.contact?.name ?? null}
            onSave={(next) =>
              saveContact(row.original.id, { name: next }, row.original.contact)
            }
          />
        ),
        size: 160,
        enableSorting: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onPhoneClick, onTypeClick, onAreaClick, onNeighborhoodClick, selectionEnabled, selectedIds, onToggleSelect, onSetSelection]
  );

  const globalFilterFn = useMemo(
    () =>
      (
        row: { original: Company },
        _columnId: string,
        filterValue: string
      ) => {
        if (!filterValue) return true;
        const q = filterValue.toLowerCase();
        const c = row.original;
        return [c.name, c.phone, c.email, c.address, c.postal_code, c.website]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q));
      },
    []
  );

  const table = useReactTable({
    data: companies,
    columns,
    state: {
      columnFilters,
      sorting,
      columnSizing,
      columnOrder,
      columnVisibility,
      globalFilter,
      pagination,
    },
    onColumnFiltersChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnFilters) : updater;
      onColumnFiltersChange(next);
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const allLeafColumnIds = useMemo(
    () => table.getAllLeafColumns().map((c) => c.id),
    [table]
  );

  const handleDrop = (targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/column-id");
    setDragOverId(null);
    // Never drag the selection checkbox column or drop onto it
    if (!sourceId || sourceId === targetId) return;
    if (sourceId === "__select__" || targetId === "__select__") return;
    const base = columnOrder.length ? [...columnOrder] : [...allLeafColumnIds];
    const from = base.indexOf(sourceId);
    const to = base.indexOf(targetId);
    if (from === -1 || to === -1) return;
    base.splice(from, 1);
    base.splice(to, 0, sourceId);
    // Always keep __select__ pinned to position 0
    if (selectionEnabled) {
      const si = base.indexOf("__select__");
      if (si > 0) { base.splice(si, 1); base.unshift("__select__"); }
      else if (si === -1) base.unshift("__select__");
    }
    setColumnOrder(base);
  };

  const resetColumns = () => {
    setColumnOrder([]);
    setColumnVisibility({});
    setColumnSizing({});
  };

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex } = pagination;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-3">
      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {loading && rows.length === 0 ? (
          <div className="border rounded-lg bg-card p-6 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="border rounded-lg bg-card p-6 text-center text-sm text-muted-foreground">
            No companies match the current filters.
          </div>
        ) : (
          rows.map((row) => {
            const c = row.original;
            const outs = c.outcomes ?? [];
            return (
              <div
                key={row.id}
                className="border rounded-lg bg-card p-3 shadow-sm active:bg-muted/30"
              >
                {/* Top row: postal + outcomes */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {c.postal_code && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {c.postal_code}
                      </Badge>
                    )}
                    {c.verified && (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-0.5 justify-end">
                    {outs.length === 0 ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        uncalled
                      </Badge>
                    ) : (
                      outs.slice(0, 2).map((o) => (
                        <Badge
                          key={o}
                          className={`text-[10px] px-1 py-0 font-normal border ${OUTCOME_COLORS[o] ?? ""}`}
                        >
                          {outcomeLabel(o)}
                        </Badge>
                      ))
                    )}
                    {outs.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{outs.length - 2}
                      </span>
                    )}
                  </div>
                </div>

                {/* Name */}
                <button
                  onClick={() => onPhoneClick(c)}
                  className="block w-full text-left font-medium text-sm mb-1 truncate"
                >
                  {c.name}
                </button>

                {/* Phone + Email row */}
                <div className="flex items-center gap-3 text-xs mb-1.5">
                  {c.phone ? (
                    <a
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-primary font-mono"
                    >
                      📞 {c.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">
                      No phone
                    </span>
                  )}
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="text-primary truncate flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ✉ {c.email}
                    </a>
                  )}
                </div>

                {/* Address */}
                {c.address && (
                  <p className="text-[11px] text-muted-foreground truncate mb-1.5">
                    {c.address}
                  </p>
                )}

                {/* Types */}
                {c.subtypes && c.subtypes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.subtypes.slice(0, 3).map((s) => (
                      <button
                        key={s}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTypeClick(s);
                        }}
                      >
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1 py-0 font-normal"
                        >
                          {s}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop: column picker only — rendered inline when no portal target,
          or portaled into the control bar next to the Table/Map toggle. */}
      {(() => {
        const toolbar = (
          <div className="hidden md:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border rounded-md hover:bg-accent transition-colors cursor-pointer">
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                  Toggle columns
                </div>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(v) => column.toggleVisibility(!!v)}
                      closeOnClick={false}
                    >
                      {COLUMN_LABELS[column.id] ?? column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={resetColumns}>
                  Reset to defaults
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
        return toolbarEl ? createPortal(toolbar, toolbarEl) : (
          <div className="hidden md:flex items-center justify-end gap-2">{toolbar}</div>
        );
      })()}

      {/* Desktop: full table */}
      <div className="hidden md:block border rounded-lg overflow-auto bg-card shadow-sm">
        <Table
          style={{
            width: table.getTotalSize(),
            minWidth: "100%",
            tableLayout: "fixed",
          }}
        >
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const isDragOver = dragOverId === header.column.id;
                  return (
                    <TableHead
                      key={header.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData(
                          "text/column-id",
                          header.column.id
                        );
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setDragOverId(header.column.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDragLeave={() => setDragOverId(null)}
                      onDragEnd={() => setDragOverId(null)}
                      onDrop={handleDrop(header.column.id)}
                      className={`relative text-xs font-semibold tracking-wide text-muted-foreground uppercase cursor-grab active:cursor-grabbing ${
                        isDragOver
                          ? "outline outline-2 outline-primary -outline-offset-2"
                          : ""
                      }`}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1 w-full">
                          <GripVertical className="h-3 w-3 shrink-0 opacity-30" />
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            disabled={!header.column.getCanSort()}
                            className="flex items-center gap-1 flex-1 min-w-0 text-left hover:text-foreground disabled:cursor-default"
                          >
                            <span className="truncate">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                            <SortIcon column={header.column} />
                          </button>
                        </div>
                      )}
                      <ColumnResizer header={header} />
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  No companies match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="py-1.5 overflow-hidden"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 flex-wrap">
          <span>
            {filteredCount === 0 ? 0 : pageIndex * pageSize + 1}
            –{Math.min((pageIndex + 1) * pageSize, filteredCount)} of{" "}
            {filteredCount.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows per page</span>
            <span className="sm:hidden">Per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => v && setPageSize(Number(v))}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1">
          <span className="mr-2">
            Page {pageIndex + 1} of {Math.max(1, pageCount)}
          </span>
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Name cell: single click opens the detail panel, double-click enters
 * inline-edit mode. Displays a pencil on hover as the edit affordance.
 */
function NameCell({
  company,
  onOpen,
  onSave,
}: {
  company: Company;
  onOpen: () => void;
  onSave: (next: string | null) => Promise<void> | void | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(company.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);
  useEffect(() => {
    if (!editing) setDraft(company.name);
  }, [company.name, editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next === company.name) {
      setEditing(false);
      return;
    }
    try {
      await onSave(next);
    } finally {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(company.name);
            setEditing(false);
          }
        }}
        className="w-full h-6 px-1 text-xs font-medium border rounded outline-none focus:ring-1 focus:ring-primary bg-background"
      />
    );
  }

  return (
    <div className="group flex items-center gap-1 min-w-0">
      <button
        onClick={onOpen}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="text-left font-medium hover:underline truncate cursor-pointer flex-1 min-w-0"
        title="Click to open · Double-click to rename"
      >
        {company.name}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-accent shrink-0"
        title="Edit name"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
