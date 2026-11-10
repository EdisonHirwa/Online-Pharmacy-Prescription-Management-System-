import { createTheme } from '@mui/material/styles';
import { getPalette, brandColors } from './palette';

const createHospitalTheme = (mode = 'light') => {
  const palette = getPalette(mode);
  const isLight = mode === 'light';

  return createTheme({
    palette,
    shape: {
      borderRadius: 10, // 8-12px as requested
    },
    spacing: 8, // 8px grid
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      h1: {
        fontSize: '2rem',
        fontWeight: 700,
        color: palette.text.primary,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: '1.75rem',
        fontWeight: 700,
        color: palette.text.primary,
        letterSpacing: '-0.015em',
      },
      h3: {
        fontSize: '1.5rem',
        fontWeight: 600,
        color: palette.text.primary,
        letterSpacing: '-0.01em',
      },
      h4: {
        fontSize: '1.25rem',
        fontWeight: 600,
        color: palette.text.primary,
      },
      h5: {
        fontSize: '1.125rem',
        fontWeight: 600,
        color: palette.text.primary,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
        color: palette.text.primary,
      },
      subtitle1: {
        fontSize: '0.9375rem',
        fontWeight: 500,
        color: palette.text.secondary,
      },
      subtitle2: {
        fontSize: '0.8125rem',
        fontWeight: 500,
        color: palette.text.secondary,
      },
      body1: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
        color: palette.text.primary,
      },
      body2: {
        fontSize: '0.8125rem',
        lineHeight: 1.45,
        color: palette.text.secondary,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.875rem',
      },
      caption: {
        fontSize: '0.75rem',
        color: palette.text.secondary,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            boxSizing: 'border-box',
          },
          body: {
            backgroundColor: palette.background.default,
            color: palette.text.primary,
            scrollBehavior: 'smooth',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
            transition: 'all 0.15s ease-in-out',
            '&:focus-visible': {
              outline: `2px solid ${brandColors.teal.main}`,
              outlineOffset: '2px',
            },
          },
          containedPrimary: {
            backgroundColor: brandColors.teal.main,
            color: '#FFFFFF',
            '&:hover': {
              backgroundColor: brandColors.teal[700],
            },
          },
          containedSecondary: {
            backgroundColor: brandColors.navy.main,
            color: '#FFFFFF',
            '&:hover': {
              backgroundColor: brandColors.navy[700],
            },
          },
          outlinedPrimary: {
            borderColor: brandColors.teal.main,
            color: brandColors.teal.main,
            '&:hover': {
              borderColor: brandColors.teal[700],
              backgroundColor: brandColors.teal[50],
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: palette.background.paper,
            border: `1px solid ${palette.divider}`,
            boxShadow: isLight
              ? '0 1px 3px rgba(18, 38, 63, 0.05), 0 10px 15px -5px rgba(18, 38, 63, 0.04)'
              : '0 4px 12px rgba(0, 0, 0, 0.35)',
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          rounded: {
            borderRadius: 12,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: palette.background.tableHeader,
            '& .MuiTableCell-head': {
              backgroundColor: palette.background.tableHeader,
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.8125rem',
              letterSpacing: '0.02em',
              borderBottom: 'none',
              padding: '12px 16px',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${palette.divider}`,
            padding: '12px 16px',
            fontSize: '0.875rem',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-child td': {
              borderBottom: 0,
            },
            '&:hover': {
              backgroundColor: isLight ? brandColors.navy[50] : 'rgba(255, 255, 255, 0.04)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 500,
            fontSize: '0.75rem',
            height: 26,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: palette.divider,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: brandColors.teal.main,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: brandColors.teal.main,
              borderWidth: 2,
            },
          },
          input: {
            padding: '10px 14px',
            fontSize: '0.875rem',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: palette.background.appBar,
            color: palette.text.primary,
            borderBottom: `1px solid ${palette.divider}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: palette.background.sidebar,
            borderRight: `1px solid ${palette.divider}`,
          },
        },
      },
    },
  });
};

export const lightTheme = createHospitalTheme('light');
export const darkTheme = createHospitalTheme('dark');
export default createHospitalTheme;
