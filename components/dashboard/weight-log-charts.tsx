"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

export type ChartPoint = { date: string; weight: number };

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs font-semibold">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="text-[#f15b5c]">{payload[0].value} kg</p>
    </div>
  );
}

export function MiniWeightChart({ data, height = 64 }: { data: ChartPoint[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-xs text-gray-300">Chưa đủ dữ liệu</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -40, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#f15b5c"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: "#f15b5c" }}
        />
        <Tooltip content={<CustomTooltip />} />
        <XAxis dataKey="date" hide />
        <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} hide />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DetailWeightChart({
  data,
  targetWeight,
}: {
  data: ChartPoint[];
  targetWeight: number;
}) {
  if (data.length < 2) {
    return (
      <div className="h-[250px] flex items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
        <p className="text-sm text-gray-300 font-semibold">
          Cần ít nhất 2 lần cân để hiển thị biểu đồ
        </p>
      </div>
    );
  }

  const minY = Math.min(...data.map((d) => d.weight), targetWeight) - 1;
  const maxY = Math.max(...data.map((d) => d.weight)) + 1;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 8, right: 56, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 600 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minY, maxY]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          unit="kg"
          width={42}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={targetWeight}
          stroke="#9ca3af"
          strokeDasharray="6 3"
          strokeWidth={1.5}
          label={{
            value: `Mục tiêu ${targetWeight}kg`,
            position: "right",
            fontSize: 10,
            fill: "#9ca3af",
            fontWeight: 600,
          }}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#f15b5c"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#f15b5c", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#f15b5c", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FullWeightChart({
  data,
  targetWeight,
}: {
  data: ChartPoint[];
  targetWeight: number;
}) {
  return <DetailWeightChart data={data} targetWeight={targetWeight} />;
}
