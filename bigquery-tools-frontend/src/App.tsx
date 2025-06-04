import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import BigQueryConfigsPage from './pages/BigQueryConfigsPage';
import SchemaDescriptionPage from './pages/SchemaDescriptionPage';
import AIChatPage from './pages/AIChatPage';
import GeminiApiKeyPage from './pages/GeminiApiKeyPage';
import { ThemeProvider, CssBaseline } from '@mui/material'; // Removed createTheme from here
import theme from './theme'; // Import the custom theme

// A simple placeholder for a protected page
const HomePage: React.FC = () => {
  return (
    <div>
      <h1>Welcome to BigQuery Tools!</h1>
      <p>This is your protected dashboard area.</p>
      <p>Explore features like BigQuery Configs, Schema Description, or the AI Chat for SQL.</p>
    </div>
  );
};

// Inline theme definition removed, will use imported theme

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Normalize CSS and apply baseline styles */}
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {/* Default protected route, e.g., dashboard or home */}
              <Route path="/" element={<HomePage />} />
              <Route path="/bigquery-configs" element={<BigQueryConfigsPage />} />
              <Route path="/schema-description" element={<SchemaDescriptionPage />} />
              <Route path="/ai-chat" element={<AIChatPage />} />
              <Route path="/gemini-api-key" element={<GeminiApiKeyPage />} />
              {/* Add other protected routes here, e.g.:
              <Route path="/dashboard" element={<HomePage />} />
              <Route path="/bigquery" element={<div>BigQuery Feature</div>} />
              */}
            </Route>
          </Route>

          {/* Fallback route for any other path - could redirect to login or a 404 page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
