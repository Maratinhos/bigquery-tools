import React, { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Container, Typography, TextField, Button, Box, Paper, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Snackbar,
  Grid,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Tooltip
} from '@mui/material';
// import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'; // Replaced
import CloudSyncIcon from '@mui/icons-material/CloudSync'; // New Test Connection Icon
import DeleteIcon from '@mui/icons-material/Delete'; // New Delete Icon

import { addConfig, addConfigFile, testConfig, getConfigs, deleteConfig } from '../services/bigQueryConfigService'; // Import getConfigs and deleteConfig
import type { BigQueryConfigItem } from '../services/bigQueryConfigService';

const BigQueryConfigsPage: React.FC = () => {
  const [configs, setConfigs] = useState<BigQueryConfigItem[]>([]);
  const [isFetchingConfigs, setIsFetchingConfigs] = useState(false);
  const [fetchConfigsError, setFetchConfigsError] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState('');
  const [gcpKeyJsonString, setGcpKeyJsonString] = useState('');
  const [gcpKeyFile, setGcpKeyFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false); // For add config form
  const [submitError, setSubmitError] = useState<string | null>(null); // For add config form
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null); // For add config form

  const [testStates, setTestStates] = useState<{ [key: string]: { loading: boolean; message: string; error: boolean } }>({});

  // State for delete confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [configToDeleteId, setConfigToDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const connNameField = document.getElementById('connectionName-input');
    connNameField?.focus();
  }, []);

  // useEffect to fetch configs on component mount
  useEffect(() => {
    const fetchInitialConfigs = async () => {
      setIsFetchingConfigs(true);
      setFetchConfigsError(null);
      try {
        const fetchedConfigs = await getConfigs();
        setConfigs(fetchedConfigs);
      } catch (err: any) {
        setFetchConfigsError(err.message || 'Failed to fetch configurations.');
      } finally {
        setIsFetchingConfigs(false);
      }
    };

    fetchInitialConfigs();
  }, []); // Empty dependency array to run only on mount


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setGcpKeyFile(event.target.files[0]);
      setGcpKeyJsonString('');
    }
  };

  const clearForm = () => {
    setConnectionName('');
    setGcpKeyJsonString('');
    setGcpKeyFile(null);
    const fileInput = document.getElementById('gcp-key-file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    const connNameField = document.getElementById('connectionName-input');
    connNameField?.focus();
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsLoading(true);

    if (!connectionName.trim()) {
        setSubmitError("Connection name is required.");
        setIsLoading(false);
        return;
    }
    if (!gcpKeyJsonString.trim() && !gcpKeyFile) {
        setSubmitError("Either GCP Key JSON or a GCP Key File must be provided.");
        setIsLoading(false);
        return;
    }

    try {
      let response;
      if (gcpKeyFile) {
        response = await addConfigFile(connectionName, gcpKeyFile);
      } else {
        try {
          const parsedGcpKeyJson = JSON.parse(gcpKeyJsonString);
          response = await addConfig(connectionName, parsedGcpKeyJson);
        } catch (e) {
          setSubmitError("Invalid GCP Key JSON format. Please ensure it's a valid JSON object.");
          setIsLoading(false);
          return;
        }
      }
      setSubmitSuccess(response.message || "Configuration added successfully!");
      // Add new config to the list
      const newConfig = { id: response.id, connection_name: response.connection_name };
      setConfigs(prevConfigs => [...prevConfigs, newConfig]);
      clearForm();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to add configuration. Check console for more details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConfig = async (configId: string) => {
    setTestStates(prev => ({ ...prev, [configId]: { loading: true, message: '', error: false } }));
    try {
      const response = await testConfig(configId);
      setTestStates(prev => ({ ...prev, [configId]: { loading: false, message: response.message || "Test successful!", error: false } }));
    } catch (err: any) {
      setTestStates(prev => ({ ...prev, [configId]: { loading: false, message: err.message || "Test failed.", error: true } }));
    }
  };

  const openDeleteDialog = (id: string) => {
    setConfigToDeleteId(id);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteDialog = () => {
    setConfigToDeleteId(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteConfig = async () => {
    if (!configToDeleteId) return;

    setIsDeleting(true);
    setDeleteError(null);
    setDeleteMessage(null);

    try {
      const response = await deleteConfig(configToDeleteId);
      setConfigs(prevConfigs => prevConfigs.filter(config => config.id !== configToDeleteId));
      setDeleteMessage(response.message || "Configuration deleted successfully.");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete configuration.");
    } finally {
      setIsDeleting(false);
      closeDeleteDialog();
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb:4 }}>
      <Typography variant="h4" gutterBottom>
        BigQuery Configurations
      </Typography>

      {/* Add Config Messages */}
      {submitError && <Alert severity="error" onClose={() => setSubmitError(null)} sx={{mb:2}}>{submitError}</Alert>}
      {submitSuccess && <Snackbar open={!!submitSuccess} autoHideDuration={6000} onClose={() => setSubmitSuccess(null)} message={submitSuccess} />}

      {/* Delete Config Messages */}
      {deleteError && <Alert severity="error" onClose={() => setDeleteError(null)} sx={{mb:2}}>{deleteError}</Alert>}
      {deleteMessage && <Snackbar open={!!deleteMessage} autoHideDuration={6000} onClose={() => setDeleteMessage(null)} message={deleteMessage} />}


      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>Add New Configuration</Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={2}>
            <Grid item={true} xs={12}> {/* Explicit item={true} */}
              <TextField
                id="connectionName-input"
                label="Connection Name"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                fullWidth
                required
                margin="normal"
                disabled={isLoading}
                autoFocus
              />
            </Grid>
            <Grid item={true} xs={12}> {/* Explicit item={true} */}
              <TextField
                label="GCP Service Account Key (JSON)"
                value={gcpKeyJsonString}
                onChange={(e) => { setGcpKeyJsonString(e.target.value); if(gcpKeyFile){setGcpKeyFile(null); const fi = document.getElementById('gcp-key-file-input') as HTMLInputElement; if(fi) fi.value='';} }}
                fullWidth
                multiline
                rows={5}
                margin="normal"
                placeholder="Paste your JSON key here OR select a file below"
                disabled={isLoading || !!gcpKeyFile}
              />
            </Grid>
            <Grid item={true} xs={12} sx={{textAlign: 'center'}}> {/* Explicit item={true} */}
              <Typography variant="subtitle1" sx={{mt:0, mb:0}}>OR</Typography>
            </Grid>
            <Grid item={true} xs={12}> {/* Explicit item={true} */}
              <Button variant="outlined" component="label" fullWidth disabled={isLoading || !!gcpKeyJsonString.trim()}>
                Upload GCP Key File
                <input
                  id="gcp-key-file-input"
                  type="file"
                  hidden
                  onChange={handleFileChange}
                  accept=".json"
                  disabled={isLoading || !!gcpKeyJsonString.trim()}
                />
              </Button>
              {gcpKeyFile && <Typography variant="body2" sx={{mt:1}}>Selected file: {gcpKeyFile.name}</Typography>}
            </Grid>
            <Grid item={true} xs={12}> {/* Explicit item={true} */}
              <Button
                type="submit"
                variant="contained"
                color="primary"
                sx={{ mt: 2 }}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : "Add Configuration"}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <Typography variant="h6" gutterBottom>Current Session Configurations</Typography>
      {isFetchingConfigs && <Box sx={{display: 'flex', justifyContent: 'center', my: 3}}><CircularProgress /></Box>}
      {fetchConfigsError && <Alert severity="error" onClose={() => setFetchConfigsError(null)} sx={{my:2}}>{fetchConfigsError}</Alert>}
      {!isFetchingConfigs && !fetchConfigsError && configs.length === 0 && (
        <Typography>No configurations found or added yet.</Typography>
      )}
      {!isFetchingConfigs && !fetchConfigsError && configs.length > 0 && (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>Connection Name</TableCell>
                <TableCell>Connection ID</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((config) => (
                <TableRow hover key={config.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row">{config.connection_name}</TableCell>
                  <TableCell sx={{fontSize: '0.75rem', color: 'text.secondary', wordBreak: 'break-all'}}>{config.id}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Test connection">
                      <IconButton
                        onClick={() => handleTestConfig(config.id)}
                        color="primary"
                        disabled={testStates[config.id]?.loading || isFetchingConfigs}
                        aria-label={`Test configuration ${config.connection_name}`}
                      >
                        {testStates[config.id]?.loading ? <CircularProgress size={24} /> : <CloudSyncIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete configuration">
                      <IconButton
                        onClick={() => openDeleteDialog(config.id)}
                        color="error"
                        disabled={isFetchingConfigs || isDeleting} // Also disable if another delete is in progress
                        aria-label={`Delete configuration ${config.connection_name}`}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Test Connection Snackbars */}
      {Object.entries(testStates).map(([id, state]) =>
        state.message && (
          <Snackbar
            key={`test-${id}`} // Ensure unique key
            open={!!state.message}
            autoHideDuration={6000}
            onClose={() => setTestStates(prev => ({...prev, [id]: {...prev[id], message: ''}}))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={() => setTestStates(prev => ({...prev, [id]: {...prev[id], message: ''}}))} severity={state.error ? "error" : "success"} sx={{ width: '100%' }}>
              {`Test for ${configs.find(c=>c.id===id)?.connection_name || 'config ' + id.slice(-6)}: ${state.message}`}
            </Alert>
          </Snackbar>
        )
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={closeDeleteDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete this configuration? This action cannot be undone.
            {configToDeleteId && configs.find(c=>c.id === configToDeleteId) &&
              ` You are about to delete: ${configs.find(c=>c.id === configToDeleteId)?.connection_name}`
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} color="primary" disabled={isDeleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfig} color="error" autoFocus disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={24} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
};

export default BigQueryConfigsPage;
