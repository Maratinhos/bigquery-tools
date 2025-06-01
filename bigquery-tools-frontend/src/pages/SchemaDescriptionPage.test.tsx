import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom'; // Needed if there are NavLinks or similar

import SchemaDescriptionPage from './SchemaDescriptionPage';
import * as schemaService from '../services/schemaService';
import * as bigQueryConfigService from '../services/bigQueryConfigService';

// Mock the services
jest.mock('../services/schemaService');
jest.mock('../services/bigQueryConfigService');

const mockGetConfigs = bigQueryConfigService.getConfigs as jest.Mock;
const mockGetAllSavedSchemas = schemaService.getAllSavedSchemas as jest.Mock;
const mockGetTableSchema = schemaService.getTableSchema as jest.Mock;
const mockUpdateSchemaDescription = schemaService.updateSchemaDescription as jest.Mock;

const mockConfigurations: bigQueryConfigService.BigQueryConfigItem[] = [
  { id: 'config-1', connection_name: 'Connection Alpha' },
  { id: 'config-2', connection_name: 'Connection Beta' },
];

const mockSavedSchemasData: schemaService.SavedObject[] = [
  {
    id: 'saved-obj-1',
    connection_id: 'config-1',
    object_name: 'dataset1.tableA',
    object_description: 'Description for Table A',
    fields: [
      { id: 'field-A1', field_name: 'column1', field_description: 'Desc for column1' },
      { id: 'field-A2', field_name: 'column2', field_description: 'Desc for column2' },
    ],
  },
  {
    id: 'saved-obj-2',
    connection_id: 'config-2',
    object_name: 'dataset2.tableB',
    object_description: 'Description for Table B',
    fields: [
      { id: 'field-B1', field_name: 'data_field', field_description: 'Desc for data_field' },
    ],
  },
    {
    id: 'saved-obj-3',
    connection_id: 'config-1', // Another object for Connection Alpha
    object_name: 'dataset1.tableC',
    object_description: 'Description for Table C',
    fields: [
      { id: 'field-C1', field_name: 'info', field_description: 'Desc for info' },
    ],
  },
];

// Helper function to render with Router context if needed
const renderPage = () => {
  return render(
    <BrowserRouter>
      <SchemaDescriptionPage />
    </BrowserRouter>
  );
};


describe('SchemaDescriptionPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockGetConfigs.mockReset();
    mockGetAllSavedSchemas.mockReset();
    mockGetTableSchema.mockReset();
    mockUpdateSchemaDescription.mockReset();

    // Default successful mocks
    mockGetConfigs.mockResolvedValue(mockConfigurations);
    mockGetAllSavedSchemas.mockResolvedValue(mockSavedSchemasData);
    mockGetTableSchema.mockResolvedValue({ schema: [{ name: 'live_col', field_type: 'STRING' }] });
    mockUpdateSchemaDescription.mockResolvedValue({ message: 'Descriptions saved successfully!' });
  });

  test('renders page title and initial elements', () => {
    renderPage();
    expect(screen.getByText('Describe BigQuery Object Schema')).toBeInTheDocument();
    expect(screen.getByText('Select Configuration and Object')).toBeInTheDocument();
    expect(screen.getByText('Browse Saved Object Descriptions')).toBeInTheDocument();
  });

  test('loads and displays configurations', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetConfigs).toHaveBeenCalledTimes(1);
      // Check if one of the mock configurations is present in the dropdown
      // MUI Select needs a bit more to test properly, often by opening the dropdown
      fireEvent.mouseDown(screen.getByLabelText('Configuration'));
    });
    // After opening, check for items
    expect(await screen.findByText('Connection Alpha (ID: ...fig-1)')).toBeInTheDocument();
    expect(await screen.findByText('Connection Beta (ID: ...fig-2)')).toBeInTheDocument();
  });

  test('loads and displays saved schemas grouped by connection name', async () => {
    renderPage();
    await waitFor(() => expect(mockGetAllSavedSchemas).toHaveBeenCalledTimes(1));

    // Check for connection names (Accordion summaries)
    expect(await screen.findByText('Connection Alpha')).toBeInTheDocument();
    expect(await screen.findByText('Connection Beta')).toBeInTheDocument();

    // Check for object names within the accordions
    expect(screen.getByText('dataset1.tableA')).toBeInTheDocument();
    expect(screen.getByText('dataset1.tableC')).toBeInTheDocument(); // For Connection Alpha
    expect(screen.getByText('dataset2.tableB')).toBeInTheDocument(); // For Connection Beta

    // Check a description snippet
    expect(screen.getByText(/Description for Table A/)).toBeInTheDocument();
  });

  test('clicking saved schema populates form', async () => {
    renderPage();
    await waitFor(() => expect(mockGetAllSavedSchemas).toHaveBeenCalledTimes(1));

    // Find the load button for 'dataset1.tableA' (more robust selectors might be needed)
    const loadButtons = await screen.findAllByRole('button', { name: /load this schema/i });
    // Assuming the first load button corresponds to the first mock saved schema or find specific one
    const tableALoadButton = loadButtons.find(button =>
        button.closest('li')?.querySelector('[data-testid="ListItemText"]')?.textContent?.includes('dataset1.tableA') || // This is a guess, MUI structure can be complex
        button.closest('li')?.textContent?.includes('dataset1.tableA') // Fallback
    );

    // A more direct way if we can add test ids or more specific aria-labels to list items or buttons
    // For now, let's assume we find a button for dataset1.tableA
    const specificLoadButton = (await screen.findAllByLabelText('load this schema')).find(
      (btn) => btn.closest('li')?.textContent?.includes('dataset1.tableA')
    );
    expect(specificLoadButton).toBeInTheDocument();

    if (specificLoadButton) {
        fireEvent.click(specificLoadButton);
    } else {
        throw new Error("Could not find load button for dataset1.tableA");
    }


    await waitFor(() => {
      // Configuration select
      expect(screen.getByLabelText('Configuration')).toHaveTextContent('Connection Alpha'); // MUI select value is tricky, check displayed text
      // Object Name input
      expect(screen.getByLabelText('Object Name (dataset.table)')).toHaveValue('dataset1.tableA');
      // Object Description
      expect(screen.getByLabelText('Description for the entire object (table/view)')).toHaveValue('Description for Table A');
    });

    // Check fields table
    expect(screen.getByRole('cell', { name: 'column1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'N/A (saved)' })).toBeInTheDocument(); // Type for first field
    // Find the text field for description of column1
    const col1DescInput = screen.getByDisplayValue('Desc for column1'); // This works if value is unique
    expect(col1DescInput).toBeInTheDocument();
  });

  test('get live schema button works', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfigs).toHaveBeenCalled());

    // Select configuration
    fireEvent.mouseDown(screen.getByLabelText('Configuration'));
    const configOption = await screen.findByText('Connection Alpha (ID: ...fig-1)');
    fireEvent.click(configOption);

    // Enter object name
    fireEvent.change(screen.getByLabelText('Object Name (dataset.table)'), { target: { value: 'dataset.liveTable' } });

    // Click "Get Live Schema"
    fireEvent.click(screen.getByRole('button', { name: /get live schema/i }));

    await waitFor(() => {
      expect(mockGetTableSchema).toHaveBeenCalledWith('config-1', 'dataset.liveTable');
    });
    expect(screen.getByRole('cell', { name: 'live_col' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'STRING' })).toBeInTheDocument();
  });

  test('save descriptions button works', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfigs).toHaveBeenCalled());

    // Populate form (e.g., by simulating "Get Live Schema" then editing)
    fireEvent.mouseDown(screen.getByLabelText('Configuration'));
    fireEvent.click(await screen.findByText('Connection Alpha (ID: ...fig-1)'));
    fireEvent.change(screen.getByLabelText('Object Name (dataset.table)'), { target: { value: 'dataset.testSave' } });

    mockGetTableSchema.mockResolvedValueOnce({ schema: [{ name: 'col_to_save', field_type: 'INTEGER' }] });
    fireEvent.click(screen.getByRole('button', { name: /get live schema/i }));

    await waitFor(() => expect(screen.getByRole('cell', { name: 'col_to_save' })).toBeInTheDocument());

    // Edit object description
    fireEvent.change(screen.getByLabelText('Description for the entire object (table/view)'), { target: { value: 'Test Object Description Save' } });

    // Edit field description (more robust: find by row context)
    const fieldDescInputs = screen.getAllByPlaceholderText('Enter field description...');
    fireEvent.change(fieldDescInputs[0], { target: { value: 'Test Field Description Save' } });

    // Click "Save All Descriptions"
    fireEvent.click(screen.getByRole('button', { name: /save all descriptions/i }));

    await waitFor(() => {
      expect(mockUpdateSchemaDescription).toHaveBeenCalledWith(
        'config-1',
        'dataset.testSave',
        'Test Object Description Save',
        [{ field_name: 'col_to_save', field_description: 'Test Field Description Save' }]
      );
    });
    expect(await screen.findByText('Descriptions saved successfully!')).toBeInTheDocument();
  });

});

`SchemaDescriptionPage.test.tsx` has been created with the tests.

Next, I'll create `bigquery-tools-frontend/src/pages/AIChatPage.test.tsx` and implement the tests for the `AIChatPage` component.
