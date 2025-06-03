import React from 'react';
import { render, screen, fireEvent, RenderOptions, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme'; // Adjusted import
import MainLayout from './MainLayout';

// Mock the authService logout function
jest.mock('../services/authService', () => ({
  logout: jest.fn(),
}));

// Helper for wrapping component with providers
const AllTheProviders: React.FC<{children: React.ReactNode}> = ({ children }) => {
  return (
    <ThemeProvider theme={theme}> {/* Using theme directly */}
      <MemoryRouter initialEntries={['/']}>
        {children}
      </MemoryRouter>
    </ThemeProvider>
  );
};

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllTheProviders, ...options });


describe('MainLayout - Basic Rendering (Mobile Default)', () => {
  beforeEach(() => {
    jest.resetModules(); // Reset modules to ensure fresh mocks for useMediaQuery
    jest.mock('@mui/material', () => ({
      ...jest.requireActual('@mui/material'),
      useMediaQuery: jest.fn().mockReturnValue(false), // Default to mobile for these basic tests
    }));
  });

  afterEach(() => {
    jest.unmock('@mui/material');
  });

  test('renders AppBar title', async () => {
    const MockedMainLayout = (await import('./MainLayout')).default;
    customRender(<MockedMainLayout />);
    expect(screen.getByText(/BigQuery Tools/i)).toBeInTheDocument();
  });

  test('initially does not show drawer items and menu button is visible', async () => {
    const MockedMainLayout = (await import('./MainLayout')).default;
    customRender(<MockedMainLayout />);
    // queryByText is good here as it won't throw if not found / not visible
    // Depending on Drawer's ModalProps->keepMounted, items might be in DOM but not visible.
    expect(screen.queryByText('BQ Configs')).not.toBeVisible();
    expect(screen.getByRole('button', { name: /open drawer/i })).toBeVisible();
  });
});

describe('MainLayout - Permanent Drawer (Desktop)', () => {
  beforeAll(() => {
    jest.resetModules();
    // Mock useMediaQuery to return true for desktop for all tests in this describe block
    jest.mock('@mui/material', () => ({
      ...jest.requireActual('@mui/material'),
      useMediaQuery: jest.fn().mockReturnValue(true),
    }));
  });

  afterAll(() => {
    jest.unmock('@mui/material'); // Clean up the mock
  });


  test('renders navigation links in permanent drawer and hides menu button', async () => {
    const MockedMainLayout = (await import('./MainLayout')).default;
    customRender(<MockedMainLayout />);
    expect(screen.getByText(/Home/i)).toBeVisible();
    expect(screen.getByText(/BQ Configs/i)).toBeVisible();
    expect(screen.getByText(/Schema Desc/i)).toBeVisible();
    expect(screen.getByText(/AI Chat/i)).toBeVisible();

    // The menu button should be hidden on desktop (not even in the DOM due to sx prop)
    expect(screen.queryByRole('button', { name: /open drawer/i })).not.toBeInTheDocument();
  });
});


describe('MainLayout - Temporary Drawer (Mobile/Tablet)', () => {
  beforeAll(() => {
    jest.resetModules();
    // Mock useMediaQuery to return false for mobile for all tests in this describe block
    jest.mock('@mui/material', () => ({
      ...jest.requireActual('@mui/material'),
      useMediaQuery: jest.fn().mockReturnValue(false),
    }));
  });

   afterAll(() => {
    jest.unmock('@mui/material'); // Clean up the mock
  });

  test('shows menu button, and toggles drawer visibility', async () => {
    const MockedMainLayout = (await import('./MainLayout')).default;
    customRender(<MockedMainLayout />);

    const menuButton = screen.getByRole('button', { name: /open drawer/i });
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toBeVisible();

    // Initially, drawer items should not be visible if keepMounted is true, or not in DOM
    expect(screen.queryByText('Home')).not.toBeVisible();

    // Open the drawer
    await act(async () => {
        fireEvent.click(menuButton);
    });

    // Now drawer items should be visible
    expect(screen.getByText(/Home/i)).toBeVisible();
    expect(screen.getByText(/BQ Configs/i)).toBeVisible();

    // Test closing by clicking an item (e.g., Home)
    const homeButtonInDrawer = screen.getByText(/Home/i);
    await act(async () => {
        fireEvent.click(homeButtonInDrawer);
    });

    // Drawer items should be hidden again
    expect(screen.queryByText('BQ Configs')).not.toBeVisible();
  });
});
