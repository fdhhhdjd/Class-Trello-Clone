import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AuthProvider, ToastProvider, ConfirmProvider, ThemeProvider, GlobalStyles,
} from '@trello/ui';
import { api } from './lib/api';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <GlobalStyles />
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <AuthProvider api={api}>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);
