import React, { useEffect, useRef, useState } from 'react';
import { PLAYERS, type PlayerId, getRegisteredPlayerId, isGmOverride, getPreviewPlayerId, getPlayerColor } from '../lib/players';
import { fetchContinentBorders, type ContinentBorder } from '../lib/api';

interface WorldBorder {
  id: string;
  name: string;
  coords: [number, number][];
  label_x: number | null;
  label_y: number | null;
  fill_color: string | null;
  stroke_color: string | null;
  fill_opacity: number | null;
  border_type: 'continent' | 'ecozone' | 'path' | 'river';
}

export const WorldMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [playerColor, setPlayerColor] = useState('#ffffff');
  const [isPreview, setIsPreview] = useState(false);
  const [borders, setBorders] = useState<WorldBorder[]>([]);

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

  // Fetch continent borders from Supabase
  useEffect(() => {
    const fetchBorders = async () => {
      try {
        const data = await fetchContinentBorders('Terram Liberorum');
        // Filter to only continent-type borders for world map
        const continentBorders = data.filter(b => b.border_type === 'continent');
        setBorders(continentBorders);
      } catch (e) {
        console.error('[WorldMap] Failed to fetch borders:', e);
      }
    };
    fetchBorders();
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
        maxBounds: [[-300, -300], [900, 1300]],
        maxBoundsViscosity: 1.0,
      });

      mapInstanceRef.current = map;

      const bounds = [[0, 0], [600, 1000]];
      const expandedBounds = [[-300, -300], [900, 1300]];

      // Set container background to water color
      map.getContainer().style.backgroundColor = '#0a1628';

      map.fitBounds(bounds, { padding: [20, 20] });

      // Water background covering expanded bounds
      L.rectangle(expandedBounds, {
        color: '#0a1628',
        fillColor: '#0a1628',
        fillOpacity: 1,
        weight: 0,
      }).addTo(map);

      // Draw continent borders from Supabase
      borders.forEach((border) => {
        const isMoravia = border.name === 'Moravia';
        const fillColor = border.fill_color || '#1a3a2a';
        const strokeColor = border.stroke_color || (isMoravia ? '#6ac98a' : '#4a9a6a');
        const fillOpacity = border.fill_opacity ?? 0.8;
        const weight = isMoravia ? 3 : 2;

        const polygon = L.polygon(border.coords, {
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          weight: weight,
          className: isMoravia ? 'continent-moravia' : '',
        }).addTo(map);

        // Permanent tooltip label at label position
        const labelX = border.label_x ?? (border.coords[0]?.[1] ?? 0);
        const labelY = border.label_y ?? (border.coords[0]?.[0] ?? 0);

        L.tooltip({
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
          ">${border.name}</div>
        `).setLatLng([labelY, labelX]).addTo(map);

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
            fillColor: fillColor,
            fillOpacity: fillOpacity,
            weight: weight,
            color: strokeColor,
          });
        });

        // Click handling
        polygon.on('click', () => {
          if (isMoravia) {
            window.location.href = '/map/moravia';
          } else {
            alert(`${border.name} — Not yet explored`);
          }
        });
      });

      // Sea of Nozdormu label (static)
      L.marker([150, 800], {
        icon: L.divIcon({
          className: 'sea-label',
          html: '<div style="font-family: Georgia, serif; color: #4a6a8a; font-size: 14px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); transform: rotate(-15deg);">Sea of Nozdormu</div>',
          iconSize: [200, 50],
          iconAnchor: [100, 25],
        }),
      }).addTo(map);

      // Eclipse River label (static)
      L.marker([380, 480], {
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
  }, [borders]);

  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white" style={{ '--player-color': playerColor }}>
      <header className="bg-[#16213e] border-b border-gray-800 px-6 py-3 flex items-center justify-between" style={{ height: '48px' }}>
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

      <main className="w-full h-full" style={{ height: 'calc(100vh - 48px)' }}>
        <div ref={mapRef} className="w-full h-full" style={{ backgroundColor: '#0a1628' }} />
      </main>
    </div>
  );
};

export default WorldMap;