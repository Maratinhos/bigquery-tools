import axios from 'axios';

// Define the base URL for the backend API
// In a real app, this would likely come from an environment variable
const API_BASE_URL = 'http://localhost:5000/api'; // Assuming backend runs on 5000 with /api prefix

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to add JWT token to headers
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
