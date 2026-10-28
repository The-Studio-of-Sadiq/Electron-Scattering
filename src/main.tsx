import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installLocalApiFallback} from './utils/localApiFallback';
import './index.css';

// Serve /api/* in the browser when no Express backend is present (static hosting).
installLocalApiFallback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
