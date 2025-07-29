'use client';

import React from 'react';

export type TimeRange = '7d' | '1m' | '3m' | '6m' | '1y' | 'all';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

export default function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2 bg-neutral-800 p-1 rounded-lg border border-neutral-700">
      {timeRangeOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150
            ${
              value === option.value
                ? 'bg-neutral-700 text-neutral-100'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}