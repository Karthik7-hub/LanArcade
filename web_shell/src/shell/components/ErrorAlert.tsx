import React from 'react';
import { AlertCircle } from 'lucide-react';
import { clearRoomFromUrl } from '../WebSocketClient';

interface ErrorAlertProps {
  message: string | null;
  onDismiss: () => void;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div className="error-alert-overlay">
      <div className="error-alert-card">
        <div className="error-alert-header">
          <AlertCircle size={24} className="text-danger" />
          <h4 className="error-alert-title">SYSTEM ALERT</h4>
        </div>
        <p className="error-alert-text">{message}</p>
        <button onClick={() => {
          if (message && message.toLowerCase().includes('room not found')) {
            clearRoomFromUrl();
          }
          onDismiss();
        }} className="error-alert-btn">
          DISMISS
        </button>
      </div>
    </div>
  );
};

export default ErrorAlert;
