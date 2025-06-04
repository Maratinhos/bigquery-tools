import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Typography, FormControl, InputLabel, Select, MenuItem, TextField, Button,
  Box, Paper, Alert, CircularProgress, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Grid,
  List, ListItem, ListItemText, IconButton, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileOpenIcon from '@mui/icons-material/FileOpen'; // For populating from saved
import type { SelectChangeEvent } from '@mui/material';

import { getConfigs } from '../services/bigQueryConfigService';
import type { BigQueryConfigItem } from '../services/bigQueryConfigService';
import { getTableSchema, updateSchemaDescription, getAllSavedSchemas } from '../services/schemaService';
import type { FieldSchema, SavedObject } from '../services/schemaService';


interface DescribedField extends FieldSchema {
  description: string;
}

const SchemaDescriptionPage: React.FC = () => {
  const [availableConfigs, setAvailableConfigs] = useState<BigQueryConfigItem[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [objectName, setObjectName] = useState<string>('');
  const [objectDescription, setObjectDescription] = useState<string>('');
  const [fields, setFields] = useState<DescribedField[]>([]);

  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [generalError, setGeneralError] = useState<string | null>(null); // For non-field specific errors
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State for saved schemas
  const [savedSchemas, setSavedSchemas] = useState<SavedObject[]>([]);
  const [isLoadingSavedSchemas, setIsLoadingSavedSchemas] = useState(false);
  const [savedSchemasError, setSavedSchemasError] = useState<string | null>(null);


  const objectNameInputRef = useRef<HTMLInputElement>(null);
  const topOfFormRef = useRef<HTMLDivElement>(null); // Ref for scrolling

  useEffect(() => {
    const fetchConfigs = async () => {
      setIsLoadingConfigs(true);
      setGeneralError(null);
      try {
        const configs = await getConfigs();
        setAvailableConfigs(configs);
      } catch (err: any) {
        setGeneralError(err.message || "Failed to load configurations. Please ensure backend is running and you are logged in.");
      } finally {
        setIsLoadingConfigs(false);
      }
    };
    fetchConfigs();
  }, []);

  // Fetch saved schemas on mount
  useEffect(() => {
    const fetchSavedSchemas = async () => {
      setIsLoadingSavedSchemas(true);
      setSavedSchemasError(null);
      try {
        const schemas = await getAllSavedSchemas();
        setSavedSchemas(schemas);
      } catch (err: any) {
        setSavedSchemasError(err.message || "Failed to load saved schemas.");
      } finally {
        setIsLoadingSavedSchemas(false);
      }
    };
    fetchSavedSchemas();
  }, []);


  useEffect(() => {
    // Focus object name input if a config is selected, and not currently loading other things
    // or if fields have just been populated (implying a saved schema was clicked)
    if (selectedConfigId && !isLoadingConfigs && !isLoadingSchema && !isSaving) {
        const timer = setTimeout(() => { // Timeout to allow state updates to render
            objectNameInputRef.current?.focus();
        }, 0);
        return () => clearTimeout(timer);
    }
  }, [selectedConfigId, isLoadingConfigs, isLoadingSchema, isSaving]);


  const handleGetSchema = async () => {
    if (!selectedConfigId || !objectName.trim()) {
      setGeneralError("Please select a configuration and enter a valid object name (e.g., dataset.table).");
      return;
    }
    if (objectName.trim().indexOf('.') <= 0 || objectName.trim().endsWith('.')) {
        setGeneralError("Invalid object_name format. Expected 'dataset_id.table_id'.");
        return;
    }

    setIsLoadingSchema(true);
    setGeneralError(null);
    setSuccessMessage(null);
    setFields([]); // Clear current fields
    setObjectDescription(''); // Clear current object description

    try {
      const response = await getTableSchema(selectedConfigId, objectName.trim());
      if (response.schema && response.schema.length > 0) {
        setFields(response.schema.map(field => ({ ...field, description: '' })));
        setSuccessMessage(`Schema for '${objectName.trim()}' fetched successfully. You can now add descriptions.`);
      } else {
        setFields([]); // Ensure fields are empty
        setGeneralError(`Schema for '${objectName.trim()}' is empty or not found (live fetch).`);
      }
    } catch (err: any) {
      setGeneralError(err.message || "Failed to fetch schema. Ensure the object exists and configuration is correct.");
      setFields([]); // Ensure fields are empty on error
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const handleFieldDescriptionChange = (index: number, newDescription: string) => {
    setFields(prevFields =>
      prevFields.map((field, i) =>
        i === index ? { ...field, description: newDescription } : field
      )
    );
  };

  const handleSaveDescriptions = async () => {
    if (!selectedConfigId || !objectName.trim()) {
      setGeneralError("Configuration and object name are required to save descriptions.");
      return;
    }
    if (fields.length === 0) {
        setGeneralError("No schema fields to save. Please fetch schema first or load a saved schema.");
        return;
    }
    setIsSaving(true);
    setGeneralError(null);
    setSuccessMessage(null);

    const fieldDataToSave = fields.map(f => ({
      field_name: f.name,
      // Ensure description is not undefined, send null if it's empty string for consistency with backend
      field_description: f.description || null
    }));

    const currentObjectDescription = objectDescription || null;

    try {
      const response = await updateSchemaDescription(
        selectedConfigId,
        objectName.trim(),
        currentObjectDescription,
        fieldDataToSave
      );
      setSuccessMessage(response.message || "Descriptions saved successfully!");
      // Optionally, refresh saved schemas after successful save
      // fetchSavedSchemas(); // Consider if this is too much or if a manual refresh button is better
    } catch (err: any) {
      setGeneralError(err.message || "Failed to save descriptions. Please check details and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSavedSchema = (savedObject: SavedObject) => {
    setSelectedConfigId(savedObject.connection_id);
    setObjectName(savedObject.object_name);
    setObjectDescription(savedObject.object_description || '');
    setFields(savedObject.fields.map(f => ({
      name: f.field_name,
      field_type: 'N/A (saved)', // As per requirement
      description: f.field_description || ''
    })));
    setGeneralError(null); // Clear any previous errors
    setSuccessMessage(`Loaded saved schema for '${savedObject.object_name}'. You can edit and save again.`);
    objectNameInputRef.current?.focus();

    // Scroll to top of form for better UX
    if(topOfFormRef.current) {
        topOfFormRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };


  // Group saved schemas by connection name for display
  const groupedSavedSchemas = savedSchemas.reduce((acc, curr) => {
    const config = availableConfigs.find(c => c.id === curr.connection_id);
    const connectionName = config ? config.connection_name : `Unknown Connection (ID: ${curr.connection_id})`;
    if (!acc[connectionName]) {
      acc[connectionName] = [];
    }
    acc[connectionName].push(curr);
    return acc;
  }, {} as Record<string, SavedObject[]>);


  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}> {/* Changed to xl for more space */}
      <Typography variant="h4" gutterBottom ref={topOfFormRef}>
        Describe BigQuery Object Schema
      </Typography>

      {generalError && <Alert severity="error" onClose={() => setGeneralError(null)} sx={{mb:2}}>{generalError}</Alert>}
      {successMessage && (
        <Snackbar
            open={!!successMessage}
            autoHideDuration={6000}
            onClose={() => setSuccessMessage(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
            <Alert onClose={() => setSuccessMessage(null)} severity="success" sx={{ width: '100%' }}>
                {successMessage}
            </Alert>
        </Snackbar>
      )}

      {/* Main layout grid */}
      <Grid container spacing={3}>
        {/* Left Panel: Schema Editing Form */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Select Configuration and Object</Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="config-select-label">Configuration</InputLabel>
                  <Select
                    labelId="config-select-label"
                    value={selectedConfigId}
                    label="Configuration"
                    onChange={(e: SelectChangeEvent<string>) => {
                        setSelectedConfigId(e.target.value);
                        setObjectName(''); // Clear object name when config changes
                        setFields([]); // Clear fields
                        setObjectDescription(''); // Clear object description
                        setGeneralError(null); // Clear errors
                    }}
                    disabled={isLoadingConfigs || availableConfigs.length === 0}
                  >
                    {isLoadingConfigs && <MenuItem value=""><em>Loading configs...</em></MenuItem>}
                    {!isLoadingConfigs && availableConfigs.length === 0 && <MenuItem value="" disabled><em>No configurations found. Add one on BQ Configs page.</em></MenuItem>}
                    {availableConfigs.map((config) => (
                      <MenuItem key={config.id} value={config.id}>
                        {config.connection_name} (ID: ...{config.id.slice(-6)})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Object Name (dataset.table)"
                  value={objectName}
                  onChange={(e) => setObjectName(e.target.value)}
                  fullWidth
                  disabled={!selectedConfigId || isLoadingSchema || isSaving}
                  inputRef={objectNameInputRef}
                />
              </Grid>
              <Grid item xs={12}> {/* Button takes full width on small screens, then adjusts */}
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleGetSchema}
                  disabled={!selectedConfigId || !objectName.trim() || isLoadingSchema || isSaving}
                  sx={{ height: '56px' }}
                >
                  {isLoadingSchema ? <CircularProgress size={24} /> : "Get Live Schema"}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {fields.length > 0 && (
            <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Object Description</Typography>
              <TextField
                label="Description for the entire object (table/view)"
                value={objectDescription}
                onChange={(e) => setObjectDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                margin="normal"
                sx={{ mb: 3 }}
                disabled={isSaving || isLoadingSchema}
              />

              <Typography variant="h6" gutterBottom>Field Descriptions</Typography>
              <TableContainer component={Paper} sx={{ mb: 2, maxHeight: '400px', overflowY: 'auto' }}>
                <Table stickyHeader sx={{ minWidth: 650 }} size="small" aria-label="schema fields table">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Field Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Data Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow hover key={`${field.name}-${index}-${selectedConfigId}-${objectName}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell component="th" scope="row">{field.name}</TableCell>
                        <TableCell>{field.field_type}</TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={field.description}
                            onChange={(e) => handleFieldDescriptionChange(index, e.target.value)}
                            placeholder="Enter field description..."
                            disabled={isSaving || isLoadingSchema}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 3, textAlign: 'right' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveDescriptions}
                  disabled={isSaving || isLoadingSchema || fields.length === 0}
                >
                  {isSaving ? <CircularProgress size={24} /> : "Save All Descriptions"}
                </Button>
              </Box>
            </Paper>
          )}
        </Grid> {/* End Left Panel */}

        {/* Right Panel: Saved Schemas */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: { xs: 2, md: 3 }, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Browse Saved Object Descriptions
            </Typography>
            {isLoadingSavedSchemas && <CircularProgress />}
            {savedSchemasError && <Alert severity="error">{savedSchemasError}</Alert>}
            {!isLoadingSavedSchemas && !savedSchemasError && savedSchemas.length === 0 && (
              <Typography variant="body2">No saved schemas found.</Typography>
            )}
            {!isLoadingSavedSchemas && !savedSchemasError && Object.keys(groupedSavedSchemas).length > 0 && (
              Object.entries(groupedSavedSchemas).map(([connectionName, objects]) => (
                <Accordion key={connectionName} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{fontWeight: 'medium'}}>{connectionName}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {objects.map(obj => (
                        <ListItem
                          key={obj.id}
                          secondaryAction={
                            <IconButton edge="end" aria-label="load schema" onClick={() => handleLoadSavedSchema(obj)} title="Load this schema">
                              <FileOpenIcon />
                            </IconButton>
                          }
                          sx={{
                            mb: 1,
                            border: '1px solid lightgray',
                            borderRadius: '4px',
                            '&:hover': { backgroundColor: 'action.hover' }
                          }}
                          divider
                        >
                          <ListItemText
                            primary={obj.object_name}
                            secondary={obj.object_description ? `Desc: ${obj.object_description.substring(0,50)}...` : "No object description."}
                            primaryTypographyProps={{ fontWeight: 'bold' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </Paper>
        </Grid> {/* End Right Panel */}
      </Grid> {/* End Main Grid */}
    </Container>
  );
};

export default SchemaDescriptionPage;
