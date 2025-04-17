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

// Define grayscale colors for pie slices (adjust as needed)
const GRAYSCALE_COLORS = [
  '#FFFFFF', // White
  '#F3F4F6', // gray-100
  '#E5E7EB', // gray-200
  '#D1D5DB', // gray-300
  '#9CA3AF', // gray-400
  '#6B7280', // gray-500
  '#4B5563', // gray-600
  '#374151', // gray-700
  '#1F2937', // gray-800
  '#111827', // gray-900
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
        <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500">
            Syncing data... Chart will update shortly.
        </div>
     );
  }

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500">
        No data available for this chart. Try syncing first.
      </div>
    );
  }

  return (
    <div className="h-full min-h-[300px] w-full flex flex-col items-center">
      {title && <h3 className="text-lg font-semibold mb-4 text-center text-white">{title}</h3>}
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
            stroke="#1F2937" // gray-800 border between slices
          >
            {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={GRAYSCALE_COLORS[index % GRAYSCALE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
             contentStyle={{ backgroundColor: '#111827', border: '1px solid #4B5563', color: '#D1D5DB' }} // gray-900 bg, gray-600 border, gray-300 text
             formatter={(value: number, name: string) => [`${value} items`, name]} // Tooltip content
           />
           {/* Adjust legend position and style */}
          <Legend
             layout="vertical"
             verticalAlign="middle"
             align="right"
             wrapperStyle={{ color: '#9CA3AF', fontSize: '12px', lineHeight: '20px' }} // gray-400 legend text
             iconSize={10}
           />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}