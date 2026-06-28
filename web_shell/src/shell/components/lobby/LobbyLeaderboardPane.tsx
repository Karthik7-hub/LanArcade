import React from 'react';
import { Trophy } from 'lucide-react';
import type { Room } from '../../../shared/types';

interface LobbyLeaderboardPaneProps {
  room: Room;
  isPortrait?: boolean;
}

const LobbyLeaderboardPane: React.FC<LobbyLeaderboardPaneProps> = ({ room, isPortrait }) => {
  const leaderboardData = room.settings?._leaderboard || {};
  const sortedEntries = Object.entries(leaderboardData)
    .map(([id, data]: [string, any]) => ({
      id,
      name: typeof data === 'object' ? data.name : `Player ${id.substring(0, 4)}`,
      wins: typeof data === 'object' ? data.wins : data,
    }))
    .sort((a, b) => b.wins - a.wins);

  if (sortedEntries.length === 0) {
    return (
      <div className="lobby-empty-state">
        <Trophy size={32} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: 8 }} />
        <div className="lobby-empty-title">No Games Played Yet</div>
        <div className="lobby-empty-subtitle">
          Complete a match to see scores here.
        </div>
      </div>
    );
  }

  return (
    <div className={isPortrait ? 'portrait-pane-wrap' : ''}>
      {isPortrait && <h3 className="card-title" style={{ marginBottom: 12 }}>MATCH LEADERBOARD</h3>}
      <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedEntries.map((entry, idx) => {
          const suffix = idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th';
          const badgeClass = idx < 3 ? `rank-${idx + 1}` : 'rank-other';
          return (
            <div key={entry.id} className={`player-item ${isPortrait ? 'portrait-rank-item' : ''}`}>
              <div className={`rank-badge ${badgeClass}`}>
                {idx + 1}
                {suffix}
              </div>
              <span className="player-name">{entry.name}</span>
              <span className="host-badge">{entry.wins} WINS</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LobbyLeaderboardPane;
