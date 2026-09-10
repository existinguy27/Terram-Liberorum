import React, { useState, useEffect } from 'react';
import {
  fetchPlayers, fetchMail, fetchLocations, fetchQuests, fetchNPCs, fetchRelics, fetchLore, fetchTowns,
  insertOne, updateOne, deleteOne, toggleVisible,
  type Player, type Mail, type Location, type Quest, type NPC, type Relic, type Lore, type Town
} from '../lib/api';

const PIN = '8472';
const STORAGE_KEY = 'gm-session';

const PREVIEW_PLAYERS = [
  { id: 'kael', name: 'Kael', color: '#ff8c00' },
  { id: 'hannya', name: 'Hannya', color: '#800080' },
  { id: 'silas', name: 'Silas', color: '#c0c0c0' },
  { id: 'ryuin', name: 'Ryuin', color: '#2ecc71' },
] as const;

type TabName = 'mail' | 'locations' | 'quests' | 'npcs' | 'relics' | 'lore' | 'towns' | 'preview';

const TABS: { id: TabName; label: string }[] = [
  { id: 'mail', label: 'Mail' },
  { id: 'locations', label: 'Locations' },
  { id: 'quests', label: 'Quests' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'relics', label: 'Relics' },
  { id: 'lore', label: 'Lore' },
  { id: 'towns', label: 'Towns' },
  { id: 'preview', label: 'Preview' },
];

type FormState = {
  mail: Partial<Mail>;
  locations: Partial<Location>;
  quests: Partial<Quest>;
  npcs: Partial<NPC>;
  relics: Partial<Relic>;
  lore: Partial<Lore>;
  towns: Partial<Town>;
  preview: Record<string, never>;
};

const initialFormState: FormState = {
  mail: { player_id: '', title: '', sender: '', content: '' },
  locations: { name: '', continent: 'Moravia', x_percent: 50, y_percent: 50, brief_description: '', full_description: '', notable_npcs: '', connected_quests: '', visible: true },
  quests: { title: '', type: 'side', status: 'active', description: '' },
  npcs: { name: '', affiliation: '', last_known_location: '', description: '', status: 'unknown', visible: true },
  relics: { name: '', type: 'relic', status: '', description: '', visible: true },
  lore: { title: '', category: '', content: '', visible: true },
  towns: { name: '', region: '', description: '', services: '', notable_npcs: '', current_rumors: '', visible: true },
  preview: {},
};

export const GMDashboard: React.FC = () => {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>('mail');
  const [players, setPlayers] = useState<Player[]>([]);
  const [data, setData] = useState<Record<TabName, any[]>>({
    mail: [], locations: [], quests: [], npcs: [], relics: [], lore: [], towns: []
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<TabName | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'authed') {
      setAuthed(true);
      loadAllData();
    }
  }, []);

  useEffect(() => {
    if (authed && players.length === 0) {
      fetchPlayers().then(setPlayers).catch(console.error);
    }
  }, [authed, players.length]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [mail, locations, quests, npcs, relics, lore, towns] = await Promise.all([
        fetchMail(), fetchLocations(), fetchQuests(), fetchNPCs(), fetchRelics(), fetchLore(), fetchTowns()
      ]);
      setData({ mail, locations, quests, npcs, relics, lore, towns });
    } catch (e) {
      setError('Failed to load data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PIN) {
      localStorage.setItem(STORAGE_KEY, 'authed');
      setAuthed(true);
      loadAllData();
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 1500);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
    setPin('');
    setData({ mail: [], locations: [], quests: [], npcs: [], relics: [], lore: [], towns: [] });
  };

  const resetForm = (tab: TabName) => {
    setFormData(prev => ({ ...prev, [tab]: initialFormState[tab] }));
    setEditingId(null);
    setShowForm(tab);
  };

  const handleFormChange = (tab: TabName, field: string, value: any) => {
    setFormData(prev => ({ ...prev, [tab]: { ...prev[tab], [field]: value } }));
  };

  const handleSubmit = async (tab: TabName, e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const payload = formData[tab];
      if (editingId) {
        await updateOne(tab === 'locations' ? 'locations' : tab === 'npcs' ? 'npcs' : tab === 'relics' ? 'relics' : tab === 'lore' ? 'lore' : tab === 'towns' ? 'towns' : tab === 'quests' ? 'quests' : 'mail', editingId, payload);
        setSuccess('Updated successfully');
      } else {
        await insertOne(tab === 'locations' ? 'locations' : tab === 'npcs' ? 'npcs' : tab === 'relics' ? 'relics' : tab === 'lore' ? 'lore' : tab === 'towns' ? 'towns' : tab === 'quests' ? 'quests' : 'mail', payload);
        setSuccess('Created successfully');
      }
      setShowForm(null);
      setEditingId(null);
      loadAllData();
    } catch (e: any) {
      setError(e.message || 'Operation failed');
      console.error(e);
    }
  };

  const handleEdit = (tab: TabName, item: any) => {
    setEditingId(item.id);
    setFormData(prev => ({ ...prev, [tab]: item }));
    setShowForm(tab);
  };

  const handleDelete = async (tab: TabName, id: string) => {
    if (!confirm('Delete this entry?')) return;
    setError(null);
    try {
      await deleteOne(tab === 'locations' ? 'locations' : tab === 'npcs' ? 'npcs' : tab === 'relics' ? 'relics' : tab === 'lore' ? 'lore' : tab === 'towns' ? 'towns' : tab === 'quests' ? 'quests' : 'mail', id);
      setSuccess('Deleted');
      loadAllData();
    } catch (e: any) {
      setError(e.message || 'Delete failed');
    }
  };

  const handleToggleVisible = async (tab: TabName, id: string, current: boolean) => {
    try {
      await toggleVisible(tab === 'locations' ? 'locations' : tab === 'npcs' ? 'npcs' : tab === 'relics' ? 'relics' : tab === 'lore' ? 'lore' : 'towns', id, !current);
      loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] text-white p-4">
        <div className="w-full max-w-md bg-[#16213e] rounded-lg p-8 border border-[#0f3460]">
          <h1 className="text-2xl font-bold text-center mb-6 text-[#e94560]">GM Dashboard</h1>
          <p className="text-center text-gray-400 mb-6">Enter PIN to access</p>
          <form onSubmit={handlePinSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="PIN"
              className={`w-full px-4 py-3 bg-[#0f3460] border rounded ${
                pinError ? 'border-red-500' : 'border-gray-600'
              } text-white focus:outline-none focus:ring-2 focus:ring-[#e94560]`}
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-3 bg-[#e94560] text-white font-semibold rounded hover:bg-[#d63650] transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  const items = data[activeTab];
  const playersList = players;

  const renderForm = () => {
    if (!showForm) return null;
    const tab = showForm;
    const isEditing = !!editingId;
    const fields = formData[tab];

    const commonStyle = "w-full px-4 py-2 bg-[#0f3460] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#e94560]";
    const labelStyle = "block text-sm text-gray-300 mb-1";

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#16213e] border border-[#0f3460] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[#e94560]">{isEditing ? 'Edit' : 'Add'} {TABS.find(t => t.id === tab)?.label}</h2>
            <button onClick={() => { setShowForm(null); setEditingId(null); }} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
          </div>
          <form onSubmit={e => handleSubmit(tab, e)} className="space-y-4">
            {tab === 'mail' && (
              <>
                <div>
                  <label className={labelStyle}>Player</label>
                  <select value={fields.player_id} onChange={e => handleFormChange(tab, 'player_id', e.target.value)} className={commonStyle} required>
                    <option value="">Select player</option>
                    {playersList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.character_name})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Title</label>
                  <input value={fields.title} onChange={e => handleFormChange(tab, 'title', e.target.value)} className={commonStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Sender</label>
                  <input value={fields.sender} onChange={e => handleFormChange(tab, 'sender', e.target.value)} className={commonStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Content</label>
                  <textarea value={fields.content} onChange={e => handleFormChange(tab, 'content', e.target.value)} className={commonStyle} rows={6} required />
                </div>
              </>
            )}
            {tab === 'locations' && (
              <>
                <div>
                  <label className={labelStyle}>Name</label>
                  <input value={fields.name} onChange={e => handleFormChange(tab, 'name', e.target.value)} className={commonStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Continent</label>
                  <input value={fields.continent} onChange={e => handleFormChange(tab, 'continent', e.target.value)} className={commonStyle} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyle}>X % (0-100)</label>
                    <input type="number" min="0" max="100" value={fields.x_percent} onChange={e => handleFormChange(tab, 'x_percent', parseFloat(e.target.value))} className={commonStyle} required />
                  </div>
                  <div>
                    <label className={labelStyle}>Y % (0-100)</label>
                    <input type="number" min="0" max="100" value={fields.y_percent} onChange={e => handleFormChange(tab, 'y_percent', parseFloat(e.target.value))} className={commonStyle} required />
                  </div>
                </div>
                <div>
                  <label className={labelStyle}>Brief Description</label>
                  <textarea value={fields.brief_description} onChange={e => handleFormChange(tab, 'brief_description', e.target.value)} className={commonStyle} rows={3} />
                </div>
                <div>
                  <label className={labelStyle}>Full Description</label>
                  <textarea value={fields.full_description} onChange={e => handleFormChange(tab, 'full_description', e.target.value)} className={commonStyle} rows={4} />
                </div>
                <div>
                  <label className={labelStyle}>Notable NPCs</label>
                  <textarea value={fields.notable_npcs} onChange={e => handleFormChange(tab, 'notable_npcs', e.target.value)} className={commonStyle} rows={2} />
                </div>
                <div>
                  <label className={labelStyle}>Connected Quests</label>
                  <textarea value={fields.connected_quests} onChange={e => handleFormChange(tab, 'connected_quests', e.target.value)} className={commonStyle} rows={2} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="loc-visible" checked={fields.visible} onChange={e => handleFormChange(tab, 'visible', e.target.checked)} className="w-4 h-4 accent-[#e94560]" />
                  <label htmlFor="loc-visible" className="text-gray-300">Visible to players</label>
                </div>
              </>
            )}
            {tab === 'quests' && (
              <>
                <div>
                  <label className={labelStyle}>Title</label>
                  <input value={fields.title} onChange={e => handleFormChange(tab, 'title', e.target.value)} className={commonStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Type</label>
                  <select value={fields.type} onChange={e => handleFormChange(tab, 'type', e.target.value)} className={commonStyle} required>
                    <option value="main">Main</option>
                    <option value="side">Side</option>
                    <option value="rumor">Rumor</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Status</label>
                  <select value={fields.status} onChange={e => handleFormChange(tab, 'status', e.target.value)} className={commonStyle} required>
                    <option value="active">Active</option>
                    <option value="complete">Complete</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Description</label>
                  <textarea value={fields.description} onChange={e => handleFormChange(tab, 'description', e.target.value)} className={commonStyle} rows={4} />
                </div>
              </>
            )}
            {tab === 'npcs' && (
              <>
                <div>
                  <label className={labelStyle}>Name</label>
                  <input value={fields.name} onChange={e => handleFormChange(tab, 'name', e.target.value)} className={commonStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Affiliation</label>
                  <input value={fields.affiliation} onChange={e => handleFormChange(tab, 'affiliation', e.target.value)} className={commonStyle} />
                </div>
                <div>
                  <label className={labelStyle}>Last Known Location</label>
                  <input value={fields.last_known_location} onChange={e => handleFormChange(tab, 'last_known_location', e.target.value)} className={commonStyle} />
                </div>
                <div>
                  <label className={labelStyle}>Description</label>
                  <textarea value={fields.description} onChange={e => handleFormChange(tab, 'description', e.target.value)} className={commonStyle} rows={4} />
                </div>
                <div>
                  <label className={labelStyle}>Status</label>
                  <select value={fields.status} onChange={e => handleFormChange(tab, 'status', e.target.value)} className={commonStyle} required>
                    <option value="alive">Alive</option>
                    <option value="dead">Dead</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="npc-visible" checked={fields.visible} onChange={e => handleFormChange(tab, 'visible', e.target.checked)} className="w-4 h-4 accent-[#e94560]" />
                  <label htmlFor="npc-visible" className="text-gray-300">Visible to players</label>
                </div>
              </>
            )}
            {tab === 'relics' && (
              <>
                <div>
                  <label className={labelStyle}>Name</label>
                  <input value={fields.name} onChange={e => handleFormChange(tab, 'name', e.target.value)} className={commonStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Type</label>
                  <select value={fields.type} onChange={e => handleFormChange(tab, 'type', e.target.value)} className={commonStyle} required>
                    <option value="relic">Relic</option>
                    <option value="boss">Boss</option>
                    <option value="encounter">Encounter</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Status</label>
                  <input value={fields.status} onChange={e => handleFormChange(tab, 'status', e.target.value)} className={commonStyle} />
                </div>
                <div>
                  <label className={labelStyle}>Description</label>
                  <textarea value={fields.description} onChange={e => handleFormChange(tab, 'description', e.target.value)} className={commonStyle} rows={4} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="relic-visible" checked={fields.visible} onChange={e => handleFormChange(tab, 'visible', e.target.checked)} className="w-4 h-4 accent-[#e94560]" />
                  <label htmlFor="relic-visible" className="text-gray-300">Visible to players</label>
                </div>
              </>
            )}
            {tab === 'lore' && (
              <>
                <div>
                  <label className={labelStyle}>Title</label>
                  <input value={fields.title} onChange={e => handleFormChange(tab, 'title', e.target.value)} className={commonStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Category</label>
                  <input value={fields.category} onChange={e => handleFormChange(tab, 'category', e.target.value)} className={commonStyle} />
                </div>
                <div>
                  <label className={labelStyle}>Content</label>
                  <textarea value={fields.content} onChange={e => handleFormChange(tab, 'content', e.target.value)} className={commonStyle} rows={6} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="lore-visible" checked={fields.visible} onChange={e => handleFormChange(tab, 'visible', e.target.checked)} className="w-4 h-4 accent-[#e94560]" />
                  <label htmlFor="lore-visible" className="text-gray-300">Visible to players</label>
                </div>
              </>
            )}
            {tab === 'towns' && (
              <>
                <div>
                  <label className={labelStyle}>Name</label>
                  <input value={fields.name} onChange={e => handleFormChange(tab, 'name', e.target.value)} className={commonStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Region</label>
                  <input value={fields.region} onChange={e => handleFormChange(tab, 'region', e.target.value)} className={commonStyle} />
                </div>
                <div>
                  <label className={labelStyle}>Description</label>
                  <textarea value={fields.description} onChange={e => handleFormChange(tab, 'description', e.target.value)} className={commonStyle} rows={4} />
                </div>
                <div>
                  <label className={labelStyle}>Services</label>
                  <textarea value={fields.services} onChange={e => handleFormChange(tab, 'services', e.target.value)} className={commonStyle} rows={2} />
                </div>
                <div>
                  <label className={labelStyle}>Notable NPCs</label>
                  <textarea value={fields.notable_npcs} onChange={e => handleFormChange(tab, 'notable_npcs', e.target.value)} className={commonStyle} rows={2} />
                </div>
                <div>
                  <label className={labelStyle}>Current Rumors</label>
                  <textarea value={fields.current_rumors} onChange={e => handleFormChange(tab, 'current_rumors', e.target.value)} className={commonStyle} rows={2} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="town-visible" checked={fields.visible} onChange={e => handleFormChange(tab, 'visible', e.target.checked)} className="w-4 h-4 accent-[#e94560]" />
                  <label htmlFor="town-visible" className="text-gray-300">Visible to players</label>
                </div>
              </>
            )}
            {tab === 'preview' && (
              <>
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-6">Click a player button below to open their view in a new tab for previewing.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {PREVIEW_PLAYERS.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => window.open(`/?preview=${p.id}`, '_blank')}
                        className="py-6 px-4 rounded-xl font-bold text-lg transition-all duration-200"
                        style={{
                          backgroundColor: '#16213e',
                          border: `2px solid ${p.color}40`,
                          color: p.color,
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = `${p.color}20`;
                          e.currentTarget.style.borderColor = p.color;
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = '#16213e';
                          e.currentTarget.style.borderColor = `${p.color}40`;
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => { setShowForm(null); setEditingId(null); }} className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded">Cancel</button>
              <button type="submit" className="flex-1 py-2 bg-[#e94560] hover:bg-[#d63650] rounded font-semibold">{isEditing ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderList = () => {
    const cols: Record<TabName, { key: keyof any; label: string }[]> = {
      mail: [
        { key: 'title', label: 'Title' },
        { key: 'sender', label: 'Sender' },
        { key: 'player_id', label: 'Player' },
        { key: 'created_at', label: 'Date' }
      ],
      locations: [
        { key: 'name', label: 'Name' },
        { key: 'continent', label: 'Continent' },
        { key: 'x_percent', label: 'X%' },
        { key: 'y_percent', label: 'Y%' },
        { key: 'visible', label: 'Visible' }
      ],
      quests: [
        { key: 'title', label: 'Title' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status' }
      ],
      npcs: [
        { key: 'name', label: 'Name' },
        { key: 'affiliation', label: 'Affiliation' },
        { key: 'status', label: 'Status' },
        { key: 'visible', label: 'Visible' }
      ],
      relics: [
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'visible', label: 'Visible' }
      ],
      lore: [
        { key: 'title', label: 'Title' },
        { key: 'category', label: 'Category' },
        { key: 'visible', label: 'Visible' }
      ],
      towns: [
        { key: 'name', label: 'Name' },
        { key: 'region', label: 'Region' },
        { key: 'visible', label: 'Visible' }
      ],
      preview: []
    };

    if (loading) return <div className="text-center py-8 text-gray-400">Loading...</div>;

    // Preview tab has no table - handled by renderForm
    if (activeTab === 'preview') {
      return (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">Use the "Add New" button to open the preview panel.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-sm uppercase tracking-wider">
              {cols[activeTab].map(c => <th key={String(c.key)} className="pb-2 px-2">{c.label}</th>)}
              <th className="pb-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={cols[activeTab].length + 1} className="text-center py-8 text-gray-500">No entries yet</td></tr>
            ) : (
              items.map(item => (
                <tr key={item.id} className="border-b border-gray-800 hover:bg-[#0f3460]/50">
                  {cols[activeTab].map(c => {
                    const val = item[c.key as keyof typeof item];
                    if (c.key === 'player_id' && val) {
                      const p = playersList.find(pl => pl.id === val);
                      return <td key={String(c.key)} className="py-2 px-2">{p?.name || val}</td>;
                    }
                    if (c.key === 'visible' && typeof val === 'boolean') {
                      return (
                        <td key={String(c.key)} className="py-2 px-2">
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={() => handleToggleVisible(activeTab, item.id, val)}
                            className="w-4 h-4 accent-[#e94560] cursor-pointer"
                          />
                        </td>
                      );
                    }
                    return <td key={String(c.key)} className="py-2 px-2 text-sm">{val ?? ''}</td>;
                  })}
                  <td className="py-2 px-2">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(activeTab, item)} className="px-2 py-1 text-xs bg-[#0f3460] hover:bg-[#1a1a2e] rounded text-gray-300">Edit</button>
                      <button onClick={() => handleDelete(activeTab, item.id)} className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-900 rounded text-red-300">Del</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      <header className="bg-[#16213e] border-b border-[#0f3460] px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-[#e94560]">GM Dashboard</h1>
        <button onClick={handleLogout} className="px-4 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">Logout</button>
      </header>

      <main className="p-6">
        {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded text-green-300">{success}</div>}

        <nav className="mb-6 border-b border-gray-700">
          <ul className="flex gap-1 overflow-x-auto pb-2">
            {TABS.map(tab => (
              <li key={tab.id}>
                <button
                  onClick={() => { setActiveTab(tab.id); setShowForm(null); setEditingId(null); }}
                  className={`px-4 py-2 rounded-t whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#e94560] text-white font-medium'
                      : 'bg-[#0f3460] text-gray-400 hover:text-white hover:bg-[#1a1a2e]'
                  }`}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">{TABS.find(t => t.id === activeTab)?.label}</h2>
          <button onClick={() => resetForm(activeTab)} className="px-4 py-2 bg-[#e94560] hover:bg-[#d63650] rounded font-medium transition-colors">
            + Add New
          </button>
        </div>

        {renderList()}
      </main>

      {renderForm()}
    </div>
  );
};

export default GMDashboard;