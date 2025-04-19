import { NextResponse } from 'next/server';
import { runCollectionSync } from '@/lib/syncLogic'; // Import the refactored function

export async function GET(_request: Request) { // Prefix unused 'request' with underscore
  console.log('Received API request to sync collection...');

  try {
    // Call the refactored sync logic
    const result = await runCollectionSync();

    // Return the result from the sync logic
    return NextResponse.json(
      { message: result.message },
      { status: 200 }
    );

  } catch (error) {
    // Errors thrown by runCollectionSync will be caught here
    console.error('API Collection Sync Error:', error);
    let errorMessage = 'Internal Server Error during sync';
    if (error instanceof Error) {
      // Use the specific error message from the sync logic if available
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Failed to sync collection', error: errorMessage },
      { status: 500 }
    );
  }
}