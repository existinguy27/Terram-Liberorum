import React, { useState, useEffect, useCallback } from 'react';
import { PLAYERS, type PlayerId, getRegisteredPlayerId, isGmOverride, getPreviewPlayerId, getPlayerColor } from '../lib/players';
import { fetchMail, fetchPlayers } from '../lib/api';

export const MailPage: React.FC = () => {
  console.log('[MailPage] Component mounted');

  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [mail, setMail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMail, setSelectedMail] = useState<any>(null);
  const [isPreview, setIsPreview] = useState(false);

  const player = playerId ? PLAYERS.find(p => p.id === playerId) : null;
  const playerColor = player ? player.color : '#ffffff';

  const loadMail = useCallback(async (reset = false) => {
    if (!playerId) return;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      // Fetch all players and find the UUID matching our playerId (name)
      const allPlayers = await fetchPlayers();
      const matchedPlayer = allPlayers.find(p => p.name.toLowerCase() === playerId.toLowerCase());
      const playerUuid = matchedPlayer?.id || null;

      console.log('[MailPage] playerId:', playerId, 'matchedPlayer:', matchedPlayer, 'playerUuid:', playerUuid);

      // GM override or preview mode without match: use first player's UUID as fallback
      if (!playerUuid && (isGmOverride() || getPreviewPlayerId())) {
        const fallbackUuid = allPlayers[0]?.id || null;
        console.log('[MailPage] GM/Preview fallback playerUuid:', fallbackUuid);
      }

      const finalUuid = playerUuid || (isGmOverride() || getPreviewPlayerId() ? allPlayers[0]?.id || null : null);
      console.log('[MailPage] Final playerUuid for filtering:', finalUuid);

      const allMail = await fetchMail();
      console.log('[MailPage] All mail from DB:', allMail.map(m => ({ id: m.id, player_id: m.player_id, title: m.title })));

      const playerMail = finalUuid
        ? allMail.filter((m: any) => m.player_id === finalUuid)
        : [];
      console.log('[MailPage] Filtered mail for player:', playerMail);

      const sortedMail = playerMail.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (reset) {
        setMail(sortedMail.slice(0, 10));
        setHasMore(sortedMail.length > 10);
      } else {
        const newMail = sortedMail.slice(mail.length, mail.length + 10);
        setMail(prev => [...prev, ...newMail]);
        setHasMore(mail.length + newMail.length < sortedMail.length);
      }
    } catch (e) {
      console.error('[MailPage ERROR]', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [playerId, mail.length]);

  useEffect(() => {
    let resolvedPlayerId: PlayerId | null = null;
    let previewMode = false;

    if (isGmOverride()) {
      // GM view - show all mail or first player's mail
      resolvedPlayerId = 'kael';
    } else if (getPreviewPlayerId()) {
      resolvedPlayerId = getPreviewPlayerId();
      previewMode = true;
    } else {
      resolvedPlayerId = getRegisteredPlayerId();
    }

    if (!resolvedPlayerId && !isGmOverride()) {
      setLoading(false);
      return;
    }

    setPlayerId(resolvedPlayerId);
    setIsPreview(previewMode);
    loadMail(true);
  }, [loadMail]);

  const handleScroll = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      loadMail(false);
    }
  }, [loadingMore, hasMore, loading, loadMail]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a] text-white px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-[var(--player-color)]" style={{ '--player-color': playerColor }} />
      </div>
    );
  }

  if (!playerId && !isGmOverride()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a] text-white px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">No Character Selected</h1>
          <p className="text-gray-400">Please register a device first.</p>
          <a href="/" className="inline-block mt-6 px-6 py-3 bg-[#e94560] text-[#0d0d1a] font-semibold rounded-lg">
            Go Home
          </a>
        </div>
      </div>
    );
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

      <header className="px-6 py-6 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: playerColor }}>Mail</h1>
          {player && <p className="text-gray-400">{player.character_name}'s Messages</p>}
        </div>
        <a
          href="/"
          className="px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 transition-colors"
        >
          ← Home
        </a>
      </header>

      <main className="px-6 py-8">
        {mail.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-xl mb-2">No messages received.</p>
            <p className="text-sm">Messages from the GM will appear here.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {mail.map((item) => (
                <article
                  key={item.id}
                  className="bg-[#16213e] border rounded-xl p-8 transition-all duration-200 cursor-pointer group"
                  style={{ borderColor: `${playerColor}40` }}
                  onClick={() => setSelectedMail(item)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = `${playerColor}15`;
                    e.currentTarget.style.borderColor = playerColor;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#16213e';
                    e.currentTarget.style.borderColor = `${playerColor}40`;
                  }}
                >
                  <h3 className="text-lg font-bold mb-2" style={{ color: playerColor }}>{item.title}</h3>
                  <p className="text-gray-400 text-sm mb-3">From: {item.sender}</p>
                  <div className="relative max-h-28 overflow-hidden">
                    <p className="text-gray-200 leading-relaxed">
                      {item.content.substring(0, 220)}{item.content.length > 220 ? '...' : ''}
                    </p>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20" style={{
                      background: 'linear-gradient(to bottom, transparent 30%, #16213e 100%)',
                    }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-4">{formatDate(item.created_at)}</p>
                </article>
              ))}
            </div>

            {hasMore && (
              <div className="text-center mt-8">
                {loadingMore ? (
                  <div className="inline-flex items-center gap-2 text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-700 border-t-[var(--player-color)]" style={{ '--player-color': playerColor }} />
                    <span>Loading more...</span>
                  </div>
                ) : (
                  <button
                    onClick={() => loadMail(false)}
                    className="px-6 py-3 bg-transparent border-2 rounded-lg font-semibold transition-colors"
                    style={{ borderColor: playerColor, color: playerColor }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = `${playerColor}20`;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Load More Messages
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {selectedMail && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMail(null)}>
          <div className="bg-[#16213e] border rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto" style={{ borderColor: playerColor }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: playerColor }}>{selectedMail.title}</h2>
                <p className="text-gray-400">From: {selectedMail.sender}</p>
                <p className="text-xs text-gray-500 mt-1">{formatDate(selectedMail.created_at)}</p>
              </div>
              <button
                onClick={() => setSelectedMail(null)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="prose prose-invert max-w-none" style={{ color: '#e0e0e0' }}>
              <p className="whitespace-pre-wrap">{selectedMail.content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MailPage;