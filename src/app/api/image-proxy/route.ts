import { NextRequest, NextResponse } from 'next/server';

// Define a User-Agent string to mimic a browser
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
        return NextResponse.json({ message: 'Missing image URL parameter' }, { status: 400 });
    }

    // Basic validation: Ensure it's likely a Discogs image URL (or the placeholder)
    // This is a simple check; more robust validation could be added.
    if (!imageUrl.startsWith('https://i.discogs.com/') && !imageUrl.startsWith('/')) {
         // Allow local placeholders starting with /
        console.warn(`Invalid image URL requested: ${imageUrl}`);
        return NextResponse.json({ message: 'Invalid image URL provided' }, { status: 400 });
    }

    // Handle local placeholder images directly (no external fetch needed)
    if (imageUrl.startsWith('/')) {
        // For simplicity, we'll let Next.js handle serving public files directly
        // in the component. This proxy is mainly for external URLs.
        // If we needed to proxy local files for some reason, we'd read them here.
        console.warn(`Attempted to proxy local file, which is not supported by this proxy: ${imageUrl}`);
        return NextResponse.json({ message: 'Proxying local files is not supported' }, { status: 400 });
    }


    try {
        console.log(`Proxying image request for: ${imageUrl}`);
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': USER_AGENT,
            },
            // Consider adding a timeout?
            // signal: AbortSignal.timeout(5000) // Example: 5 second timeout
        });

        if (!response.ok) {
            console.error(`Failed to fetch image from ${imageUrl}. Status: ${response.status} ${response.statusText}`);
            // Forward the status code if possible, otherwise use a generic error
            const status = response.status >= 400 && response.status < 600 ? response.status : 502; // Bad Gateway
            return NextResponse.json({ message: `Failed to fetch image: ${response.statusText}` }, { status });
        }

        // Get the content type and body (as ReadableStream)
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const body = response.body; // ReadableStream<Uint8Array> | null

        if (!body) {
             console.error(`Fetched image from ${imageUrl} but response body was null.`);
             return NextResponse.json({ message: 'Image fetch succeeded but response body was empty' }, { status: 500 });
        }

        // Create a new NextResponse to stream the body
        // Copy relevant headers from the original response
        const headers = new Headers();
        headers.set('Content-Type', contentType);
        if (response.headers.has('content-length')) {
            headers.set('Content-Length', response.headers.get('content-length')!);
        }
        // Add caching headers - adjust as needed
        headers.set('Cache-Control', 'public, max-age=604800, immutable'); // Cache for 1 week

        console.log(`Successfully fetched and streaming image from: ${imageUrl}`);
        return new NextResponse(body, {
            status: 200,
            headers: headers,
        });

    } catch (error) {
        console.error(`Error proxying image ${imageUrl}:`, error);
        let errorMessage = 'Internal Server Error proxying image';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { message: 'Failed to proxy image', error: errorMessage },
            { status: 500 }
        );
    }
}