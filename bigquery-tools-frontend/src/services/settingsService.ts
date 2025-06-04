import { getApiUrl } from '../config/api'; // Assuming you have this helper
import { getToken } from './authService'; // For authorization header

const API_URL = getApiUrl();

export interface GeminiApiKeyResponse {
  api_key?: string;
  message?: string;
}

export const saveGeminiApiKey = async (apiKey: string): Promise<GeminiApiKeyResponse> => {
  const token = getToken();
  if (!token) {
    throw new Error('Authentication token not found.');
  }

  const response = await fetch(`${API_URL}/settings/gemini-api-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!response.ok) {
    const errorData: GeminiApiKeyResponse = await response.json().catch(() => ({ message: 'Failed to save API Key. Server returned an error.' }));
    throw new Error(errorData.message || `HTTP error ${response.status}`);
  }
  return response.json() as Promise<GeminiApiKeyResponse>;
};

export const getGeminiApiKey = async (): Promise<GeminiApiKeyResponse> => {
  const token = getToken();
  if (!token) {
    throw new Error('Authentication token not found.');
  }

  const response = await fetch(`${API_URL}/settings/gemini-api-key`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { message: 'Gemini API Key not set.' }; // Specific message for 404
    }
    const errorData: GeminiApiKeyResponse = await response.json().catch(() => ({ message: 'Failed to fetch API Key. Server returned an error.' }));
    throw new Error(errorData.message || `HTTP error ${response.status}`);
  }
  return response.json() as Promise<GeminiApiKeyResponse>;
};
