"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart2 } from "lucide-react";

export interface WeekDayData {
  day: string;
  avgLoss: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5 text-xs font-semibold">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="text-[#f15b5c]">{payload[0].value.toFixed(1)} kg giảm TB</p>
    </div>
  );
}

export function WeightChart({
  data,
  emptyMessage = "Chưa có dữ liệu",
}: {
  data: WeekDayData[];
  emptyMessage?: string;
}) {
  const hasData = data.some((d) => d.avgLoss > 0);

  if (!hasData) {
    return (
      <div className="h-44 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl gap-2">
        <BarChart2 className="w-8 h-8 text-gray-200" />
        <p className="text-sm text-gray-300 font-semibold">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={176}>
      <BarChart
        data={data}
        barSize={28}
        margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af", fontWeight: 600 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          unit="kg"
          width={38}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#fafafa", radius: 8 }} />
        <Bar dataKey="avgLoss" radius={[8, 8, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.avgLoss > 0 ? "#f15b5c" : "#f3f4f6"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
