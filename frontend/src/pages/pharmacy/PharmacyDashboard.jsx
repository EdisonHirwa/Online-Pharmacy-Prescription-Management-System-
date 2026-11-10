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
  Chip,
} from '@mui/material';
import {
  LocalPharmacy as PharmacyIcon,
  Warning as WarningIcon,
  Inventory as InventoryIcon,
  AssignmentTurnedIn as DispensedIcon,
} from '@mui/icons-material';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export const PharmacyDashboard = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispenseDialogOpen, setDispenseDialogOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [dispenseQty, setDispenseQty] = useState(1);
  const [dispenseError, setDispenseError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  useEffect(() => {
    axiosInstance.get('/medicines').then((res) => {
      setMedicines(res.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleOpenDispense = (med) => {
    setSelectedMed(med);
    setDispenseQty(1);
    setDispenseError('');
    setDispenseDialogOpen(true);
  };

  const handleConfirmDispense = () => {
    const qty = parseInt(dispenseQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setDispenseError('Dispense quantity must be a positive integer.');
      return;
    }
    if (qty > selectedMed.available_stock) {
      setDispenseError(`Cannot dispense ${qty} units. Only ${selectedMed.available_stock} available in current inventory stock.`);
      return;
    }

    // Deduct stock in local state
    setMedicines((prev) =>
      prev.map((m) =>
        m.id === selectedMed.id
          ? { ...m, available_stock: m.available_stock - qty }
          : m
      )
    );

    setSuccessToast(`Successfully dispensed ${qty} units of ${selectedMed.name}. Inventory stock updated.`);
    setDispenseDialogOpen(false);
  };

  const lowStockMeds = medicines.filter((m) => m.available_stock <= m.reorder_level);

  const columns = [
    { id: 'medicine_code', label: 'Code', render: (r) => <strong>{r.medicine_code}</strong> },
    { id: 'name', label: 'Medicine Name' },
    { id: 'category', label: 'Category' },
    {
      id: 'available_stock',
      label: 'Stock On Hand',
      render: (r) => {
        const isLow = r.available_stock <= r.reorder_level;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {r.available_stock} {r.unit}s
            </Typography>
            {isLow && (
              <Chip
                label="Low Stock"
                size="small"
                sx={{
                  bgcolor: brandColors.coral[50],
                  color: brandColors.coral.main,
                  border: `1px solid ${brandColors.coral[200]}`,
                  fontWeight: 700,
                  height: 20,
                  fontSize: '0.65rem',
                }}
              />
            )}
          </Box>
        );
      },
    },
    { id: 'unit_price', label: 'Unit Price', render: (r) => `$${Number(r.unit_price).toFixed(2)}` },
    { id: 'expiry_date', label: 'Expiry Date' },
    {
      id: 'actions',
      label: 'Actions',
      render: (r) => (
        <Button
          size="small"
          variant="contained"
          color="primary"
          disabled={r.available_stock === 0}
          onClick={() => handleOpenDispense(r)}
          sx={{ textTransform: 'none', py: 0.4, fontSize: '0.75rem' }}
        >
          Dispense
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Total Catalog Lines"
            value={medicines.length.toString()}
            icon={<InventoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Low-Stock Alerts"
            value={lowStockMeds.length.toString()}
            subtitle="Requires immediate warehouse requisition"
            variant="inverted"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Today's Dispensations"
            value="34"
            icon={<DispensedIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Pending e-Prescriptions"
            value="7"
            icon={<PharmacyIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
      </Grid>

      {/* Medicine Inventory DataTable */}
      <DataTable
        title="Pharmacy Formulary & Stock Management"
        columns={columns}
        data={medicines}
        loading={loading}
        footerCaption="Pharmacy dispensing strictly checks patient allergies, prescription limits, and prevents dispensing exceeding on-hand stock."
      />

      {/* Dispense Dialog */}
      <Dialog
        open={dispenseDialogOpen}
        onClose={() => setDispenseDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Dispense Medication
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Medication: <strong>{selectedMed?.name}</strong> ({selectedMed?.medicine_code})
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Available stock: <strong>{selectedMed?.available_stock} {selectedMed?.unit}s</strong>
          </Typography>

          <TextField
            fullWidth
            type="number"
            label={`Quantity to Dispense (${selectedMed?.unit}s)`}
            value={dispenseQty}
            onChange={(e) => setDispenseQty(e.target.value)}
            inputProps={{ min: 1, max: selectedMed?.available_stock }}
            error={Boolean(dispenseError)}
            helperText={dispenseError}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDispenseDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" color="primary" onClick={handleConfirmDispense}>
            Confirm Dispensation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PharmacyDashboard;
