import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BigQueryConfigsPage from './BigQueryConfigsPage';
import * as configService from '../services/bigQueryConfigService'; // Import as namespace

// Mock the service
jest.mock('../services/bigQueryConfigService');
const mockedConfigService = configService as jest.Mocked<typeof configService>;

const mockConfigs: configService.BigQueryConfigItem[] = [
  { id: '1', connection_name: 'Test Connection 1' },
  { id: '2', connection_name: 'Test Connection 2' },
];

describe('BigQueryConfigsPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockedConfigService.getConfigs.mockReset();
    // Clear any previous visual state if necessary, e.g. by removing the component from the DOM
    // (React Testing Library does this automatically between `render` calls in separate tests)
  });

  test('renders loading indicator initially and then displays configurations on successful fetch', async () => {
    mockedConfigService.getConfigs.mockResolvedValue([...mockConfigs]);

    render(<BigQueryConfigsPage />);

    // Check for loading indicator (optional, but good to confirm)
    // Note: If the fetch is too fast, this might be hard to catch reliably without specific timing mocks.
    // For now, we'll focus on the state after loading.
    // expect(screen.getByRole('progressbar')).toBeInTheDocument(); // This might flicker

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Test Connection 1')).toBeInTheDocument();
    expect(screen.getByText('Test Connection 2')).toBeInTheDocument();
    expect(screen.getByText(mockConfigs[0].id)).toBeInTheDocument();
    expect(screen.getByText(mockConfigs[1].id)).toBeInTheDocument();

    // Check for test buttons (aria-label might be more robust if text changes)
    const testButtons = screen.getAllByRole('button', { name: /Test configuration/i });
    expect(testButtons).toHaveLength(mockConfigs.length);
  });

  test('displays an error message if fetching configurations fails', async () => {
    const errorMessage = 'Network Error: Failed to fetch';
    mockedConfigService.getConfigs.mockRejectedValue(new Error(errorMessage));

    render(<BigQueryConfigsPage />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    expect(screen.queryByText('Test Connection 1')).not.toBeInTheDocument();
  });

  test('shows loading indicator while fetching', async () => {
    // Create a promise that doesn't resolve immediately
    const slowPromise = new Promise<configService.BigQueryConfigItem[]>(() => {});
    mockedConfigService.getConfigs.mockReturnValue(slowPromise);

    render(<BigQueryConfigsPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Clean up: although this promise never resolves,
    // RTL's cleanup should prevent issues. If tests were slower or state leaked,
    // one might need to force a resolution/rejection here or mock timers.
  });

  // Test for adding a new config (form interaction) could be added here too,
  // but the current subtask focuses on fetching and displaying.
});
