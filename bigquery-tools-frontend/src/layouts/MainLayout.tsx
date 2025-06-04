import React from 'react';
import { Outlet, useNavigate, Link as RouterLink } from 'react-router-dom';
import { logout } from '../services/authService';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import MenuIcon from '@mui/icons-material/Menu';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';


// Import icons if you want to use them for smaller screens
import HomeIcon from '@mui/icons-material/Home';
import StorageIcon from '@mui/icons-material/Storage'; // For BQ Configs
import DescriptionIcon from '@mui/icons-material/Description'; // For Schema Desc
import ChatIcon from '@mui/icons-material/Chat'; // For AI Chat
// import SmartToyIcon from '@mui/icons-material/SmartToy'; // Alternative for AI Chat
import KeyIcon from '@mui/icons-material/VpnKey'; // For Gemini API Key

const drawerWidth = 240;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDrawerToggle = () => {
    if (!isDesktop) {
      setIsDrawerOpen(!isDrawerOpen);
    }
  };

  const drawerContent = (
    <>
      {isDesktop && <Toolbar />}{/* Spacer for permanent drawer */}
      {isDesktop && <Divider />}
      <List>
        <Tooltip title="Home">
          <ListItem button component={RouterLink} to="/" onClick={handleDrawerToggle}>
            <ListItemIcon>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="Home" />
          </ListItem>
        </Tooltip>
        <Tooltip title="BigQuery Configurations">
          <ListItem button component={RouterLink} to="/bigquery-configs" onClick={handleDrawerToggle}>
            <ListItemIcon>
              <StorageIcon />
            </ListItemIcon>
            <ListItemText primary="BQ Configs" />
          </ListItem>
        </Tooltip>
        <Tooltip title="Schema Descriptions">
          <ListItem button component={RouterLink} to="/schema-description" onClick={handleDrawerToggle}>
            <ListItemIcon>
              <DescriptionIcon />
            </ListItemIcon>
            <ListItemText primary="Schema Desc" />
          </ListItem>
        </Tooltip>
        <Tooltip title="AI SQL Chat Assistant">
          <ListItem button component={RouterLink} to="/ai-chat" onClick={handleDrawerToggle}>
            <ListItemIcon>
              <ChatIcon />
            </ListItemIcon>
            <ListItemText primary="AI Chat" />
          </ListItem>
        </Tooltip>
        <Tooltip title="Gemini API Key">
          <ListItem button component={RouterLink} to="/gemini-api-key" onClick={handleDrawerToggle}>
            <ListItemIcon>
              <KeyIcon />
            </ListItemIcon>
            <ListItemText primary="Gemini Key" />
          </ListItem>
        </Tooltip>
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          // transition: theme.transitions.create(['margin', 'width'], { // Optional
          //   easing: theme.transitions.easing.sharp,
          //   duration: theme.transitions.duration.leavingScreen,
          // }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none', '&:hover': {textDecoration: 'underline'} }}
          >
            BigQuery Tools
          </Typography>
          <Tooltip title="Logout">
            <Button color="inherit" onClick={handleLogout}>
              Logout
            </Button>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop ? true : isDrawerOpen}
          onClose={handleDrawerToggle} // Only used for temporary variant
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              // borderRight: '1px solid rgba(0, 0, 0, 0.12)' // Optional
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          // marginLeft handled by AppBar and Drawer structure for 'md' up
        }}
      >
        <Toolbar /> {/* Necessary for content to be below app bar */}
        <Outlet />
      </Box>
      {/* Optional: Footer ... */}
    </Box>
  );
};

export default MainLayout;
