import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getToken } from '../services/authService'; // Assuming getToken is exported

interface ProtectedRouteProps {
  // You can add specific props if needed, e.g., roles or permissions
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = () => {
  const token = getToken();
  const location = useLocation();

  if (!token) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />; // Render children routes if token exists
};

export default ProtectedRoute;
