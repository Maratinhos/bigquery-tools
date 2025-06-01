import axios from 'axios';

// Define the base URL for the backend API
// When running through Nginx reverse proxy in Docker,
// this should be a relative path that Nginx can intercept.
const API_BASE_URL = '/api'; // Changed from absolute to relative

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
