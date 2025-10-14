import { NextRequest, NextResponse } from "next/server";
import { DiscogsOAuth } from "@/lib/discogs/oauth";

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();
        const { verifier, requestToken } = body;

        if (!verifier) {
            return NextResponse.json(
                {
                    error: "Missing required parameters",
                    required: ["verifier"],
                    optional: ["requestToken"],
                },
                { status: 400 },
            );
        }

        const oauth = new DiscogsOAuth();

        if (!requestToken) {
            return NextResponse.json(
                {
                    error: "Request token is required",
                    message: "Please provide the requestToken you received from /api/oauth/setup",
                },
                { status: 400 },
            );
        }

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