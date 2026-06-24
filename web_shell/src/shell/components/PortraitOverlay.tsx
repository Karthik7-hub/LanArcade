import React from 'react';
import { Smartphone, RotateCw } from 'lucide-react';

const PortraitOverlay: React.FC = () => (
  <div className="portrait-overlay">
    <div className="portrait-overlay-icon-wrap">
      <Smartphone className="phone-icon" />
      <RotateCw className="rotate-icon" />
    </div>
    <div className="portrait-overlay-title">Landscape Mode Required</div>
    <div className="portrait-overlay-text">
      Please rotate your device to landscape for the best gaming interface.
    </div>
  </div>
);

export default PortraitOverlay;
