"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  Column,
  Header,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Check,
  ExternalLink,
} from "lucide-react";
import { outcomeLabel } from "@/lib/outcomes";
import type { Company } from "@/lib/use-companies";

const COLUMN_WIDTHS_KEY = "hsc:columnWidths:v2";

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
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
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
  globalFilter: string;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  onColumnFiltersChange: (v: ColumnFiltersState) => void;
  onSortingChange: (v: SortingState) => void;
  onPhoneClick: (company: Company) => void;
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
}: CompaniesTableProps) {
  const [columnSizing, setColumnSizing] = useLocalStorageState<
    Record<string, number>
  >(COLUMN_WIDTHS_KEY, {});

  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        accessorKey: "postal_code",
        header: "Postal",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">
            {(getValue() as string) || "—"}
          </span>
        ),
        size: 90,
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
                <Badge
                  key={s}
                  variant="secondary"
                  className="text-[10px] px-1 py-0 font-normal"
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
        header: "Name",
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
        header: "✓",
        cell: ({ getValue }) =>
          getValue() ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        size: 50,
      },
      {
        accessorKey: "phone",
        header: "Phone",
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
        size: 140,
      },
      {
        accessorKey: "email",
        header: "Email",
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
        header: "Website",
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
              <ExternalLink className="h-3 w-3 shrink-0" />
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
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ getValue }) => (
          <span
            className="text-xs text-muted-foreground truncate block max-w-full"
            title={(getValue() as string) ?? ""}
          >
            {(getValue() as string) || "—"}
          </span>
        ),
        size: 220,
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
                  className="text-[10px] px-1 py-0 font-normal"
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
          if (value === "__uncalled__") return outs.length === 0;
          if (value === "__any__") return outs.length > 0;
          const v = String(value).toLowerCase();
          return outs.some((o) => outcomeLabel(o).toLowerCase().includes(v));
        },
      },
      {
        id: "last_reached_out",
        accessorKey: "last_reached_out",
        header: "Last Reached",
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
        header: "Callback",
        cell: ({ getValue }) => {
          const d = getValue() as string | null;
          if (!d) return <span className="text-muted-foreground">—</span>;
          return <span className="text-xs font-medium">{formatDate(d)}</span>;
        },
        size: 100,
        sortingFn: "datetime",
      },
    ],
    [onPhoneClick]
  );

  // Global fuzzy filter across name, phone, email, address, postal_code
  const globalFilterFn = useMemo(
    () => (row: { original: Company }, _columnId: string, filterValue: string) => {
      if (!filterValue) return true;
      const q = filterValue.toLowerCase();
      const c = row.original;
      return [
        c.name,
        c.phone,
        c.email,
        c.address,
        c.postal_code,
        c.website,
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    },
    []
  );

  const table = useReactTable({
    data: companies,
    columns,
    state: { columnFilters, sorting, columnSizing, globalFilter },
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
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const rows = table.getRowModel().rows;

  // Virtualizer
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1].end
      : 0;

  return (
    <div
      ref={scrollRef}
      className="border rounded-lg overflow-auto bg-card shadow-sm"
      style={{ height: "calc(100vh - 180px)" }}
    >
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
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="relative text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                      className="flex items-center gap-1 w-full text-left hover:text-foreground disabled:cursor-default"
                    >
                      <span className="truncate">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </span>
                      <SortIcon column={header.column} />
                    </button>
                  )}
                  <ColumnResizer header={header} />
                </TableHead>
              ))}
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
            <>
              {paddingTop > 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{ height: paddingTop }}
                  />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <TableRow
                    key={row.id}
                    data-index={virtualRow.index}
                    className="hover:bg-muted/30"
                  >
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
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{ height: paddingBottom }}
                  />
                </tr>
              )}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
