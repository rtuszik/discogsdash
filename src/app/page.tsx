'use client'; // Needs to be a client component for hooks and event handlers

import React, { useState, useEffect, useCallback } from 'react';
// Link import removed correctly
import TimeSeriesChart from '@/components/TimeSeriesChart';
import SettingsModal from '@/components/SettingsModal';
import DistributionPieChart from '@/components/DistributionPieChart'; // Import Pie Chart

// Define the structure matching the API response (can be imported from a shared types file later)
interface DashboardStats {
  totalItems: number | null;
  latestValueMin: number | null;
  latestValueMean: number | null;
  latestValueMax: number | null;
  averageValuePerItem: number | null;
  itemCountHistory: { timestamp: string; count: number }[];
  valueHistory: { timestamp: string; min: number | null; mean: number | null; max: number | null }[];
  // Distribution Stats
  genreDistribution: Record<string, number>;
  yearDistribution: Record<string, number>;
  formatDistribution: Record<string, number>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false); // State for modal

  // Function to fetch dashboard stats
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard-stats');
      if (!response.ok) {
        // Attempt to get more details from the response body
        let errorDetails = `HTTP error! status: ${response.status}`;
        try {
          // Try reading as text first, as it might be HTML
          const errorText = await response.text();
          // Try parsing as JSON *after* reading as text, in case it *was* a JSON error response
          try {
             const errorJson = JSON.parse(errorText);
             errorDetails = errorJson.message || errorText; // Use JSON message if available
          } catch (jsonError) {
             // If JSON parsing fails, use the raw text (likely HTML)
             errorDetails = errorText.substring(0, 500); // Limit length to avoid huge logs/errors
          }
        } catch (textError) {
          // Fallback if reading text fails
          console.error("Could not read error response body:", textError);
        }
        throw new Error(errorDetails);
      }
      // Only call response.json() if response.ok is true
      const data: DashboardStats = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching stats.');
      setStats(null); // Clear stats on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch stats on initial load
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Function to trigger collection sync
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing collection with Discogs...');
    setError(null); // Clear previous errors
    try {
      const response = await fetch('/api/collection/sync');
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      setSyncMessage(result.message || 'Sync initiated successfully!');
      // Refresh stats after sync completes
      await fetchStats();
       // Clear message after a delay
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      console.error('Sync failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during sync.';
      setError(`Sync failed: ${errorMessage}`);
      setSyncMessage(null); // Clear sync message on error
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper to format currency
  const formatCurrency = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') return 'N/A';
    // Basic Euro formatting, adjust as needed
    return `€${value.toFixed(2)}`;
  };

  return (
    <main className="flex min-h-screen flex-col bg-black text-white p-8 md:p-12 lg:p-16">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white">Discogs Dashboard</h1>
        <div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-semibold py-2 px-4 rounded mr-4 transition duration-150 ease-in-out"
          >
            {isSyncing ? 'Syncing...' : 'Sync Collection'}
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition duration-150 ease-in-out"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Sync Status/Error Messages */}
      {syncMessage && <div className="mb-4 p-3 bg-gray-700 text-gray-100 rounded">{syncMessage}</div>}
      {error && <div className="mb-4 p-3 bg-gray-500 text-white rounded">Error: {error}</div>}

      {isLoading ? (
        <div className="text-center py-10 text-gray-400">Loading dashboard data...</div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* KPI Cards */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-medium text-gray-400 mb-1">Total Items</h2>
            <p className="text-3xl font-semibold text-white">{stats.totalItems ?? 'N/A'}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-medium text-gray-400 mb-1">Collection Value (Mean)</h2>
            <p className="text-3xl font-semibold text-white">{formatCurrency(stats.latestValueMean)}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-medium text-gray-400 mb-1">Value Range (Min/Max)</h2>
            <p className="text-xl font-semibold text-white">{formatCurrency(stats.latestValueMin)} / {formatCurrency(stats.latestValueMax)}</p>
          </div>
           <div className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-medium text-gray-400 mb-1">Average Value / Item</h2>
            <p className="text-3xl font-semibold text-white">{formatCurrency(stats.averageValuePerItem)}</p>
          </div>

          {/* Charts */}
          {/* Value Chart */}
          <div className="md:col-span-2 lg:col-span-4 bg-gray-800 p-4 md:p-6 rounded-lg shadow-md">
             <TimeSeriesChart
                title="Collection Value Over Time"
                data={stats.valueHistory}
                lines={[
                  { dataKey: 'min', stroke: '#6B7280', name: 'Min Value (€)' },
                  { dataKey: 'mean', stroke: '#D1D5DB', name: 'Mean Value (€)' },
                  { dataKey: 'max', stroke: '#374151', name: 'Max Value (€)' },
                ]}
                yAxisLabel="Value (€)"
                syncing={isSyncing}
              />
          </div>

           {/* Item Count Chart */}
           <div className="md:col-span-2 lg:col-span-4 bg-gray-800 p-4 md:p-6 rounded-lg shadow-md">
             <TimeSeriesChart
                title="Item Count Over Time"
                data={stats.itemCountHistory}
                lines={[
                  { dataKey: 'count', stroke: '#9CA3AF', name: 'Total Items' },
                ]}
                yAxisLabel="Items"
                syncing={isSyncing}
              />
          </div>

          {/* Distribution Sections */}
          <div className="md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Genre Distribution */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-white mb-4">Top Genres</h2>
              {stats.genreDistribution && Object.keys(stats.genreDistribution).length > 0 ? (
                <ul className="space-y-2 max-h-60 overflow-y-auto text-sm text-gray-300">
                  {Object.entries(stats.genreDistribution).slice(0, 15).map(([genre, count]) => (
                    <li key={genre} className="flex justify-between">
                      <span>{genre}</span>
                      <span className="font-medium text-gray-500">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No genre data available.</p>
              )}
            </div>

            {/* Year Distribution Pie Chart */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-md flex flex-col items-center">
              <DistributionPieChart
                title="Top Release Years"
                data={stats.yearDistribution}
                limit={10} // Show top 10 + Other
                syncing={isSyncing}
              />
            </div>

            {/* Format Distribution */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-white mb-4">Formats</h2>
               {stats.formatDistribution && Object.keys(stats.formatDistribution).length > 0 ? (
                <ul className="space-y-2 max-h-60 overflow-y-auto text-sm text-gray-300">
                  {Object.entries(stats.formatDistribution).slice(0, 15).map(([format, count]) => (
                    <li key={format} className="flex justify-between">
                      <span>{format}</span>
                      <span className="font-medium text-gray-500">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No format data available.</p>
              )}
            </div>
          </div>

        </div>
      ) : (
         <div className="text-center py-10 text-gray-400">
            Could not load dashboard data. {error ? `Reason: ${error}` : 'Please try syncing or check settings.'}
         </div>
      )}

     {/* Settings Modal */}
     <SettingsModal
       isOpen={isSettingsOpen}
       onClose={() => setIsSettingsOpen(false)}
       // We could potentially fetch initial values from DB here if needed
       // initialUsername={...}
       // initialToken={...}
     />
    </main>
  );
}
