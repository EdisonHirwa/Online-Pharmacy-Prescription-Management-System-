import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
export default function ReportPreview({ file, name }) {
  const [url, setUrl] = useState('');
  useEffect(() => { if (!file) return; const value = URL.createObjectURL(file); setUrl(value); return () => URL.revokeObjectURL(value); }, [file]);
  if (!url) return null;
  return <Box sx={{ border: '1px solid', borderColor: 'divider', p: 1, borderRadius: 1 }}>
    <Typography variant="caption">Preview: {name}</Typography>
    {file.type.startsWith('image/') ? <Box component="img" src={url} alt={name} sx={{ display: 'block', maxWidth: '100%', maxHeight: 360, mx: 'auto' }} /> : <Box component="iframe" title={`Report preview: ${name}`} src={url} sx={{ width: '100%', height: 340, border: 0, display: 'block' }} />}
  </Box>;
}
