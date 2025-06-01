import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Typography, FormControl, InputLabel, Select, MenuItem, TextField, Button,
  Box, Paper, Alert, CircularProgress, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Grid
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';

import { getConfigs } from '../services/bigQueryConfigService';
import type { BigQueryConfigItem } from '../services/bigQueryConfigService';
import { getTableSchema, updateSchemaDescription } from '../services/schemaService';
import type { FieldSchema } from '../services/schemaService';

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

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const objectNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConfigs = async () => {
      setIsLoadingConfigs(true);
      setError(null);
      try {
        const configs = await getConfigs();
        setAvailableConfigs(configs);
      } catch (err: any) {
        setError(err.message || "Failed to load configurations. Please ensure backend is running and you are logged in.");
      } finally {
        setIsLoadingConfigs(false);
      }
    };
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (selectedConfigId && !isLoadingConfigs) {
      objectNameInputRef.current?.focus();
    }
  }, [selectedConfigId, isLoadingConfigs]);


  const handleGetSchema = async () => {
    if (!selectedConfigId || !objectName.trim()) {
      setError("Please select a configuration and enter a valid object name (e.g., dataset.table).");
      return;
    }
    if (objectName.trim().indexOf('.') <= 0 || objectName.trim().endsWith('.')) {
        setError("Invalid object_name format. Expected 'dataset_id.table_id'.");
        return;
    }

    setIsLoadingSchema(true);
    setError(null);
    setSuccessMessage(null);
    setFields([]);
    setObjectDescription('');

    try {
      const response = await getTableSchema(selectedConfigId, objectName.trim());
      if (response.schema && response.schema.length > 0) {
        setFields(response.schema.map(field => ({ ...field, description: '' })));
        setSuccessMessage(`Schema for '${objectName.trim()}' fetched successfully. You can now add descriptions.`);
      } else {
        setFields([]);
        setError(`Schema for '${objectName.trim()}' is empty or not found.`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch schema. Ensure the object exists and configuration is correct.");
      setFields([]);
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
      setError("Configuration and object name are required to save descriptions.");
      return;
    }
    if (fields.length === 0) {
        setError("No schema fields to save. Please fetch schema first.");
        return;
    }
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const fieldDataToSave = fields.map(f => ({
      field_name: f.name,
      field_description: f.description
    }));

    try {
      const response = await updateSchemaDescription(
        selectedConfigId,
        objectName.trim(),
        objectDescription,
        fieldDataToSave
      );
      setSuccessMessage(response.message || "Descriptions saved successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to save descriptions. Please check details and try again.");
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Describe BigQuery Object Schema
      </Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{mb:2}}>{error}</Alert>}
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

      <Paper sx={{ p: {xs: 2, md: 3}, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Select Configuration and Object</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item={true} xs={12} md={5}> {/* Explicit item={true} */}
            <FormControl fullWidth >
              <InputLabel id="config-select-label">Configuration</InputLabel>
              <Select
                labelId="config-select-label"
                value={selectedConfigId}
                label="Configuration"
                onChange={(e: SelectChangeEvent<string>) => {
                    setSelectedConfigId(e.target.value);
                    setObjectName('');
                    setFields([]);
                    setObjectDescription('');
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
          <Grid item={true} xs={12} md={5}> {/* Explicit item={true} */}
            <TextField
              label="Object Name (dataset.table)"
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              fullWidth
              disabled={!selectedConfigId || isLoadingSchema}
              inputRef={objectNameInputRef}
            />
          </Grid>
          <Grid item={true} xs={12} md={2}> {/* Explicit item={true} */}
            <Button
              fullWidth
              variant="contained"
              onClick={handleGetSchema}
              disabled={!selectedConfigId || !objectName.trim() || isLoadingSchema || isSaving}
              sx={{height: '56px'}}
            >
              {isLoadingSchema ? <CircularProgress size={24} /> : "Get Schema"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {fields.length > 0 && (
        <Paper sx={{ p: {xs: 2, md: 3}, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Object Description</Typography>
          <TextField
            label="Description for the entire object (table/view)"
            value={objectDescription}
            onChange={(e) => setObjectDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            margin="normal"
            sx={{mb:3}}
            disabled={isSaving || isLoadingSchema}
          />

          <Typography variant="h6" gutterBottom>Field Descriptions</Typography>
          <TableContainer component={Paper} sx={{mb:2}}>
            <Table sx={{ minWidth: 650 }} size="small" aria-label="schema fields table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{fontWeight: 'bold'}}>Field Name</TableCell>
                  <TableCell sx={{fontWeight: 'bold'}}>Data Type</TableCell>
                  <TableCell sx={{fontWeight: 'bold', width: '50%'}}>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow hover key={`${field.name}-${index}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
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
    </Container>
  );
};

export default SchemaDescriptionPage;
