import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db";

export interface AuthStatusResponse {
    isAuthenticated: boolean;
    username?: string;
}

export async function GET() {
    try {
        const tokenKey = await getSetting("oauth_token");
        const tokenSecret = await getSetting("oauth_token_secret");
        const username = await getSetting("discogs_username");

        const isAuthenticated = !!(tokenKey && tokenSecret);

        const response: AuthStatusResponse = {
            isAuthenticated,
            ...(isAuthenticated && username && { username }),
        };

        return NextResponse.json(response, { status: 200 });
    } catch (error) {
        console.error("Auth status check error:", error);
        return NextResponse.json(
            {
                isAuthenticated: false,
                error: "Failed to check authentication status"
            },
            { status: 500 }
        );
    }
}