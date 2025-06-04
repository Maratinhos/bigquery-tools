import React, { useState, useEffect } from 'react';
import { Container, Typography, TextField, Button, Box, Paper, Alert, CircularProgress, Snackbar } from '@mui/material';
import { saveGeminiApiKey, getGeminiApiKey } from '../services/settingsService';

const GeminiApiKeyPage: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [displayedApiKey, setDisplayedApiKey] = useState<string>('Not set or hidden');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchKey = async () => {
      setIsFetching(true);
      setError(null);
      try {
        const response = await getGeminiApiKey();
        if (response.api_key) {
          // Display only a portion of the key for security, e.g., last 4 chars
          setDisplayedApiKey(`********${response.api_key.slice(-4)}`);
          // You might not want to set the full key in the input field for editing by default
          // setApiKey(response.api_key);
        } else {
          setDisplayedApiKey('Not set');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch API Key.');
        setDisplayedApiKey('Error fetching key');
      } finally {
        setIsFetching(false);
      }
    };
    fetchKey();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!apiKey.trim()) {
      setError("API Key cannot be empty.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await saveGeminiApiKey(apiKey);
      setSuccessMessage(response.message || 'API Key saved successfully!');
      // Update displayed key
       setDisplayedApiKey(`********${apiKey.slice(-4)}`);
      setApiKey(''); // Clear the input field after successful save
    } catch (err: any) {
      setError(err.message || 'Failed to save API Key.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: { xs: 2, md: 3 }, mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Configure Gemini API Key
        </Typography>

        {isFetching && <CircularProgress sx={{display: 'block', margin: '20px auto'}} />}

        {!isFetching && (
          <Box mb={3}>
            <Typography variant="subtitle1">Current API Key Status:</Typography>
            <Typography variant="body1" color="textSecondary">
              {displayedApiKey}
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error" onClose={() => setError(null)} sx={{mb:2}}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            label="New Gemini API Key"
            variant="outlined"
            fullWidth
            type="password" // Use password type to hide the key
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            helperText="Enter your new Gemini API Key. The existing key will be overwritten."
            margin="normal"
            disabled={isLoading || isFetching}
          />
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isLoading || isFetching || !apiKey.trim()}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Save API Key'}
            </Button>
          </Box>
        </form>
      </Paper>
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
    </Container>
  );
};

export default GeminiApiKeyPage;
