import React, { useEffect, useState } from 'react';
import { useStore } from '../shell/store';
import { ArcadeSDK } from './ArcadeSDK';
import { wsClient } from '../shell/WebSocketClient';

const GameLoader: React.FC = () => {
    const { room, player } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
        };
    }, []);

    useEffect(() => {
        return () => {
            console.log('Cleaning up game sdk subscriptions...');
            ArcadeSDK.clearSubscriptions();
        };
    }, [room?.game.id]);

    if (!room) return null;

    // The BIOS points the iframe to the game's entry point served by the Kernel
    const gameUrl = `/games/${room.game.id}/${room.game.entry}`;

    const handleLeaveRoom = () => {
        if (window.confirm("Are you sure you want to leave the match?")) {
            wsClient.send('room.leave', {});
            window.history.replaceState({}, '', window.location.pathname);
            window.location.reload();
        }
    };

    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    const handleUpdateSetting = (key: string, value: any) => {
        if (!room || !player || player.id !== room.hostId) return;
        const currentSettings = room.settings || {};
        const newSettings = { ...currentSettings, [key]: value };
        
        if (room.game.settingsSchema && 'preset' in room.game.settingsSchema && key !== 'preset') {
            newSettings['preset'] = 'custom';
        }
        
        wsClient.send('room.update_settings', { settings: newSettings });
    };

    const handlePresetChange = (preset: string) => {
        if (!room || !player || player.id !== room.hostId) return;
        const schemaPreset = room.game.settingsSchema?.preset;
        let presetSettings: Record<string, any> = { preset };
        if (schemaPreset && schemaPreset.values && schemaPreset.values[preset]) {
            presetSettings = {
                ...presetSettings,
                ...schemaPreset.values[preset]
            };
        } else {
            presetSettings = { ...room.settings, preset };
        }
        wsClient.send('room.update_settings', { settings: presetSettings });
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: '#000',
            zIndex: 100,
        }}>
            {/* Backdrop click overlay to dismiss drawer */}
            {isOpen && (
                <div 
                    onClick={() => setIsOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 999,
                        background: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(2px)',
                    }}
                />
            )}

            {/* Floating Settings Gear Icon */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        zIndex: 1000,
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#f8fafc',
                        fontSize: '18px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    ⚙️
                </button>
            )}

            {/* Slide-out Settings Drawer (Landscape Responsive) */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '320px',
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(16px)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                zIndex: 1001,
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
                fontFamily: "'Inter', 'system-ui', sans-serif",
                color: '#fff',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px' }}>⚙️ MATCH SETTINGS</h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px',
                            outline: 'none',
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* Drawer Body (Scrollable) */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                }}>
                    {/* System Section */}
                    <div>
                        <div style={styles.sectionTitle}>SYSTEM</div>
                        <div style={styles.settingsRow}>
                            <div style={styles.settingsLabelContainer}>
                                <div style={styles.settingsLabel}>Full Screen</div>
                                <div style={styles.settingsDescription}>Toggle browser fullscreen mode</div>
                            </div>
                            <button 
                                onClick={handleToggleFullscreen}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    background: isFullscreen ? 'linear-gradient(135deg, #6366f1, #ec4899)' : '#334155',
                                    boxShadow: isFullscreen ? '0 0 10px rgba(99, 102, 241, 0.4)' : 'none',
                                    transition: 'all 0.2s',
                                    minWidth: '70px',
                                }}
                            >
                                {isFullscreen ? '⚡ ON' : '💤 OFF'}
                            </button>
                        </div>
                        <button 
                            onClick={handleLeaveRoom}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: 'none',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: '13px',
                                cursor: 'pointer',
                                background: '#ef4444',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                                transition: 'background 0.2s',
                                marginTop: '16px',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                        >
                            🚪 LEAVE MATCH
                        </button>
                    </div>

                    {/* Game Rules Section */}
                    <div>
                        <div style={styles.sectionTitle}>
                            {player?.id === room.hostId ? '⚙️ HOST CONTROLS' : '🔒 GAME RULES'}
                        </div>
                        {player?.id !== room.hostId && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginBottom: '12px' }}>
                                View-only mode. Only the host can edit rules.
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {room.game.settingsSchema ? (
                                Object.entries(room.game.settingsSchema).map(([key, def]: [string, any]) => {
                                    if (key === 'isDailyChallenge' && room.settings?.levelType !== 'procedural') {
                                        return null;
                                    }

                                    const value = room.settings?.[key] !== undefined ? room.settings[key] : def.default;

                                    return (
                                        <div key={key} style={styles.settingsRow}>
                                            <div style={styles.settingsLabelContainer}>
                                                <div style={styles.settingsLabel}>{def.label || key}</div>
                                                {def.description && (
                                                    <div style={styles.settingsDescription}>{def.description}</div>
                                                )}
                                            </div>
                                            
                                            <div style={{ minWidth: '100px', display: 'flex', justifyContent: 'flex-end' }}>
                                                {def.type === 'select' && (
                                                    <select
                                                        value={value}
                                                        onChange={e => {
                                                            let val: any = e.target.value;
                                                            if (def.options && def.options.length > 0 && typeof def.options[0].value === 'number') {
                                                                val = Number(val);
                                                            }
                                                            if (key === 'preset') {
                                                                handlePresetChange(val);
                                                            } else {
                                                                handleUpdateSetting(key, val);
                                                            }
                                                        }}
                                                        disabled={player?.id !== room.hostId}
                                                        style={styles.selectInput}
                                                    >
                                                        {def.options?.map((opt: any) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label || opt.value}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                                {def.type === 'number' && (
                                                    <input
                                                        type="number"
                                                        min={def.min}
                                                        max={def.max}
                                                        value={value}
                                                        onChange={e => {
                                                            const val = parseInt(e.target.value);
                                                            handleUpdateSetting(key, isNaN(val) ? def.default : val);
                                                        }}
                                                        disabled={player?.id !== room.hostId}
                                                        style={styles.numberInput}
                                                    />
                                                )}
                                                {def.type === 'boolean' && (
                                                    <input
                                                        type="checkbox"
                                                        checked={!!value}
                                                        onChange={e => handleUpdateSetting(key, e.target.checked)}
                                                        disabled={player?.id !== room.hostId}
                                                        style={styles.checkboxInput}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                                    No rule settings available for this game.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <iframe
                id="game-frame"
                src={gameUrl}
                sandbox="allow-scripts allow-same-origin"
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                }}
                allow="autoplay; gamepad; keyboard"
                title={room.game.name}
            />
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    sectionTitle: {
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '1.5px',
        color: '#6366f1',
        marginBottom: '12px',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
        paddingBottom: '4px',
    },
    settingsRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        gap: '12px',
    },
    settingsLabelContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    settingsLabel: {
        fontSize: '13px',
        fontWeight: 700,
        color: '#fff',
    },
    settingsDescription: {
        fontSize: '10px',
        color: '#94a3b8',
        marginTop: '2px',
        lineHeight: '1.3',
    },
    selectInput: {
        background: '#0f172a',
        color: '#fff',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '6px 10px',
        fontSize: '12px',
        fontWeight: 600,
        outline: 'none',
        width: '100%',
        maxWidth: '150px',
        cursor: 'pointer',
    },
    numberInput: {
        background: '#0f172a',
        color: '#fff',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '6px 10px',
        fontSize: '12px',
        fontWeight: 600,
        outline: 'none',
        width: '70px',
        textAlign: 'center',
    },
    checkboxInput: {
        width: '20px',
        height: '20px',
        cursor: 'pointer',
        accentColor: '#6366f1',
    }
};

export default GameLoader;
