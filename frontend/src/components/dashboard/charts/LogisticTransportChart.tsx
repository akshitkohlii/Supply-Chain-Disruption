
"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { logisticsTransportData } from "@/lib/dashboard-data";
import ChartTooltip from "./ChartTooltip";

export default function LogisticsTransportChart() {
  return (
    <div className="h-full min-h-0 w-full min-w-0 pt-2">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={logisticsTransportData}
          margin={{ top: 6, right: 4, bottom: 0, left: -30 }}
        >
          <CartesianGrid stroke="rgba(71,85,105,0.18)" vertical={false} />

          <XAxis
            dataKey="day"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />

          <YAxis
            width={60}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{
              stroke: "rgba(148,163,184,0.35)",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />

          <Legend wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }} />

          <Line
            type="monotone"
            dataKey="delay"
            stroke="#fb7185"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#fb7185", strokeWidth: 0 }}
            activeDot={{
              r: 6,
              fill: "#fb7185",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
            name="Delay Hours"
          />

          <Line
            type="monotone"
            dataKey="throughput"
            stroke="#22d3ee"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#22d3ee", strokeWidth: 0 }}
            activeDot={{
              r: 6,
              fill: "#22d3ee",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
            name="Throughput"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
