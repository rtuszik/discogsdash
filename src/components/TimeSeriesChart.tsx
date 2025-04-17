'use client'; // Recharts components need to be client-side

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';

interface TimeSeriesDataPoint {
  timestamp: string; // ISO string date
  [key: string]: any; // Allow other numeric values
}

interface LineConfig {
  dataKey: string;
  stroke: string;
  name?: string;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  lines: LineConfig[];
  title?: string;
  yAxisLabel?: string;
  xAxisDataKey?: string;
  syncing?: boolean; // Optional flag to show placeholder during sync
}

// Helper to format date for XAxis tick
const formatDateTick = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    // Simple date format (e.g., 'Apr 17'), adjust as needed
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return isoString; // Fallback
  }
};

// Helper to format currency/number for Tooltip/YAxis
const formatValueTick = (value: number | null | undefined): string => {
    if (value === null || typeof value === 'undefined') return 'N/A';
    if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(1) + 'k'; // Simple k formatting
    }
    return value.toFixed(0); // Default to integer for counts or small values
};


export default function TimeSeriesChart({
  data,
  lines,
  title,
  yAxisLabel,
  xAxisDataKey = 'timestamp',
  syncing = false,
}: TimeSeriesChartProps) {

  if (syncing) {
     return (
        <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500">
            Syncing data... Chart will update shortly.
        </div>
     );
  }

  if (!data || data.length === 0) {
    return (
        <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500">
            No historical data available to display the chart. Try syncing first.
        </div>
    );
  }

  return (
    <div className="h-full min-h-[300px] w-full">
       {title && <h3 className="text-lg font-semibold mb-4 text-center text-gray-300">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" /> {/* gray-700 grid */}
          <XAxis
             dataKey={xAxisDataKey}
             stroke="#6B7280" // gray-500 Axis line color
             tick={{ fill: '#9CA3AF' }} // gray-400 Tick label color
             tickFormatter={formatDateTick}
             dy={5}
           />
          <YAxis
            stroke="#6B7280" // gray-500
            tick={{ fill: '#9CA3AF' }} // gray-400
            tickFormatter={formatValueTick}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#6B7280', dy: -10 } : undefined} // gray-500 label
            domain={['auto', 'auto']}
            allowDataOverflow={false}
          />
          <Tooltip
             contentStyle={{ backgroundColor: '#111827', border: '1px solid #4B5563', color: '#D1D5DB' }} // gray-900 bg, gray-600 border, gray-300 text
             itemStyle={{ color: '#D1D5DB' }} // gray-300 item text
             formatter={(value: number, name: string) => [`${formatValueTick(value)} ${name === 'count' ? 'items' : ''}`, name]}
             labelFormatter={formatDateTick}
           />
          <Legend wrapperStyle={{ color: '#9CA3AF' }} /> {/* gray-400 legend text */}
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name || line.dataKey}
              stroke={line.stroke}
              strokeWidth={2}
              dot={{ r: 3, fill: line.stroke }}
              activeDot={{ r: 6 }}
              connectNulls // Connect lines across null data points
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}