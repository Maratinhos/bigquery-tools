import React from 'react';
import { Outlet, useNavigate, Link as RouterLink } from 'react-router-dom';
import { logout } from '../services/authService';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
// import IconButton from '@mui/material/IconButton'; // Removed as unused
import Tooltip from '@mui/material/Tooltip';

// Import icons if you want to use them for smaller screens
// import SettingsIcon from '@mui/icons-material/Settings';
// import DescriptionIcon from '@mui/icons-material/Description';
// import SmartToyIcon from '@mui/icons-material/SmartToy';

const NavButton = (props: {to: string, children: React.ReactNode, title: string }) => (
    <Tooltip title={props.title}>
        <Button
            color="inherit"
            component={RouterLink}
            to={props.to}
            sx={{
                mr: 1,
            }}
        >
            {props.children}
        </Button>
    </Tooltip>
);


const MainLayout: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none', '&:hover': {textDecoration: 'underline'} }}
          >
            BigQuery Tools
          </Typography>

          <NavButton to="/bigquery-configs" title="BigQuery Configurations">
            BQ Configs
          </NavButton>
          <NavButton to="/schema-description" title="Schema Descriptions">
            Schema Desc
          </NavButton>
          <NavButton to="/ai-chat" title="AI SQL Chat Assistant">
            AI Chat
          </NavButton>

          <Tooltip title="Logout">
            <Button color="inherit" onClick={handleLogout}>
                Logout
            </Button>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: {xs: 1, sm: 2, md: 3} /* Responsive padding */ }}>
        <Outlet />
      </Box>
      {/* Optional: Footer ... */}
    </Box>
  );
};

export default MainLayout;
