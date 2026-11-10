import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Divider,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  CheckCircle as PaidIcon,
} from '@mui/icons-material';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export const BillingPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [paymentError, setPaymentError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  useEffect(() => {
    axiosInstance.get('/invoices').then((res) => {
      setInvoices(res.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleOpenPay = (inv) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.outstanding_balance.toString());
    setPaymentError('');
    setPaymentDialogOpen(true);
  };

  const handleProcessPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('Payment amount must be a positive number.');
      return;
    }
    if (amount > selectedInvoice.outstanding_balance) {
      setPaymentError(`Payment amount ($${amount}) cannot exceed the outstanding invoice balance ($${selectedInvoice.outstanding_balance.toFixed(2)}).`);
      return;
    }

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === selectedInvoice.id) {
          const newPaid = inv.amount_paid + amount;
          const newBal = inv.total_amount - newPaid;
          const newStatus = newBal <= 0 ? 'paid' : 'partially_paid';
          return {
            ...inv,
            amount_paid: newPaid,
            outstanding_balance: Math.max(0, newBal),
            status: newStatus,
          };
        }
        return inv;
      })
    );

    setSuccessToast(`Payment of $${amount.toFixed(2)} processed via ${paymentMethod.replace('_', ' ')}.`);
    setPaymentDialogOpen(false);
  };

  const totalBilled = invoices.reduce((acc, i) => acc + i.total_amount, 0);
  const totalReceived = invoices.reduce((acc, i) => acc + i.amount_paid, 0);
  const totalOutstanding = invoices.reduce((acc, i) => acc + i.outstanding_balance, 0);

  const columns = [
    { id: 'invoice_number', label: 'Invoice No.', render: (r) => <strong>{r.invoice_number}</strong> },
    { id: 'patient_name', label: 'Patient Name' },
    { id: 'total_amount', label: 'Total Billed', render: (r) => `$${r.total_amount.toFixed(2)}` },
    { id: 'amount_paid', label: 'Amount Paid', render: (r) => `$${r.amount_paid.toFixed(2)}` },
    {
      id: 'outstanding_balance',
      label: 'Balance Due',
      render: (r) => (
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: r.outstanding_balance > 0 ? brandColors.coral.main : brandColors.teal.main,
          }}
        >
          ${r.outstanding_balance.toFixed(2)}
        </Typography>
      ),
    },
    { id: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
    {
      id: 'actions',
      label: 'Action',
      render: (r) =>
        r.outstanding_balance > 0 ? (
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={() => handleOpenPay(r)}
            sx={{ textTransform: 'none', py: 0.4, fontSize: '0.75rem' }}
          >
            Process Payment
          </Button>
        ) : (
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>Settled in Full</Typography>
        ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Hospital Billing & Payment Collections
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Manage patient invoices, itemized service breakdowns, and cash/card/mobile money receipts.
        </Typography>
      </Box>

      {successToast && (
        <Alert
          severity="success"
          onClose={() => setSuccessToast('')}
          sx={{ bgcolor: brandColors.teal[50], color: brandColors.teal.main, border: `1px solid ${brandColors.teal[200]}` }}
        >
          {successToast}
        </Alert>
      )}

      {/* KPI Row */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={4}>
          <DashboardCard
            title="Total Revenue Billed"
            value={`$${totalBilled.toFixed(2)}`}
            icon={<ReceiptIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <DashboardCard
            title="Total Collections Received"
            value={`$${totalReceived.toFixed(2)}`}
            icon={<PaidIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <DashboardCard
            title="Total Outstanding Balances"
            value={`$${totalOutstanding.toFixed(2)}`}
            variant="inverted"
          />
        </Grid>
      </Grid>

      {/* Invoices DataTable */}
      <DataTable
        title="Patient Billing Ledgers"
        columns={columns}
        data={invoices}
        loading={loading}
        footerCaption="Invoices cannot be deleted from the UI per regulatory audit requirements. All payment entries generate an immutable receipt."
      />

      {/* Process Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Record Payment: {selectedInvoice?.invoice_number}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Patient: <strong>{selectedInvoice?.patient_name}</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Outstanding Balance: <strong>${selectedInvoice?.outstanding_balance.toFixed(2)}</strong>
          </Typography>

          <Divider />

          <TextField
            fullWidth
            type="number"
            label="Payment Amount ($)"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            error={Boolean(paymentError)}
            helperText={paymentError}
          />

          <TextField
            select
            fullWidth
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <MenuItem value="mobile_money">Mobile Money (MTN / Airtel)</MenuItem>
            <MenuItem value="card">Credit / Debit Card</MenuItem>
            <MenuItem value="cash">Hospital Cashier Counter</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setPaymentDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" color="primary" onClick={handleProcessPayment}>
            Confirm Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingPage;
