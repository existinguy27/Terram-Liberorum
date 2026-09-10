import React, { useState } from 'react';
import { PLAYERS, type Player, registerDevice, generateDeviceToken, setDeviceToken, setRegisteredPlayerId, getPlayerColor } from '../lib/players';

interface DeviceRegistrationProps {
  onRegistered?: (playerId: string) => void;
}

export const DeviceRegistration: React.FC<DeviceRegistrationProps> = ({ onRegistered }) => {
  const [registering, setRegistering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (player: Player) => {
    setRegistering(player.id);
    setError(null);
    try {
      const deviceToken = generateDeviceToken();
      await registerDevice(player.id, deviceToken);
      setDeviceToken(deviceToken);
      setRegisteredPlayerId(player.id);
      onRegistered?.(player.id);
      window.location.reload();
    } catch (e: any) {
      setError(e.message || 'Registration failed. Please try again.');
      setRegistering(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a] text-white p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight">Terram Liberorum</h1>
          <p className="text-xl text-gray-400">Select your character to begin</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-900/30 border border-red-700 rounded text-red-300 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {PLAYERS.map((player) => (
            <button
              key={player.id}
              onClick={() => handleRegister(player)}
              disabled={registering !== null}
              className={`relative aspect-square rounded-xl border-4 transition-all duration-200 flex flex-col items-center justify-center p-6 group ${
                registering === player.id
                  ? 'opacity-50 cursor-wait scale-95'
                  : 'hover:scale-105 cursor-pointer'
              }`}
              style={{
                borderColor: player.color,
                background: `linear-gradient(145deg, ${player.color}15, transparent)`,
              }}
            >
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: player.color }} />
              <div className="relative z-10 text-center">
                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-full border-4 flex items-center justify-center transition-transform group-hover:scale-110" style={{ borderColor: player.color }}>
                  <span className="text-4xl md:text-5xl font-bold" style={{ color: player.color }}>
                    {player.name[0]}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: player.color }}>
                  {player.name}
                </h2>
                <p className="text-gray-400 text-sm">{player.character_name}</p>
                {registering === player.id && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-white">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    <span>Registering...</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-gray-500 text-sm mt-12">
          This device will be permanently linked to your chosen character.
          Visit <code className="text-gray-400">/?reset=true</code> to change characters.
        </p>
      </div>
    </div>
  );
};

export default DeviceRegistration;