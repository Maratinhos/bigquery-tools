import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface CodeBlockProps {
  sql: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ sql }) => (
  <Paper elevation={1} sx={{
    p: 1.5,
    mt: 1,
    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
    color: (theme) => theme.palette.text.primary,
    overflowX: 'auto',
    border: (theme) => `1px solid ${theme.palette.divider}`
  }}>
    <Typography component="pre" sx={{
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all', // Ensure long strings without spaces wrap
      fontFamily: 'monospace',
      fontSize: '0.875rem'
    }}>
      {sql}
    </Typography>
  </Paper>
);

export default CodeBlock;
