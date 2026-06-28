import React from 'react';
import { Smartphone, RotateCw } from 'lucide-react';

interface PortraitOverlayProps {
  mode: 'portrait' | 'landscape';
}

const PortraitOverlay: React.FC<PortraitOverlayProps> = ({ mode }) => (
  <div className="portrait-overlay">
    <div className="portrait-overlay-icon-wrap">
      <Smartphone 
        className="phone-icon" 
        style={{ 
          transform: mode === 'landscape' ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 0.5s ease-in-out'
        }} 
      />
      <RotateCw className="rotate-icon" />
    </div>
    <div className="portrait-overlay-title">
      {mode === 'landscape' ? 'Landscape Mode Required' : 'Portrait Mode Required'}
    </div>
    <div className="portrait-overlay-text">
      {mode === 'landscape' 
        ? 'Please rotate your device to landscape for the best gaming interface.'
        : 'This game is designed for portrait mode. Please rotate your device.'}
    </div>
  </div>
);

export default PortraitOverlay;
