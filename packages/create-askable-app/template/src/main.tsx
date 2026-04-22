import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CopilotKit } from '@copilotkit/react-core';
import '@copilotkit/react-ui/styles.css';
import './styles.css';
import App from './App';

const runtimeUrl = import.meta.env.VITE_COPILOT_RUNTIME_URL ?? 'http://localhost:3001/api/copilotkit';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopilotKit runtimeUrl={runtimeUrl}>
      <App />
    </CopilotKit>
  </StrictMode>,
);
