import { NextResponse } from "next/server";
import { DiscogsOAuth } from "@/lib/discogs/oauth";

export async function GET(): Promise<NextResponse> {
    try {
        const oauth = new DiscogsOAuth();

        const storedTokens = await oauth.getStoredTokens();
        if (storedTokens) {
            return NextResponse.json({
                status: "already_authenticated",
                message: "OAuth tokens already exist. Discogs authentication is complete.",
            });
        }

        const { token, secret, authorizeUrl } = await oauth.getRequestToken();

        return NextResponse.json({
            status: "auth_required",
            message: "Please visit the authorization URL to complete OAuth setup",
            authorizeUrl,
            requestToken: token,
            instructions: [
                "1. Visit the authorizeUrl above",
                "2. Log into Discogs and authorize the application",
                "3. Copy the verification code from the callback",
                "4. Make a POST request to /api/oauth/callback with the verification code and requestToken",
            ],
        });
    } catch (error) {
        console.error("OAuth setup error:", error instanceof Error ? error.message : "Unknown error");
        return NextResponse.json(
            {
                error: "Failed to initialize OAuth setup",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}
