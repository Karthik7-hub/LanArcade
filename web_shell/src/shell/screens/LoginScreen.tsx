import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { wsClient } from '../WebSocketClient';
import { resolveAvatarColor } from '../constants';

const LoginScreen: React.FC = () => {
  const [loginTab, setLoginTab] = useState<'create' | 'load' | 'scan'>('create');
  const [nameInput, setNameInput] = useState('');
  const [playerIdInput, setPlayerIdInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('indigo');

  // QR Code camera scanning
  useEffect(() => {
    if (loginTab !== 'scan') return;

    let scanner: Html5QrcodeScanner | null = null;
    try {
      scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: (width: number, height: number) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText: string) => {
          try {
            console.log('Decoded QR Text:', decodedText);
            let pid = decodedText;
            if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
              const url = new URL(decodedText);
              pid = url.searchParams.get('login_id') || url.searchParams.get('playerId') || decodedText;
            }
            if (pid && pid.trim().length > 10) {
              if (scanner) {
                scanner.clear().catch((err: unknown) => console.error('Failed to clear scanner', err));
              }
              const loadPlayer = { id: pid.trim(), name: '', avatar: 'default', isHost: false };
              wsClient.send('player.identify', loadPlayer);
            }
          } catch (e) {
            console.error('Failed to parse scanned QR content:', e);
          }
        },
        (_error: string) => { /* scanner error */ }
      );
    } catch (e) {
      console.error('Failed to initialize Html5QrcodeScanner:', e);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch((err: unknown) => console.error('Failed to clear scanner on cleanup', err));
      }
    };
  }, [loginTab]);

  const handleJoinPlatform = () => {
    if (loginTab === 'create') {
      if (nameInput.trim()) {
        const newPlayer = { id: '', name: nameInput.trim(), avatar: selectedAvatar, isHost: false };
        wsClient.send('player.identify', newPlayer);
      }
    } else {
      if (playerIdInput.trim()) {
        const loadPlayer = { id: playerIdInput.trim(), name: '', avatar: 'default', isHost: false };
        wsClient.send('player.identify', loadPlayer);
      }
    }
  };

  const tabStyle = (active: boolean) => ({
    flex: 1,
    background: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
    border: active ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
    color: active ? '#fff' : '#94a3b8',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 900 as const,
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'all 0.2s',
    boxShadow: active ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none',
  });

  return (
    <div className="full-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
      <div className="identity-panel">
        <div className="identity-brand-group">
          <img src="/logo.png" alt="LAN Arcade Logo" className="identity-logo" />
          <h1 className="identity-title">LAN ARCADE</h1>
          <p className="identity-subtitle">Zero-latency local multiplayer gaming portal</p>
        </div>

        <div className="identity-form-group">
          {/* Login Tabs Header */}
          <div className="login-tabs-header" style={{
            display: 'flex',
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            padding: '2px',
            marginBottom: '20px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            <button type="button" onClick={() => setLoginTab('create')} className={`login-tab-btn ${loginTab === 'create' ? 'active' : ''}`} style={tabStyle(loginTab === 'create')}>
              Create Profile
            </button>
            <button type="button" onClick={() => setLoginTab('load')} className={`login-tab-btn ${loginTab === 'load' ? 'active' : ''}`} style={tabStyle(loginTab === 'load')}>
              Reload Profile
            </button>
            <button type="button" onClick={() => setLoginTab('scan')} className={`login-tab-btn ${loginTab === 'scan' ? 'active' : ''}`} style={tabStyle(loginTab === 'scan')}>
              Scan QR
            </button>
          </div>

          {loginTab === 'create' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Username</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinPlatform()}
                  placeholder="Enter username"
                  className="identity-input"
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    color: '#fff',
                    padding: '12px 16px',
                    fontSize: '15px',
                    fontWeight: 700,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Avatar Color</label>
                <div className="avatar-color-picker" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedAvatar(c)}
                      className={`avatar-color-circle ${selectedAvatar === c ? 'active' : ''}`}
                      style={{
                        backgroundColor: resolveAvatarColor(c),
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        border: selectedAvatar === c ? '2.5px solid #fff' : '2.5px solid transparent',
                        cursor: 'pointer',
                        boxShadow: selectedAvatar === c ? `0 0 12px ${resolveAvatarColor(c)}` : 'none',
                        transition: 'all 0.2s',
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleJoinPlatform}
                className="primary-button identity-submit-btn"
                style={{
                  background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  padding: '14px 20px',
                  fontWeight: 900,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  marginTop: '8px',
                  width: '100%',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Create Character
              </button>
            </div>
          )}

          {loginTab === 'load' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Player ID</label>
                <input
                  type="text"
                  value={playerIdInput}
                  onChange={(e) => setPlayerIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinPlatform()}
                  placeholder="Paste Player ID UUID"
                  className="identity-input"
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    color: '#fff',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: 700,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <button
                onClick={handleJoinPlatform}
                className="primary-button identity-submit-btn"
                style={{
                  background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  padding: '14px 20px',
                  fontWeight: 900,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  marginTop: '8px',
                  width: '100%',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Load Profile
              </button>
            </div>
          )}

          {loginTab === 'scan' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Scan login QR code</label>
                <div className="qr-reader-container">
                  <div id="qr-reader" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
