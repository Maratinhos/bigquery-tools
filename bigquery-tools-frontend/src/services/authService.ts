import apiClient from '../config/api'; // apiClient from the previous step

// Define interfaces for expected request/response structures for clarity
interface AuthResponse {
  message: string;
  token?: string; // Token is optional, present on success
  user_id?: string;
  // Add other fields if your backend returns them, e.g., refresh_token, user details
}

interface ErrorResponse {
  message: string;
  // Add other potential error fields
}

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    return response.data;
  } catch (error: any) {
    // Axios errors have a 'response' object for API errors (4xx, 5xx)
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    // Network errors or other issues
    throw { message: error.message || 'Login failed due to an unexpected error.' } as ErrorResponse;
  }
};

export const register = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    // Assuming the register endpoint expects 'email' and 'password' directly
    const response = await apiClient.post<AuthResponse>('/auth/register', { email, password });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Registration failed due to an unexpected error.' } as ErrorResponse;
  }
};

export const logout = (): void => {
  localStorage.removeItem('authToken');
  // Potentially also remove other user-related data from localStorage or state
  // Example: localStorage.removeItem('userData');
  // No API call needed for basic JWT logout, but if you have a session invalidation endpoint:
  // apiClient.post('/auth/logout').catch(error => console.error("Logout API call failed", error));
};

// Optional: Function to get current token, might be useful elsewhere
export const getToken = (): string | null => {
  return localStorage.getItem('authToken');
};
