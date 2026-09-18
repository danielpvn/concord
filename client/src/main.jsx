import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { VoiceProvider } from './context/VoiceContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SocketProvider>
        <VoiceProvider>
          <App />
        </VoiceProvider>
      </SocketProvider>
    </AuthProvider>
  </React.StrictMode>
);
