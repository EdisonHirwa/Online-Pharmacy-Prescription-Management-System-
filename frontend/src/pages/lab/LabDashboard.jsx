import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import {
  Biotech as BiotechIcon,
  CheckCircle as CheckCircleIcon,
  HourglassTop as HourglassIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export const LabDashboard = () => {
  const [labTests, setLabTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resultSummary, setResultSummary] = useState('');
  const [fileError, setFileError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    axiosInstance.get('/lab-tests').then((res) => {
      setLabTests(res.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleOpenProcess = (test) => {
    setSelectedTest(test);
    setResultSummary(test.result_summary || '');
    setSelectedFile(null);
    setFileError('');
    setDialogOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type: PDF, JPEG, PNG only
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setFileError('Invalid file format. Only PDF, JPEG, and PNG files are accepted.');
      return;
    }

    // Validate size: max 2MB
    if (file.size > 2 * 1024 * 1024) {
      setFileError('File size exceeds the 2MB limit. Please upload a compressed document.');
      return;
    }

    setFileError('');
    setSelectedFile(file);
  };

  const handleSaveResult = () => {
    if (!resultSummary.trim()) {
      alert('Please enter a clinical test result summary.');
      return;
    }

    setLabTests((prev) =>
      prev.map((t) =>
        t.id === selectedTest.id
          ? {
              ...t,
              status: 'completed',
              result_summary: resultSummary,
              reports: selectedFile
                ? [{ id: Date.now(), file_name: selectedFile.name, file_type: selectedFile.type, file_size: selectedFile.size }]
                : t.reports,
            }
          : t
      )
    );
    setDialogOpen(false);
  };

  const columns = [
    { id: 'id', label: 'Test ID', render: (r) => <strong>#{r.id}</strong> },
    { id: 'patient_name', label: 'Patient Name' },
    { id: 'test_type_name', label: 'Investigation Type' },
    { id: 'doctor_name', label: 'Requested By' },
    { id: 'request_date', label: 'Requested At', render: (r) => new Date(r.request_date).toLocaleDateString() },
    { id: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
    {
      id: 'actions',
      label: 'Action',
      render: (r) => (
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={() => handleOpenProcess(r)}
          sx={{ textTransform: 'none', py: 0.4, fontSize: '0.75rem' }}
        >
          {r.status === 'completed' ? 'Update Findings' : 'Process & Upload'}
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* KPI Row */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Total Investigations"
            value={labTests.length.toString()}
            icon={<BiotechIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Processing Tests"
            value={labTests.filter((t) => t.status === 'processing').length.toString()}
            icon={<HourglassIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Completed Tests"
            value={labTests.filter((t) => t.status === 'completed').length.toString()}
            icon={<CheckCircleIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Avg Turnaround"
            value="2.4 hrs"
            subtitle="Within expected hospital limits"
          />
        </Grid>
      </Grid>

      {/* Investigation Queue */}
      <DataTable
        title="Laboratory Test Queue & Diagnostic Intake"
        columns={columns}
        data={labTests}
        loading={loading}
        footerCaption="Authorized technicians can record quantitative laboratory results and attach signed report attachments."
      />

      {/* Process & Upload Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Process Test: {selectedTest?.test_type_name}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Patient: <strong>{selectedTest?.patient_name}</strong> | Requested by: <strong>{selectedTest?.doctor_name}</strong>
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Diagnostic Findings & Parameter Values"
            placeholder="Enter clinical observations, numerical counts, reference comparisons..."
            value={resultSummary}
            onChange={(e) => setResultSummary(e.target.value)}
          />

          <Box
            sx={{
              p: 2.5,
              border: '2px dashed',
              borderColor: fileError ? brandColors.coral.main : 'divider',
              borderRadius: 2,
              textAlign: 'center',
              bgcolor: 'action.hover',
            }}
          >
            <UploadIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Attach Diagnostic Report Document
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
              Accepted formats: PDF, JPEG, PNG (Strict limit: 2MB)
            </Typography>

            <input
              type="file"
              accept=".pdf,image/jpeg,image/png"
              id="lab-report-file"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <label htmlFor="lab-report-file">
              <Button variant="outlined" component="span" size="small" sx={{ borderColor: 'primary.main', color: 'primary.main' }}>
                Browse File
              </Button>
            </label>

            {selectedFile && (
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, color: 'primary.main' }}>
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </Typography>
            )}
          </Box>

          {fileError && (
            <Alert
              severity="error"
              sx={{ bgcolor: brandColors.coral[50], color: brandColors.coral.main, border: `1px solid ${brandColors.coral[200]}` }}
            >
              {fileError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" color="primary" onClick={handleSaveResult}>
            Complete & Sign Off Test
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LabDashboard;
