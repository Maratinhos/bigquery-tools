import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Typography, TextField, Button, Box, Paper, CircularProgress, Snackbar, Alert,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Chip, Grid,
  Drawer, IconButton,
} from '@mui/material'; // Removed duplicate IconButton
import type { SelectChangeEvent } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close'; // Added CloseIcon
import CodeBlock from '../components/CodeBlock';

import { getConfigs } from '../services/bigQueryConfigService';
import type { BigQueryConfigItem } from '../services/bigQueryConfigService';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'; // Import the icon
import { generateSqlFromNaturalLanguage, dryRunQuery } from '../services/aiService';
import type { GenerateSqlResponse, DryRunResponse } from '../services/aiService';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'error';
  content: string;
  sql?: string;
  gbProcessed?: number | null;
  isDryRunLoading?: boolean;
  fullRequestText?: string; // New field
}

const DRAWER_WIDTH_CLAMP = 'clamp(300px, 35%, 600px)';

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

  // const [showRequestPanel, setShowRequestPanel] = useState<boolean>(false); // Added in previous step - this line is commented out as it was already added
  // const [requestPanelContent, setRequestPanelContent] = useState<string>(''); // Added in previous step - this line is commented out as it was already added

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
    addMessage('user', currentRequest, { fullRequestText: currentRequest });
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
      <Container
        maxWidth="lg" // Keeps content centered with a max width if desired, or set to false
        sx={{
          display: 'flex',
          flexDirection: 'row',
          height: { xs: 'auto', md: 'calc(100vh - 64px - 32px)' }, // Main container height
          maxHeight: 'calc(100vh - 64px - 32px)',
          my: 2, // Vertical margin for the whole page component
          boxSizing: 'border-box',
          p: 0, // Remove padding from outer container, will be handled by inner box
        }}
      >
        {/* Main Content Area Wrapper */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            overflowY: 'hidden', // Inner content like chat messages will scroll
            width: showRequestPanel ? `calc(100% - ${DRAWER_WIDTH_CLAMP})` : '100%',
            transition: 'width 0.225s cubic-bezier(0.0, 0, 0.2, 1) 0ms', // MUI's default transition
          }}
        >
          <Typography variant="h4" gutterBottom sx={{ textAlign: 'center', flexShrink: 0, px: 2, pt: 2 }}>
            AI SQL Chat Assistant
          </Typography>

          {error && !chatMessages.find(m => m.type === 'error') && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1, flexShrink: 0, mx: 2 }}>
              {error}
            </Alert>
          )}

          <Paper elevation={2} sx={{ p: 2, mb: 2, flexShrink: 0, mx: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item={true} xs={12} md={4}>
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
              <Grid item={true} xs={12} md={8}>
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
                      label="Relevant Tables (Optional - uses all if empty)"
                      placeholder="e.g., dataset.table (or leave blank to use all from connection)"
                    />
                  )}
                  disabled={!selectedConfigId}
                />
                <FormControl fullWidth sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ pl: 1.5, pr: 1.5, textAlign: 'left' }}>
                    If left blank, the AI will use schema descriptions from all tables saved under the selected configuration.
                  </Typography>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          <Box
            ref={chatContainerRef}
            sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 1, sm: 2 }, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, backgroundColor: 'action.hover', mx: 2 }}
          >
            {chatMessages.map((msg) => (
              <Paper
                key={msg.id}
                elevation={msg.type === 'user' ? 1 : 3}
                sx={{
                  p: 1.5, mb: 1.5,
                  bgcolor: msg.type === 'user' ? 'primary.light' : (msg.type === 'error' ? 'error.main' : 'background.paper'),
                  color: msg.type === 'user' ? 'primary.contrastText' : (msg.type === 'error' ? 'error.contrastText' : 'text.primary'),
                  ml: msg.type === 'ai' || msg.type === 'system' || msg.type === 'error' ? 0 : 'auto',
                  mr: msg.type === 'user' ? 0 : 'auto',
                  maxWidth: '85%', minWidth: '20%',
                  borderRadius: msg.type === 'user' ? '10px 10px 0 10px' : '10px 10px 10px 0',
                  position: 'relative', // For icon positioning later
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.sql && msg.content.startsWith("Generated SQL:") ? msg.content.substring(0, msg.content.indexOf(msg.sql)).trim() : msg.content}
                </Typography>
                {msg.sql && <CodeBlock sql={msg.sql} />}
                {msg.isDryRunLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <CircularProgress size={16} sx={{ mr: 1, color: msg.type === 'user' ? 'inherit' : 'primary.main' }} />
                    <Typography variant="caption" sx={{ color: msg.type === 'user' ? 'inherit' : 'text.secondary' }}>Performing dry run...</Typography>
                  </Box>
                )}
                {msg.type === 'user' && msg.fullRequestText && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setRequestPanelContent(msg.fullRequestText || ''); // Set content
                      setShowRequestPanel(true); // Show panel
                    }}
                    sx={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      color: 'primary.contrastText', // Ensure visibility on user message background
                    }}
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                )}
              </Paper>
            ))}
          </Box>

          <Box component="form" sx={{ display: 'flex', gap: 1, alignItems: 'stretch', flexShrink: 0, px: 2, pb: 2 }} onSubmit={(e) => { e.preventDefault(); handleSubmitRequest(); }}>
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
        </Box>

        {/* Request Display Panel (Drawer) */}
        <Drawer
          anchor="right"
          open={showRequestPanel}
          onClose={() => setShowRequestPanel(false)}
          variant="persistent"
          PaperProps={{
            sx: {
              width: DRAWER_WIDTH_CLAMP,
              p: 2,
              boxSizing: 'border-box',
              height: '100%', // Fills the flex parent's height (Container)
              position: 'relative', // Important for persistent drawer in flex layout
              borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            }
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">Full User Request</Typography>
            <IconButton onClick={() => setShowRequestPanel(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
          <Paper elevation={0} sx={{ p: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', flexGrow: 1, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, height: 'calc(100% - 48px)' /* Approx height of header */ }}>
            {requestPanelContent}
          </Paper>
        </Drawer>
      </Container>
  );
};

export default AIChatPage;
