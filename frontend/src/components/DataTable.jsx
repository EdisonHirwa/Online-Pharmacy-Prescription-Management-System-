import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  TextField,
  InputAdornment,
  TablePagination,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { brandColors } from '../theme/palette';

export const DataTable = ({
  columns = [],
  data = [],
  title = null,
  searchPlaceholder = 'Search records...',
  loading = false,
  emptyMessage = 'No records found matching criteria.',
  footerCaption = null,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.id];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, columns, searchQuery]);

  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        overflow: 'hidden',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Table Header toolbar if title or search is present */}
      {(title || searchPlaceholder) && (
        <Box
          sx={{
            p: 2.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          {title && (
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main' }}>
              {title}
            </Typography>
          )}

          {searchPlaceholder && (
            <TextField
              size="small"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: '100%', sm: 260 },
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            />
          )}
        </Box>
      )}

      <TableContainer>
        <Table sx={{ minWidth: 650 }}>
          {/* Solid Deep Navy Header matching design reference image */}
          <TableHead>
            <TableRow sx={{ bgcolor: brandColors.navy.main }}>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align || 'left'}
                  sx={{
                    color: '#FFFFFF !important',
                    bgcolor: `${brandColors.navy.main} !important`,
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    letterSpacing: '0.02em',
                    py: 1.5,
                    borderBottom: 'none',
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <CircularProgress color="primary" size={32} />
                  <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
                    Loading hospital data...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, idx) => (
                <TableRow
                  hover
                  key={row.id || idx}
                  sx={{
                    '&:nth-of-type(even)': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id} align={col.align || 'left'}>
                      {col.render ? col.render(row) : row[col.id]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination & Footer */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5 }}>
        {footerCaption && (
          <Typography variant="caption" sx={{ color: 'text.secondary', pl: 1 }}>
            {footerCaption}
          </Typography>
        )}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ borderTop: 0 }}
        />
      </Box>
    </Paper>
  );
};

export default DataTable;
