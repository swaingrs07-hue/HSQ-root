import * as React from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, FileX } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface EnhancedTableProps<T> {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onRefresh?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  rowKey?: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function EnhancedTable<T extends Record<string, any>>({
  title,
  description,
  icon,
  columns,
  data,
  loading = false,
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  onRefresh,
  emptyTitle = "No data found",
  emptyDescription = "There are no items to display.",
  actions,
  rowKey,
  onRowClick,
  className,
}: EnhancedTableProps<T>) {
  return (
    <Card className={cn("border-0 shadow-lg overflow-hidden", className)}>
      {(title || actions) && (
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="p-2 bg-indigo-100 rounded-lg">
                  {icon}
                </div>
              )}
              <div>
                {title && <CardTitle className="text-lg font-semibold">{title}</CardTitle>}
                {description && <CardDescription className="text-sm">{description}</CardDescription>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onSearchChange && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={searchPlaceholder}
                    className="pl-9 w-48 bg-white border-slate-200"
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                  />
                </div>
              )}
              {onRefresh && (
                <Button variant="outline" size="icon" onClick={onRefresh} className="shrink-0">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              {actions}
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                {columns.map((_, j) => (
                  <Skeleton key={j} className="h-10 flex-1" />
                ))}
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-100 rounded-full mb-4">
              <FileX className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-700 mb-1">{emptyTitle}</h3>
            <p className="text-sm text-slate-500 max-w-sm">{emptyDescription}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  {columns.map((column) => (
                    <TableHead key={column.key} className={cn("font-semibold text-slate-600", column.className)}>
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow
                    key={rowKey ? rowKey(item, index) : index}
                    className={cn(
                      "transition-all duration-200 hover:bg-indigo-50/50",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.key} className={cn("py-4", column.className)}>
                        {column.render 
                          ? column.render(item, index) 
                          : item[column.key]
                        }
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ 
  status, 
  variant 
}: { 
  status: string; 
  variant?: "success" | "warning" | "error" | "info" | "neutral" 
}) {
  const variants = {
    success: "bg-emerald-100 text-emerald-700 border-emerald-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    error: "bg-red-100 text-red-700 border-red-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
      variants[variant || "neutral"]
    )}>
      {status}
    </span>
  );
}

export function ActionButton({
  onClick,
  icon,
  label,
  variant = "default",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "success" | "danger";
}) {
  const variants = {
    default: "bg-slate-100 hover:bg-slate-200 text-slate-700",
    success: "bg-emerald-100 hover:bg-emerald-200 text-emerald-700",
    danger: "bg-red-100 hover:bg-red-200 text-red-700",
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        variants[variant]
      )}
    >
      {icon}
      {label}
    </button>
  );
}
