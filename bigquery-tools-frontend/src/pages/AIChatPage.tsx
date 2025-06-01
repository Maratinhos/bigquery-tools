import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Typography, TextField, Button, Box, Paper, CircularProgress, Snackbar, Alert,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Chip,
  Grid
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CodeBlock from '../components/CodeBlock';

import { getConfigs } from '../services/bigQueryConfigService';
import type { BigQueryConfigItem } from '../services/bigQueryConfigService';
import { generateSqlFromNaturalLanguage, dryRunQuery } from '../services/aiService';
import type { GenerateSqlResponse, DryRunResponse } from '../services/aiService';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'error';
  content: string;
  sql?: string;
  gbProcessed?: number | null;
  isDryRunLoading?: boolean;
}

const AIChatPage: React.FC = () => {
  const [availableConfigs, setAvailableConfigs] = useState<BigQueryConfigItem[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [selectedObjectNames, setSelectedObjectNames] = useState<string[]>([]);
  const [userRequest, setUserRequest] = useState<string>('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [isGeneratingSql, setIsGeneratingSql] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConfigs = async () => {
      setIsLoadingConfigs(true);
      try {
        const configs = await getConfigs();
        setAvailableConfigs(configs);
      } catch (err: any) {
        setError(err.message || "Failed to load configurations. Ensure backend is running.");
      } finally {
        setIsLoadingConfigs(false);
      }
    };
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (selectedConfigId && !isLoadingConfigs) {
        userInputRef.current?.focus();
    }
  }, [selectedConfigId, isLoadingConfigs]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const addMessage = (type: ChatMessage['type'], content: string, extras: Partial<ChatMessage> = {}) => {
    setChatMessages(prev => [...prev, { id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, type, content, ...extras }]);
  };

  const handleSubmitRequest = async () => {
    if (!userRequest.trim() || !selectedConfigId) {
      setError("Please select a configuration and enter your request.");
      return;
    }

    const currentRequest = userRequest;
    addMessage('user', currentRequest);
    setUserRequest('');
    setIsGeneratingSql(true);
    setError(null);

    const tempAiMessageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-ai`;

    try {
      const genSqlResponse: GenerateSqlResponse = await generateSqlFromNaturalLanguage(
        selectedConfigId,
        currentRequest,
        selectedObjectNames
      );

      if (genSqlResponse.generated_sql) {
        const sql = genSqlResponse.generated_sql;
        setChatMessages(prev => [...prev, {
            id: tempAiMessageId,
            type: 'ai',
            content: `Generated SQL:`,
            sql: sql,
            isDryRunLoading: true
        }]);
        setIsGeneratingSql(false);

        try {
          const dryRunRes: DryRunResponse = await dryRunQuery(selectedConfigId, sql);
          let dryRunInfo = `Dry run: ${dryRunRes.message}`;
          if (dryRunRes.gb_processed !== undefined && dryRunRes.gb_processed !== null) {
            dryRunInfo += ` Processed: ${dryRunRes.gb_processed.toFixed(4)} GB.`;
          }
          setChatMessages(prev => prev.map(msg =>
            msg.id === tempAiMessageId
            ? { ...msg, content: `Generated SQL:\n\n${dryRunInfo}`, sql: sql, gbProcessed: dryRunRes.gb_processed, isDryRunLoading: false }
            : msg
          ));

        } catch (dryRunErr: any) {
          setChatMessages(prev => prev.map(msg =>
            msg.id === tempAiMessageId
            ? { ...msg, content: `Generated SQL:\n\nDry run failed: ${dryRunErr.message}`, sql: sql, gbProcessed: null, isDryRunLoading: false }
            : msg
          ));
        }
      } else {
        addMessage('error', "The AI did not return a SQL query. Please try rephrasing your request.");
        setIsGeneratingSql(false);
      }
    } catch (genErr: any) {
      addMessage('error', `Failed to generate SQL: ${genErr.message}`);
      setIsGeneratingSql(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ display: 'flex', flexDirection: 'column', height: {xs: 'auto', md: 'calc(100vh - 64px - 32px)'}, maxHeight: 'calc(100vh - 64px - 32px)', my: 2, boxSizing: 'border-box' }}>
      <Typography variant="h4" gutterBottom sx={{textAlign: 'center', flexShrink: 0 }}>
        AI SQL Chat Assistant
      </Typography>

      {error && !chatMessages.find(m => m.type === 'error') &&
        <Alert severity="error" onClose={() => setError(null)} sx={{mb:1, flexShrink: 0}}>{error}</Alert>
      }

      <Paper elevation={2} sx={{ p: 2, mb: 2, flexShrink: 0 }}>
        <Grid container spacing={2} alignItems="center">
            <Grid item={true} xs={12} md={4}> {/* Explicit item={true} */}
                <FormControl fullWidth size="small">
                <InputLabel id="config-select-label">Configuration*</InputLabel>
                <Select
                    labelId="config-select-label"
                    value={selectedConfigId}
                    label="Configuration*"
                    onChange={(e: SelectChangeEvent<string>) => setSelectedConfigId(e.target.value)}
                    disabled={isLoadingConfigs || availableConfigs.length === 0}
                >
                    {isLoadingConfigs && <MenuItem value=""><em>Loading...</em></MenuItem>}
                    {!isLoadingConfigs && availableConfigs.length === 0 && <MenuItem value="" disabled><em>No configurations found</em></MenuItem>}
                    {availableConfigs.map((config) => (
                    <MenuItem key={config.id} value={config.id}>
                        {config.connection_name}
                    </MenuItem>
                    ))}
                </Select>
                </FormControl>
            </Grid>
            <Grid item={true} xs={12} md={8}> {/* Explicit item={true} */}
                <Autocomplete
                    multiple
                    freeSolo
                    size="small"
                    options={[]}
                    value={selectedObjectNames}
                    onChange={(_event, newValue) => {
                        setSelectedObjectNames(newValue as string[]);
                    }}
                    renderTags={(value: readonly string[], getTagProps) =>
                        value.map((option: string, index: number) => (
                        <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                        ))
                    }
                    renderInput={(params) => (
                        <TextField
                        {...params}
                        variant="outlined"
                        label="Relevant Table/View Names (Optional)"
                        placeholder="e.g., dataset.table, another.view"
                        />
                    )}
                    disabled={!selectedConfigId}
                />
            </Grid>
        </Grid>
      </Paper>

      <Box
        ref={chatContainerRef}
        sx={{ flexGrow: 1, overflowY: 'auto', p: {xs:1, sm:2}, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, backgroundColor: 'action.hover' }}
      >
        {chatMessages.map((msg) => (
          <Paper
            key={msg.id}
            elevation={msg.type === 'user' ? 1 : 3}
            sx={{
              p: 1.5,
              mb: 1.5,
              bgcolor: msg.type === 'user' ? 'primary.light' : (msg.type === 'error' ? 'error.main' : 'background.paper'),
              color: msg.type === 'user' ? 'primary.contrastText' : (msg.type === 'error' ? 'error.contrastText' : 'text.primary'),
              ml: msg.type === 'ai' || msg.type === 'system' || msg.type === 'error' ? 0 : 'auto',
              mr: msg.type === 'user' ? 0 : 'auto',
              maxWidth: '85%',
              minWidth: '20%',
              borderRadius: msg.type === 'user' ? '10px 10px 0 10px' : '10px 10px 10px 0',
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.sql && msg.content.startsWith("Generated SQL:") ? msg.content.substring(0, msg.content.indexOf(msg.sql)).trim() : msg.content}
            </Typography>
            {msg.sql && <CodeBlock sql={msg.sql} />}
            {msg.isDryRunLoading && (
              <Box sx={{display: 'flex', alignItems: 'center', mt: 1}}>
                <CircularProgress size={16} sx={{mr:1, color: msg.type === 'user' ? 'inherit' : 'primary.main' }} />
                <Typography variant="caption" sx={{color: msg.type === 'user' ? 'inherit' : 'text.secondary'}}>Performing dry run...</Typography>
              </Box>
            )}
          </Paper>
        ))}
      </Box>

      <Box component="form" sx={{ display: 'flex', gap: 1, alignItems: 'stretch', flexShrink: 0 }} onSubmit={(e) => { e.preventDefault(); handleSubmitRequest(); }}>
        <TextField
          fullWidth
          variant="outlined"
          label="Your request for SQL query..."
          value={userRequest}
          onChange={(e) => setUserRequest(e.target.value)}
          multiline
          minRows={2}
          maxRows={5}
          disabled={isGeneratingSql || !selectedConfigId}
          inputRef={userInputRef}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isGeneratingSql && selectedConfigId && userRequest.trim()) {
              e.preventDefault();
              handleSubmitRequest();
            }
          }}
        />
        <Button
          type="submit"
          variant="contained"
          endIcon={<SendIcon />}
          disabled={isGeneratingSql || !selectedConfigId || !userRequest.trim()}
        >
          Send
        </Button>
      </Box>
      <Snackbar
        open={!!error && !chatMessages.some(m => m.type === 'error' && m.content.includes(error || ''))}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
            {error}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AIChatPage;
