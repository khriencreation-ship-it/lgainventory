'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Map, ShieldAlert, Check, Edit3, Trash2, Calendar, ShieldCheck, Info, AlertTriangle } from 'lucide-react';
import SlideOver from '@/components/SlideOver';
import Toast from '@/components/Toast';


interface StateRecord {
  id: string;
  name: string;
  code: string;
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
}

interface LgRecord {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"
      ></div>

      {/* Modal Dialog */}
      <div className="relative bg-white border border-slate-200/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10 text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-red-50 text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
        </div>
        
        <p className="text-xs text-slate-550 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer bg-red-600 hover:bg-red-750 shadow-md shadow-red-500/10"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StatesManagement() {
  const [states, setStates] = useState<StateRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add panel states
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Detail panel states
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [activeStateDetails, setActiveStateDetails] = useState<StateRecord | null>(null);
  const [activeStateLgs, setActiveStateLgs] = useState<LgRecord[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [stateLgCount, setStateLgCount] = useState(0);
  const [stateUserCount, setStateUserCount] = useState(0);

  // Edit panel states
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editLogoPreview, setEditLogoPreview] = useState('');
  const [editUploadingLogo, setEditUploadingLogo] = useState(false);
  const [editStatus, setEditStatus] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Confirmation Modal states
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteStateObj, setConfirmDeleteStateObj] = useState<{ id: string, name: string } | null>(null);

  // Fetch states on mount
  useEffect(() => {
    fetchStates();
  }, []);

  async function fetchStates() {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/states');
      const data = await res.json();
      if (res.ok) {
        setStates(data.states || []);
      } else {
        setError(data.error || 'Failed to load states');
      }
    } catch (err) {
      setError('Network error loading states');
    } finally {
      setLoading(false);
    }
  }

  const handleFetchDetails = async (id: string) => {
    setActiveStateDetails(null);
    setActiveStateLgs([]);
    setLoadingDetails(true);
    setError('');
    setSuccess('');
    setShowDetailsPanel(true);

    try {
      const res = await fetch(`/api/super-admin/states/${id}`);
      const data = await res.json();
      if (res.ok) {
        setActiveStateDetails(data.state);
        setActiveStateLgs(data.lgs || []);
        setStateLgCount(data.state.lg_count || 0);
        setStateUserCount(data.state.user_count || 0);
      } else {
        setError(data.error || 'Failed to retrieve state details');
        setShowDetailsPanel(false);
      }
    } catch (err) {
      setError('Network error fetching details');
      setShowDetailsPanel(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenEdit = (state: StateRecord) => {
    setEditName(state.name);
    setEditCode(state.code);
    setEditLogoUrl(state.logo_url || '');
    setEditLogoPreview(state.logo_url || '');
    setEditStatus(state.is_active);
    setError('');
    setSuccess('');
    setShowDetailsPanel(false); // Close details if open
    setShowEditPanel(true);
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      setError('');
      setSuccess('');
      const res = await fetch(`/api/super-admin/states/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      const data = await res.json();

      if (res.ok) {
        setStates(states.map(s => s.id === id ? data.state : s));
        setSuccess(`State status updated successfully.`);
      } else {
        setError(data.error || 'Failed to update state status');
      }
    } catch (err) {
      setError('Network error updating state status');
    }
  };

  const handleAddState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCode) {
      setError('Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/super-admin/states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, code: newCode, logo_url: newLogoUrl }),
      });

      const data = await res.json();

      if (res.ok) {
        setStates([...states, data.state].sort((a, b) => a.name.localeCompare(b.name)));
        setSuccess(`State "${newName}" onboarded successfully!`);
        setNewName('');
        setNewCode('');
        setNewLogoUrl('');
        setLogoPreview('');
        setShowAddPanel(false);
      } else {
        setError(data.error || 'Failed to onboard state');
      }
    } catch (err) {
      setError('Network error creating state');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStateDetails || !editName || !editCode) {
      setError('Please fill in all required fields.');
      return;
    }

    setEditSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/super-admin/states/${activeStateDetails.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          code: editCode,
          logo_url: editLogoUrl,
          is_active: editStatus
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStates(states.map(s => s.id === activeStateDetails.id ? data.state : s).sort((a, b) => a.name.localeCompare(b.name)));
        setSuccess(`State details updated successfully!`);
        setShowEditPanel(false);
        handleFetchDetails(activeStateDetails.id);
      } else {
        setError(data.error || 'Failed to update state');
      }
    } catch (err) {
      setError('Network error updating state');
    } finally {
      setEditSubmitting(false);
    }
  };

  const triggerDeleteConfirm = (id: string, name: string) => {
    setConfirmDeleteStateObj({ id, name });
    setConfirmDeleteOpen(true);
  };

  const executeDeleteState = async (id: string) => {
    setError('');
    setSuccess('');
    setShowDetailsPanel(false);

    try {
      const res = await fetch(`/api/super-admin/states/${id}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (res.ok) {
        setStates(states.filter(s => s.id !== id));
        setSuccess(`State "${confirmDeleteStateObj?.name}" has been deleted successfully.`);
      } else {
        setError(data.error || 'Failed to delete state');
      }
    } catch (err) {
      setError('Network error deleting state');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isEdit) {
      setEditLogoPreview(URL.createObjectURL(file));
      setEditUploadingLogo(true);
    } else {
      setLogoPreview(URL.createObjectURL(file));
      setUploadingLogo(true);
    }
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/super-admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        if (isEdit) {
          setEditLogoUrl(data.url);
        } else {
          setNewLogoUrl(data.url);
        }
      } else {
        setError(data.error || 'Failed to upload logo');
        if (isEdit) setEditLogoPreview(''); else setLogoPreview('');
      }
    } catch (err) {
      setError('Network error uploading logo');
      if (isEdit) setEditLogoPreview(''); else setLogoPreview('');
    } finally {
      if (isEdit) setEditUploadingLogo(false); else setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = (isEdit: boolean) => {
    if (isEdit) {
      setEditLogoUrl('');
      setEditLogoPreview('');
    } else {
      setNewLogoUrl('');
      setLogoPreview('');
    }
  };

  const filteredStates = states.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  const isModalActive = showAddPanel || showEditPanel || showDetailsPanel;

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">State Management</h1>
          <p className="text-sm text-slate-505">Onboard and manage states across the federation.</p>
        </div>
        <button
          onClick={() => {
            setError('');
            setSuccess('');
            setLogoPreview('');
            setNewLogoUrl('');
            setNewName('');
            setNewCode('');
            setShowAddPanel(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add New State</span>
        </button>
      </div>

      {/* Notifications */}
      {error && !isModalActive && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-amber-50 border border-amber-100 text-amber-800 text-sm rounded-xl p-4 flex items-center gap-2">
          <Check className="h-5 w-5 shrink-0 text-amber-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Floating Toast Notification for modal errors */}
      <Toast message={isModalActive ? error : ''} type="error" onClose={() => setError('')} />


      {/* Main Card Wrapper */}
      <div className="bg-white border border-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
        
        {/* Search bar */}
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            placeholder="Search states by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-150 text-sm"
          />
        </div>

        {/* States Table */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider">
                <th className="py-4 px-6">State Name</th>
                <th className="py-4 px-6">State Code</th>
                <th className="py-4 px-6">Onboarded Date</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-650">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-amber-600" />
                    <span>Loading states...</span>
                  </td>
                </tr>
              ) : filteredStates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    No states found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStates.map((state) => (
                  <tr key={state.id} className="hover:bg-slate-50/40 transition-colors duration-150">
                    <td 
                      onClick={() => handleFetchDetails(state.id)}
                      className="py-4 px-6 font-bold text-slate-800 flex items-center gap-3 cursor-pointer group"
                    >
                      {state.logo_url ? (
                        <img 
                          src={state.logo_url} 
                          alt={`${state.name} Logo`} 
                          className="w-8 h-8 rounded-lg object-cover border border-slate-100 shadow-sm shrink-0 bg-white"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center font-extrabold text-xs shadow-sm uppercase shrink-0">
                          {state.code.slice(0, 2)}
                        </div>
                      )}
                      <span className="group-hover:text-amber-700 group-hover:underline transition-colors">{state.name}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">
                        {state.code}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-550">
                      {new Date(state.created_at).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        state.is_active 
                          ? 'bg-amber-50 border-amber-100 text-amber-700' 
                          : 'bg-red-50 border-red-100 text-red-655'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${state.is_active ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                        <span>{state.is_active ? 'Active' : 'Deactivated'}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleFetchDetails(state.id)}
                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all cursor-pointer"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handleOpenEdit(state)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-750 text-xs font-bold rounded-lg transition-all cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => triggerDeleteConfirm(state.id, state.name)}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-655 text-xs font-bold rounded-lg transition-all cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboarding Add State Drawer */}
      <SlideOver
        isOpen={showAddPanel}
        onClose={() => setShowAddPanel(false)}
        title="Onboard New State"
        icon={<Map className="h-5 w-5 text-amber-600" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowAddPanel(false)}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-state-form"
              disabled={submitting || uploadingLogo}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <span>Onboard State</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleAddState} id="add-state-form" className="space-y-5">
          <div>
            <label htmlFor="state-name" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              State Name
            </label>
            <input
              id="state-name"
              type="text"
              required
              placeholder="e.g. Oyo State"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
            />
          </div>

          <div>
            <label htmlFor="state-code" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              State Code (Abbreviation)
            </label>
            <input
              id="state-code"
              type="text"
              required
              placeholder="e.g. OY"
              maxLength={5}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
            />
            <p className="text-[10px] text-slate-400 mt-1">Short unique prefix code representing the state.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              State Logo
            </label>
            
            {logoPreview ? (
              <div className="relative rounded-2xl border border-slate-200 p-4 bg-slate-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={logoPreview} 
                    alt="Logo Preview" 
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200/50 bg-white shadow-sm shrink-0"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Uploaded Logo</span>
                    {uploadingLogo ? (
                      <span className="text-[10px] text-amber-600 font-bold animate-pulse block">Uploading...</span>
                    ) : (
                      <span className="text-[10px] text-emerald-655 font-bold block">Ready</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveLogo(false)}
                  disabled={uploadingLogo}
                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 text-red-655 hover:text-red-750 text-[10px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative group rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-500/50 p-6 bg-slate-50/50 hover:bg-amber-50/10 flex flex-col items-center justify-center text-center gap-2 transition-all duration-200">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, false)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Upload state logo</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Drag & drop or click to choose file</span>
                </div>
              </div>
            )}
          </div>
        </form>
      </SlideOver>

      {/* Details View Drawer */}
      <SlideOver
        isOpen={showDetailsPanel}
        onClose={() => setShowDetailsPanel(false)}
        title="State Profile Details"
        icon={<Info className="h-5 w-5 text-amber-600" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowDetailsPanel(false)}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-550 hover:text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
            >
              Close Profile
            </button>
            {activeStateDetails && (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(activeStateDetails)}
                  className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-750 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                >
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={() => triggerDeleteConfirm(activeStateDetails.id, activeStateDetails.name)}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-655 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                >
                  Delete State
                </button>
              </>
            )}
          </>
        }
      >
        {loadingDetails ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-600" />
            <p className="text-xs font-bold tracking-wider uppercase">Loading profile...</p>
          </div>
        ) : activeStateDetails ? (
          <div className="space-y-6">
            
            {/* Logo and Name Banner */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 border border-slate-200/60 rounded-2xl">
              {activeStateDetails.logo_url ? (
                <img 
                  src={activeStateDetails.logo_url} 
                  alt="State Logo" 
                  className="w-16 h-16 rounded-xl object-cover bg-white border border-slate-250 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 font-black text-2xl flex items-center justify-center uppercase shrink-0">
                  {activeStateDetails.code.slice(0, 2)}
                </div>
              )}
              <div className="space-y-0.5">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">{activeStateDetails.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 font-extrabold rounded-md uppercase tracking-wider">
                    {activeStateDetails.code}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                    activeStateDetails.is_active 
                      ? 'bg-amber-50 border-amber-100 text-amber-700' 
                      : 'bg-red-50 border-red-100 text-red-655'
                  }`}>
                    {activeStateDetails.is_active ? 'Active Node' : 'Deactivated'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metadata Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Onboarded Date</span>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                  <Calendar className="h-4 w-4 text-slate-405" />
                  <span>{new Date(activeStateDetails.created_at).toLocaleDateString([], { dateStyle: 'medium' })}</span>
                </div>
              </div>
              <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Infrastructure</span>
                <div className="flex items-center gap-3 text-slate-700 font-bold text-xs pt-0.5">
                  <span>{stateLgCount} LGAs</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                  <span>{stateUserCount} Staff</span>
                </div>
              </div>
            </div>

            {/* Associated Local Governments list */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-450 uppercase tracking-wider">Local Government Deployments</h3>
              {activeStateLgs.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                  No local governments onboarded in this state yet.
                </div>
              ) : (
                <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-4">LG Name</th>
                        <th className="py-2.5 px-4">Code</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-650">
                      {activeStateLgs.map(lg => (
                        <tr key={lg.id} className="hover:bg-slate-55/30">
                          <td className="py-2.5 px-4 font-bold text-slate-800">{lg.name}</td>
                          <td className="py-2.5 px-4 uppercase font-medium">{lg.code}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              lg.is_active 
                                ? 'bg-amber-50 border-amber-100 text-amber-700' 
                                : 'bg-red-50 border-red-100 text-red-655'
                            }`}>
                              {lg.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        ) : (
          <p className="text-center text-slate-400 text-xs py-10">Failed to load state details.</p>
        )}
      </SlideOver>

      {/* Edit View Drawer */}
      <SlideOver
        isOpen={showEditPanel}
        onClose={() => {
          setShowEditPanel(false);
          // If we had a detail drawer open, reopen it on close
          if (activeStateDetails) setShowDetailsPanel(true);
        }}
        title="Edit State Details"
        icon={<Edit3 className="h-5 w-5 text-amber-600" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowEditPanel(false);
                if (activeStateDetails) setShowDetailsPanel(true);
              }}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-550 hover:text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-state-form"
              disabled={editSubmitting || editUploadingLogo}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md cursor-pointer disabled:cursor-not-allowed"
            >
              {editSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleEditState} id="edit-state-form" className="space-y-5">
          <div>
            <label htmlFor="edit-name" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              State Name
            </label>
            <input
              id="edit-name"
              type="text"
              required
              placeholder="e.g. Oyo State"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-code" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              State Code (Abbreviation)
            </label>
            <input
              id="edit-code"
              type="text"
              required
              placeholder="e.g. OY"
              maxLength={5}
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
            />
            <p className="text-[10px] text-slate-400 mt-1">Short unique prefix code representing the state.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              State Status
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditStatus(true)}
                className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer ${
                  editStatus 
                    ? 'bg-amber-50 border-amber-200 text-amber-750 shadow-sm shadow-amber-500/5' 
                    : 'bg-white border-slate-200 text-slate-550 hover:bg-slate-55'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setEditStatus(false)}
                className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer ${
                  !editStatus 
                    ? 'bg-red-50 border-red-200 text-red-655 shadow-sm shadow-red-500/5' 
                    : 'bg-white border-slate-200 text-slate-550 hover:bg-slate-55'
                }`}
              >
                Deactivated
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              State Logo
            </label>
            
            {editLogoPreview ? (
              <div className="relative rounded-2xl border border-slate-200 p-4 bg-slate-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={editLogoPreview} 
                    alt="Logo Preview" 
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200/50 bg-white shadow-sm shrink-0"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Uploaded Logo</span>
                    {editUploadingLogo ? (
                      <span className="text-[10px] text-amber-600 font-bold animate-pulse block">Uploading...</span>
                    ) : (
                      <span className="text-[10px] text-emerald-650 font-bold block">Ready</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveLogo(true)}
                  disabled={editUploadingLogo}
                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 text-red-655 hover:text-red-750 text-[10px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative group rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-500/50 p-6 bg-slate-50/50 hover:bg-amber-50/10 flex flex-col items-center justify-center text-center gap-2 transition-all duration-200">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, true)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Upload state logo</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Drag & drop or click to choose file</span>
                </div>
              </div>
            )}
          </div>
        </form>
      </SlideOver>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDeleteOpen}
        title="Delete State"
        message={`Are you sure you want to permanently delete state "${confirmDeleteStateObj?.name}"? This action cannot be undone, and will fail if there are any active onboarded Local Governments associated with this state.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          if (confirmDeleteStateObj) {
            executeDeleteState(confirmDeleteStateObj.id);
          }
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
