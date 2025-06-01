import { createTheme } from '@mui/material/styles';
import { red } from '@mui/material/colors'; // For error states if needed

// A custom theme for the application
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // MUI Blue 500
      // light: '#42a5f5',
      // dark: '#1565c0',
      // contrastText: '#fff',
    },
    secondary: {
      main: '#dc004e', // MUI Pink A400 (can be changed)
      // light: '#ff6090',
      // dark: '#9a0036',
      // contrastText: '#fff',
    },
    error: {
      main: red.A400, // Standard red for errors
    },
    background: {
      // default: '#f4f6f8', // A slightly off-white background
      // paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 500,
      marginBottom: '1rem', // Add some default margin
    },
    h5: {
      fontWeight: 500,
      marginBottom: '0.75rem',
    },
    h6: {
      fontWeight: 500,
      marginBottom: '0.5rem',
    },
    // Example: Customize button typography
    // button: {
    //   textTransform: 'none', // To prevent ALL CAPS buttons if desired
    // }
  },
  // Example: Customize components globally
  // components: {
  //   MuiButton: {
  //     styleOverrides: {
  //       root: {
  //         borderRadius: 8, // Slightly more rounded buttons
  //       },
  //     },
  //   },
  //   MuiTextField: {
  //     defaultProps: {
  //       variant: 'outlined',
  //       margin: 'normal',
  //     }
  //   },
  //   MuiPaper: {
  //     styleOverrides: {
  //       root: {
  //         padding: '16px', // Default padding for Paper components
  //       }
  //     }
  //   }
  // }
});

export default theme;
