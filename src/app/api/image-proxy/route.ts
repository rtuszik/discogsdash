import { type NextRequest, NextResponse } from "next/server";

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
        return NextResponse.json({ message: "Missing image URL parameter" }, { status: 400 });
    }

    if (!imageUrl.startsWith("https://i.discogs.com/") && !imageUrl.startsWith("/")) {
        console.warn(`Invalid image URL requested: ${imageUrl}`);
        return NextResponse.json({ message: "Invalid image URL provided" }, { status: 400 });
    }

    if (imageUrl.startsWith("/")) {
        console.warn(`Attempted to proxy local file, which is not supported by this proxy: ${imageUrl}`);
        return NextResponse.json({ message: "Proxying local files is not supported" }, { status: 400 });
    }

    try {
        console.log(`Proxying image request for: ${imageUrl}`);
        const response = await fetch(imageUrl, {
            headers: {
                "User-Agent": USER_AGENT,
            },
        });

        if (!response.ok) {
            console.error(`Failed to fetch image from ${imageUrl}. Status: ${response.status} ${response.statusText}`);

            const status = response.status >= 400 && response.status < 600 ? response.status : 502;
            return NextResponse.json({ message: `Failed to fetch image: ${response.statusText}` }, { status });
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const body = response.body;

        if (!body) {
            console.error(`Fetched image from ${imageUrl} but response body was null.`);
            return NextResponse.json({ message: "Image fetch succeeded but response body was empty" }, { status: 500 });
        }

        const headers = new Headers();
        headers.set("Content-Type", contentType);
        if (response.headers.has("content-length")) {
            headers.set("Content-Length", response.headers.get("content-length")!);
        }

        headers.set("Cache-Control", "public, max-age=604800, immutable");

        console.log(`Successfully fetched and streaming image from: ${imageUrl}`);
        return new NextResponse(body, {
            status: 200,
            headers: headers,
        });
    } catch (error) {
        console.error(`Error proxying image ${imageUrl}:`, error);
        let errorMessage = "Internal Server Error proxying image";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ message: "Failed to proxy image", error: errorMessage }, { status: 500 });
    }
}
