import { type NextRequest, NextResponse } from "next/server";
import { DiscogsOAuth } from "@/lib/discogs/oauth";

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        // Check content type before parsing JSON
        const contentType = request.headers.get("content-type");
        if (!contentType || !contentType.startsWith("application/json")) {
            return NextResponse.json(
                {
                    error: "Invalid content type",
                    message: "Content-Type must be application/json",
                },
                { status: 400 },
            );
        }

        // Parse JSON with error handling
        let body;
        try {
            body = await request.json();
        } catch (_parseError) {
            return NextResponse.json(
                {
                    error: "Invalid JSON",
                    message: "Request body must be valid JSON",
                },
                { status: 400 },
            );
        }

        const { verifier, requestToken } = body;

        // Validate that verifier and requestToken exist and are strings
        if (!verifier || typeof verifier !== "string") {
            return NextResponse.json(
                {
                    error: "Missing or invalid verifier",
                    message: "verifier must be a non-empty string",
                },
                { status: 400 },
            );
        }

        if (!requestToken || typeof requestToken !== "string") {
            return NextResponse.json(
                {
                    error: "Missing or invalid requestToken",
                    message: "requestToken must be a non-empty string",
                },
                { status: 400 },
            );
        }

        const oauth = new DiscogsOAuth();

        const requestTokenSecret = oauth.getStoredRequestTokenSecret(requestToken);
        if (!requestTokenSecret) {
            return NextResponse.json(
                {
                    error: "Request token not found or expired",
                    message: "Please restart the OAuth flow from /api/oauth/setup",
                },
                { status: 400 },
            );
        }

        await oauth.getAccessToken(requestToken, requestTokenSecret, verifier);

        try {
            const identity = await oauth.makeAuthenticatedRequest<{ username: string }>("/oauth/identity");
            return NextResponse.json({
                status: "success",
                message: "OAuth authentication completed successfully",
                username: identity.username,
                tokensStored: true,
            });
        } catch (identityError) {
            console.warn("Failed to verify identity, but tokens were stored:", identityError);
            return NextResponse.json({
                status: "success",
                message: "OAuth tokens stored, but failed to verify identity",
                tokensStored: true,
                warning: "Could not verify identity endpoint",
            });
        }
    } catch (error) {
        console.error("OAuth callback error:", error instanceof Error ? error.message : "Unknown error");
        return NextResponse.json(
            {
                error: "Failed to complete OAuth authentication",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}
