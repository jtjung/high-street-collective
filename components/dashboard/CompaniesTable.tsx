"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  GroupingState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  Column,
  Header,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowDownAZ,
  ArrowUpDown,
  ArrowUpZA,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Group,
  Ungroup,
  X,
} from "lucide-react";
import { outcomeLabel } from "@/lib/outcomes";
import type { Company } from "@/lib/use-companies";

const COLUMN_WIDTHS_KEY = "hsc:columnWidths";
const COLUMN_FILTERS_KEY = "hsc:columnFilters";
const SORTING_KEY = "hsc:sorting";
const GROUPING_KEY = "hsc:grouping";

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

function ColumnHeader<T>({
  column,
  label,
}: {
  column: Column<T, unknown>;
  label: string;
}) {
  const sortDir = column.getIsSorted();
  const canGroup = column.getCanGroup();
  const isGrouped = column.getIsGrouped();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center justify-between gap-1 group">
      <button
        type="button"
        onClick={() => column.toggleSorting()}
        className="flex items-center gap-1 flex-1 text-left font-medium hover:text-foreground"
      >
        {label}
        {sortDir === "asc" && <ArrowDownAZ className="h-3 w-3" />}
        {sortDir === "desc" && <ArrowUpZA className="h-3 w-3" />}
        {!sortDir && (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="opacity-0 group-hover:opacity-100 px-1 rounded hover:bg-accent"
        aria-label="Column options"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-6 z-50 min-w-48 bg-popover border rounded-md shadow-md p-2 text-xs font-normal"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="mb-2">
            <Input
              placeholder="Filter..."
              value={(column.getFilterValue() as string) ?? ""}
              onChange={(e) => column.setFilterValue(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="flex items-center gap-2 px-2 py-1 text-left rounded hover:bg-accent"
              onClick={() => {
                column.toggleSorting(false);
                setOpen(false);
              }}
            >
              <ArrowDownAZ className="h-3 w-3" /> Sort asc
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-2 py-1 text-left rounded hover:bg-accent"
              onClick={() => {
                column.toggleSorting(true);
                setOpen(false);
              }}
            >
              <ArrowUpZA className="h-3 w-3" /> Sort desc
            </button>
            {canGroup && (
              <button
                type="button"
                className="flex items-center gap-2 px-2 py-1 text-left rounded hover:bg-accent"
                onClick={() => {
                  column.toggleGrouping();
                  setOpen(false);
                }}
              >
                {isGrouped ? (
                  <>
                    <Ungroup className="h-3 w-3" /> Ungroup
                  </>
                ) : (
                  <>
                    <Group className="h-3 w-3" /> Group by this
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnResizer({ header }: { header: Header<Company, unknown> }) {
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-accent ${
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
      className="inline-flex items-center justify-center w-7 h-7 rounded text-[10px] font-semibold hover:opacity-80 transition-opacity"
      style={{ background: bg, color }}
      title={label}
    >
      {label}
    </a>
  );
}

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface CompaniesTableProps {
  companies: Company[];
  loading: boolean;
  onPhoneClick: (company: Company) => void;
  onMapsClick: (company: Company) => void;
}

export function CompaniesTable({
  companies,
  loading,
  onPhoneClick,
  onMapsClick,
}: CompaniesTableProps) {
  const [columnFilters, setColumnFilters] = useLocalStorageState<ColumnFiltersState>(
    COLUMN_FILTERS_KEY,
    [{ id: "website", value: "__empty__" }]
  );
  const [sorting, setSorting] = useLocalStorageState<SortingState>(SORTING_KEY, [
    { id: "postal_code", desc: false },
  ]);
  const [grouping, setGrouping] = useLocalStorageState<GroupingState>(
    GROUPING_KEY,
    []
  );
  const [columnSizing, setColumnSizing] = useLocalStorageState<
    Record<string, number>
  >(COLUMN_WIDTHS_KEY, {});

  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        accessorKey: "postal_code",
        header: ({ column }) => <ColumnHeader column={column} label="Postal" />,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">
            {(getValue() as string) || "—"}
          </span>
        ),
        size: 90,
        enableGrouping: true,
      },
      {
        accessorKey: "subtypes",
        header: ({ column }) => <ColumnHeader column={column} label="Type" />,
        cell: ({ getValue }) => {
          const subs = getValue() as string[] | null;
          if (!subs?.length)
            return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-0.5">
              {subs.slice(0, 2).map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="text-[10px] px-1 py-0"
                >
                  {s}
                </Badge>
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
          const subs = (row.getValue(id) as string[] | null) ?? [];
          return subs.some((s) =>
            s.toLowerCase().includes(String(value).toLowerCase())
          );
        },
      },
      {
        accessorKey: "name",
        header: ({ column }) => <ColumnHeader column={column} label="Name" />,
        cell: ({ getValue, row }) => (
          <button
            onClick={() => onPhoneClick(row.original)}
            className="text-left font-medium hover:underline truncate max-w-full"
          >
            {getValue() as string}
          </button>
        ),
        size: 200,
      },
      {
        accessorKey: "verified",
        header: ({ column }) => <ColumnHeader column={column} label="✓" />,
        cell: ({ getValue }) =>
          getValue() ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        size: 40,
        filterFn: (row, id, value) => {
          const v = row.getValue(id) as boolean | null;
          const s = String(value).toLowerCase();
          if (s === "true" || s === "yes" || s === "1") return v === true;
          if (s === "false" || s === "no" || s === "0") return v === false;
          return true;
        },
      },
      {
        accessorKey: "phone",
        header: ({ column }) => <ColumnHeader column={column} label="Phone" />,
        cell: ({ getValue, row }) => {
          const phone = getValue() as string | null;
          if (!phone) return <span className="text-muted-foreground">—</span>;
          return (
            <a
              href={`tel:${phone}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return;
                e.preventDefault();
                onPhoneClick(row.original);
              }}
              className="text-primary hover:underline font-mono text-xs"
            >
              {phone}
            </a>
          );
        },
        size: 130,
      },
      {
        accessorKey: "email",
        header: ({ column }) => <ColumnHeader column={column} label="Email" />,
        cell: ({ getValue }) => {
          const email = getValue() as string | null;
          if (!email) return <span className="text-muted-foreground">—</span>;
          return (
            <a
              href={`mailto:${email}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline text-xs truncate max-w-full inline-block"
            >
              {email}
            </a>
          );
        },
        size: 180,
      },
      {
        accessorKey: "website",
        header: ({ column }) => <ColumnHeader column={column} label="Website" />,
        cell: ({ getValue }) => {
          const site = getValue() as string | null;
          if (!site) return <span className="text-muted-foreground">—</span>;
          let host = site;
          try {
            host = new URL(site).hostname.replace(/^www\./, "");
          } catch {
            // keep raw
          }
          return (
            <a
              href={site}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline text-xs inline-flex items-center gap-1"
            >
              {host}
              <ExternalLink className="h-3 w-3" />
            </a>
          );
        },
        size: 160,
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
        header: ({ column }) => <ColumnHeader column={column} label="Maps" />,
        cell: ({ row }) =>
          row.original.location_link ? (
            <button
              onClick={() => onMapsClick(row.original)}
              className="text-primary hover:underline text-xs"
            >
              View
            </button>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        size: 60,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "instagram",
        header: ({ column }) => <ColumnHeader column={column} label="IG" />,
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
      },
      {
        accessorKey: "facebook",
        header: ({ column }) => <ColumnHeader column={column} label="FB" />,
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
      },
      {
        accessorKey: "linkedin",
        header: ({ column }) => <ColumnHeader column={column} label="LI" />,
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
      },
      {
        accessorKey: "x_twitter",
        header: ({ column }) => <ColumnHeader column={column} label="X" />,
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
      },
      {
        accessorKey: "youtube",
        header: ({ column }) => <ColumnHeader column={column} label="YT" />,
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
      },
      {
        accessorKey: "address",
        header: ({ column }) => <ColumnHeader column={column} label="Address" />,
        cell: ({ getValue }) => (
          <span
            className="text-xs text-muted-foreground truncate block max-w-full"
            title={(getValue() as string) ?? ""}
          >
            {(getValue() as string) || "—"}
          </span>
        ),
        size: 200,
      },
      {
        accessorKey: "outcomes",
        header: ({ column }) => (
          <ColumnHeader column={column} label="Outcomes" />
        ),
        cell: ({ getValue }) => {
          const outs = (getValue() as string[]) ?? [];
          if (!outs.length)
            return (
              <Badge variant="outline" className="text-[10px]">
                uncalled
              </Badge>
            );
          return (
            <div className="flex flex-wrap gap-0.5">
              {outs.map((o) => (
                <Badge key={o} className="text-[10px] px-1 py-0">
                  {outcomeLabel(o)}
                </Badge>
              ))}
            </div>
          );
        },
        size: 160,
        filterFn: (row, id, value) => {
          const outs = (row.getValue(id) as string[]) ?? [];
          const v = String(value).toLowerCase();
          if (v === "uncalled") return outs.length === 0;
          return outs.some((o) => outcomeLabel(o).toLowerCase().includes(v));
        },
      },
      {
        id: "last_reached_out",
        accessorKey: "last_reached_out",
        header: ({ column }) => (
          <ColumnHeader column={column} label="Last Reached" />
        ),
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(getValue() as string | null)}
          </span>
        ),
        size: 120,
        sortingFn: "datetime",
      },
      {
        accessorKey: "callback_at",
        header: ({ column }) => (
          <ColumnHeader column={column} label="Callback" />
        ),
        cell: ({ getValue }) => {
          const d = getValue() as string | null;
          if (!d) return <span className="text-muted-foreground">—</span>;
          return <span className="text-xs font-medium">{formatDate(d)}</span>;
        },
        size: 100,
        sortingFn: "datetime",
      },
    ],
    [onPhoneClick, onMapsClick]
  );

  const table = useReactTable({
    data: companies,
    columns,
    state: { columnFilters, sorting, grouping, columnSizing },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onGroupingChange: setGrouping,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const rowCount = table.getFilteredRowModel().rows.length;

  const clearFilters = useCallback(() => {
    setColumnFilters([]);
    setGrouping([]);
  }, [setColumnFilters, setGrouping]);

  const hasActiveFilters = columnFilters.length > 0 || grouping.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{rowCount} companies</span>
        <div className="flex items-center gap-2">
          {grouping.length > 0 && (
            <span className="inline-flex items-center gap-1">
              Grouped by:{" "}
              {grouping.map((g) => (
                <Badge key={g} variant="secondary" className="text-[10px]">
                  {g}
                </Badge>
              ))}
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear filters & grouping
            </button>
          )}
        </div>
      </div>

      <div className="border rounded-md overflow-auto bg-card">
        <table
          className="text-sm"
          style={{ width: table.getTotalSize(), minWidth: "100%" }}
        >
          <thead className="bg-muted/40 border-b sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative text-left px-2 py-2 text-xs font-medium text-muted-foreground"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    <ColumnResizer header={header} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : rowCount === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  No companies match the current filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                if (row.getIsGrouped()) {
                  return (
                    <tr key={row.id} className="bg-muted/20 font-medium">
                      <td
                        colSpan={columns.length}
                        className="px-2 py-1.5 text-xs"
                      >
                        <button
                          onClick={row.getToggleExpandedHandler()}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {row.getIsExpanded() ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {String(row.groupingValue)} ({row.subRows.length})
                        </button>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-muted/20 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-2 py-1.5 overflow-hidden"
                        style={{ width: cell.column.getSize() }}
                      >
                        {cell.getIsPlaceholder()
                          ? null
                          : flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
