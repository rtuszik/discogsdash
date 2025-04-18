'use client';

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PieChartDataPoint {
  name: string; // e.g., Year, Genre, Format
  value: number; // Count
}

interface DistributionPieChartProps {
  data: Record<string, number>;
  title?: string;
  limit?: number; // Max number of slices to show (others grouped into 'Other')
  syncing?: boolean;
}

// Define vibrant colors for pie slices suitable for a dark theme
const SLEEK_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#10b981', // emerald-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#06b6d4', // cyan-500
  '#f59e0b', // amber-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
  '#d946ef', // fuchsia-500
];

export default function DistributionPieChart({
  data,
  title,
  limit = 10, // Default to top 10
  syncing = false,
}: DistributionPieChartProps) {

  const processedData = useMemo(() => {
    if (!data || Object.keys(data).length === 0) {
      return [];
    }

    const sortedEntries = Object.entries(data).sort(([, countA], [, countB]) => countB - countA);

    let chartData: PieChartDataPoint[] = sortedEntries.slice(0, limit).map(([name, value]) => ({ name, value }));

    // Group remaining items into 'Other'
    if (sortedEntries.length > limit) {
      const otherCount = sortedEntries.slice(limit).reduce((sum, [, count]) => sum + count, 0);
      if (otherCount > 0) {
        chartData.push({ name: 'Other', value: otherCount });
      }
    }
    return chartData;
  }, [data, limit]);


  if (syncing) {
     return (
        <div className="flex items-center justify-center h-full min-h-[300px] text-neutral-500"> {/* Updated text */}
            Syncing data... Chart will update shortly.
        </div>
     );
  }

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] text-neutral-500"> {/* Updated text */}
        No data available for this chart. Try syncing first.
      </div>
    );
  }

  return (
    <div className="h-full min-h-[300px] w-full flex flex-col items-center">
      {title && <h3 className="text-lg font-semibold mb-4 text-center text-neutral-100">{title}</h3>} {/* Updated text */}
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={processedData}
            cx="50%"
            cy="50%"
            labelLine={false}
            // label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} // Optional: labels on slices
            outerRadius={80}
            fill="#8884d8" // Default fill, overridden by Cell
            dataKey="value"
            stroke="#262626" // neutral-800 border between slices
          >
            {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={SLEEK_COLORS[index % SLEEK_COLORS.length]} /> // Use new colors
            ))}
          </Pie>
          <Tooltip
             contentStyle={{ backgroundColor: '#171717', border: '1px solid #525252', color: '#f5f5f5' }} // neutral-900 bg, neutral-600 border, neutral-100 text (even lighter)
             itemStyle={{ color: '#f5f5f5' }} // Explicitly set item text color to neutral-100
             formatter={(value: number, name: string) => [`${value} items`, name]} // Tooltip content
           />
           {/* Adjust legend position and style */}
          <Legend
             layout="vertical"
             verticalAlign="middle"
             align="right"
             wrapperStyle={{ color: '#a3a3a3', fontSize: '12px', lineHeight: '20px' }} // neutral-400 legend text
             iconSize={10}
           />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}