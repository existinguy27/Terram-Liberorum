import React, { useState, useEffect } from 'react';
import { PLAYERS, type PlayerId, isGmOverride, isResetRequested, clearDeviceToken } from '../lib/players';
import { fetchMail } from '../lib/api';

interface PlayerHomepageProps {
  initialPlayerId?: PlayerId;
  isPreview?: boolean;
}

export const PlayerHomepage: React.FC<PlayerHomepageProps> = ({ initialPlayerId, isPreview = false }) => {
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [mail, setMail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // isPreview comes from props

  const player = playerId ? PLAYERS.find(p => p.id === playerId) : null;
  const playerColor = player ? player.color : '#ffffff';

  useEffect(() => {
    if (isResetRequested()) {
      clearDeviceToken();
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    const initPlayer = async () => {
      let resolvedPlayerId: PlayerId | null = initialPlayerId || null;

      if (!resolvedPlayerId && !isGmOverride()) {
        setLoading(false);
        return;
      }

      setPlayerId(resolvedPlayerId);

      if (resolvedPlayerId) {
        try {
          const allMail = await fetchMail();
          const playerMail = allMail.filter((m: any) => m.player_id === getPlayerDbId(resolvedPlayerId));
          setMail(playerMail[0] || null);
        } catch (e) {
          console.error('Failed to fetch mail:', e);
        }
      }
      setLoading(false);
    };

    initPlayer();
  }, [initialPlayerId, isPreview]);

  const getPlayerDbId = (pid: PlayerId): string => {
    const map: Record<PlayerId, string> = {
      kael: 'Kael',
      hannya: 'Hannya',
      silas: 'Silas',
      ryuin: 'Ryuin',
    };
    return map[pid];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-[var(--player-color)]" style={{ '--player-color': playerColor }} />
      </div>
    );
  }

  if (!playerId && !isGmOverride()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white" style={{ '--player-color': playerColor }}>
      {isPreview && (
        <div className="w-full bg-gray-800/50 border-b border-gray-700 px-6 py-3 text-center">
          <span className="text-sm font-mono text-gray-300 uppercase tracking-wider">
            GM PREVIEW MODE — viewing as {player?.name || 'Unknown'}
          </span>
        </div>
      )}

      <header className="px-6 py-8 md:py-12 text-center border-b border-gray-800">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4" style={{ color: playerColor }}>
          Terram Liberorum
        </h1>
        {player && (
          <p className="text-xl md:text-2xl font-medium" style={{ color: playerColor }}>
            {player.character_name}
          </p>
        )}
        {!player && !isGmOverride() && (
          <p className="text-xl md:text-2xl font-medium text-gray-400">
            GM View
          </p>
        )}
      </header>

      <main className="px-6 py-8 md:py-12 max-w-3xl mx-auto">
        <section className="mb-12">
          <h2 className="text-lg font-semibold uppercase tracking-wider text-gray-400 mb-4">Latest Mail</h2>
          <div className="bg-[#16213e] border rounded-xl p-6" style={{ borderColor: `${playerColor}40` }}>
            {mail ? (
              <>
                <h3 className="text-xl font-bold mb-2" style={{ color: playerColor }}>{mail.title}</h3>
                <p className="text-gray-400 mb-4">From: {mail.sender}</p>
                <div className="relative fade-container" style={{ '--player-color': playerColor }}>
                  <p className="text-gray-300 line-clamp-3" style={{ maxWidth: '100%' }}>
                    {mail.content.substring(0, 100)}{mail.content.length > 100 ? '...' : ''}
                  </p>
                </div>
                <a
                  href="/mail"
                  className="inline-block mt-6 px-6 py-3 rounded-lg font-semibold transition-colors"
                  style={{
                    backgroundColor: playerColor,
                    color: '#0d0d1a',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                  View All Mail
                </a>
              </>
            ) : (
              <p className="text-gray-500 text-center py-8">No messages received.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold uppercase tracking-wider text-gray-400 mb-4">Navigation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/map"
              className="py-8 px-6 rounded-xl font-bold text-xl text-center transition-all duration-200"
              style={{
                backgroundColor: '#16213e',
                border: `2px solid ${playerColor}40`,
                color: '#ffffff',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = `${playerColor}20`;
                e.currentTarget.style.borderColor = playerColor;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#16213e';
                e.currentTarget.style.borderColor = `${playerColor}40`;
              }}
            >
              World Map
            </a>
            <a
              href="/logs"
              className="py-8 px-6 rounded-xl font-bold text-xl text-center transition-all duration-200"
              style={{
                backgroundColor: '#16213e',
                border: `2px solid ${playerColor}40`,
                color: '#ffffff',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = `${playerColor}20`;
                e.currentTarget.style.borderColor = playerColor;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#16213e';
                e.currentTarget.style.borderColor = `${playerColor}40`;
              }}
            >
              Logs
            </a>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PlayerHomepage;