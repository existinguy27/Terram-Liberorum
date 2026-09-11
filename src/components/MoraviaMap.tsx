import React, { useEffect, useRef, useState } from 'react';
import { PLAYERS, type PlayerId, getRegisteredPlayerId, isGmOverride, getPreviewPlayerId, getPlayerColor } from '../lib/players';
import { fetchLocations, type Location } from '../lib/api';

interface Ecozone {
  name: string;
  coords: [number, number][];
  fillColor: string;
  center: [number, number];
}

const moraviaOutline: [number, number][] = [
  [100,50],[300,30],[450,60],[500,120],[490,200],[460,280],
  [420,350],[380,420],[300,480],[200,500],[120,470],[80,400],
  [60,300],[70,180],[100,50]
];

const ecozones: Ecozone[] = [
  {
    name: 'Redwood Forest',
    coords: [[200,30],[420,40],[470,100],[440,180],[350,200],[220,190],[170,120],[180,60]],
    fillColor: '#2d5a1b',
    center: [300, 100],
  },
  {
    name: 'Hills of Jarlsberg',
    coords: [[80,150],[200,130],[280,200],[260,320],[180,360],[90,320],[60,240]],
    fillColor: '#5a4a1b',
    center: [180, 250],
  },
  {
    name: 'Moravian Woods',
    coords: [[350,280],[480,260],[510,340],[490,430],[400,470],[320,450],[300,370],[330,300]],
    fillColor: '#1b3d1b',
    center: [400, 350],
  },
];

const pathOfShatteredKings: [number, number][] = [
  [120,200],[200,250],[300,280],[400,300],[480,320]
];

const moravaRiver: [number, number][] = [
  [70,50],[75,150],[80,280],[90,400],[100,480]
];

export const MoraviaMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [playerColor, setPlayerColor] = useState('#ffffff');
  const [isPreview, setIsPreview] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    const initPlayer = () => {
      if (isGmOverride()) {
        setPlayerColor('#e94560');
        return;
      }
      const previewId = getPreviewPlayerId();
      if (previewId) {
        setIsPreview(true);
        const player = PLAYERS.find(p => p.id === previewId);
        setPlayerColor(player?.color || '#ffffff');
        return;
      }
      const stored = getRegisteredPlayerId();
      if (stored) {
        const player = PLAYERS.find(p => p.id === stored);
        setPlayerColor(player?.color || '#ffffff');
        return;
      }
    };
    initPlayer();
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      const map = L.map(mapRef.current!, {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 3,
        center: [400, 500],
        zoom: 0,
        attributionControl: false,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      const bounds = [[0, 0], [800, 1000]];
      const imageBounds = [[0, 0], [800, 1000]];
      map.fitBounds(imageBounds);

      // Water background
      const waterLayer = L.rectangle(bounds, {
        color: '#0a1628',
        fillColor: '#0a1628',
        fillOpacity: 1,
        weight: 0,
      }).addTo(map);

      // Moravia continent outline
      const continentPolygon = L.polygon(moraviaOutline, {
        color: '#4a9a6a',
        fillColor: '#1a3a2a',
        fillOpacity: 0.8,
        weight: 2,
      }).addTo(map);

      // Ecozone layers
      ecozones.forEach((zone) => {
        L.polygon(zone.coords, {
          color: zone.fillColor,
          fillColor: zone.fillColor,
          fillOpacity: 0.4,
          weight: 1,
          dashArray: '5, 5',
        }).addTo(map);

        // Ecozone label
        L.marker(zone.center, {
          icon: L.divIcon({
            className: 'ecozone-label',
            html: `<div style="font-family: Georgia, serif; color: #6aa85a; font-size: 11px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); pointer-events: none; white-space: nowrap;">${zone.name}</div>`,
            iconSize: [180, 30],
            iconAnchor: [90, 15],
          }),
        }).addTo(map);
      });

      // Path of Shattered Kings
      L.polyline(pathOfShatteredKings, {
        color: '#8a7a5a',
        weight: 3,
        dashArray: '10, 8',
        opacity: 0.8,
      }).addTo(map);

      // Path label
      L.marker([300, 250], {
        icon: L.divIcon({
          className: 'path-label',
          html: '<div style="font-family: Georgia, serif; color: #8a7a5a; font-size: 10px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); white-space: nowrap;">Path of Shattered Kings</div>',
          iconSize: [200, 30],
          iconAnchor: [100, 15],
        }),
      }).addTo(map);

      // Morava River
      L.polyline(moravaRiver, {
        color: '#2a5a8a',
        weight: 4,
        opacity: 0.9,
      }).addTo(map);

      // River label
      L.marker([85, 250], {
        icon: L.divIcon({
          className: 'river-label',
          html: '<div style="font-family: Georgia, serif; color: #2a5a8a; font-size: 10px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); transform: rotate(90deg); white-space: nowrap;">Morava River</div>',
          iconSize: [100, 30],
          iconAnchor: [50, 15],
        }),
      }).addTo(map);

      // Compass rose
      const compass = L.control({ position: 'bottomright' });
      compass.onAdd = () => {
        const div = L.DomUtil.create('div', 'compass-rose');
        div.innerHTML = `
          <div style="
            width: 60px;
            height: 60px;
            border: 2px solid #4a9a6a;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(10, 22, 40, 0.9);
            font-family: Georgia, serif;
            color: #4a9a6a;
            font-size: 10px;
            letter-spacing: 1px;
          ">
            <span>N</span>
            <div style="display: flex; gap: 14px;">
              <span style="transform: rotate(-90deg);">W</span>
              <span style="transform: rotate(90deg);">E</span>
            </div>
            <span style="margin-top: -4px;">S</span>
          </div>
        `;
        return div;
      };
      compass.addTo(map);

      // Fetch and add location markers
      try {
        const locations = await fetchLocations();
        const moraviaLocations = locations.filter(
          (loc: Location) => loc.continent === 'Moravia' && loc.visible
        );

        moraviaLocations.forEach((loc: Location) => {
          const x = (loc.x_percent || 0) * 10;
          const y = (loc.y_percent || 0) * 8;

          const marker = L.circleMarker([y, x], {
            radius: 8,
            fillColor: '#ffffff',
            color: playerColor,
            weight: 2,
            fillOpacity: 1,
            className: 'location-marker',
          }).addTo(map);

          marker.on('click', () => {
            setSelectedLocation(loc);
          });

          marker.on('mouseover', () => {
            marker.setStyle({ radius: 10, fillColor: playerColor, color: '#ffffff' });
          });

          marker.on('mouseout', () => {
            marker.setStyle({ radius: 8, fillColor: '#ffffff', color: playerColor });
          });
        });
      } catch (e) {
        console.error('[MoraviaMap] Failed to fetch locations:', e);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [playerColor]);

  const handleBack = () => {
    window.location.href = '/map';
  };

  const handleCloseSidebar = () => {
    setSelectedLocation(null);
  };

  const formatField = (value: string | null | undefined) => {
    return value && value.trim() ? value : 'None recorded.';
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white relative" style={{ '--player-color': playerColor }}>
      <header className="bg-[#16213e] border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
        <button
          onClick={handleBack}
          className="px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          ← World Map
        </button>
        <h1 className="text-xl font-bold" style={{ color: playerColor }}>
          Moravia
        </h1>
        {isPreview && (
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            GM PREVIEW
          </span>
        )}
      </header>

      <main className="flex-1 w-full">
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: 'calc(100vh - 72px)' }} />
      </main>

      {/* Sidebar */}
      {selectedLocation && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={handleCloseSidebar} />
          <aside className="absolute right-0 top-0 bottom-0 w-full md:w-96 bg-[#0d0d1a] border-l border-gray-700 pointer-events-auto overflow-y-auto animate-slide-in">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1" style={{ color: playerColor }}>
                    {selectedLocation.name}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {selectedLocation.region ? `${selectedLocation.region}, ` : ''}Moravia
                  </p>
                </div>
                <button
                  onClick={handleCloseSidebar}
                  className="text-gray-400 hover:text-white text-2xl leading-none p-1"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Description</h3>
                  <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {formatField(selectedLocation.full_description)}
                  </p>
                </section>

                {selectedLocation.notable_npcs && (
                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Notable NPCs</h3>
                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {formatField(selectedLocation.notable_npcs)}
                    </p>
                  </section>
                )}

                {selectedLocation.connected_quests && (
                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Connected Quests</h3>
                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {formatField(selectedLocation.connected_quests)}
                    </p>
                  </section>
                )}

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Coordinates</h3>
                  <p className="text-gray-400 font-mono text-sm">
                    X: {selectedLocation.x_percent}% &nbsp; Y: {selectedLocation.y_percent}%
                  </p>
                </section>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default MoraviaMap;