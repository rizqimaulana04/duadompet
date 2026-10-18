"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { money } from "@/lib/finance";
export function CashChart({
  data,
}: {
  data: { name: string; income: number; expense: number }[];
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 6, left: -22, bottom: 0 }}
        >
          <defs>
            <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5276f5" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#5276f5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8c96ab" }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8c96ab" }}
            tickFormatter={(v) =>
              v >= 1000000
                ? `${v / 1000000}jt`
                : v >= 1000
                  ? `${v / 1000}rb`
                  : v
            }
          />
          <Tooltip
            formatter={(v) =>
              new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              }).format(Number(v))
            }
          />
          <Area
            name="Pemasukan"
            type="monotone"
            dataKey="income"
            stroke="#5276f5"
            strokeWidth={2.5}
            fill="url(#inc)"
          />
          <Area
            name="Pengeluaran"
            type="monotone"
            dataKey="expense"
            stroke="#65ccb2"
            strokeWidth={2.5}
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
const colors = ["#5673ec", "#9297f0", "#69c6ba", "#f1bd7e", "#d6dff7"];
export function SpendingChart({
  data,
  total,
}: {
  data: { name: string; value: number }[];
  total?: string;
}) {
  const sum = data.reduce((a, b) => a + b.value, 0);
  return (
    <>
      <div className="donut-area">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sum ? data : [{ name: "Belum ada", value: 1 }]}
              innerRadius={68}
              outerRadius={86}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {(sum ? data : [1]).map((_, i) => (
                <Cell
                  key={i}
                  fill={sum ? colors[i % colors.length] : "#e9edf5"}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <span className="muted small">Total pengeluaran</span>
          <strong>{money(total ?? BigInt(Math.round(sum)))}</strong>
        </div>
      </div>
      {data.slice(0, 4).map((d, i) => (
        <div className="category-row" key={d.name}>
          <span>
            <i
              className="dot"
              style={{ background: colors[i % colors.length] }}
            />
            {d.name}
          </span>
          <strong>{sum ? Math.round((d.value / sum) * 100) : 0}%</strong>
        </div>
      ))}
    </>
  );
}
