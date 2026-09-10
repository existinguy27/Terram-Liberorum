import React, { useState, useEffect } from 'react';
import { DeviceRegistration } from './DeviceRegistration';
import { PlayerHomepage } from './PlayerHomepage';
import { getRegisteredPlayerId, isGmOverride, getPreviewPlayerId, isResetRequested, clearDeviceToken, type PlayerId } from '../lib/players';

export const PlayerApp: React.FC = () => {
  const [showRegistration, setShowRegistration] = useState(true);
  const [registeredPlayerId, setRegisteredPlayerId] = useState<PlayerId | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (isResetRequested()) {
      clearDeviceToken();
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    const checkRegistration = () => {
      if (isGmOverride()) {
        setShowRegistration(false);
        setRegisteredPlayerId(null);
        setIsPreview(false);
        return;
      }

      const previewId = getPreviewPlayerId();
      if (previewId) {
        setShowRegistration(false);
        setRegisteredPlayerId(previewId);
        setIsPreview(true);
        return;
      }

      const stored = getRegisteredPlayerId();
      if (stored) {
        setShowRegistration(false);
        setRegisteredPlayerId(stored);
        setIsPreview(false);
        return;
      }

      setShowRegistration(true);
    };

    checkRegistration();
  }, []);

  const handleRegistered = (playerId: PlayerId) => {
    setRegisteredPlayerId(playerId);
    setShowRegistration(false);
  };

  if (showRegistration) {
    return <DeviceRegistration onRegistered={handleRegistered} />;
  }

  return <PlayerHomepage initialPlayerId={registeredPlayerId || undefined} isPreview={isPreview} />;
};

export default PlayerApp;