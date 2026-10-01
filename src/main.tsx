import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import App from './App';
// Bangla face bundled with the app (Bengali subset only, loaded from disk —
// no network). Windows 7 has no Nirmala UI; see globals.css.
import '@fontsource/noto-sans-bengali/bengali-400.css';
import '@fontsource/noto-sans-bengali/bengali-500.css';
import '@fontsource/noto-sans-bengali/bengali-600.css';
import '@fontsource/noto-sans-bengali/bengali-700.css';
import './styles/globals.css';
import { installWheelBoost } from './lib/wheelBoost';
import { installScreenErrorLog } from './lib/errorLog';

// Linux only: Chromium scrolls half as far per wheel notch there as on Windows.
installWheelBoost();
// Uncaught screen errors go to the app's log file (the installed app has no console).
installScreenErrorLog();

// One shared client, so writes outside React Query can refresh it (src/lib/queryClient.ts).

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
