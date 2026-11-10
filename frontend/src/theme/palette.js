/**
 * Brand Design System - 3 Colors Only:
 * 1. PRIMARY   - Medical Teal   #0E7C86
 * 2. SECONDARY - Deep Navy      #12263F
 * 3. ACCENT    - Coral          #F4795B
 *
 * All other variations are strictly tints and shades of these three colors,
 * plus white (#FFFFFF) and near-black (#08101A).
 * No foreign hues (green, yellow, purple, blue, orange) anywhere.
 */

export const brandColors = {
  // 1. PRIMARY: Medical Teal
  teal: {
    50: '#EAF6F7',
    100: '#D0ECEE',
    200: '#A1D9DD',
    300: '#72C5CB',
    400: '#3AB0B9',
    main: '#0E7C86',
    600: '#0C6C75',
    700: '#0A5961',
    800: '#07454B',
    dark: '#053135',
    contrastText: '#FFFFFF',
  },

  // 2. SECONDARY: Deep Navy
  navy: {
    50: '#F0F3F7',
    100: '#DCE2EB',
    200: '#BAC5D5',
    300: '#8E9FB7',
    400: '#546B89',
    main: '#12263F',
    600: '#0F2035',
    700: '#0C1B2D',
    800: '#091523',
    dark: '#060D17',
    contrastText: '#FFFFFF',
  },

  // 3. ACCENT: Coral
  coral: {
    50: '#FDF2EF',
    100: '#FBE0D9',
    200: '#F7C1B3',
    300: '#F49E8A',
    400: '#F5866D',
    main: '#F4795B',
    600: '#DB6245',
    700: '#B84C33',
    800: '#943721',
    dark: '#702413',
    contrastText: '#FFFFFF',
  },

  // Pure Neutrals derived strictly from Navy & White
  neutral: {
    white: '#FFFFFF',
    black: '#08101A',
    surfaceLight: '#F8FAFC',
    borderLight: 'rgba(18, 38, 63, 0.12)',
    borderDark: 'rgba(255, 255, 255, 0.14)',
  },

  // Chart dedicated tokens using only the 3 brand colors & their tints
  charts: {
    series1: '#0E7C86', // Medical Teal
    series2: '#12263F', // Deep Navy
    series3: '#F4795B', // Coral
    series4: '#72C5CB', // Teal Tint
    series5: '#8E9FB7', // Navy Tint
    series6: '#F7C1B3', // Coral Tint
    grid: 'rgba(18, 38, 63, 0.08)',
    gridDark: 'rgba(255, 255, 255, 0.08)',
  },
};

/**
 * Palette generator for MUI themes.
 * Error, warning, info, and success are mapped strictly to Coral and Teal tints.
 */
export const getPalette = (mode = 'light') => {
  const isLight = mode === 'light';

  return {
    mode,
    primary: {
      light: brandColors.teal[300],
      main: brandColors.teal.main,
      dark: brandColors.teal.dark,
      contrastText: brandColors.teal.contrastText,
    },
    secondary: {
      light: isLight ? brandColors.navy[300] : brandColors.navy[200],
      main: brandColors.navy.main,
      dark: brandColors.navy.dark,
      contrastText: brandColors.navy.contrastText,
    },
    // Map standard MUI feedback to Coral (Accent) and Teal (Primary) tints
    error: {
      light: brandColors.coral[100],
      main: brandColors.coral.main,
      dark: brandColors.coral.dark,
      contrastText: brandColors.coral.contrastText,
    },
    warning: {
      // Mapped to soft Coral tint instead of yellow/orange
      light: brandColors.coral[50],
      main: brandColors.coral[400],
      dark: brandColors.coral[700],
      contrastText: brandColors.coral.contrastText,
    },
    info: {
      // Mapped to Navy / Teal tint instead of blue
      light: brandColors.navy[100],
      main: brandColors.navy[400],
      dark: brandColors.navy[700],
      contrastText: brandColors.navy.contrastText,
    },
    success: {
      // Mapped to Medical Teal instead of green
      light: brandColors.teal[100],
      main: brandColors.teal.main,
      dark: brandColors.teal[700],
      contrastText: brandColors.teal.contrastText,
    },
    background: isLight
      ? {
          default: brandColors.neutral.surfaceLight,
          paper: brandColors.neutral.white,
          sidebar: brandColors.neutral.white,
          appBar: brandColors.neutral.white,
          tableHeader: brandColors.navy.main,
          cardAlt: brandColors.navy[50],
        }
      : {
          default: brandColors.navy.dark, // #060D17
          paper: brandColors.navy.main,   // #12263F
          sidebar: brandColors.navy[700],
          appBar: brandColors.navy[800],
          tableHeader: brandColors.navy[800],
          cardAlt: brandColors.navy[600],
        },
    text: isLight
      ? {
          primary: brandColors.navy.main,
          secondary: brandColors.navy[400],
          disabled: brandColors.navy[200],
        }
      : {
          primary: '#FFFFFF',
          secondary: brandColors.navy[100],
          disabled: brandColors.navy[300],
        },
    divider: isLight ? brandColors.neutral.borderLight : brandColors.neutral.borderDark,
    action: isLight
      ? {
          active: brandColors.navy.main,
          hover: 'rgba(14, 124, 134, 0.08)',
          selected: 'rgba(14, 124, 134, 0.14)',
          disabled: brandColors.navy[200],
          disabledBackground: brandColors.navy[50],
        }
      : {
          active: '#FFFFFF',
          hover: 'rgba(255, 255, 255, 0.08)',
          selected: 'rgba(14, 124, 134, 0.25)',
          disabled: brandColors.navy[400],
          disabledBackground: brandColors.navy[800],
        },
    // Custom brand accessors
    custom: {
      teal: brandColors.teal,
      navy: brandColors.navy,
      coral: brandColors.coral,
      charts: brandColors.charts,
    },
  };
};

export default brandColors;
