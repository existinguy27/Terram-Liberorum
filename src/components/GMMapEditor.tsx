import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fetchLocations, updateOne, insertOne, type Location } from '../lib/api';

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

// Bounding box for Moravia outline (x: 60-500, y: 30-500)
const OUTLINE_MIN_X = 60;
const OUTLINE_MAX_X = 500;
const OUTLINE_MIN_Y = 30;
const OUTLINE_MAX_Y = 500;

// Expanded bounds with 300 unit padding
const EXPANDED_BOUNDS: [[number, number], [number, number]] = [[-300, -300], [800, 800]];
const CONTENT_BOUNDS: [[number, number], [number, number]] = [[OUTLINE_MIN_Y, OUTLINE_MIN_X], [OUTLINE_MAX_Y, OUTLINE_MAX_X]];

export const GMMapEditor: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [gmMode, setGmMode] = useState<'view' | 'place' | 'edit'>('view');
  const [draggingVertex, setDraggingVertex] = useState<{ polygon: string; index: number } | null>(null);
  const [polygonCoords, setPolygonCoords] = useState<{
    outline: [number, number][];
    ecozones: Record<string, [number, number][]>;
  }>({
    outline: moraviaOutline,
    ecozones: ecozones.reduce((acc, z) => ({ ...acc, [z.name]: z.coords }), {}),
  });
  const [markerPositions, setMarkerPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [locationData, setLocationData] = useState<Location[]>([]);
  const [newMarkerForm, setNewMarkerForm] = useState<{
    active: boolean;
    lat: number;
    lng: number;
    name: string;
    brief_description: string;
    full_description: string;
    visible: boolean;
  }>({ active: false, lat: 0, lng: 0, name: '', brief_description: '', full_description: '', visible: true });
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
  const [showVertexHandles, setShowVertexHandles] = useState<string | null>(null);

  // Scale percentage to canvas coordinates within Moravia bounds
  const percentToCanvas = useCallback((xPercent: number, yPercent: number): [number, number] => {
    const x = OUTLINE_MIN_X + (xPercent / 100) * (OUTLINE_MAX_X - OUTLINE_MIN_X);
    const y = OUTLINE_MIN_Y + (yPercent / 100) * (OUTLINE_MAX_Y - OUTLINE_MIN_Y);
    return [y, x]; // Leaflet uses [lat, lng] = [y, x]
  }, []);

  // Convert canvas coordinates back to percentages
  const canvasToPercent = useCallback((canvasX: number, canvasY: number): { xPercent: number; yPercent: number } => {
    const xPercent = ((canvasX - OUTLINE_MIN_X) / (OUTLINE_MAX_X - OUTLINE_MIN_X)) * 100;
    const yPercent = ((canvasY - OUTLINE_MIN_Y) / (OUTLINE_MAX_Y - OUTLINE_MIN_Y)) * 100;
    return {
      xPercent: Math.max(0, Math.min(100, Math.round(xPercent * 10) / 10)),
      yPercent: Math.max(0, Math.min(100, Math.round(yPercent * 10) / 10)),
    };
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
        console.error('[GMMapEditor] Failed to fetch locations:', e);
      }
    };
    fetchData();
  }, [percentToCanvas]);

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
      const waterLayer = L.rectangle(EXPANDED_BOUNDS, {
        color: '#0a1628',
        fillColor: '#0a1628',
        fillOpacity: 1,
        weight: 0,
      }).addTo(map);

      // Store layer references
      const layers: {
        outline: any;
        ecozones: Record<string, any>;
        markers: Record<string, { marker: any; label: any }>;
        vertexHandles: Record<string, any[]>;
      } = {
        outline: null,
        ecozones: {},
        markers: {},
        vertexHandles: {},
      };

      // Moravia continent outline
      const outlinePolygon = L.polygon(polygonCoords.outline, {
        color: '#4a9a6a',
        fillColor: '#1a3a2a',
        fillOpacity: 0.8,
        weight: 2,
      }).addTo(map);
      layers.outline = outlinePolygon;

      // Ecozone layers
      ecozones.forEach((zone) => {
        const ecozonePolygon = L.polygon(polygonCoords.ecozones[zone.name] || zone.coords, {
          color: zone.fillColor,
          fillColor: zone.fillColor,
          fillOpacity: 0.4,
          weight: 1,
          dashArray: '5, 5',
        }).addTo(map);
        layers.ecozones[zone.name] = ecozonePolygon;

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
          color: '#e94560',
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

        layers.markers[loc.id] = { marker, label };

        marker.dragging.enable();

        // Show tooltip with coordinates while dragging
        marker.on('dragstart', () => {
          marker.bindTooltip(
            `x: ${canvasToPercent(pos.x, pos.y).xPercent}%, y: ${canvasToPercent(pos.x, pos.y).yPercent}%`,
            { permanent: true, direction: 'top', offset: [0, -10] }
          ).openTooltip();
        });

        marker.on('drag', (e: any) => {
          const latlng = e.target.getLatLng();
          const { xPercent, yPercent } = canvasToPercent(latlng.lng, latlng.lat);
          marker.setTooltipContent(`x: ${xPercent}%, y: ${yPercent}%`);

          setMarkerPositions(prev => ({
            ...prev,
            [loc.id]: { x: latlng.lng, y: latlng.lat }
          }));

          // Update label position
          label.setLatLng([latlng.lat + 12, latlng.lng]);
        });

        marker.on('dragend', (e: any) => {
          const latlng = e.target.getLatLng();
          const { xPercent, yPercent } = canvasToPercent(latlng.lng, latlng.lat);

          marker.unbindTooltip();

          setMarkerPositions(prev => ({
            ...prev,
            [loc.id]: { x: latlng.lng, y: latlng.lat }
          }));

          setUnsavedChanges(prev => new Set([...prev, loc.id]));

          label.setLatLng([latlng.lat + 12, latlng.lng]);
        });

        // Click to select (only in view mode)
        marker.on('click', () => {
          if (gmMode === 'view') {
            setSelectedLocation(loc);
          }
        });
      });

      // Add vertex handles for polygons
      const addVertexHandles = (polygonName: string, coords: [number, number][], layer: any) => {
        const handles: any[] = [];
        coords.forEach((coord, index) => {
          const handle = L.circleMarker([coord[0], coord[1]], {
            radius: 6,
            fillColor: '#e94560',
            color: '#ffffff',
            weight: 2,
            fillOpacity: 1,
            className: 'vertex-handle',
            interactive: showVertexHandles === polygonName,
          }).addTo(map);

          if (showVertexHandles === polygonName) {
            handle.dragging.enable();
            handle.on('drag', (e: any) => {
              const latlng = e.target.getLatLng();
              const newCoords = [...coords];
              newCoords[index] = [latlng.lat, latlng.lng];

              if (polygonName === 'outline') {
                setPolygonCoords(prev => ({ ...prev, outline: newCoords }));
                layer.setLatLngs(newCoords);
              } else {
                setPolygonCoords(prev => ({
                  ...prev,
                  ecozones: { ...prev.ecozones, [polygonName]: newCoords }
                }));
                layer.setLatLngs(newCoords);
              }
            });
          }

          handles.push(handle);
        });
        layers.vertexHandles[polygonName] = handles;
      };

      addVertexHandles('outline', polygonCoords.outline, outlinePolygon);
      Object.keys(polygonCoords.ecozones).forEach(name => {
        addVertexHandles(name, polygonCoords.ecozones[name], layers.ecozones[name]);
      });

      // Handle map click for placing new markers
      map.on('click', (e: any) => {
        if (gmMode === 'place' && !newMarkerForm.active) {
          const latlng = e.latlng;
          setNewMarkerForm({
            active: true,
            lat: latlng.lat,
            lng: latlng.lng,
            name: '',
            brief_description: '',
            full_description: '',
            visible: true,
          });
        }
      });

      // Store layers ref for cleanup
      (window as any).__gmeditorLayers = layers;

    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      // Clean up vertex handles
      const layers = (window as any).__gmeditorLayers;
      if (layers) {
        Object.values(layers.vertexHandles).flat().forEach((h: any) => mapInstanceRef.current?.removeLayer(h));
      }
    };
  }, [gmMode, showVertexHandles, polygonCoords, markerPositions, locationData, newMarkerForm.active, canvasToPercent]);

  // Update vertex handles when polygonCoords or showVertexHandles change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    // Vertex handles are recreated when showVertexHandles changes
  }, [polygonCoords, showVertexHandles]);

  const handleCloseSidebar = () => {
    setSelectedLocation(null);
  };

  const handleSaveAllPositions = async () => {
    const changes = Array.from(unsavedChanges);
    if (changes.length === 0) {
      alert('No changes to save');
      return;
    }

    try {
      for (const id of changes) {
        const pos = markerPositions[id];
        if (pos) {
          const { xPercent, yPercent } = canvasToPercent(pos.x, pos.y);
          await updateOne('locations', id, { x_percent: xPercent, y_percent: yPercent });
        }
      }
      alert(`Saved ${changes.length} position(s)`);
      setUnsavedChanges(new Set());
      window.location.reload();
    } catch (e) {
      console.error('[GMMapEditor] Failed to save positions:', e);
      alert('Failed to save positions');
    }
  };

  const handleCreateLocation = async () => {
    if (!newMarkerForm.name.trim()) {
      alert('Name is required');
      return;
    }
    try {
      const { xPercent, yPercent } = canvasToPercent(newMarkerForm.lng, newMarkerForm.lat);
      await insertOne('locations', {
        name: newMarkerForm.name,
        continent: 'Moravia',
        x_percent: xPercent,
        y_percent: yPercent,
        brief_description: newMarkerForm.brief_description,
        full_description: newnewMarkerForm.full_description,
        visible: newMarkerForm.visible,
      });
      alert(`Created "${newMarkerForm.name}" at x:${xPercent}%, y:${yPercent}%`);
      setNewMarkerForm({ active: false, lat: 0, lng: 0, name: '', brief_description: '', full_description: '', visible: true });
      setGmMode('view');
      window.location.reload();
    } catch (e) {
      console.error('[GMMapEditor] Failed to create location:', e);
      alert('Failed to create location');
    }
  };

  const handleCancelNewMarker = () => {
    setNewMarkerForm({ active: false, lat: 0, lng: 0, name: '', brief_description: '', full_description: '', visible: true });
    setGmMode('view');
  };

  const handleCopyCoords = (name: string) => {
    const coords = name === 'outline' ? polygonCoords.outline : polygonCoords.ecozones[name];
    const json = JSON.stringify(coords, null, 2);
    navigator.clipboard.writeText(json);
    alert(`Copied ${name} coordinates to clipboard`);
  };

  const formatField = (value: string | null | undefined) => {
    return value && value.trim() ? value : 'None recorded.';
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white relative" style={{ '--player-color': '#e94560' }}>
      <header className="bg-[#16213e] border-b border-gray-800 px-6 py-3 flex items-center justify-between z-10" style={{ height: '48px' }}>
        <button
          onClick={() => window.location.href = '/map/moravia'}
          className="px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          ← Moravia Map
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#e94560' }}>
          Moravia — Map Editor
        </h1>
      </header>

      {/* Top banner */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-[#e94560] text-white px-4 py-2 text-center font-bold text-sm">
        GM MAP EDITOR — {gmMode === 'place' ? 'Click map to place new marker' : gmMode === 'edit' ? 'Drag vertices to reshape' : 'Drag markers to reposition'}
      </div>

      {/* Left toolbar panel */}
      <aside className="fixed left-0 top-12 bottom-0 w-72 bg-[#16213e] border-r border-gray-700 p-4 overflow-y-auto z-40" style={{ top: '48px', height: 'calc(100vh - 48px)' }}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#e94560]">GM MAP EDITOR</span>
          </div>

          {/* Mode toggles */}
          <div className="flex gap-2">
            <button
              onClick={() => { setGmMode('view'); setShowVertexHandles(null); }}
              className={`flex-1 px-2 py-1 text-xs rounded ${gmMode === 'view' ? 'bg-[#e94560] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              View
            </button>
            <button
              onClick={() => { setGmMode('place'); setShowVertexHandles(null); setNewMarkerForm(prev => ({ ...prev, active: true })); }}
              className={`flex-1 px-2 py-1 text-xs rounded ${gmMode === 'place' ? 'bg-[#e94560] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Place
            </button>
            <button
              onClick={() => { setGmMode('edit'); setShowVertexHandles('outline'); }}
              className={`flex-1 px-2 py-1 text-xs rounded ${gmMode === 'edit' ? 'bg-[#e94560] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Edit Borders
            </button>
          </div>

          {/* Save All button */}
          {unsavedChanges.size > 0 && (
            <button
              onClick={handleSaveAllPositions}
              className="w-full px-3 py-2 bg-[#e94560] text-white rounded hover:bg-[#d63650] transition-colors text-sm font-medium"
            >
              Save All Positions ({unsavedChanges.size})
            </button>
          )}

          {/* Vertex handle toggles */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-xs text-gray-400 mb-2">Show Vertex Handles:</p>
            <div className="space-y-1">
              <button
                onClick={() => setShowVertexHandles(prev => prev === 'outline' ? null : 'outline')}
                className={`w-full text-left px-2 py-1 text-xs rounded ${showVertexHandles === 'outline' ? 'bg-[#e94560] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                Continent Outline
                <button
                  onClick={() => handleCopyCoords('outline')}
                  className="ml-1 text-[10px] px-1 py-0.5 bg-gray-600 rounded hover:bg-gray-500"
                >
                  Copy
                </button>
              </button>
              {Object.keys(polygonCoords.ecozones).map(name => (
                <button
                  key={name}
                  onClick={() => setShowVertexHandles(prev => prev === name ? null : name)}
                  className={`w-full text-left px-2 py-1 text-xs rounded ${showVertexHandles === name ? 'bg-[#e94560] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  {name}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyCoords(name); }}
                    className="ml-1 text-[10px] px-1 py-0.5 bg-gray-600 rounded hover:bg-gray-500"
                  >
                    Copy
                  </button>
                </button>
              ))}
            </div>
          </div>

          {/* Location list */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-xs text-gray-400 mb-2 font-medium">Locations ({locationData.length})</p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {locationData.map(loc => {
                const pos = markerPositions[loc.id];
                const hasChanges = unsavedChanges.has(loc.id);
                const coords = pos
                  ? `${canvasToPercent(pos.x, pos.y).xPercent}%, ${canvasToPercent(pos.x, pos.y).yPercent}%`
                  : `${loc.x_percent}%, ${loc.y_percent}%`;

                return (
                  <div key={loc.id} className={`px-2 py-1 rounded text-xs ${hasChanges ? 'bg-[#e94560]/20 border border-[#e94560]' : 'bg-gray-800'} flex flex-col gap-1`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white truncate">{loc.name}</span>
                      {hasChanges && <span className="text-[10px] text-[#e94560]">●</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">{coords}</div>
                    <button
                      onClick={() => {
                        if (mapInstanceRef.current && pos) {
                          mapInstanceRef.current.setView([pos.y, pos.x], 2, { animate: true });
                        }
                      }}
                      className="text-[10px] text-[#e94560] hover:underline self-start"
                    >
                      Jump to
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* New Marker Form Overlay */}
      {newMarkerForm.active && (
        <div className="fixed inset-0 z-50 pointer-events-none" style={{ top: '48px' }}>
          <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={handleCancelNewMarker} />
          <div className="fixed left-72 top-20 w-96 bg-[#16213e] border border-gray-700 rounded-lg p-4 pointer-events-auto z-50 shadow-xl">
            <h3 className="text-lg font-bold text-[#e94560] mb-4">New Location</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newMarkerForm.name}
                  onChange={(e) => setNewMarkerForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm"
                  placeholder="Location name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Brief Description</label>
                <textarea
                  value={newMarkerForm.brief_description}
                  onChange={(e) => setNewMarkerForm(prev => ({ ...prev, brief_description: e.target.value }))}
                  className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm"
                  rows={2}
                  placeholder="Short description for map popup"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Full Description</label>
                <textarea
                  value={newMarkerForm.full_description}
                  onChange={(e) => setNewMarkerForm(prev => ({ ...prev, full_description: e.target.value }))}
                  className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm"
                  rows={4}
                  placeholder="Detailed description for sidebar"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="visible-toggle"
                  checked={newMarkerForm.visible}
                  onChange={(e) => setNewMarkerForm(prev => ({ ...prev, visible: e.target.checked }))}
                  className="w-4 h-4 accent-[#e94560]"
                />
                <label htmlFor="visible-toggle" className="text-sm text-gray-300">Visible to players</label>
              </div>
              <div className="text-[10px] text-gray-500 font-mono">
                Position: {canvasToPercent(newMarkerForm.lng, newMarkerForm.lat).xPercent}%, {canvasToPercent(newMarkerForm.lng, newMarkerForm.lat).yPercent}%
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCancelNewMarker}
                  className="flex-1 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLocation}
                  className="flex-1 px-3 py-1 bg-[#e94560] text-white rounded hover:bg-[#d63650] text-sm font-medium"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <h2 className="text-2xl font-bold mb-1" style={{ color: '#e94560' }}>
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

export default GMMapEditor;