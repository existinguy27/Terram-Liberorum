import React, { useEffect, useRef, useState } from 'react';
import { PLAYERS, type PlayerId, getRegisteredPlayerId, isGmOverride, getPreviewPlayerId, getPlayerColor } from '../lib/players';

interface Continent {
  name: string;
  coords: [number, number][];
  center: [number, number];
}

const continents: Continent[] = [
  {
    name: 'Rohendel West',
    coords: [[80,60],[180,50],[200,90],[220,120],[190,150],[140,160],[90,140],[70,100]],
    center: [140, 100],
  },
  {
    name: 'Rohendel East (Icecrown Citadel)',
    coords: [[260,40],[310,35],[320,70],[300,90],[255,80]],
    center: [290, 60],
  },
  {
    name: 'Sedletz',
    coords: [[20,280],[60,260],[75,300],[70,380],[50,420],[20,400],[10,350]],
    center: [45, 350],
  },
  {
    name: 'Bohemia',
    coords: [[180,180],[420,160],[500,190],[510,240],[480,280],[400,290],[300,300],[200,290],[160,260],[150,220]],
    center: [320, 230],
  },
  {
    name: 'Sasau',
    coords: [[150,310],[320,300],[340,380],[320,450],[280,500],[200,510],[150,480],[120,420],[130,360]],
    center: [220, 400],
  },
  {
    name: 'Moravia',
    coords: [[620,300],[720,280],[780,310],[790,380],[760,440],[700,470],[640,460],[600,420],[590,360]],
    center: [680, 380],
  },
];

export const WorldMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [playerColor, setPlayerColor] = useState('#ffffff');
  const [isPreview, setIsPreview] = useState(false);

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
        maxZoom: 2,
        center: [300, 500],
        zoom: 0,
        attributionControl: false,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      const bounds = [[0, 0], [600, 1000]];
      const imageBounds = [[0, 0], [600, 1000]];

      map.fitBounds(imageBounds);

      // Water background
      const waterLayer = L.rectangle(bounds, {
        color: '#0a1628',
        fillColor: '#0a1628',
        fillOpacity: 1,
        weight: 0,
      }).addTo(map);

      // Continent layers
      const continentLayers: any[] = [];

      continents.forEach((continent) => {
        const isMoravia = continent.name === 'Moravia';

        const polygon = L.polygon(continent.coords, {
          color: isMoravia ? '#6ac98a' : '#4a9a6a',
          fillColor: '#1a3a2a',
          fillOpacity: 0.8,
          weight: isMoravia ? 3 : 2,
          className: isMoravia ? 'continent-moravia' : '',
        }).addTo(map);

        // Permanent tooltip label
        const tooltip = L.tooltip({
          permanent: true,
          direction: 'center',
          className: 'continent-label',
          offset: [0, 0],
        }).setContent(`
          <div style="
            font-family: Georgia, serif;
            color: white;
            font-size: 13px;
            font-weight: 500;
            text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
            white-space: nowrap;
          ">${continent.name}</div>
        `).setLatLng(continent.center).addTo(map);

        // Hover effects
        polygon.on('mouseover', () => {
          polygon.setStyle({
            fillColor: '#2a5a3a',
            fillOpacity: 0.9,
            weight: isMoravia ? 4 : 3,
          });
          if (isMoravia) {
            polygon.getElement()?.style.setProperty('cursor', 'pointer');
          }
        });

        polygon.on('mouseout', () => {
          polygon.setStyle({
            fillColor: '#1a3a2a',
            fillOpacity: 0.8,
            weight: isMoravia ? 3 : 2,
            color: isMoravia ? '#6ac98a' : '#4a9a6a',
          });
        });

        // Click handling
        polygon.on('click', () => {
          if (isMoravia) {
            window.location.href = '/map/moravia';
          } else {
            alert(`${continent.name} — Not yet explored`);
          }
        });

        continentLayers.push({ polygon, tooltip });
      });

      // Sea of Nozdormu label
      const seaLabel = L.marker([150, 800], {
        icon: L.divIcon({
          className: 'sea-label',
          html: '<div style="font-family: Georgia, serif; color: #4a6a8a; font-size: 14px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); transform: rotate(-15deg);">Sea of Nozdormu</div>',
          iconSize: [200, 50],
          iconAnchor: [100, 25],
        }),
      }).addTo(map);

      // Eclipse River label
      const riverLabel = L.marker([380, 480], {
        icon: L.divIcon({
          className: 'river-label',
          html: '<div style="font-family: Georgia, serif; color: #4a6a8a; font-size: 12px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); transform: rotate(45deg);">Eclipse River</div>',
          iconSize: [150, 40],
          iconAnchor: [75, 20],
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
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white" style={{ '--player-color': playerColor }}>
      <header className="bg-[#16213e] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          ← Home
        </button>
        <h1 className="text-xl font-bold" style={{ color: playerColor }}>
          Terram Liberorum — World Map
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
    </div>
  );
};

export default WorldMap;