import { NextResponse } from 'next/server';
import { setSetting } from '@/lib/db'; // Import the database function

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, token } = body;

    if (!username || !token) {
      return NextResponse.json(
        { message: 'Username and token are required' },
        { status: 400 }
      );
    }

    // --- Store settings in the database ---
    // NOTE: Storing tokens directly in the DB is generally discouraged
    // unless encrypted or the DB is highly secured.
    // For this personal dashboard, we accept the risk for simplicity,
    // but acknowledge this isn't best practice for multi-user/production apps.
    setSetting('discogs_username', username);
    setSetting('discogs_token', token); // Store the token

    // Optional: Add logic here to validate the token/username against the Discogs API
    // by making a simple request (e.g., fetch user profile) using the new credentials.
    // If validation fails, return an error response.
    // Example (needs makeDiscogsRequest and getSetting implemented fully):
    // try {
    //   await makeDiscogsRequest(`/users/${username}`, token);
    //   console.log('Discogs credentials validated successfully.');
    // } catch (validationError) {
    //   console.error('Discogs credential validation failed:', validationError);
    //   // Optionally remove the just-saved settings if validation fails
    //   // setSetting('discogs_username', ''); // Or handle removal appropriately
    //   // setSetting('discogs_token', '');
    //   return NextResponse.json(
    //     { message: 'Invalid Discogs username or token. Please check your credentials.' },
    //     { status: 401 } // Unauthorized
    //   );
    // }


    return NextResponse.json(
      { message: 'Settings saved successfully!' },
      { status: 200 }
    );

  } catch (error) {
    console.error('API Auth Error:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    return NextResponse.json(
      { message: 'Failed to process settings', error: errorMessage },
      { status: 500 }
    );
  }
}