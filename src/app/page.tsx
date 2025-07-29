"use client";

import React, { useState, useEffect, useCallback } from "react";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import DistributionPieChart from "@/components/DistributionPieChart";
import ValuableItemsList from "@/components/ValuableItemsList";
import LatestAdditions from "@/components/LatestAdditions";
import TimeRangeSelector, { TimeRange } from "@/components/TimeRangeSelector";

interface ValuableItem {
    id: number;
    release_id: number;
    artist: string | null;
    title: string | null;
    cover_image_url: string | null;
    condition: string | null;
    suggested_value: number | null;
}

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

interface DashboardStats {
    totalItems: number;
    latestValueMin: number | null;
    latestValueMean: number | null;
    latestValueMax: number | null;
    averageValuePerItem: number | null;
    itemCountHistory: { timestamp: string; count: number }[];
    valueHistory: {
        timestamp: string;
        min: number | null;
        mean: number | null;
        max: number | null;
    }[]; // Add back value history
    genreDistribution: Record<string, number>;
    yearDistribution: Record<string, number>;
    formatDistribution: Record<string, number>;
    topValuableItems: ValuableItem[];
    leastValuableItems: ValuableItem[];
    latestAdditions: LatestAddition[];
}

import type { SyncStatusResponse } from "@/app/api/collection/sync/status/route";

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatusResponse["status"]>("idle");
    const [syncProgress, setSyncProgress] = useState<{ current: number; total: number }>({
        current: 0,
        total: 0,
    });
    const [syncFetchError, setSyncFetchError] = useState<string | null>(null);
    const [finalSyncMessage, setFinalSyncMessage] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('3m');

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/dashboard-stats?timeRange=${timeRange}`);
            if (!response.ok) {
                let errorDetails = `HTTP error! status: ${response.status}`;
                try {
                    const errorText = await response.text();
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorDetails = errorJson.message || errorText;
                    } catch (_jsonError) {
                        errorDetails = errorText.substring(0, 500);
                    }
                } catch (textError) {
                    console.error("Could not read error response body:", textError);
                }
                throw new Error(errorDetails);
            }
            const data: DashboardStats = await response.json();
            setStats(data);
        } catch (err) {
            console.error("Failed to fetch stats:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "An unknown error occurred while fetching stats.",
            );
            setStats(null);
        } finally {
            setIsLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncStatus("running");
        setSyncProgress({ current: 0, total: 0 });
        setFinalSyncMessage(null);
        setSyncFetchError(null);
        setError(null);

        try {
            const response = await fetch("/api/collection/sync");
            if (!response.ok) {
                let initialError = `Sync initiation failed: ${response.status}`;
                try {
                    const result = await response.json();
                    initialError = result.message || initialError;
                } catch (__ /* _ */) {}
                throw new Error(initialError);
            }
            console.log("Sync initiated via API call.");
        } catch (err) {
            console.error("Sync initiation failed:", err);
            const errorMessage =
                err instanceof Error ? err.message : "An unknown error occurred initiating sync.";
            setError(`Sync Error: ${errorMessage}`); // Show general error
            setIsSyncing(false); // Stop syncing process on initiation failure
            setSyncStatus("error");
        }
    };

    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;

        const fetchSyncStatus = async () => {
            try {
                const response = await fetch("/api/collection/sync/status");
                if (!response.ok) {
                    throw new Error(`Status fetch failed: ${response.status}`);
                }
                const data: SyncStatusResponse = await response.json();

                setSyncStatus(data.status);
                setSyncProgress({ current: data.currentItem, total: data.totalItems });
                setSyncFetchError(null);

                if (data.status === "idle" || data.status === "error") {
                    setIsSyncing(false);
                    if (intervalId) clearInterval(intervalId);
                    if (data.status === "idle") {
                        setFinalSyncMessage(`Sync complete. Processed ${data.totalItems} items.`);
                        await fetchStats();
                        setTimeout(() => setFinalSyncMessage(null), 7000);
                    } else if (data.status === "error") {
                        setError(`Sync failed: ${data.lastError || "Unknown error during sync."}`);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch sync status:", err);
                setSyncFetchError(
                    err instanceof Error ? err.message : "Failed to get sync status.",
                );
                // Optional: Stop syncing/polling on status fetch error after a few retries?
                // setIsSyncing(false);
                // if (intervalId) clearInterval(intervalId);
            }
        };

        if (isSyncing) {
            // Fetch immediately and then set interval
            fetchSyncStatus();
            intervalId = setInterval(fetchSyncStatus, 3000); // Poll every 3 seconds
        } else {
            if (intervalId) {
                clearInterval(intervalId);
            }
        }

        // Cleanup function to clear interval when component unmounts or isSyncing changes
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isSyncing, fetchStats]); // Rerun effect when isSyncing changes

    // Helper to format currency
    const formatCurrency = (value: number | null): string => {
        if (value === null || typeof value === "undefined") return "N/A";
        // Basic Euro formatting, adjust as needed
        return `€${value.toFixed(2)}`;
    };

    return (
        <main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100 p-8 md:p-12 lg:p-16">
            {" "}
            {/* Updated bg and text */}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-neutral-100">
                    Discogs Collection IQ
                </h1>{" "}
                {/* Updated text */}
                <div>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-100 font-semibold py-2 px-4 rounded mr-4 transition duration-150 ease-in-out" // Updated colors
                    >
                        {isSyncing ? "Syncing..." : "Sync Collection"}
                    </button>
                    {/* Settings button removed */}
                </div>
            </header>
            {/* Sync Status/Error Messages */}
            {isSyncing && syncStatus === "running" && (
                <div className="mb-4 p-3 bg-neutral-700 text-neutral-100 rounded animate-pulse">
                    {" "}
                    {/* Changed to neutral, added pulse */}
                    Syncing...{" "}
                    {syncProgress.total > 0
                        ? `(Item ${syncProgress.current} of ${syncProgress.total})`
                        : "(Fetching collection...)"}
                </div>
            )}
            {/* Ensure final message only shows when sync is NOT running and message exists */}
            {finalSyncMessage && !isSyncing && syncStatus !== "running" && (
                <div className="mb-4 p-3 bg-green-800 text-green-100 rounded">
                    {finalSyncMessage}
                </div>
            )}
            {/* Show general errors when not syncing or if sync ended in error */}
            {error && (!isSyncing || syncStatus === "error") && (
                <div className="mb-4 p-3 bg-red-800 text-red-100 rounded">Error: {error}</div>
            )}
            {syncFetchError && (
                <div className="mb-4 p-3 bg-yellow-800 text-yellow-100 rounded">
                    Status Update Error: {syncFetchError}
                </div>
            )}
            {isLoading ? (
                <div className="text-center py-10 text-neutral-400">Loading dashboard data...</div> // Updated text color
            ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* KPI Cards */}
                    <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700">
                        {" "}
                        {/* Replaced shadow with border */}
                        <h2 className="text-sm font-medium text-neutral-400 mb-1">
                            Total Items
                        </h2>{" "}
                        {/* Updated text */}
                        <p className="text-3xl font-semibold text-neutral-100">
                            {stats.totalItems ?? "N/A"}
                        </p>{" "}
                        {/* Updated text */}
                    </div>
                    <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700">
                        {" "}
                        {/* Replaced shadow with border */}
                        <h2 className="text-sm font-medium text-neutral-400 mb-1">
                            Collection Value (Mean)
                        </h2>{" "}
                        {/* Reverted Label */}
                        <p className="text-3xl font-semibold text-neutral-100">
                            {formatCurrency(stats.latestValueMean)}
                        </p>{" "}
                        {/* Use mean from history */}
                    </div>
                    <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700">
                        {" "}
                        {/* Replaced shadow with border */}
                        <h2 className="text-sm font-medium text-neutral-400 mb-1">
                            Value Range (Min/Max)
                        </h2>{" "}
                        {/* Updated text */}
                        <p className="text-xl font-semibold text-neutral-100">
                            {formatCurrency(stats.latestValueMin)} /{" "}
                            {formatCurrency(stats.latestValueMax)}
                        </p>{" "}
                        {/* Updated text */}
                    </div>
                    <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700">
                        {" "}
                        {/* Replaced shadow with border */}
                        <h2 className="text-sm font-medium text-neutral-400 mb-1">
                            Average Value / Item
                        </h2>{" "}
                        {/* Updated text */}
                        <p className="text-3xl font-semibold text-neutral-100">
                            {formatCurrency(stats.averageValuePerItem)}
                        </p>{" "}
                        {/* Updated text */}
                    </div>

                    {/* Value History Chart Row */}
                    {stats.valueHistory && stats.valueHistory.length > 0 && (
                        <div className="lg:col-span-4 bg-neutral-800 p-4 md:p-6 rounded-lg border border-neutral-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-neutral-300">Collection Value Over Time</h3>
                                <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                            </div>
                            <TimeSeriesChart
                                data={stats.valueHistory}
                                lines={[
                                    { dataKey: "min", stroke: "#3b82f6", name: "Min Value (€)" }, // blue-500
                                    { dataKey: "mean", stroke: "#a855f7", name: "Mean Value (€)" }, // purple-500
                                    { dataKey: "max", stroke: "#22c55e", name: "Max Value (€)" }, // green-500
                                ]}
                                yAxisLabel="Value (€)"
                                syncing={isSyncing} // Pass syncing status
                                timeRange={timeRange} // Pass time range for formatting
                            />
                        </div>
                    )}

                    {/* Value Lists Row */}
                    <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ValuableItemsList
                            title="Top 10 Most Valuable"
                            items={stats.topValuableItems}
                            currencyFormatter={formatCurrency}
                        />
                        <ValuableItemsList
                            title="Top 10 Least Valuable"
                            items={stats.leastValuableItems}
                            currencyFormatter={formatCurrency}
                        />
                        <LatestAdditions
                            title="Latest Additions"
                            items={stats.latestAdditions}
                            currencyFormatter={formatCurrency}
                        />
                    </div>

                    {/* Item Count Chart Row */}
                    <div className="lg:col-span-4 bg-neutral-800 p-4 md:p-6 rounded-lg border border-neutral-700">
                        {" "}
                        {/* Replaced shadow with border */}
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-neutral-300">Item Count Over Time</h3>
                            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                        </div>
                        <TimeSeriesChart
                            data={stats.itemCountHistory}
                            lines={[
                                { dataKey: "count", stroke: "#60a5fa", name: "Total Items" }, // blue-400
                            ]}
                            yAxisLabel="Items"
                            syncing={isSyncing}
                            timeRange={timeRange} // Pass time range for formatting
                        />
                    </div>

                    {/* Distribution Sections */}
                    <div className="md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Genre Distribution */}
                        <div className="bg-neutral-800 p-4 md:p-6 rounded-lg border border-neutral-700">
                            {" "}
                            {/* Replaced shadow with border */}
                            <h2 className="text-xl font-semibold text-neutral-100 mb-4">
                                Top Genres
                            </h2>{" "}
                            {/* Updated text */}
                            {stats.genreDistribution &&
                            Object.keys(stats.genreDistribution).length > 0 ? (
                                <ul className="space-y-2 max-h-60 overflow-y-auto text-sm text-neutral-300">
                                    {" "}
                                    {/* Updated text */}
                                    {Object.entries(stats.genreDistribution)
                                        .slice(0, 15)
                                        .map(([genre, count]) => (
                                            <li key={genre} className="flex justify-between">
                                                <span>{genre}</span>
                                                <span className="font-medium text-neutral-500">
                                                    {count}
                                                </span>{" "}
                                                {/* Updated text */}
                                            </li>
                                        ))}
                                </ul>
                            ) : (
                                <p className="text-neutral-500">No genre data available.</p> // Updated text
                            )}
                        </div>

                        {/* Year Distribution Pie Chart */}
                        {/* NOTE: We will update chart colors separately */}
                        <div className="bg-neutral-800 p-4 md:p-6 rounded-lg border border-neutral-700 flex flex-col items-center">
                            {" "}
                            {/* Replaced shadow with border */}
                            <DistributionPieChart
                                title="Top Release Years"
                                data={stats.yearDistribution}
                                limit={10} // Show top 10 + Other
                                syncing={isSyncing}
                            />
                        </div>

                        {/* Format Distribution */}
                        <div className="bg-neutral-800 p-4 md:p-6 rounded-lg border border-neutral-700">
                            {" "}
                            {/* Replaced shadow with border */}
                            <h2 className="text-xl font-semibold text-neutral-100 mb-4">
                                Formats
                            </h2>{" "}
                            {/* Updated text */}
                            {stats.formatDistribution &&
                            Object.keys(stats.formatDistribution).length > 0 ? (
                                <ul className="space-y-2 max-h-60 overflow-y-auto text-sm text-neutral-300">
                                    {" "}
                                    {/* Updated text */}
                                    {Object.entries(stats.formatDistribution)
                                        .slice(0, 15)
                                        .map(([format, count]) => (
                                            <li key={format} className="flex justify-between">
                                                <span>{format}</span>
                                                <span className="font-medium text-neutral-500">
                                                    {count}
                                                </span>{" "}
                                                {/* Updated text */}
                                            </li>
                                        ))}
                                </ul>
                            ) : (
                                <p className="text-neutral-500">No format data available.</p> // Updated text
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-10 text-neutral-400">
                    {" "}
                    {/* Updated text */}
                    Could not load dashboard data.{" "}
                    {error ? `Reason: ${error}` : "Please try syncing or check settings."}
                </div>
            )}
            {/* Settings Modal removed */}
        </main>
    );
}
