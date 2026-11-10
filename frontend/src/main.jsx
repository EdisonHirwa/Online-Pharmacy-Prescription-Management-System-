import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeModeProvider } from './contexts/ThemeContext';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeModeProvider>
      <App />
    </ThemeModeProvider>
  </StrictMode>,
);
