import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PLAYERS, type PlayerId, getRegisteredPlayerId, isGmOverride, getPreviewPlayerId, getPlayerColor } from '../lib/players';
import { fetchLocations, fetchContinentBorders, type Location, type ContinentBorder } from '../lib/api';

// Bounding box for Moravia outline (x: 60-500, y: 30-500)
const OUTLINE_MIN_X = 60;
const OUTLINE_MAX_X = 500;
const OUTLINE_MIN_Y = 30;
const OUTLINE_MAX_Y = 500;

// Expanded bounds with 300 unit padding
const EXPANDED_BOUNDS: [[number, number], [number, number]] = [[-300, -300], [800, 800]];
const CONTENT_BOUNDS: [[number, number], [number, number]] = [[OUTLINE_MIN_Y, OUTLINE_MIN_X], [OUTLINE_MAX_Y, OUTLINE_MAX_X]];

export const MoraviaMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [playerColor, setPlayerColor] = useState('#ffffff');
  const [isPreview, setIsPreview] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationData, setLocationData] = useState<Location[]>([]);
  const [markerPositions, setMarkerPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [borders, setBorders] = useState<ContinentBorder[]>([]);

  // Scale percentage to canvas coordinates within Moravia bounds
  const percentToCanvas = useCallback((xPercent: number, yPercent: number): [number, number] => {
    const x = OUTLINE_MIN_X + (xPercent / 100) * (OUTLINE_MAX_X - OUTLINE_MIN_X);
    const y = OUTLINE_MIN_Y + (yPercent / 100) * (OUTLINE_MAX_Y - OUTLINE_MIN_Y);
    return [y, x]; // Leaflet uses [lat, lng] = [y, x]
  }, []);

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

  // Fetch locations and initialize marker positions
  useEffect(() => {
    const fetchData = async () => {
      try {
        const locations = await fetchLocations();
        const moraviaLocations = locations.filter(
          (loc: Location) => loc.continent === 'Moravia'
        );
        setLocationData(moraviaLocations);

        // Initialize marker positions
        const positions: Record<string, { x: number; y: number }> = {};
        moraviaLocations.forEach(loc => {
          const [lat, lng] = percentToCanvas(loc.x_percent || 0, loc.y_percent || 0);
          positions[loc.id] = { x: lng, y: lat };
        });
        setMarkerPositions(positions);
      } catch (e) {
        console.error('[MoraviaMap] Failed to fetch locations:', e);
      }
    };
    fetchData();
  }, [percentToCanvas]);

  // Fetch Moravia borders from Supabase
  useEffect(() => {
    const fetchBorders = async () => {
      try {
        const data = await fetchContinentBorders('Moravia');
        setBorders(data);
      } catch (e) {
        console.error('[MoraviaMap] Failed to fetch borders:', e);
      }
    };
    fetchBorders();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      const map = L.map(mapRef.current!, {
        crs: L.CRS.Simple,
        minZoom: -1,
        maxZoom: 4,
        center: [265, 280],
        zoom: 0,
        attributionControl: false,
        zoomControl: true,
        maxBounds: EXPANDED_BOUNDS,
        maxBoundsViscosity: 1.0,
      });

      mapInstanceRef.current = map;

      // Set container background to water color
      map.getContainer().style.backgroundColor = '#0a1628';

      // Fit to content bounds (Moravia outline)
      map.fitBounds(CONTENT_BOUNDS, { padding: [20, 20] });

      // Water background covering expanded bounds
      L.rectangle(EXPANDED_BOUNDS, {
        color: '#0a1628',
        fillColor: '#0a1628',
        fillOpacity: 1,
        weight: 0,
      }).addTo(map);

      // Render borders by type
      borders.forEach((border) => {
        const fillColor = border.fill_color || '#1a3a2a';
        const strokeColor = border.stroke_color || '#4a9a6a';
        const fillOpacity = border.fill_opacity ?? 0.8;
        const labelX = border.label_x ?? (border.coords[0]?.[1] ?? 0);
        const labelY = border.label_y ?? (border.coords[0]?.[0] ?? 0);

        switch (border.border_type) {
          case 'continent': {
            // Main continent outline - filled polygon
            L.polygon(border.coords, {
              color: strokeColor,
              fillColor: fillColor,
              fillOpacity: fillOpacity,
              weight: 2,
            }).addTo(map);

            // Label at label position
            if (border.label_x != null && border.label_y != null) {
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
            }
            break;
          }

          case 'ecozone': {
            // Ecozone - filled polygon with dashed stroke, muted italic green label
            L.polygon(border.coords, {
              color: strokeColor,
              fillColor: fillColor,
              fillOpacity: fillOpacity ?? 0.4,
              weight: 1,
              dashArray: '5, 5',
            }).addTo(map);

            // Ecozone label: muted italic green
            if (border.label_x != null && border.label_y != null) {
              L.marker([labelY, labelX], {
                icon: L.divIcon({
                  className: 'ecozone-label',
                  html: `<div style="font-family: Georgia, serif; color: #6aa85a; font-size: 11px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); pointer-events: none; white-space: nowrap;">${border.name}</div>`,
                  iconSize: [180, 30],
                  iconAnchor: [90, 15],
                }),
              }).addTo(map);
            }
            break;
          }

          case 'path': {
            // Path - dashed polyline, no fill, matching color label
            L.polyline(border.coords, {
              color: strokeColor,
              weight: 3,
              dashArray: '10, 8',
              opacity: 0.8,
            }).addTo(map);

            // Path label: muted italic matching stroke color
            if (border.label_x != null && border.label_y != null) {
              L.marker([labelY, labelX], {
                icon: L.divIcon({
                  className: 'path-label',
                  html: `<div style="font-family: Georgia, serif; color: ${strokeColor}; font-size: 10px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); white-space: nowrap;">${border.name}</div>`,
                  iconSize: [200, 30],
                  iconAnchor: [100, 15],
                }),
              }).addTo(map);
            }
            break;
          }

          case 'river': {
            // River - solid polyline, no fill, matching color label
            L.polyline(border.coords, {
              color: strokeColor,
              weight: 4,
              opacity: 0.9,
            }).addTo(map);

            // River label: muted italic matching stroke color, rotated
            if (border.label_x != null && border.label_y != null) {
              L.marker([labelY, labelX], {
                icon: L.divIcon({
                  className: 'river-label',
                  html: `<div style="font-family: Georgia, serif; color: ${strokeColor}; font-size: 10px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); transform: rotate(90deg); white-space: nowrap;">${border.name}</div>`,
                  iconSize: [100, 30],
                  iconAnchor: [50, 15],
                }),
              }).addTo(map);
            }
            break;
          }
        }
      });

      // Compass rose - bottom LEFT
      const compass = L.control({ position: 'bottomleft' });
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

      // Add location markers
      locationData.forEach((loc: Location) => {
        const pos = markerPositions[loc.id];
        if (!pos) return;

        const marker = L.circleMarker([pos.y, pos.x], {
          radius: 8,
          fillColor: '#ffffff',
          color: playerColor,
          weight: 2,
          fillOpacity: 1,
          className: 'location-marker',
          interactive: true,
        }).addTo(map);

        // Permanent label below marker
        const label = L.marker([pos.y + 12, pos.x], {
          icon: L.divIcon({
            className: 'location-label',
            html: `<div style="
              font-family: Georgia, serif;
              color: white;
              font-size: 10px;
              text-shadow: 1px 1px 3px rgba(0,0,0,0.9);
              white-space: nowrap;
              text-align: center;
              pointer-events: none;
            ">${loc.name}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 0],
          }),
          interactive: false,
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

    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [playerColor, locationData, markerPositions, borders]);

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
    <div className="min-h-screen bg-[#0a1628] text-white relative" style={{ '--player-color': playerColor }}>
      <header className="bg-[#16213e] border-b border-gray-800 px-6 py-3 flex items-center justify-between z-10" style={{ height: '48px' }}>
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

      {/* Map + Sidebar wrapper */}
      <div className="relative w-full h-full" style={{ width: '100vw', height: 'calc(100vh - 48px)' }}>
        <main className="w-full h-full">
          <div ref={mapRef} className="w-full h-full" style={{ backgroundColor: '#0a1628' }} />
        </main>

        {/* Sidebar - sibling to map, positioned absolute in wrapper */}
        {selectedLocation && (
          <aside className="absolute right-0 top-0 h-full w-full md:w-96 bg-[#0d0d1a] border-l border-gray-700 pointer-events-auto overflow-y-auto z-1000 animate-slide-in" style={{ height: '100%' }}>
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
        )}
      </div>
    </div>
  );
};

export default MoraviaMap;