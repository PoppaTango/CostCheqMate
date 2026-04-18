"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

const COLORS = ["#60B5FF", "#FF9149", "#FF9898", "#FF90BB", "#80D8C3", "#A19AD3", "#72BF78", "#FF6363", "#06b6d4", "#8b5cf6", "#f59e0b", "#84cc16"];

interface ChartProps {
  type: "pie" | "bar" | "comparison";
  data: any[];
  height?: number;
  dataKey?: string;
  xKey?: string;
}

/** Returns responsive dimensions based on screen width */
function useResponsiveChart(baseHeight: number) {
  const [dimensions, setDimensions] = useState({ 
    height: baseHeight, 
    isMobile: false,
    isTablet: false,
    pieRadius: 100,
    fontSize: 10,
    legendFontSize: 11,
    barMargin: { top: 20, right: 30, left: 20, bottom: 5 },
    comparisonMargin: { top: 20, right: 30, left: 80, bottom: 5 },
    yAxisWidth: 75,
  });

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      const isMobile = w < 640;
      const isTablet = w >= 640 && w < 1024;

      // Scale height: bigger on large screens, adapt to mobile
      let h = baseHeight;
      if (isMobile) {
        h = Math.max(280, Math.min(400, w * 0.85));
      } else if (isTablet) {
        h = Math.max(350, baseHeight);
      } else {
        h = Math.max(400, baseHeight * 1.15);
      }

      // Pie radius scales with available space
      const pieRadius = isMobile ? Math.round(h * 0.28) : isTablet ? Math.round(h * 0.3) : Math.round(h * 0.32);

      setDimensions({
        height: Math.round(h),
        isMobile,
        isTablet,
        pieRadius,
        fontSize: isMobile ? 9 : 11,
        legendFontSize: isMobile ? 10 : 12,
        barMargin: isMobile
          ? { top: 10, right: 10, left: 0, bottom: 5 }
          : { top: 20, right: 30, left: 20, bottom: 5 },
        comparisonMargin: isMobile
          ? { top: 10, right: 10, left: 10, bottom: 5 }
          : isTablet
          ? { top: 15, right: 20, left: 60, bottom: 5 }
          : { top: 20, right: 30, left: 80, bottom: 5 },
        yAxisWidth: isMobile ? 55 : isTablet ? 65 : 75,
      });
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [baseHeight]);

  return dimensions;
}

export default function RechartsCharts({ type, data, height = 300, dataKey = "value", xKey = "name" }: ChartProps) {
  const safeData = data ?? [];
  const dims = useResponsiveChart(height);

  if (type === "pie") {
    // Custom label that truncates on mobile
    const renderLabel = ({ name, percent, cx, cy, midAngle, outerRadius: or }: any) => {
      if (dims.isMobile && (percent ?? 0) < 0.05) return null; // Hide tiny slices on mobile
      const RADIAN = Math.PI / 180;
      const radius = (or ?? dims.pieRadius) + (dims.isMobile ? 14 : 22);
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
      const displayName = dims.isMobile && name?.length > 8 ? name.slice(0, 7) + "…" : name;
      return (
        <text x={x} y={y} fill="currentColor" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central"
          fontSize={dims.isMobile ? 9 : 11} fontWeight={500}>
          {`${displayName}: ${((percent ?? 0) * 100).toFixed(0)}%`}
        </text>
      );
    };

    return (
      <div style={{ width: "100%", height: dims.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safeData}
              cx="50%"
              cy="50%"
              labelLine={!dims.isMobile}
              label={renderLabel}
              outerRadius={dims.pieRadius}
              innerRadius={dims.isMobile ? dims.pieRadius * 0.4 : 0}
              fill="#8884d8"
              dataKey="value"
            >
              {safeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry?.color ?? COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number) => [
                new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value ?? 0),
                "Spent",
              ]}
            />
            <Legend
              verticalAlign="top"
              wrapperStyle={{ fontSize: dims.legendFontSize, paddingBottom: 8 }}
              iconSize={dims.isMobile ? 8 : 10}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "bar") {
    return (
      <div style={{ width: "100%", height: dims.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={safeData} margin={dims.barMargin}>
            <XAxis
              dataKey={xKey}
              tickLine={false}
              tick={{ fontSize: dims.fontSize }}
              interval={dims.isMobile ? 1 : 0}
              angle={dims.isMobile ? -45 : 0}
              textAnchor={dims.isMobile ? "end" : "middle"}
              height={dims.isMobile ? 60 : 30}
            />
            <YAxis
              tickLine={false}
              tick={{ fontSize: dims.fontSize }}
              tickFormatter={(value) => `$${(value ?? 0) / 1000}k`}
              width={dims.isMobile ? 40 : 50}
            />
            <RechartsTooltip
              formatter={(value: number) => [
                new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value ?? 0),
                "Total",
              ]}
            />
            <Bar dataKey={dataKey} fill="#60B5FF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "comparison") {
    // Scale height for comparison charts based on data length
    const compHeight = Math.max(dims.height, safeData.length * (dims.isMobile ? 45 : 55) + 60);

    return (
      <div style={{ width: "100%", height: compHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={safeData}
            layout="vertical"
            margin={dims.comparisonMargin}
          >
            <XAxis
              type="number"
              tickLine={false}
              tick={{ fontSize: dims.fontSize }}
              tickFormatter={(value) => `$${(value ?? 0) / 1000}k`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              tick={{ fontSize: dims.fontSize }}
              width={dims.yAxisWidth}
            />
            <RechartsTooltip
              formatter={(value: number, name: string) => [
                new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value ?? 0),
                name === "budget" ? "Budget" : "Actual",
              ]}
            />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: dims.legendFontSize }} iconSize={dims.isMobile ? 8 : 10} />
            <Bar dataKey="budget" fill="#80D8C3" name="Budget" radius={[0, 4, 4, 0]} />
            <Bar dataKey="actual" fill="#60B5FF" name="Actual" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
