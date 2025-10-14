"use client";

import { useState } from "react";
import Link from "next/link";

export default function OAuthSetupPage() {
    const [step, setStep] = useState<"initial" | "authorizing" | "verifying" | "complete" | "error">("initial");
    const [authUrl, setAuthUrl] = useState<string>("");
    const [requestToken, setRequestToken] = useState<string>("");
    const [verificationCode, setVerificationCode] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [username, setUsername] = useState<string>("");

    const startOAuthFlow = async () => {
        try {
            setStep("authorizing");
            setError("");

            const response = await fetch("/api/oauth/setup", {
                method: "GET",
            });

            const data = await response.json();

            if (response.ok) {
                setAuthUrl(data.authorizeUrl);
                setRequestToken(data.requestToken);
                // Open authorization URL in new tab
                window.open(data.authorizeUrl, "_blank");
            } else {
                setError(data.error || "Failed to start OAuth flow");
                setStep("error");
            }
        } catch (_err) {
            setError("Network error occurred");
            setStep("error");
        }
    };

    const completeOAuthFlow = async () => {
        if (!verificationCode.trim()) {
            setError("Please enter the verification code");
            return;
        }

        try {
            setStep("verifying");
            setError("");

            const response = await fetch("/api/oauth/callback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    verifier: verificationCode.trim(),
                    requestToken: requestToken,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setUsername(data.username || "Unknown");
                setStep("complete");
            } else {
                setError(data.error || "Failed to complete OAuth flow");
                setStep("error");
            }
        } catch (_err) {
            setError("Network error occurred");
            setStep("error");
        }
    };

    const resetFlow = () => {
        setStep("initial");
        setAuthUrl("");
        setRequestToken("");
        setVerificationCode("");
        setError("");
        setUsername("");
    };

    return (
        <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h1 className="mt-6 text-center text-3xl font-bold text-neutral-100">
                    Discogs Collection IQ
                </h1>
                <h2 className="mt-4 text-center text-xl font-semibold text-neutral-300">
                    OAuth Setup
                </h2>
                <p className="mt-2 text-center text-sm text-neutral-400">
                    Connect your Discogs account to enable collection syncing
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-neutral-800 py-8 px-4 border border-neutral-700 rounded-lg sm:px-10">
                    {step === "initial" && (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-neutral-300">
                                    To sync your Discogs collection, you need to authorize this application to access your account.
                                </p>
                            </div>
                            <button
                                onClick={startOAuthFlow}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-neutral-100 bg-neutral-700 hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500 transition duration-150 ease-in-out"
                            >
                                Connect to Discogs
                            </button>
                        </div>
                    )}

                    {step === "authorizing" && (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-neutral-300">
                                    1. A new tab should have opened with the Discogs authorization page
                                </p>
                                <p className="text-sm text-neutral-300 mt-2">
                                    2. Authorize the application and copy the verification code
                                </p>
                                <p className="text-sm text-neutral-300 mt-2">
                                    3. Paste the code below and click &quot;Complete Setup&quot;
                                </p>
                            </div>

                            {authUrl && (
                                <div className="text-center">
                                    <a
                                        href={authUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 text-sm transition duration-150 ease-in-out"
                                    >
                                        Click here if the tab didn&apos;t open automatically
                                    </a>
                                </div>
                            )}

                            <div>
                                <label htmlFor="verificationCode" className="block text-sm font-medium text-neutral-300">
                                    Verification Code
                                </label>
                                <input
                                    id="verificationCode"
                                    type="text"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-neutral-600 placeholder-neutral-500 text-neutral-100 bg-neutral-700 rounded-md focus:outline-none focus:ring-neutral-500 focus:border-neutral-500 focus:z-10 sm:text-sm"
                                    placeholder="Enter verification code from Discogs"
                                />
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={completeOAuthFlow}
                                    disabled={!verificationCode.trim()}
                                    className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-neutral-100 bg-green-700 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-neutral-600 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                                >
                                    Complete Setup
                                </button>
                                <button
                                    onClick={resetFlow}
                                    className="flex-1 flex justify-center py-2 px-4 border border-neutral-600 rounded-md text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500 transition duration-150 ease-in-out"
                                >
                                    Start Over
                                </button>
                            </div>
                        </div>
                    )}

                    {step === "verifying" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                                <p className="mt-2 text-sm text-neutral-300">Completing authorization...</p>
                            </div>
                        </div>
                    )}

                    {step === "complete" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-green-400 text-4xl mb-4">✓</div>
                                <h3 className="text-lg font-medium text-neutral-100">Setup Complete!</h3>
                                <p className="mt-2 text-sm text-neutral-300">
                                    Successfully connected to Discogs account: <strong className="text-neutral-100">{username}</strong>
                                </p>
                                <p className="mt-2 text-sm text-neutral-300">
                                    You can now close this page and your collection will sync automatically.
                                </p>
                            </div>
                            <div className="text-center">
                                <Link
                                    href="/"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-neutral-100 bg-neutral-700 hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500 transition duration-150 ease-in-out"
                                >
                                    Go to Dashboard
                                </Link>
                            </div>
                        </div>
                    )}

                    {step === "error" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-red-400 text-4xl mb-4">✗</div>
                                <h3 className="text-lg font-medium text-neutral-100">Setup Failed</h3>
                                <p className="mt-2 text-sm text-red-300">{error}</p>
                            </div>
                            <button
                                onClick={resetFlow}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-neutral-100 bg-neutral-700 hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500 transition duration-150 ease-in-out"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}