import { useState, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";

const COLORS = {
  primary: "#6366f1",
  secondary: "#8b5cf6", 
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  muted: "#94a3b8",
};

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", 
  "#f97316", "#eab308", "#22c55e", "#14b8a6"
];

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  className?: string;
  action?: React.ReactNode;
}

export function ChartCard({ 
  title, 
  description, 
  children, 
  loading, 
  error,
  className,
  action 
}: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className={cn("border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">{title}</CardTitle>
              {description && <CardDescription className="text-sm">{description}</CardDescription>}
            </div>
            {action}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {loading ? (
            <ChartSkeleton />
          ) : error ? (
            <ChartError message={error} />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              {children}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-48">
        {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
          <Skeleton 
            key={i} 
            className="flex-1 rounded-t-lg animate-pulse" 
            style={{ height: `${h}%` }} 
          />
        ))}
      </div>
      <div className="flex justify-between">
        {[1, 2, 3, 4, 5, 6, 7].map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

function ChartError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <div className="p-3 bg-red-100 rounded-full mb-3">
        <AlertCircle className="h-6 w-6 text-red-500" />
      </div>
      <p className="text-sm text-slate-600">{message}</p>
      <p className="text-xs text-slate-400 mt-1">Please try again later</p>
    </div>
  );
}

function EmptyChart({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <div className="p-3 bg-slate-100 rounded-full mb-3">
        <TrendingUp className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200"
      >
        <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </motion.div>
    );
  }
  return null;
};

interface LeadsTrendChartProps {
  data: { month: string; count: number }[];
  loading?: boolean;
  error?: string | null;
}

export function LeadsTrendChart({ data, loading, error }: LeadsTrendChartProps) {
  if (!loading && !error && (!data || data.length === 0)) {
    return (
      <ChartCard title="Leads Trend" description="Monthly lead acquisition">
        <EmptyChart message="No lead data available" />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Leads Trend" description="Monthly lead acquisition" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            name="Leads"
            stroke={COLORS.primary}
            strokeWidth={3}
            fill="url(#leadGradient)"
            animationBegin={0}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface PropertyBookingsChartProps {
  data: { name: string; bookings: number; revenue?: number }[];
  loading?: boolean;
  error?: string | null;
}

export function PropertyBookingsChart({ data, loading, error }: PropertyBookingsChartProps) {
  if (!loading && !error && (!data || data.length === 0)) {
    return (
      <ChartCard title="Property Bookings" description="Bookings by property">
        <EmptyChart message="No booking data available" />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Property Bookings" description="Bookings by property" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="bookings" 
            name="Bookings"
            fill={COLORS.success}
            radius={[8, 8, 0, 0]}
            animationBegin={0}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface SalesPerformanceChartProps {
  data: { name: string; leads: number; closed: number }[];
  loading?: boolean;
  error?: string | null;
}

export function SalesPerformanceChart({ data, loading, error }: SalesPerformanceChartProps) {
  if (!loading && !error && (!data || data.length === 0)) {
    return (
      <ChartCard title="Sales Performance" description="Executive comparison">
        <EmptyChart message="No performance data available" />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Sales Performance" description="Executive comparison" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: 16 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar 
            dataKey="leads" 
            name="Total Leads"
            fill={COLORS.primary}
            radius={[4, 4, 0, 0]}
            animationBegin={0}
            animationDuration={1200}
          />
          <Bar 
            dataKey="closed" 
            name="Closed Deals"
            fill={COLORS.success}
            radius={[4, 4, 0, 0]}
            animationBegin={200}
            animationDuration={1200}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface LeadSourcePieChartProps {
  data: { source: string; count: number }[];
  loading?: boolean;
  error?: string | null;
}

export function LeadSourcePieChart({ data, loading, error }: LeadSourcePieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!loading && !error && (!data || data.length === 0)) {
    return (
      <ChartCard title="Lead Sources" description="Distribution by source">
        <EmptyChart message="No source data available" />
      </ChartCard>
    );
  }

  const chartData = data.map(item => ({
    name: item.source.charAt(0).toUpperCase() + item.source.slice(1),
    value: item.count
  }));

  return (
    <ChartCard title="Lead Sources" description="Distribution by source" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            animationBegin={0}
            animationDuration={1500}
            animationEasing="ease-out"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {chartData.map((_, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                style={{ 
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                  transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                  transformOrigin: 'center'
                }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface ConversionFunnelChartProps {
  data: { stage: string; count: number; percentage: number }[];
  loading?: boolean;
  error?: string | null;
}

export function ConversionFunnelChart({ data, loading, error }: ConversionFunnelChartProps) {
  if (!loading && !error && (!data || data.length === 0)) {
    return (
      <ChartCard title="Conversion Funnel" description="Lead journey stages">
        <EmptyChart message="No funnel data available" />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Conversion Funnel" description="Lead journey stages" loading={loading} error={error}>
      <div className="space-y-3">
        {data.map((stage, index) => (
          <motion.div
            key={stage.stage}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className="relative"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700 capitalize">{stage.stage}</span>
              <span className="text-sm text-slate-500">{stage.count} ({stage.percentage}%)</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                initial={{ width: 0 }}
                animate={{ width: `${stage.percentage}%` }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </ChartCard>
  );
}

interface TrendIndicatorProps {
  value: number;
  label?: string;
}

export function TrendIndicator({ value, label }: TrendIndicatorProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  
  return (
    <div className={cn(
      "flex items-center gap-1 text-sm font-medium",
      isPositive ? "text-emerald-600" : isNeutral ? "text-slate-500" : "text-red-600"
    )}>
      {isPositive ? (
        <TrendingUp className="h-4 w-4" />
      ) : isNeutral ? (
        <Minus className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <span>{isPositive ? "+" : ""}{value}%</span>
      {label && <span className="text-slate-400 font-normal">{label}</span>}
    </div>
  );
}
