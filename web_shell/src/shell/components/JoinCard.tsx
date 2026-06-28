import React from 'react';
import { Wifi } from 'lucide-react';

interface JoinCardProps {
  roomCodeInput: string;
  setRoomCodeInput: (val: string) => void;
  handleJoinRoom: () => void;
  isPortrait?: boolean;
}

const JoinCard: React.FC<JoinCardProps> = ({
  roomCodeInput,
  setRoomCodeInput,
  handleJoinRoom,
  isPortrait,
}) => {
  return (
    <div className={`home-join-card ${isPortrait ? 'portrait-join' : ''}`}>
      <div className="home-join-eyebrow">
        <Wifi size={14} />
        <span>JOIN ROOM</span>
      </div>
      {!isPortrait && (
        <>
          <h2 className="home-join-heading">Have a room code?</h2>
          <p className="home-join-desc">Ask your host to share their room code, then enter it below.</p>
        </>
      )}

      <div className="home-join-field">
        <span className="home-join-hash">#</span>
        <input
          id="home-room-code-input"
          type="text"
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
          placeholder="Enter Room Code"
          className="home-join-input"
          maxLength={4}
          autoComplete="off"
        />
        {isPortrait && (
          <button
            id="home-room-code-btn"
            onClick={handleJoinRoom}
            className="home-join-btn portrait-join-btn"
            style={{ width: 'auto', padding: '10px 16px', margin: 4 }}
          >
            <span>JOIN</span>
          </button>
        )}
      </div>

      {!isPortrait && (
        <>
          <button
            id="home-join-room-btn"
            onClick={handleJoinRoom}
            className="home-join-btn"
          >
            <span>JOIN ROOM</span>
            <span className="home-join-arrow">→</span>
          </button>

          <div className="home-join-hint">
            <Wifi size={12} />
            <span>Make sure you're on the same Wi-Fi as your friends.</span>
          </div>
        </>
      )}
    </div>
  );
};

export default JoinCard;
