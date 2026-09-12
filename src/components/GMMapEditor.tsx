import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  fetchLocations,
  fetchContinentBorders,
  updateOne,
  insertOne,
  updateContinentBorder,
  type Location,
  type ContinentBorder
} from '../lib/api';

// Moravia bounds constants
const OUTLINE_MIN_X = 60;
const OUTLINE_MAX_X = 500;
const OUTLINE_MIN_Y = 30;
const OUTLINE_MAX_Y = 500;
const EXPANDED_BOUNDS: [[number, number], [number, number]] = [[-300, -300], [800, 800]];
const CONTENT_BOUNDS: [[number, number], [number, number]] = [[OUTLINE_MIN_Y, OUTLINE_MIN_X], [OUTLINE_MAX_Y, OUTLINE_MAX_X]];

// Convert percentage to canvas coordinates (Leaflet uses [lat, lng] = [y, x])
const percentToCanvas = (xPercent: number, yPercent: number): [number, number] => {
  const x = OUTLINE_MIN_X + (xPercent / 100) * (OUTLINE_MAX_X - OUTLINE_MIN_X);
  const y = OUTLINE_MIN_Y + (yPercent / 100) * (OUTLINE_MAX_Y - OUTLINE_MIN_Y);
  return [y, x];
};

// Convert canvas coordinates back to percentages
const canvasToPercent = (canvasX: number, canvasY: number): { xPercent: number; yPercent: number } => {
  const xPercent = ((canvasX - OUTLINE_MIN_X) / (OUTLINE_MAX_X - OUTLINE_MIN_X)) * 100;
  const yPercent = ((canvasY - OUTLINE_MIN_Y) / (OUTLINE_MAX_Y - OUTLINE_MIN_Y)) * 100;
  return {
    xPercent: Math.max(0, Math.min(100, Math.round(xPercent * 10) / 10)),
    yPercent: Math.max(0, Math.min(100, Math.round(yPercent * 10) / 10)),
  };
};

export const GMMapEditor: React.FC = () => {
  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const vertexHandlesRef = useRef<any[]>([]);
  const labelMarkerRef = useRef<any>(null);

  // Data state
  const [locations, setLocations] = useState<Location[]>([]);
  const [borders, setBorders] = useState<ContinentBorder[]>([]);
  const [markerPositions, setMarkerPositions] = useState<Record<string, { x: number; y: number }>>({});

  // UI state
  const [activeTab, setActiveTab] = useState<'locations' | 'borders'>('locations');
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState<Partial<Location>>({
    name: '',
    continent: 'Moravia',
    x_percent: 50,
    y_percent: 50,
    brief_description: '',
    full_description: '',
    notable_npcs: '',
    connected_quests: '',
    visible: true,
  });
  const [dirtyLocations, setDirtyLocations] = useState<Set<string>>(new Set());

  // Borders tab state
  const [editingBorderId, setEditingBorderId] = useState<string | null>(null);
  const [editingBorderCoords, setEditingBorderCoords] = useState<[number, number][]>([]);
  const [editingLabelX, setEditingLabelX] = useState<number>(0);
  const [editingLabelY, setEditingLabelY] = useState<number>(0);
  const [originalBorder, setOriginalBorder] = useState<ContinentBorder | null>(null);

  // Fetch locations
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchLocations();
        const moraviaLocations = data.filter(loc => loc.continent === 'Moravia');
        setLocations(moraviaLocations);

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
  }, []);

  // Fetch borders
  useEffect(() => {
    const fetchBorders = async () => {
      try {
        const data = await fetchContinentBorders('Moravia');
        console.log('[GMMapEditor] Fetched borders:', data);
        console.log('[GMMapEditor] Borders count:', data.length);
        data.forEach(b => console.log('[GMMapEditor] Border:', b.name, b.continent, b.border_type, b.coords?.length, 'coords'));
        setBorders(data);
      } catch (e) {
        console.error('[GMMapEditor] Failed to fetch borders:', e);
      }
    };
    fetchBorders();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const Leaflet = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      const map = Leaflet.map(mapRef.current!, {
        crs: Leaflet.CRS.Simple,
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
      map.getContainer().style.backgroundColor = '#0a1628';
      map.fitBounds(CONTENT_BOUNDS, { padding: [20, 20] });

      // Water background
      Leaflet.rectangle(EXPANDED_BOUNDS, {
        color: '#0a1628',
        fillColor: '#0a1628',
        fillOpacity: 1,
        weight: 0,
      }).addTo(map);

      // Compass rose
      const compass = Leaflet.control({ position: 'bottomleft' });
      compass.onAdd = () => {
        const div = Leaflet.DomUtil.create('div', 'compass-rose');
        div.innerHTML = `
          <div style="
            width: 60px; height: 60px;
            border: 2px solid #4a9a6a; border-radius: 50%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: rgba(10, 22, 40, 0.9);
            font-family: Georgia, serif; color: #4a9a6a; font-size: 10px; letter-spacing: 1px;
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

  // Render borders and locations on map (reacts to borders/locations/markerPositions changes)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const renderMap = async () => {
      const map = mapInstanceRef.current;
      const Leaflet = (await import('leaflet')).default;

      // Clear previous polygon layer and vertex handles
      if (polygonLayerRef.current) {
        map.removeLayer(polygonLayerRef.current);
      }
      vertexHandlesRef.current.forEach(h => map.removeLayer(h));
      vertexHandlesRef.current = [];
      if (labelMarkerRef.current) {
        map.removeLayer(labelMarkerRef.current);
      }

      // Create a layer group for all borders
      const borderLayer = Leaflet.layerGroup().addTo(map);
      polygonLayerRef.current = borderLayer;

      // Render each border
      borders.forEach(border => {
        const fillColor = border.fill_color || '#1a3a2a';
        const strokeColor = border.stroke_color || '#4a9a6a';
        const fillOpacity = border.fill_opacity ?? 0.8;

        // Database stores coords as [x, y], Leaflet CRS.Simple needs [lat, lng] = [y, x]
        const leafletCoords = border.coords.map(([x, y]) => [y, x] as [number, number]);

        if (border.border_type === 'continent' || border.border_type === 'ecozone') {
          // Polygon
          const poly = Leaflet.polygon(leafletCoords, {
            color: strokeColor,
            fillColor: fillColor,
            fillOpacity: border.border_type === 'ecozone' ? (fillOpacity ?? 0.4) : fillOpacity,
            weight: border.border_type === 'ecozone' ? 1 : 2,
            dashArray: border.border_type === 'ecozone' ? '5, 5' : undefined,
          }).addTo(borderLayer);

          // Label
          if (border.label_x != null && border.label_y != null) {
            if (border.border_type === 'ecozone') {
              Leaflet.marker([border.label_y, border.label_x], {
                icon: Leaflet.divIcon({
                  className: 'ecozone-label',
                  html: `<div style="font-family: Georgia, serif; color: #6aa85a; font-size: 11px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); pointer-events: none; white-space: nowrap;">${border.name}</div>`,
                  iconSize: [180, 30],
                  iconAnchor: [90, 15],
                }),
              }).addTo(borderLayer);
            } else {
              Leaflet.tooltip({
                permanent: true,
                direction: 'center',
                className: 'continent-label',
                offset: [0, 0],
              }).setContent(`
                <div style="font-family: Georgia, serif; color: white; font-size: 13px; font-weight: 500; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); white-space: nowrap;">${border.name}</div>
              `).setLatLng([border.label_y, border.label_x]).addTo(borderLayer);
            }
          }

          // If this border is being edited, add vertex handles
          if (editingBorderId === border.id) {
            leafletCoords.forEach((coord, index) => {
              const handle = Leaflet.circleMarker(coord, {
                radius: 6,
                fillColor: '#e94560',
                color: '#ffffff',
                weight: 2,
                fillOpacity: 1,
                className: 'vertex-handle',
              }).addTo(map);

              handle.dragging.enable();
              handle.on('drag', (e: any) => {
                const latlng = e.target.getLatLng();
                const newCoords = [...editingBorderCoords];
                newCoords[index] = [latlng.lat, latlng.lng];
                setEditingBorderCoords(newCoords);
                poly.setLatLngs(newCoords);
              });
              vertexHandlesRef.current.push(handle);
            });

            // Label marker (draggable for label position)
            if (border.label_x != null && border.label_y != null) {
              const labelMarker = Leaflet.marker([editingLabelY, editingLabelX], {
                icon: Leaflet.divIcon({
                  className: 'label-marker',
                  html: '<div style="width: 12px; height: 12px; background: #e94560; border: 2px solid white; border-radius: 50%; transform: translate(-50%, -50%);"></div>',
                  iconSize: [12, 12],
                  iconAnchor: [6, 6],
                }),
                draggable: true,
              }).addTo(map);

              labelMarker.on('drag', (e: any) => {
                const latlng = e.target.getLatLng();
                setEditingLabelX(latlng.lng);
                setEditingLabelY(latlng.lat);
              });
              labelMarkerRef.current = labelMarker;
            }
          }
        } else if (border.border_type === 'path') {
          Leaflet.polyline(leafletCoords, {
            color: strokeColor,
            weight: 3,
            dashArray: '10, 8',
            opacity: 0.8,
          }).addTo(borderLayer);

          if (border.label_x != null && border.label_y != null) {
            Leaflet.marker([border.label_y, border.label_x], {
              icon: Leaflet.divIcon({
                className: 'path-label',
                html: `<div style="font-family: Georgia, serif; color: ${strokeColor}; font-size: 10px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); white-space: nowrap;">${border.name}</div>`,
                iconSize: [200, 30],
                iconAnchor: [100, 15],
              }),
            }).addTo(borderLayer);
          }
        } else if (border.border_type === 'river') {
          Leaflet.polyline(leafletCoords, {
            color: strokeColor,
            weight: 4,
            opacity: 0.9,
          }).addTo(borderLayer);

          if (border.label_x != null && border.label_y != null) {
            Leaflet.marker([border.label_y, border.label_x], {
              icon: Leaflet.divIcon({
                className: 'river-label',
                html: `<div style="font-family: Georgia, serif; color: ${strokeColor}; font-size: 10px; font-style: italic; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); transform: rotate(90deg); white-space: nowrap;">${border.name}</div>`,
                iconSize: [100, 30],
                iconAnchor: [50, 15],
              }),
            }).addTo(borderLayer);
          }
        }
      });

      // Render location markers (read-only in this view)
      locations.forEach(loc => {
        const pos = markerPositions[loc.id];
        if (!pos) return;

        Leaflet.circleMarker([pos.y, pos.x], {
          radius: 8,
          fillColor: '#ffffff',
          color: '#e94560',
          weight: 2,
          fillOpacity: 1,
          className: 'location-marker',
          interactive: false,
        }).addTo(borderLayer);

        Leaflet.marker([pos.y + 12, pos.x], {
          icon: Leaflet.divIcon({
            className: 'location-label',
            html: `<div style="font-family: Georgia, serif; color: white; font-size: 10px; text-shadow: 1px 1px 3px rgba(0,0,0,0.9); white-space: nowrap; text-align: center; pointer-events: none;">${loc.name}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 0],
          }),
          interactive: false,
        }).addTo(borderLayer);
      });
    };
    renderMap();
  }, [borders, locations, markerPositions, editingBorderId, editingBorderCoords, editingLabelX, editingLabelY]);

  // Location form handlers
  const handleLocationFormChange = (field: string, value: any) => {
    setLocationForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddLocation = () => {
    setEditingLocationId(null);
    setLocationForm({
      name: '',
      continent: 'Moravia',
      x_percent: 50,
      y_percent: 50,
      brief_description: '',
      full_description: '',
      notable_npcs: '',
      connected_quests: '',
      visible: true,
    });
    setShowLocationForm(true);
  };

  const handleEditLocation = (loc: Location) => {
    setEditingLocationId(loc.id);
    setLocationForm({
      name: loc.name,
      continent: loc.continent,
      x_percent: loc.x_percent,
      y_percent: loc.y_percent,
      brief_description: loc.brief_description || '',
      full_description: loc.full_description || '',
      notable_npcs: loc.notable_npcs || '',
      connected_quests: loc.connected_quests || '',
      visible: loc.visible,
    });
    setShowLocationForm(true);
  };

  const handleLocationXChange = (id: string, value: number) => {
    setMarkerPositions(prev => ({ ...prev, [id]: { ...prev[id], x: OUTLINE_MIN_X + (value / 100) * (OUTLINE_MAX_X - OUTLINE_MIN_X) } }));
    setDirtyLocations(prev => new Set([...prev, id]));
  };

  const handleLocationYChange = (id: string, value: number) => {
    setMarkerPositions(prev => ({ ...prev, [id]: { ...prev[id], y: OUTLINE_MIN_Y + (value / 100) * (OUTLINE_MAX_Y - OUTLINE_MIN_Y) } }));
    setDirtyLocations(prev => new Set([...prev, id]));
  };

  const handleLocationVisibleToggle = (id: string, visible: boolean) => {
    const loc = locations.find(l => l.id === id);
    if (loc) {
      setLocations(prev => prev.map(l => l.id === id ? { ...l, visible } : l));
      setDirtyLocations(prev => new Set([...prev, id]));
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    try {
      await updateOne('locations', id, { visible: false }); // Soft delete via visible flag
      setLocations(prev => prev.filter(l => l.id !== id));
      setDirtyLocations(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) {
      console.error('Delete failed:', e);
      alert('Failed to delete location');
    }
  };

  const handleSaveLocation = async () => {
    if (!locationForm.name?.trim()) {
      alert('Name is required');
      return;
    }
    try {
      const canvasX = OUTLINE_MIN_X + (locationForm.x_percent! / 100) * (OUTLINE_MAX_X - OUTLINE_MIN_X);
      const canvasY = OUTLINE_MIN_Y + (locationForm.y_percent! / 100) * (OUTLINE_MAX_Y - OUTLINE_MIN_Y);
      const { xPercent, yPercent } = canvasToPercent(canvasX, canvasY);
      const payload = {
        ...locationForm,
        x_percent: xPercent,
        y_percent: yPercent,
      };
      if (editingLocationId) {
        await updateOne('locations', editingLocationId, payload);
        setLocations(prev => prev.map(l => l.id === editingLocationId ? { ...l, ...payload } : l));
      } else {
        const newLoc = await insertOne('locations', payload);
        setLocations(prev => [...prev, newLoc]);
        const [lat, lng] = percentToCanvas(xPercent, yPercent);
        setMarkerPositions(prev => ({ ...prev, [newLoc.id]: { x: lng, y: lat } }));
      }
      setShowLocationForm(false);
      setEditingLocationId(null);
      setDirtyLocations(prev => { const n = new Set(prev); n.delete(editingLocationId!); return n; });
    } catch (e) {
      console.error('Save location failed:', e);
      alert('Failed to save location');
    }
  };

  const handleCancelLocationForm = () => {
    setShowLocationForm(false);
    setEditingLocationId(null);
  };

  const handleSaveAllLocations = async () => {
    const dirtyIds = Array.from(dirtyLocations);
    if (dirtyIds.length === 0) {
      alert('No changes to save');
      return;
    }
    try {
      for (const id of dirtyIds) {
        const loc = locations.find(l => l.id === id);
        const pos = markerPositions[id];
        if (loc && pos) {
          const { xPercent, yPercent } = canvasToPercent(pos.x, pos.y);
          await updateOne('locations', id, {
            x_percent: xPercent,
            y_percent: yPercent,
            visible: loc.visible,
          });
        }
      }
      alert(`Saved ${dirtyIds.length} location(s)`);
      setDirtyLocations(new Set());
    } catch (e) {
      console.error('Batch save failed:', e);
      alert('Failed to save changes');
    }
  };

  // Border edit handlers
  const handleEditBorder = (border: ContinentBorder) => {
    setEditingBorderId(border.id);
    setEditingBorderCoords([...border.coords]);
    setEditingLabelX(border.label_x ?? 0);
    setEditingLabelY(border.label_y ?? 0);
    setOriginalBorder({ ...border });
    setActiveTab('borders'); // Ensure borders tab is active
  };

  const handleSaveBorder = async () => {
    if (!editingBorderId || !originalBorder) return;
    try {
      // Convert from Leaflet [y, x] back to database [x, y] format
      const dbCoords = editingBorderCoords.map(([y, x]) => [x, y] as [number, number]);
      await updateContinentBorder(editingBorderId, {
        coords: dbCoords,
        label_x: editingLabelX,
        label_y: editingLabelY,
      });
      // Refresh borders
      const data = await fetchContinentBorders('Moravia');
      setBorders(data);
      setEditingBorderId(null);
      setOriginalBorder(null);
    } catch (e) {
      console.error('Save border failed:', e);
      alert('Failed to save border');
    }
  };

  const handleCancelBorderEdit = () => {
    setEditingBorderId(null);
    setOriginalBorder(null);
    setEditingBorderCoords([]);
    setEditingLabelX(0);
    setEditingLabelY(0);
  };

  const formatField = (value: string | null | undefined) => {
    return value && value.trim() ? value : 'None recorded.';
  };

  // Group borders by continent for Borders tab
  const bordersByContinent = borders.reduce((acc, b) => {
    if (!acc[b.continent]) acc[b.continent] = [];
    acc[b.continent].push(b);
    return acc;
  }, {} as Record<string, ContinentBorder[]>);

  return (
    <div className="h-full bg-[#0a1628] text-white flex" style={{ '--player-color': '#e94560' }}>
      {/* Left Panel */}
      <aside className="w-[380px] flex-shrink-0 bg-[#16213e] border-r border-gray-700 flex flex-col">
        {/* Tab Bar */}
        <div className="flex border-b border-gray-700">
          {['locations', 'borders'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab as any); setShowLocationForm(false); setEditingLocationId(null); }}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#e94560] text-white bg-[#0a1628]'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-[#0a1628]'
              }`}
            >
              {tab === 'locations' ? 'Locations' : 'Borders'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'locations' && (
            <div className="space-y-4">
              {/* Add Location Button / Form */}
              {showLocationForm ? (
                <div className="bg-[#0a1628] border border-gray-700 rounded-lg p-4 space-y-3">
                  <h3 className="font-bold text-[#e94560]">{editingLocationId ? 'Edit Location' : 'Add Location'}</h3>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name *</label>
                    <input
                      value={locationForm.name}
                      onChange={e => handleLocationFormChange('name', e.target.value)}
                      className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm"
                      placeholder="Location name"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">X % (0-100)</label>
                      <input type="number" min="0" max="100" step="0.1"
                        value={locationForm.x_percent}
                        onChange={e => handleLocationFormChange('x_percent', parseFloat(e.target.value))}
                        className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Y % (0-100)</label>
                      <input type="number" min="0" max="100" step="0.1"
                        value={locationForm.y_percent}
                        onChange={e => handleLocationFormChange('y_percent', parseFloat(e.target.value))}
                        className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Continent</label>
                    <select value={locationForm.continent} onChange={e => handleLocationFormChange('continent', e.target.value)} className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm">
                      <option value="Moravia">Moravia</option>
                      <option value="Terram Liberorum">Terram Liberorum</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Brief Description</label>
                    <textarea value={locationForm.brief_description} onChange={e => handleLocationFormChange('brief_description', e.target.value)} className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm" rows={2} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Full Description</label>
                    <textarea value={locationForm.full_description} onChange={e => handleLocationFormChange('full_description', e.target.value)} className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm" rows={3} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Notable NPCs</label>
                    <textarea value={locationForm.notable_npcs} onChange={e => handleLocationFormChange('notable_npcs', e.target.value)} className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm" rows={2} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Connected Quests</label>
                    <textarea value={locationForm.connected_quests} onChange={e => handleLocationFormChange('connected_quests', e.target.value)} className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm" rows={2} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="loc-visible" checked={locationForm.visible} onChange={e => handleLocationFormChange('visible', e.target.checked)} className="w-4 h-4 accent-[#e94560]" />
                    <label htmlFor="loc-visible" className="text-sm text-gray-300">Visible to players</label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleCancelLocationForm} className="flex-1 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm">Cancel</button>
                    <button onClick={handleSaveLocation} className="flex-1 px-3 py-1 bg-[#e94560] text-white rounded hover:bg-[#d63650] text-sm font-medium">{editingLocationId ? 'Update' : 'Create'}</button>
                  </div>
                </div>
              ) : (
                <button onClick={handleAddLocation} className="w-full px-4 py-2 bg-[#e94560] text-white rounded hover:bg-[#d63650] font-medium transition-colors">+ Add Location</button>
              )}

              {/* Locations Table */}
              <div className="space-y-2">
                {locations.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No locations yet</p>
                ) : (
                  <div className="border border-gray-700 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[1fr_60px_60px_60px_80px] gap-1 bg-gray-800 px-2 py-1 text-xs font-medium text-gray-400 uppercase">
                      <span>Name</span>
                      <span>X</span>
                      <span>Y</span>
                      <span>Vis</span>
                      <span>Actions</span>
                    </div>
                    {locations.map(loc => {
                      const pos = markerPositions[loc.id];
                      const isDirty = dirtyLocations.has(loc.id);
                      const xPercent = pos ? canvasToPercent(pos.x, pos.y).xPercent : loc.x_percent;
                      const yPercent = pos ? canvasToPercent(pos.x, pos.y).yPercent : loc.y_percent;

                      return (
                        <div key={loc.id} className={`grid grid-cols-[1fr_60px_60px_60px_80px] gap-1 px-2 py-1 items-center border-t border-gray-700 ${isDirty ? 'bg-yellow-900/20 border-l-2 border-yellow-400' : 'hover:bg-[#0f3460]/50'}`}>
                          <span className="text-sm truncate font-medium text-white">{loc.name}</span>
                          <input type="number" min="0" max="100" step="0.1" value={xPercent}
                            onChange={e => handleLocationXChange(loc.id, parseFloat(e.target.value))}
                            className="w-full px-1 py-0.5 bg-[#0d0d1a] border border-gray-700 rounded text-white text-xs text-center" />
                          <input type="number" min="0" max="100" step="0.1" value={yPercent}
                            onChange={e => handleLocationYChange(loc.id, parseFloat(e.target.value))}
                            className="w-full px-1 py-0.5 bg-[#0d0d1a] border border-gray-700 rounded text-white text-xs text-center" />
                          <label className="flex items-center justify-center">
                            <input type="checkbox" checked={loc.visible} onChange={e => handleLocationVisibleToggle(loc.id, e.target.checked)} className="w-4 h-4 accent-[#e94560]" />
                          </label>
                          <div className="flex gap-1">
                            <button onClick={() => handleEditLocation(loc)} className="px-2 py-0.5 text-xs bg-[#0f3460] hover:bg-[#1a1a2e] rounded text-gray-300">Edit</button>
                            <button onClick={() => handleDeleteLocation(loc.id)} className="px-2 py-0.5 text-xs bg-red-900/50 hover:bg-red-900 rounded text-red-300">Del</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Save All Changes */}
              {dirtyLocations.size > 0 && (
                <button
                  onClick={handleSaveAllLocations}
                  className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-500 font-medium transition-colors"
                >
                  Save All Changes ({dirtyLocations.size})
                </button>
              )}
            </div>
          )}

          {activeTab === 'borders' && (
            <div className="space-y-4">
              {Object.entries(bordersByContinent).map(([continent, continentBorders]) => (
                <div key={continent} className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{continent}</h4>
                  {continentBorders.map(border => (
                    <div key={border.id} className="bg-[#0a1628] border border-gray-700 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{border.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded uppercase">{border.border_type}</span>
                        </div>
                        <button
                          onClick={() => handleEditBorder(border)}
                          disabled={editingBorderId !== null && editingBorderId !== border.id}
                          className="px-3 py-1 text-xs bg-[#e94560] text-white rounded hover:bg-[#d63650] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {editingBorderId === border.id ? 'Editing...' : 'Edit Shape'}
                        </button>
                      </div>

                      {editingBorderId === border.id && (
                        <div className="border-t border-gray-700 pt-2 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Label X</label>
                              <input type="number" step="1"
                                value={editingLabelX}
                                onChange={e => setEditingLabelX(parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Label Y</label>
                              <input type="number" step="1"
                                value={editingLabelY}
                                onChange={e => setEditingLabelY(parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 bg-[#0d0d1a] border border-gray-700 rounded text-white text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleCancelBorderEdit} className="flex-1 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm">Cancel</button>
                            <button onClick={handleSaveBorder} className="flex-1 px-3 py-1 bg-[#e94560] text-white rounded hover:bg-[#d63650] text-sm font-medium">Save Shape</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Right Panel - Live Map Preview */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" style={{ backgroundColor: '#0a1628' }} />
      </div>
    </div>
  );
};

export default GMMapEditor;