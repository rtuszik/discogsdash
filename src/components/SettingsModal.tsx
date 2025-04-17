'use client';

import React, { useState, useEffect, FormEvent } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUsername?: string | null; // Allow passing initial values if needed
  initialToken?: string | null;
}

export default function SettingsModal({
  isOpen,
  onClose,
  initialUsername = '',
  initialToken = '',
}: SettingsModalProps) {
  const [username, setUsername] = useState(initialUsername || '');
  const [token, setToken] = useState(initialToken || '');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when modal opens/closes or initial values change
  useEffect(() => {
    setUsername(initialUsername || '');
    setToken(initialToken || '');
    setMessage('');
    setIsLoading(false);
  }, [isOpen, initialUsername, initialToken]);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage('Saving...');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, token }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      setMessage(result.message || 'Settings saved successfully!');
      // Optionally close modal on success after a short delay
      setTimeout(() => {
         onClose();
      }, 1500);

    } catch (error) {
      console.error('Save error:', error);
      setMessage(`Error saving settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    // Darker overlay, slightly lighter modal background
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 transition-opacity duration-300 ease-in-out">
      <div className="relative w-full max-w-md p-8 bg-gray-900 rounded-lg shadow-xl transform transition-all duration-300 ease-in-out scale-100 border border-gray-700">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors" // Lighter gray close icon
          aria-label="Close settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold mb-6 text-white">Settings</h2>
        <form className="space-y-6" onSubmit={handleSave}>
          <div>
            <label htmlFor="modal-username" className="block text-sm font-medium text-gray-400 mb-1"> {/* Lighter label */}
              Discogs Username
            </label>
            <input
              type="text"
              id="modal-username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent" // Darker input, lighter placeholder/focus
            />
          </div>
          <div>
            <label htmlFor="modal-token" className="block text-sm font-medium text-gray-400 mb-1">
              Discogs Personal Access Token
            </label>
            <input
              type="password"
              id="modal-token"
              name="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500"> {/* Darker help text */}
              Generate a token from your <a href="https://www.discogs.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:underline">Discogs Developer Settings</a>. {/* Lighter link */}
            </p>
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 font-semibold text-black bg-gray-300 rounded-md hover:bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-900 transition duration-150 ease-in-out disabled:opacity-50" // Light button, black text
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
        {message && (
          // Use gray tones for feedback messages
          <p className={`mt-4 text-sm text-center ${message.startsWith('Error') ? 'text-gray-400' : 'text-gray-300'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}