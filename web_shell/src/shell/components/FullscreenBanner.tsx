import React from 'react';
import { X } from 'lucide-react';

interface FullscreenBannerProps {
  onRestore: () => void;
  onDismiss: () => void;
}

const FullscreenBanner: React.FC<FullscreenBannerProps> = ({ onRestore, onDismiss }) => (
  <div className="fs-recovery-banner">
    <span>Return to fullscreen?</span>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button onClick={onRestore} className="fs-recovery-banner-btn">
        YES
      </button>
      <button onClick={onDismiss} className="fs-recovery-banner-close-btn" title="Dismiss">
        <X size={14} />
      </button>
    </div>
  </div>
);

export default FullscreenBanner;
