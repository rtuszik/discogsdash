"use client";

import { useState } from "react";

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
        } catch (err) {
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
        } catch (err) {
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
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Discogs OAuth Setup
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Connect your Discogs account to enable collection syncing
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {step === "initial" && (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-gray-600">
                                    To sync your Discogs collection, you need to authorize this application to access your account.
                                </p>
                            </div>
                            <button
                                onClick={startOAuthFlow}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Connect to Discogs
                            </button>
                        </div>
                    )}

                    {step === "authorizing" && (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-gray-600">
                                    1. A new tab should have opened with the Discogs authorization page
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    2. Authorize the application and copy the verification code
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    3. Paste the code below and click "Complete Setup"
                                </p>
                            </div>

                            {authUrl && (
                                <div className="text-center">
                                    <a
                                        href={authUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-500 text-sm"
                                    >
                                        Click here if the tab didn't open automatically
                                    </a>
                                </div>
                            )}

                            <div>
                                <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700">
                                    Verification Code
                                </label>
                                <input
                                    id="verificationCode"
                                    type="text"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                    placeholder="Enter verification code from Discogs"
                                />
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={completeOAuthFlow}
                                    disabled={!verificationCode.trim()}
                                    className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    Complete Setup
                                </button>
                                <button
                                    onClick={resetFlow}
                                    className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Start Over
                                </button>
                            </div>
                        </div>
                    )}

                    {step === "verifying" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                <p className="mt-2 text-sm text-gray-600">Completing authorization...</p>
                            </div>
                        </div>
                    )}

                    {step === "complete" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-green-600 text-4xl mb-4">✓</div>
                                <h3 className="text-lg font-medium text-gray-900">Setup Complete!</h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    Successfully connected to Discogs account: <strong>{username}</strong>
                                </p>
                                <p className="mt-2 text-sm text-gray-600">
                                    You can now close this page and your collection will sync automatically.
                                </p>
                            </div>
                            <div className="text-center">
                                <a
                                    href="/"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Go to Dashboard
                                </a>
                            </div>
                        </div>
                    )}

                    {step === "error" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-red-600 text-4xl mb-4">✗</div>
                                <h3 className="text-lg font-medium text-gray-900">Setup Failed</h3>
                                <p className="mt-2 text-sm text-red-600">{error}</p>
                            </div>
                            <button
                                onClick={resetFlow}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}