import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Button, CircularProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField } from '@mui/material';
import { pharmacyService, pharmacyError, pharmacyLabel } from '../../services/pharmacyService';
export function usePharmacyList(resource, mode) {
  const location = useLocation(); const request = useRef(0);
  const [rows, setRows] = useState([]); const [page, setPage] = useState(0); const [size, setSize] = useState(10); const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(new URLSearchParams(location.search).get('search') || ''); const [query, setQuery] = useState(search);
  const [filters, setFilters] = useState({}); const [sort, setSort] = useState(resource === 'medicines' ? 'name' : 'id'); const [direction, setDirection] = useState(resource === 'medicines' ? 'asc' : 'desc');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => {
    const id = ++request.current; setLoading(true);
    try { const response = await pharmacyService.list(resource, { mode, search: query, page: page + 1, per_page: size, sort, direction, ...filters }); if (id === request.current) { setRows(response.data.data); setTotal(response.data.meta?.total ?? response.data.total); setError(''); } }
    catch (err) { if (id === request.current) { setError(pharmacyError(err)); setRows([]); setTotal(0); } }
    finally { if (id === request.current) setLoading(false); }
  }, [resource, mode, query, page, size, sort, direction, filters]);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => { ++request.current; clearInterval(timer); }; }, [load]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { setSearch(new URLSearchParams(location.search).get('search') || ''); }, [location.search]);
  const filter = (key, value) => { setFilters((previous) => ({ ...previous, [key]: value || undefined })); setPage(0); };
  return { rows, page, setPage, size, setSize, total, search, setSearch, filters, filter, sort, setSort, direction, setDirection, loading, error, setError, load };
}
export function PharmacyFilters({ state, statuses = [], dates = true, inventory = false, movements = false }) {
  return <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, '& > .MuiTextField-root': { width: { xs: '100%', sm: 185 } } }}>
    <TextField size="small" label="Search records" value={state.search} onChange={(event) => state.setSearch(event.target.value)} />
    {statuses.length > 0 && <TextField select size="small" label="Status" value={state.filters.status || ''} onChange={(event) => state.filter('status', event.target.value)}><MenuItem value="">All statuses</MenuItem>{statuses.map((status) => <MenuItem key={status} value={status}>{pharmacyLabel(status)}</MenuItem>)}</TextField>}
    {inventory && <TextField select size="small" label="Stock alert" value={state.filters.filter || ''} onChange={(event) => state.filter('filter', event.target.value)}><MenuItem value="">All medicines</MenuItem>{['low_stock', 'expired', 'expiring'].map((value) => <MenuItem key={value} value={value}>{value === 'expiring' ? 'Expires within 30 days' : pharmacyLabel(value)}</MenuItem>)}</TextField>}
    {movements && <TextField select size="small" label="Movement type" value={state.filters.movement_type || ''} onChange={(event) => state.filter('movement_type', event.target.value)}><MenuItem value="">All movements</MenuItem>{['addition','deduction','dispensing','adjustment','expired'].map((value) => <MenuItem key={value} value={value}>{pharmacyLabel(value)}</MenuItem>)}</TextField>}
    {dates && ['start_date','end_date'].map((key) => <TextField key={key} size="small" type="date" label={key === 'start_date' ? 'From date' : 'To date'} value={state.filters[key] || ''} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => state.filter(key, event.target.value)} />)}
    <Button onClick={state.load}>Refresh</Button>
  </Stack>;
}
export default function PharmacyTable({ state, columns, title }) {
  return <Paper variant="outlined" sx={{ width: '100%', overflow: 'hidden', minWidth: 0 }}><TableContainer><Table size="small" aria-label={title}>
    <TableHead><TableRow>{columns.map((column) => <TableCell key={column.key}>{column.sort ? <TableSortLabel active={state.sort === column.key} direction={state.sort === column.key ? state.direction : 'asc'} onClick={() => { state.setSort(column.key); state.setDirection(state.sort === column.key && state.direction === 'asc' ? 'desc' : 'asc'); state.setPage(0); }}>{column.label}</TableSortLabel> : column.label}</TableCell>)}</TableRow></TableHead>
    <TableBody>{state.loading ? <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow> : state.rows.length === 0 ? <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 5 }}>No records found.</TableCell></TableRow> : state.rows.map((row) => <TableRow key={row.id} hover>{columns.map((column) => <TableCell key={column.key} sx={{ minWidth: column.key === 'actions' ? 110 : undefined }}>{column.render ? column.render(row) : row[column.key] ?? '—'}</TableCell>)}</TableRow>)}</TableBody>
  </Table></TableContainer><Box sx={{ overflowX: 'auto' }}><TablePagination component="div" count={state.total} page={state.page} rowsPerPage={state.size} rowsPerPageOptions={[10,25,50,100]} onPageChange={(_, value) => state.setPage(value)} onRowsPerPageChange={(event) => { state.setSize(Number(event.target.value)); state.setPage(0); }} /></Box></Paper>;
}
