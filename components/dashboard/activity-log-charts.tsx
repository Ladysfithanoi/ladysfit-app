"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

export type ActivityChartPoint = { day: string; steps: number; minutes: number };

const STEP_GOAL = 8000;

function ChartTooltip({
  active, payload, label, unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs font-bold">
      <p className="text-gray-400">{label}</p>
      <p className="text-gray-800">{(payload[0].value as number).toLocaleString()} {unit}</p>
    </div>
  );
}

export function StepsBarChart({ data }: { data: ActivityChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 700 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : `${v}`}
        />
        <ReferenceLine
          y={STEP_GOAL}
          stroke="#d1d5db"
          strokeDasharray="4 4"
          label={{ value: "8k", position: "right", fontSize: 9, fill: "#9ca3af" }}
        />
        <Tooltip content={({ active, payload, label }) => (
          <ChartTooltip active={active} payload={payload as unknown as { value: number }[]} label={String(label ?? "")} unit="bước" />
        )} />
        <Bar dataKey="steps" fill="#f15b5c" radius={[5, 5, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MinutesBarChart({ data }: { data: ActivityChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 700 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
        />
        <Tooltip content={({ active, payload, label }) => (
          <ChartTooltip active={active} payload={payload as unknown as { value: number }[]} label={String(label ?? "")} unit="phút" />
        )} />
        <Bar dataKey="minutes" fill="#3b82f6" radius={[5, 5, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
