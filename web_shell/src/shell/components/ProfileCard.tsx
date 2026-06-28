import React from 'react';
import { Trophy, Settings } from 'lucide-react';
import { resolveAvatarColor } from '../constants';
import type { Player } from '../../shared/types';

interface ProfileCardProps {
  player: Player;
  onOpenSettings: () => void;
  isPortrait?: boolean;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ player, onOpenSettings, isPortrait }) => {
  return (
    <div className={`home-profile-card ${isPortrait ? 'portrait-profile' : ''}`}>
      <div
        className="home-profile-avatar"
        style={{ background: resolveAvatarColor(player.avatar) }}
      >
        {player.name ? player.name[0].toUpperCase() : '?'}
        <span className="home-profile-online-dot" />
      </div>
      <div className="home-profile-info">
        <div className="home-profile-name">{player.name}</div>
        <div className="home-profile-wins">
          <Trophy size={11} />
          <span>{player.stats?.totalWins ?? 0} GLOBAL WINS</span>
        </div>
      </div>
      <button
        className="home-settings-btn"
        onClick={onOpenSettings}
        title="Settings"
      >
        <Settings size={15} />
      </button>
    </div>
  );
};

export default ProfileCard;
