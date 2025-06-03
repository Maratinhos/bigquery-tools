import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { format } from 'sql-formatter';

interface CodeBlockProps {
  sql: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ sql }) => {
  const [showCopyMessage, setShowCopyMessage] = useState(false);
  const formattedSql = format(sql, { language: 'bigquery', keywordCase: 'lower' });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedSql);
      setShowCopyMessage(true);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <Paper elevation={1} sx={{
      p: 1.5,
      mt: 1,
    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
    color: (theme) => theme.palette.text.primary,
    overflowX: 'auto',
      border: (theme) => `1px solid ${theme.palette.divider}`,
      position: 'relative', // For positioning the copy button
  }}>
      <IconButton
        onClick={handleCopy}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          color: (theme) => theme.palette.action.active,
        }}
        aria-label="copy sql to clipboard"
      >
        <ContentCopyIcon />
      </IconButton>
    <Typography component="pre" sx={{
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all', // Ensure long strings without spaces wrap
        paddingRight: '40px', // Ensure text does not overlap with copy button
      fontFamily: 'monospace',
      fontSize: '0.875rem'
    }}>
      {formattedSql}
    </Typography>
    <Snackbar
      open={showCopyMessage}
      autoHideDuration={2000}
      onClose={() => setShowCopyMessage(false)}
      message="Copied!"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
  </Paper>
  );
};

export default CodeBlock;
