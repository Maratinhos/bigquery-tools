import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';

import AIChatPage from './AIChatPage';
import * as aiService from '../services/aiService';
import * as bigQueryConfigService from '../services/bigQueryConfigService';

// Mock the services
jest.mock('../services/aiService');
jest.mock('../services/bigQueryConfigService');

const mockGetConfigs = bigQueryConfigService.getConfigs as jest.Mock;
const mockGenerateSql = aiService.generateSqlFromNaturalLanguage as jest.Mock;
const mockDryRunQuery = aiService.dryRunQuery as jest.Mock;

const mockConfigurations: bigQueryConfigService.BigQueryConfigItem[] = [
  { id: 'config-ai-1', connection_name: 'AI Connection One' },
  { id: 'config-ai-2', connection_name: 'AI Connection Two' },
];

// Helper function to render with Router context
const renderPage = () => {
  return render(
    <BrowserRouter>
      <AIChatPage />
    </BrowserRouter>
  );
};

describe('AIChatPage', () => {
  beforeEach(() => {
    mockGetConfigs.mockReset();
    mockGenerateSql.mockReset();
    mockDryRunQuery.mockReset();

    // Default successful mocks
    mockGetConfigs.mockResolvedValue(mockConfigurations);
    mockGenerateSql.mockResolvedValue({ generated_sql: 'SELECT mock_column FROM mock_table;' });
    mockDryRunQuery.mockResolvedValue({ message: 'Dry run successful.', gb_processed: 0.123 });
  });

  test('renders page title and initial elements', () => {
    renderPage();
    expect(screen.getByText('AI SQL Chat Assistant')).toBeInTheDocument();
    expect(screen.getByLabelText('Configuration*')).toBeInTheDocument();
    expect(screen.getByLabelText('Relevant Tables (Optional - uses all if empty)')).toBeInTheDocument();
    expect(screen.getByLabelText('Your request for SQL query...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  test('loads configurations', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfigs).toHaveBeenCalledTimes(1));

    fireEvent.mouseDown(screen.getByLabelText('Configuration*'));
    expect(await screen.findByText('AI Connection One')).toBeInTheDocument();
    expect(await screen.findByText('AI Connection Two')).toBeInTheDocument();
  });

  test('sends chat request and displays response with specific tables', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfigs).toHaveBeenCalled());

    // Select configuration
    fireEvent.mouseDown(screen.getByLabelText('Configuration*'));
    fireEvent.click(await screen.findByText('AI Connection One'));

    // Enter user request
    fireEvent.change(screen.getByLabelText('Your request for SQL query...'), { target: { value: 'Show me users from my_table' } });

    // Enter relevant table names (Autocomplete interaction)
    const autocompleteInput = screen.getByLabelText('Relevant Tables (Optional - uses all if empty)');
    fireEvent.change(autocompleteInput, { target: { value: 'dataset.my_table' } });
    fireEvent.keyDown(autocompleteInput, { key: 'Enter' }); // Simulate adding the typed value

    // Click Send
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockGenerateSql).toHaveBeenCalledWith(
        'config-ai-1',
        'Show me users from my_table',
        ['dataset.my_table'] // Expecting array with the typed table
      );
    });

    // Check for user message and AI response in chat
    expect(screen.getByText('Show me users from my_table')).toBeInTheDocument();
    await waitFor(() => {
        expect(screen.getByText(/Generated SQL:/i)).toBeInTheDocument();
        expect(screen.getByText('SELECT mock_column FROM mock_table;')).toBeInTheDocument(); // Check CodeBlock content
        expect(screen.getByText(/Dry run successful. Processed: 0.1230 GB./i)).toBeInTheDocument();
    });
  });

  test('sends chat request and displays response with no specific tables', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfigs).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByLabelText('Configuration*'));
    fireEvent.click(await screen.findByText('AI Connection One'));
    fireEvent.change(screen.getByLabelText('Your request for SQL query...'), { target: { value: 'General query about all data' } });

    // Leave "Relevant Tables" empty
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockGenerateSql).toHaveBeenCalledWith(
        'config-ai-1',
        'General query about all data',
        [] // Expecting empty array
      );
    });

    expect(screen.getByText('General query about all data')).toBeInTheDocument();
    await waitFor(() => {
        expect(screen.getByText(/Generated SQL:/i)).toBeInTheDocument();
        expect(screen.getByText('SELECT mock_column FROM mock_table;')).toBeInTheDocument();
        expect(screen.getByText(/Dry run successful. Processed: 0.1230 GB./i)).toBeInTheDocument();
    });
  });

  test('ui reflects optional tables field guidance', () => {
    renderPage();
    expect(screen.getByLabelText('Relevant Tables (Optional - uses all if empty)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., dataset.table (or leave blank to use all from connection)')).toBeInTheDocument();
    expect(screen.getByText('If left blank, the AI will use schema descriptions from all tables saved under the selected configuration.')).toBeInTheDocument();
  });

  test('handles error from generateSqlFromNaturalLanguage', async () => {
    mockGenerateSql.mockRejectedValueOnce(new Error('AI service unavailable'));
    renderPage();
    await waitFor(() => expect(mockGetConfigs).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByLabelText('Configuration*'));
    fireEvent.click(await screen.findByText('AI Connection One'));
    fireEvent.change(screen.getByLabelText('Your request for SQL query...'), { target: { value: 'A request that will fail' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to generate SQL: AI service unavailable/i)).toBeInTheDocument();
    });
  });

   test('handles error from dryRunQuery', async () => {
    mockDryRunQuery.mockRejectedValueOnce(new Error('Invalid SQL for dry run'));
    renderPage();
    await waitFor(() => expect(mockGetConfigs).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByLabelText('Configuration*'));
    fireEvent.click(await screen.findByText('AI Connection One'));
    fireEvent.change(screen.getByLabelText('Your request for SQL query...'), { target: { value: 'Request leading to dry run error' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      // The SQL is still displayed
      expect(screen.getByText('SELECT mock_column FROM mock_table;')).toBeInTheDocument();
      // The content of the AI message should update to show the dry run error
      expect(screen.getByText(/Dry run failed: Invalid SQL for dry run/i)).toBeInTheDocument();
    });
  });

});
