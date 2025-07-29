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
  // ReferenceArea, // Removed unused import
} from 'recharts';

interface TimeSeriesDataPoint {
  timestamp: string; // ISO string date
  [key: string]: number | string | null; // Replaced 'any' with more specific types
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
  timeRange?: string; // Optional time range for custom formatting
}

// Helper to format date for XAxis tick based on time range
const formatDateTick = (isoString: string, timeRange?: string): string => {
  try {
    const date = new Date(isoString);
    
    switch (timeRange) {
      case '7d':
        return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
      case '1m':
      case '3m':
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      case '6m':
      case '1y':
        return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      case 'all':
        return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      default:
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  } catch (_e) { // Prefix unused variable
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
  timeRange,
}: TimeSeriesChartProps) {

  if (syncing) {
     return (
        <div className="flex items-center justify-center h-full min-h-[300px] text-neutral-500"> {/* Updated text */}
            Syncing data... Chart will update shortly.
        </div>
     );
  }

  if (!data || data.length === 0) {
    return (
        <div className="flex items-center justify-center h-full min-h-[300px] text-neutral-500"> {/* Updated text */}
            No historical data available to display the chart. Try syncing first.
        </div>
    );
  }

  return (
    <div className="h-full min-h-[300px] w-full">
       {title && <h3 className="text-lg font-semibold mb-4 text-center text-neutral-300">{title}</h3>} {/* Updated text */}
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
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" /> {/* neutral-700 grid */}
          <XAxis
             dataKey={xAxisDataKey}
             stroke="#737373" // neutral-500 Axis line color
             tick={{ fill: '#a3a3a3' }} // neutral-400 Tick label color
             tickFormatter={(value) => formatDateTick(value, timeRange)}
             dy={5}
           />
          <YAxis
            stroke="#737373" // neutral-500
            tick={{ fill: '#a3a3a3' }} // neutral-400
            tickFormatter={formatValueTick}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#737373', dy: -10 } : undefined} // neutral-500 label
            domain={['auto', 'auto']}
            allowDataOverflow={false}
          />
          <Tooltip
             contentStyle={{ backgroundColor: '#171717', border: '1px solid #525252', color: '#e5e5e5' }} // neutral-900 bg, neutral-600 border, neutral-200 text
             itemStyle={{ color: '#e5e5e5' }} // neutral-200 item text
             formatter={(value: number, name: string) => [`${formatValueTick(value)} ${name === 'count' ? 'items' : ''}`, name]}
             labelFormatter={(value) => formatDateTick(value, timeRange)}
           />
          <Legend wrapperStyle={{ color: '#a3a3a3' }} /> {/* neutral-400 legend text */}
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotoneX"
              dataKey={line.dataKey}
              name={line.name || line.dataKey}
              stroke={line.stroke}
              strokeWidth={2.5}
              dot={false} // Remove individual dots
              activeDot={{ r: 5, fill: line.stroke, strokeWidth: 2, stroke: '#171717' }}
              connectNulls // Connect lines across null data points
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}