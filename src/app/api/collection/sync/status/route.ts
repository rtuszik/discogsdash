import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

export interface SyncStatusResponse {
  status: 'idle' | 'running' | 'error' | 'unknown';
  currentItem: number;
  totalItems: number;
  lastError: string | null;
}

export async function GET(request: Request) {
  try {
    const status = getSetting('sync_status') || 'unknown';
    const currentItemStr = getSetting('sync_current_item') || '0';
    const totalItemsStr = getSetting('sync_total_items') || '0';
    const lastError = getSetting('sync_last_error') || null;

    const currentItem = parseInt(currentItemStr, 10);
    const totalItems = parseInt(totalItemsStr, 10);

    // Basic validation on status
    const validStatus = ['idle', 'running', 'error'].includes(status) ? status : 'unknown';

    const response: SyncStatusResponse = {
      status: validStatus as SyncStatusResponse['status'],
      currentItem: isNaN(currentItem) ? 0 : currentItem,
      totalItems: isNaN(totalItems) ? 0 : totalItems,
      lastError: lastError,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { message: 'Failed to fetch sync status', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}