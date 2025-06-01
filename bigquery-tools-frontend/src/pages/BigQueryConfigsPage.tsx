import React, { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Container, Typography, TextField, Button, Box, Paper, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Snackbar,
  Grid
} from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

import { addConfig, addConfigFile, testConfig } from '../services/bigQueryConfigService';
import type { BigQueryConfigItem } from '../services/bigQueryConfigService';

const BigQueryConfigsPage: React.FC = () => {
  const [configs, setConfigs] = useState<BigQueryConfigItem[]>([]);
  const [connectionName, setConnectionName] = useState('');
  const [gcpKeyJsonString, setGcpKeyJsonString] = useState('');
  const [gcpKeyFile, setGcpKeyFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [testStates, setTestStates] = useState<{ [key: string]: { loading: boolean; message: string; error: boolean } }>({});

  useEffect(() => {
    const connNameField = document.getElementById('connectionName-input');
    connNameField?.focus();
  }, []);


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
      if (response.id && response.connection_name) {
         setConfigs(prevConfigs => [...prevConfigs, {id: response.id, connection_name: response.connection_name}]);
      } else {
        console.warn("New config ID not returned from backend, cannot add to local list for testing immediately.")
      }
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

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb:4 }}>
      <Typography variant="h4" gutterBottom>
        BigQuery Configurations
      </Typography>

      {submitError && <Alert severity="error" onClose={() => setSubmitError(null)} sx={{mb:2}}>{submitError}</Alert>}
      <Snackbar open={!!submitSuccess} autoHideDuration={6000} onClose={() => setSubmitSuccess(null)} message={submitSuccess} />

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
      {configs.length === 0 ? (
        <Typography>No configurations added yet in this session.</Typography>
      ) : (
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
                    <IconButton
                      onClick={() => handleTestConfig(config.id)}
                      color="primary"
                      disabled={testStates[config.id]?.loading}
                      aria-label={`Test configuration ${config.connection_name}`}
                    >
                      {testStates[config.id]?.loading ? <CircularProgress size={24} /> : <PlayCircleOutlineIcon />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {Object.entries(testStates).map(([id, state]) =>
        state.message && (
          <Snackbar
            key={id}
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
    </Container>
  );
};

export default BigQueryConfigsPage;
