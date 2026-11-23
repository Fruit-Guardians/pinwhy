import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';
import { ThemeProvider } from './lib/theme.jsx';
import { RouteProvider, useRoute } from './router.jsx';
import { LangProvider } from './i18n.jsx';
import { ToastProvider } from './shared.jsx';
import SiteLayout from './layout/SiteLayout.jsx';
import HomePage from './pages/Home.jsx';
import SecurityPage from './pages/Security.jsx';
import DshPage from './pages/Dsh.jsx';

function Page() {
  const { page } = useRoute();

  return (
    <SiteLayout>
      {page === 'security' ? <SecurityPage /> : page === 'dsh' ? <DshPage /> : <HomePage />}
    </SiteLayout>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <RouteProvider>
        <LangProvider>
          <ToastProvider>
            <Page />
          </ToastProvider>
        </LangProvider>
      </RouteProvider>
    </ThemeProvider>
  </StrictMode>,
);
