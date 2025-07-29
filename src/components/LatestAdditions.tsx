'use client';

import React from 'react';

interface LatestAddition {
    id: number;
    release_id: number;
    artist: string | null;
    title: string | null;
    cover_image_url: string | null;
    condition: string | null;
    suggested_value: number | null;
    added_date: string;
    format: string | null;
    year: number | null;
}

interface LatestAdditionsProps {
    title: string;
    items: LatestAddition[];
    currencyFormatter: (value: number | null) => string;
}

const formatRelativeTime = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) {
            return 'Today';
        } else if (diffInDays === 1) {
            return '1 day ago';
        } else if (diffInDays < 7) {
            return `${diffInDays} days ago`;
        } else if (diffInDays < 30) {
            const weeks = Math.floor(diffInDays / 7);
            return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
        } else if (diffInDays < 365) {
            const months = Math.floor(diffInDays / 30);
            return months === 1 ? '1 month ago' : `${months} months ago`;
        } else {
            const years = Math.floor(diffInDays / 365);
            return years === 1 ? '1 year ago' : `${years} years ago`;
        }
    } catch (_error) {
        return 'Unknown';
    }
};

export default function LatestAdditions({ title, items, currencyFormatter }: LatestAdditionsProps) {
    if (!items || items.length === 0) {
        return (
            <div className="bg-neutral-800 p-4 md:p-6 rounded-lg border border-neutral-700">
                <h2 className="text-xl font-semibold text-neutral-100 mb-4">{title}</h2>
                <p className="text-neutral-500">No recent additions found.</p>
            </div>
        );
    }

    return (
        <div className="bg-neutral-800 p-4 md:p-6 rounded-lg border border-neutral-700">
            <h2 className="text-xl font-semibold text-neutral-100 mb-4">{title}</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-700/50 transition-colors"
                    >
                        {/* Cover Image */}
                        <div className="w-12 h-12 flex-shrink-0">
                            {item.cover_image_url ? (
                                <img
                                    src={`/api/image-proxy?url=${encodeURIComponent(item.cover_image_url)}`}
                                    alt={`${item.artist} - ${item.title}`}
                                    className="w-full h-full object-cover rounded"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const placeholder = target.nextElementSibling as HTMLElement;
                                        if (placeholder) placeholder.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div
                                className={`w-full h-full bg-neutral-600 rounded flex items-center justify-center text-xs text-neutral-400 ${
                                    item.cover_image_url ? 'hidden' : 'flex'
                                }`}
                            >
                                No Image
                            </div>
                        </div>

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-neutral-100 numbertruncate">
                                        {item.artist || 'Unknown Artist'}
                                    </p>
                                    <p className="text-xs text-neutral-300 truncate">
                                        {item.title || 'Unknown Title'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {item.format && (
                                            <span className="text-xs px-2 py-0.5 bg-neutral-700 text-neutral-300 rounded">
                                                {item.format}
                                            </span>
                                        )}
                                        {item.year && (
                                            <span className="text-xs text-neutral-400">
                                                {item.year}
                                            </span>
                                        )}
                                        {item.condition && (
                                            <span className="text-xs text-neutral-400">
                                                {item.condition}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Value and Date */}
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-medium text-neutral-100">
                                        {currencyFormatter(item.suggested_value)}
                                    </p>
                                    <p className="text-xs text-neutral-400">
                                        {formatRelativeTime(item.added_date)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}