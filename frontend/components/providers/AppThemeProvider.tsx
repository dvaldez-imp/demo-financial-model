"use client";

import {
  ThemeProvider,
  createTheme,
  responsiveFontSizes,
} from "@mui/material/styles";
import { CssBaseline } from "@mui/material";

const baseTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#003865",
      light: "#1F5A8C",
      dark: "#002C50",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#FC4C02",
      light: "#FF814C",
      dark: "#D63D00",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#05A53C",
    },
    warning: {
      main: "#FFAC12",
    },
    error: {
      main: "#B71414",
    },
    info: {
      main: "#3781CE",
    },
    background: {
      default: "#F6F6F6",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#151515",
      secondary: "#737373",
    },
    divider: "#D2D2D2",
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: "var(--font-poppins), sans-serif",
    h1: {
      fontSize: "2.25rem",
      fontWeight: 700,
      lineHeight: 1.1,
    },
    h2: {
      fontSize: "1.75rem",
      fontWeight: 700,
      lineHeight: 1.15,
    },
    h3: {
      fontSize: "1.25rem",
      fontWeight: 600,
      lineHeight: 1.2,
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.6,
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          colorScheme: "light",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 600,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 46,
          borderRadius: 14,
          fontWeight: 600,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 20,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 600,
        },
      },
    },
  },
});

const theme = responsiveFontSizes(baseTheme);

type AppThemeProviderProps = {
  children: React.ReactNode;
};

export default function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
