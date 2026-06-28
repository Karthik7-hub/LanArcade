import React from 'react';
import { Settings, Lock, Minus, Plus } from 'lucide-react';
import { stripEmojis } from '../../constants';
import type { Room, Player } from '../../../shared/types';

interface LobbyRulesPaneProps {
  room: Room;
  player: Player;
  activeRuleTooltip: string | null;
  setActiveRuleTooltip: (val: string | null) => void;
  handleUpdateSetting: (key: string, value: any) => void;
  handlePresetChange: (preset: string) => void;
  isPortrait?: boolean;
}

const LobbyRulesPane: React.FC<LobbyRulesPaneProps> = ({
  room,
  player,
  activeRuleTooltip,
  setActiveRuleTooltip,
  handleUpdateSetting,
  handlePresetChange,
  isPortrait,
}) => {
  return (
    <div className={isPortrait ? 'portrait-pane-wrap' : 'lobby-rules-tab'}>
      <div
        className="lobby-rules-subheader"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 10,
        }}
      >
        <div className="settings-label" style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
          {player.id === room.hostId ? (
            <span
              className="host-privilege-active"
              style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Settings size={14} /> HOST PRIVILEGES ACTIVE
            </span>
          ) : (
            <span
              className="read-only-rules-label"
              style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Lock size={14} /> READ-ONLY LOBBY RULES
            </span>
          )}
        </div>
        {player.id === room.hostId && (
          <span className="changes-instant-hint" style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
            Changes apply instantly
          </span>
        )}
      </div>

      <div className={`settings-rules-grid ${isPortrait ? 'portrait-rules-vertical' : ''}`}>
        {room.game.settingsSchema ? (
          Object.entries(room.game.settingsSchema).map(([key, def]: [string, any]) => {
            if (key === 'isDailyChallenge' && room.settings?.levelType !== 'procedural') {
              return null;
            }

            const value = room.settings?.[key] !== undefined ? room.settings[key] : def.default;

            if (def.type === 'boolean') {
              const handleToggle = () => {
                if (player.id !== room.hostId) return;
                handleUpdateSetting(key, !value);
              };
              return (
                <div key={key} className={`rule-card-wrapper ${isPortrait ? 'portrait-rule-card' : ''}`}>
                  <div
                    onClick={handleToggle}
                    className={`rule-card ${value ? 'active' : ''}`}
                    style={{ cursor: player.id === room.hostId ? 'pointer' : 'default' }}
                  >
                    <div className="rule-card-left">
                      <div className="rule-card-title">{stripEmojis(def.label || key)}</div>
                    </div>
                    <div className="rule-card-control">
                      <div className={`rule-toggle-pill ${value ? 'on' : 'off'}`}>
                        <div className="rule-toggle-knob" />
                      </div>
                      {def.description && (
                        <button
                          className={`rule-help-btn ${activeRuleTooltip === key ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRuleTooltip(activeRuleTooltip === key ? null : key);
                          }}
                          title="About this rule"
                        >
                          ?
                        </button>
                      )}
                    </div>
                  </div>
                  {activeRuleTooltip === key && def.description && (
                    <div className="rule-tooltip-panel">{stripEmojis(def.description)}</div>
                  )}
                </div>
              );
            }

            if (def.type === 'number') {
              const handleDec = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (player.id !== room.hostId) return;
                const val = value - 1;
                handleUpdateSetting(key, val >= (def.min ?? 0) ? val : value);
              };
              const handleInc = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (player.id !== room.hostId) return;
                const val = value + 1;
                handleUpdateSetting(key, val <= (def.max ?? 1000) ? val : value);
              };
              return (
                <div key={key} className={`rule-card-wrapper ${isPortrait ? 'portrait-rule-card' : ''}`}>
                  <div className="rule-card">
                    <div className="rule-card-left">
                      <div className="rule-card-title">{stripEmojis(def.label || key)}</div>
                    </div>
                    <div className="rule-card-control">
                      <span className="rule-card-value">{value}</span>
                      <div className="rule-number-adjuster">
                        <button
                          onClick={handleDec}
                          disabled={player.id !== room.hostId || value <= (def.min ?? 0)}
                          className="rule-adjust-btn"
                        >
                          <Minus size={12} />
                        </button>
                        <button
                          onClick={handleInc}
                          disabled={player.id !== room.hostId || value >= (def.max ?? 1000)}
                          className="rule-adjust-btn"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      {def.description && (
                        <button
                          className={`rule-help-btn ${activeRuleTooltip === key ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRuleTooltip(activeRuleTooltip === key ? null : key);
                          }}
                          title="About this rule"
                        >
                          ?
                        </button>
                      )}
                    </div>
                  </div>
                  {activeRuleTooltip === key && def.description && (
                    <div className="rule-tooltip-panel">{stripEmojis(def.description)}</div>
                  )}
                </div>
              );
            }

            // select type
            return (
              <div key={key} className={`rule-card-wrapper ${isPortrait ? 'portrait-rule-card' : ''}`}>
                <div className="rule-card">
                  <div className="rule-card-left">
                    <div className="rule-card-title">{stripEmojis(def.label || key)}</div>
                  </div>
                  <div className="rule-card-control">
                    <select
                      value={value}
                      onChange={(e) => {
                        let val: any = e.target.value;
                        if (
                          def.options &&
                          def.options.length > 0 &&
                          typeof def.options[0].value === 'number'
                        ) {
                          val = Number(val);
                        }
                        if (key === 'preset') {
                          handlePresetChange(val);
                        } else {
                          handleUpdateSetting(key, val);
                        }
                      }}
                      disabled={player.id !== room.hostId}
                      className="rule-card-select-overlay"
                    >
                      {def.options?.map((opt: any) => (
                        <option key={opt.value} value={opt.value}>
                          {stripEmojis(opt.label || String(opt.value))}
                        </option>
                      ))}
                    </select>
                    {def.description && (
                      <button
                        className={`rule-help-btn ${activeRuleTooltip === key ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRuleTooltip(activeRuleTooltip === key ? null : key);
                        }}
                        title="About this rule"
                      >
                        ?
                      </button>
                    )}
                  </div>
                </div>
                {activeRuleTooltip === key && def.description && (
                  <div className="rule-tooltip-panel">{stripEmojis(def.description)}</div>
                )}
              </div>
            );
          })
        ) : (
          <div className="settings-rules-empty">No Customizable Rules.</div>
        )}

        {/* Configurable Win on Abandonment Toggle (Host Only) */}
        {player.id === room.hostId && (
          <div className={`rule-card-wrapper ${isPortrait ? 'portrait-rule-card' : ''}`}>
            <div
              onClick={() =>
                handleUpdateSetting('winOnAbandonment', !(room.settings?.winOnAbandonment ?? true))
              }
              className={`rule-card ${(room.settings?.winOnAbandonment ?? true) ? 'active' : ''}`}
              style={{ cursor: 'pointer' }}
            >
              <div className="rule-card-left">
                <div className="rule-card-title">WIN ON ABANDONMENT</div>
              </div>
              <div className="rule-card-control">
                <div
                  className={`rule-toggle-pill ${(room.settings?.winOnAbandonment ?? true) ? 'on' : 'off'}`}
                >
                  <div className="rule-toggle-knob" />
                </div>
                <button
                  className={`rule-help-btn ${activeRuleTooltip === 'winOnAbandonment' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveRuleTooltip(
                      activeRuleTooltip === 'winOnAbandonment' ? null : 'winOnAbandonment'
                    );
                  }}
                  title="About this rule"
                >
                  ?
                </button>
              </div>
            </div>
            {activeRuleTooltip === 'winOnAbandonment' && (
              <div className="rule-tooltip-panel">
                Declare the remaining connected player as the winner if all other players disconnect during the match.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LobbyRulesPane;
