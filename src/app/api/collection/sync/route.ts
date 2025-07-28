import { NextResponse } from "next/server";
import { runCollectionSync } from "@/lib/syncLogic";

export async function GET(_request: Request) {
    console.log("Received API request to sync collection...");

    try {
        const result = await runCollectionSync();

        return NextResponse.json({ message: result.message }, { status: 200 });
    } catch (error) {
        console.error("API Collection Sync Error:", error);
        let errorMessage = "Internal Server Error during sync";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { message: "Failed to sync collection", error: errorMessage },
            { status: 500 },
        );
    }
}

