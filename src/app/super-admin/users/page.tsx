'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Loader2, 
  Users, 
  ShieldAlert, 
  Check, 
  Filter, 
  AlertTriangle, 
  Info, 
  Calendar, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  ChevronRight, 
  ChevronLeft,
  Eye,
  EyeOff
} from 'lucide-react';
import SlideOver from '@/components/SlideOver';
import Toast from '@/components/Toast';


interface StateRecord {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface LgRecord {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  state_id: string;
  state_name: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  lg_id: string | null;
  lg_name: string | null;
  state_id?: string | null;
  state_name: string | null;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'success';
}

function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          iconBg: 'bg-emerald-55 bg-emerald-50 text-emerald-600',
          btnBg: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20',
          icon: <Check className="h-5 w-5" />
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50 text-amber-600',
          btnBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/20',
          icon: <AlertTriangle className="h-5 w-5 text-amber-600" />
        };
      case 'danger':
      default:
        return {
          iconBg: 'bg-red-50 text-red-500',
          btnBg: 'bg-red-600 hover:bg-red-750 focus:ring-red-500/20',
          icon: <AlertTriangle className="h-5 w-5 text-red-500" />
        };
    }
  };

  const styles = getVariantStyles();

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
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${styles.iconBg}`}>
            {styles.icon}
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
            className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer ${styles.btnBg} shadow-md`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [lgs, setLgs] = useState<LgRecord[]>([]);
  const [states, setStates] = useState<StateRecord[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 3-Step Creation Form states
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('lg_chairman');
  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedLgId, setSelectedLgId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // User Details Panel states
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [activeUserDetails, setActiveUserDetails] = useState<UserRecord | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // User Edit Panel states
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editStateId, setEditStateId] = useState('');
  const [editLgId, setEditLgId] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Confirmation Modal states
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<'revoke' | 'grant' | 'delete' | null>(null);
  const [confirmTargetUser, setConfirmTargetUser] = useState<UserRecord | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  // Fetch users, LGs, and States
  useEffect(() => {
    async function fetchData() {
      try {
        const [usersRes, lgsRes, statesRes] = await Promise.all([
          fetch('/api/super-admin/users'),
          fetch('/api/super-admin/lgs'),
          fetch('/api/super-admin/states')
        ]);

        const usersData = await usersRes.json();
        const lgsData = await lgsRes.json();
        const statesData = await statesRes.json();

        if (usersRes.ok && lgsRes.ok && statesRes.ok) {
          setUsers(usersData.users || []);
          setLgs(lgsData.lgs || []);
          setStates(statesData.states || []);
        } else {
          setError(usersData.error || lgsData.error || statesData.error || 'Failed to fetch data');
        }
      } catch (err) {
        setError('Network error fetching users, states, and local governments');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleFetchDetails = async (id: string) => {
    setActiveUserDetails(null);
    setLoadingDetails(true);
    setError('');
    setSuccess('');
    setShowDetailsPanel(true);

    try {
      const res = await fetch(`/api/super-admin/users/${id}`);
      const data = await res.json();
      if (res.ok) {
        setActiveUserDetails(data.user);
      } else {
        setError(data.error || 'Failed to retrieve user details');
        setShowDetailsPanel(false);
      }
    } catch (err) {
      setError('Network error fetching user details');
      setShowDetailsPanel(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenEdit = (user: UserRecord) => {
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone || '');
    setEditRole(user.role);
    setEditStateId(user.state_id || '');
    setEditLgId(user.lg_id || '');
    setEditPassword('');
    setEditConfirmPassword('');
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
    setError('');
    setSuccess('');
    setShowDetailsPanel(false);
    setShowEditPanel(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim() || !editRole) {
      setError('Please fill in Name, Email and Role.');
      return;
    }

    if (editRole !== 'super_admin' && (!editStateId || !editLgId)) {
      setError('Please select an associated State and Local Government.');
      return;
    }

    if (editPassword) {
      if (editPassword.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (editPassword !== editConfirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setEditSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/super-admin/users/${activeUserDetails?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.toLowerCase().trim(),
          phone: editPhone.trim() || null,
          role: editRole,
          lg_id: editRole === 'super_admin' ? null : editLgId,
          password: editPassword.trim() ? editPassword : undefined
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setUsers(users.map(u => u.id === activeUserDetails?.id ? data.user : u));
        setSuccess(`User "${editName}" details updated successfully!`);
        setShowEditPanel(false);
        handleFetchDetails(data.user.id);
      } else {
        setError(data.error || 'Failed to update user');
      }
    } catch (err) {
      setError('Network error updating user');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCloseAddPanel = () => {
    setShowAddPanel(false);
    setActiveStep(1);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setNewRole('lg_chairman');
    setSelectedStateId('');
    setSelectedLgId('');
    setError('');
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!newName.trim()) return 'Full Name is required.';
      if (!newEmail.trim()) return 'Email Address is required.';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) return 'Please enter a valid email address.';
      if (!newPhone.trim()) return 'Phone Number is required.';
      return null;
    }
    if (step === 2) {
      if (!newRole) return 'Please select a role.';
      if (newRole !== 'super_admin') {
        if (!selectedStateId) return 'Please select an associated State.';
        if (!selectedLgId) return 'Please select an associated Local Government.';
      }
      return null;
    }
    if (step === 3) {
      if (!newPassword) return 'Password is required.';
      if (newPassword.length < 6) return 'Password must be at least 6 characters long.';
      if (newPassword !== confirmPassword) return 'Passwords do not match.';
      return null;
    }
    return null;
  };

  const handleNextStep = () => {
    const errorMsg = validateStep(activeStep);
    if (errorMsg) {
      setError(errorMsg);
      return;
    }
    setError('');
    setActiveStep(activeStep + 1);
  };

  const handlePrevStep = () => {
    setError('');
    setActiveStep(activeStep - 1);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validateStep(3);
    if (errorMsg) {
      setError(errorMsg);
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/super-admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.toLowerCase().trim(),
          phone: newPhone.trim(),
          password: newPassword,
          role: newRole,
          lg_id: newRole === 'super_admin' ? null : selectedLgId
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setUsers([...users, data.user].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)));
        setSuccess(`User "${newName}" created successfully!`);
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        setNewPassword('');
        setConfirmPassword('');
        setNewRole('lg_chairman');
        setSelectedStateId('');
        setSelectedLgId('');
        setActiveStep(1);
        setShowAddPanel(false);
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error creating user');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerConfirmModal = (type: 'revoke' | 'grant' | 'delete', user: UserRecord) => {
    setConfirmTargetUser(user);
    setConfirmType(type);
    setConfirmModalOpen(true);
  };

  const handleExecuteConfirm = async () => {
    if (!confirmTargetUser || !confirmType) return;
    
    setConfirmSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (confirmType === 'revoke' || confirmType === 'grant') {
        const newStatus = confirmType === 'grant';
        const res = await fetch(`/api/super-admin/users/${confirmTargetUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: newStatus })
        });
        const data = await res.json();
        if (res.ok) {
          setUsers(users.map(u => u.id === confirmTargetUser.id ? { ...u, is_active: data.user.is_active } : u));
          setSuccess(`User access for "${confirmTargetUser.name}" was successfully ${newStatus ? 'granted' : 'revoked'}.`);
          setConfirmModalOpen(false);
          handleFetchDetails(confirmTargetUser.id);
        } else {
          setError(data.error || `Failed to update status`);
          setConfirmModalOpen(false);
        }
      } else if (confirmType === 'delete') {
        const res = await fetch(`/api/super-admin/users/${confirmTargetUser.id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok) {
          setUsers(users.filter(u => u.id !== confirmTargetUser.id));
          setSuccess(`User account "${confirmTargetUser.name}" has been permanently deleted.`);
          setConfirmModalOpen(false);
          setShowDetailsPanel(false);
          setActiveUserDetails(null);
        } else {
          setError(data.error || 'Failed to delete user account.');
          setConfirmModalOpen(false);
        }
      }
    } catch (err) {
      setError(`Network error during action.`);
      setConfirmModalOpen(false);
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.lg_name && u.lg_name.toLowerCase().includes(search.toLowerCase())) ||
      (u.state_name && u.state_name.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-50 border-purple-100 text-purple-700';
      case 'lg_admin':
      case 'lg_chairman':
        return 'bg-blue-50 border-blue-100 text-blue-700';
      case 'lg_account_officer':
      case 'lg_officer':
        return 'bg-teal-50 border-teal-100 text-teal-700';
      case 'treasurer':
      case 'lg_treasurer':
        return 'bg-indigo-50 border-indigo-100 text-indigo-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-600';
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'lg_chairman':
        return 'LG Chairman';
      case 'lg_admin':
        return 'LG Admin (Chairman)';
      case 'lg_officer':
        return 'LG Officer';
      case 'lg_account_officer':
        return 'LG Account Officer';
      case 'lg_treasurer':
        return 'LG Treasurer';
      case 'treasurer':
        return 'LG Treasurer (Legacy)';
      default:
        return role;
    }
  };

  const isModalActive = showAddPanel || showEditPanel || showDetailsPanel;

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">User Management</h1>
          <p className="text-sm text-slate-505">Onboard platform operators and Local Government staff.</p>
        </div>
        <button
          onClick={() => {
            setError('');
            setSuccess('');
            setShowAddPanel(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-750 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Create New User</span>
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
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="Search users by name, email, or LG..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-150 text-sm"
            />
          </div>

          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Filter className="h-4 w-4" />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-150 text-sm appearance-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="lg_chairman">LG Chairman</option>
              <option value="lg_treasurer">LG Treasurer</option>
              <option value="lg_officer">LG Officer</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                <th className="py-4 px-6">Name / Email</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Associated LG</th>
                <th className="py-4 px-6">State</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-650">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-amber-600" />
                    <span>Loading users...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/40 transition-colors duration-150">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800">{u.name}</div>
                      <div className="text-xs text-slate-450 mt-0.5">{u.email}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getRoleBadge(u.role)}`}>
                        {getRoleName(u.role)}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-650">
                      {u.lg_name || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-4 px-6 text-slate-550">
                      {u.state_name || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        u.is_active 
                          ? 'bg-amber-50 border-amber-100 text-amber-700' 
                          : 'bg-red-50 border-red-100 text-red-655'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                        <span>{u.is_active ? 'Active' : 'Deactivated'}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleFetchDetails(u.id)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Onboarding Drawer */}
      <SlideOver
        isOpen={showAddPanel}
        onClose={handleCloseAddPanel}
        title="Create New User"
        icon={<Users className="h-5 w-5 text-amber-600" />}
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {activeStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-850 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseAddPanel}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-550 hover:text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              
              {activeStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  form="add-user-form"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              )}
            </div>
          </div>
        }
      >
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            {/* Background track line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 -z-10"></div>
            {/* Active track line */}
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-amber-500 -z-10 transition-all duration-300"
              style={{ width: `${((activeStep - 1) / 2) * 100}%` }}
            ></div>

            {[1, 2, 3].map((step) => {
              const isCompleted = activeStep > step;
              const isActive = activeStep === step;
              return (
                <div key={step} className="flex flex-col items-center">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      isCompleted 
                        ? 'bg-amber-600 text-white shadow' 
                        : isActive 
                          ? 'bg-white border-2 border-amber-600 text-amber-700 shadow-sm ring-4 ring-amber-500/10' 
                          : 'bg-white border-2 border-slate-200 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : (
                      <span>{step}</span>
                    )}
                  </div>
                  <span 
                    className={`text-[10px] font-bold mt-2 tracking-wider uppercase transition-colors duration-200 ${
                      isActive ? 'text-amber-700' : isCompleted ? 'text-slate-650' : 'text-slate-400'
                    }`}
                  >
                    {step === 1 ? 'Personal' : step === 2 ? 'Location' : 'Password'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleAddUser} id="add-user-form" className="space-y-5">
          {/* STEP 1: Personal Details */}
          {activeStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label htmlFor="user-name" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  id="user-name"
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-55 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                />
              </div>

              <div>
                <label htmlFor="user-email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  id="user-email"
                  type="email"
                  required
                  placeholder="e.g. johndoe@lga.gov.ng"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                />
              </div>

              <div>
                <label htmlFor="user-phone" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <input
                  id="user-phone"
                  type="tel"
                  required
                  placeholder="e.g. +234 803 123 4567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Location and Role */}
          {activeStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label htmlFor="user-role" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Platform Role
                </label>
                <select
                  id="user-role"
                  required
                  value={newRole}
                  onChange={(e) => {
                    setNewRole(e.target.value);
                    if (e.target.value === 'super_admin') {
                      setSelectedStateId('');
                      setSelectedLgId('');
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-55 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm cursor-pointer"
                >
                  <option value="lg_chairman">LG Chairman</option>
                  <option value="lg_treasurer">LG Treasurer</option>
                  <option value="lg_officer">LG Officer</option>
                  <option value="super_admin">Khrien Super Admin</option>
                </select>
              </div>

              {newRole !== 'super_admin' ? (
                <>
                  <div>
                    <label htmlFor="user-state" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Associated State
                    </label>
                    <select
                      id="user-state"
                      required
                      value={selectedStateId}
                      onChange={(e) => {
                        setSelectedStateId(e.target.value);
                        setSelectedLgId('');
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm cursor-pointer"
                    >
                      <option value="">Select State</option>
                      {states.filter(s => s.is_active).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="user-lg" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Associated Local Government
                    </label>
                    <select
                      id="user-lg"
                      required
                      value={selectedLgId}
                      onChange={(e) => setSelectedLgId(e.target.value)}
                      disabled={!selectedStateId}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{selectedStateId ? 'Select Local Govt' : 'Select State first'}</option>
                      {lgs
                        .filter(lg => lg.state_id === selectedStateId && lg.is_active)
                        .map(lg => (
                          <option key={lg.id} value={lg.id}>
                            {lg.name}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                </>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
                  <Info className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Federated Platform Operations</span>
                    <span className="text-[10px] text-slate-500 leading-relaxed block mt-0.5">
                      Super Admins operate across all states and local governments in the federation. No location binding is required.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Password Creation */}
          {activeStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label htmlFor="user-pass" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    id="user-pass"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-pass" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-pass"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </SlideOver>

      {/* Details View Drawer */}
      <SlideOver
        isOpen={showDetailsPanel}
        onClose={() => setShowDetailsPanel(false)}
        title="User Profile Details"
        icon={<Info className="h-5 w-5 text-amber-600" />}
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              <button
                type="button"
                onClick={() => setShowDetailsPanel(false)}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-550 hover:text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
              >
                Close Profile
              </button>
            </div>
            {activeUserDetails && (
              <div className="flex items-center gap-3">
                {activeUserDetails.is_active ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(activeUserDetails)}
                      className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                    >
                      Edit details
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerConfirmModal('revoke', activeUserDetails)}
                      className="px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-655 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                    >
                      Revoke Access
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => triggerConfirmModal('grant', activeUserDetails)}
                      className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                    >
                      Grant Access
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerConfirmModal('delete', activeUserDetails)}
                      className="px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-655 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                    >
                      Delete User
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        }
      >
        {loadingDetails ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-600" />
            <p className="text-xs font-bold tracking-wider uppercase">Loading profile...</p>
          </div>
        ) : activeUserDetails ? (
          <div className="space-y-6">
            
            {/* User Name & Status Banner */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 border border-slate-200/60 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center font-extrabold text-lg uppercase shrink-0">
                {activeUserDetails.name.slice(0, 2)}
              </div>
              <div className="space-y-0.5">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">{activeUserDetails.name}</h2>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${getRoleBadge(activeUserDetails.role)}`}>
                    {getRoleName(activeUserDetails.role)}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    activeUserDetails.is_active 
                      ? 'bg-amber-50 border-amber-100 text-amber-700' 
                      : 'bg-red-50 border-red-100 text-red-655'
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${activeUserDetails.is_active ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                    <span>{activeUserDetails.is_active ? 'Active' : 'Suspended'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Fields List */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-450 uppercase tracking-wider">Contact & Location</h3>
              
              <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white divide-y divide-slate-100 text-xs">
                <div className="p-4 flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Email Address</span>
                  <span className="text-slate-700 font-medium">{activeUserDetails.email}</span>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Phone Number</span>
                  <span className="text-slate-700 font-medium">{activeUserDetails.phone || '—'}</span>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Associated State</span>
                  <span className="text-slate-700 font-medium">{activeUserDetails.state_name || 'Khrien Federated'}</span>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Associated LGA</span>
                  <span className="text-slate-700 font-medium">{activeUserDetails.lg_name || 'Khrien Federated'}</span>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Onboarded Date</span>
              <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{new Date(activeUserDetails.created_at).toLocaleDateString([], { dateStyle: 'long' })}</span>
              </div>
            </div>

          </div>
        ) : (
          <p className="text-center text-slate-400 text-xs py-10">Failed to load user details.</p>
        )}
      </SlideOver>

      {/* Edit View Drawer */}
      <SlideOver
        isOpen={showEditPanel}
        onClose={() => {
          setShowEditPanel(false);
          if (activeUserDetails) setShowDetailsPanel(true);
        }}
        title="Edit User Details"
        icon={<Edit3 className="h-5 w-5 text-amber-600" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowEditPanel(false);
                if (activeUserDetails) setShowDetailsPanel(true);
              }}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-550 hover:text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-user-form"
              disabled={editSubmitting}
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
        <form onSubmit={handleEditUser} id="edit-user-form" className="space-y-5">
          <div>
            <label htmlFor="edit-user-name" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Full Name
            </label>
            <input
              id="edit-user-name"
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-user-email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              id="edit-user-email"
              type="email"
              required
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-user-phone" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <input
              id="edit-user-phone"
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-user-role" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              Platform Role
            </label>
            <select
              id="edit-user-role"
              required
              value={editRole}
              onChange={(e) => {
                setEditRole(e.target.value);
                if (e.target.value === 'super_admin') {
                  setEditStateId('');
                  setEditLgId('');
                }
              }}
              className="w-full px-4 py-3 bg-slate-55 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm cursor-pointer"
            >
              <option value="lg_chairman">LG Chairman</option>
              <option value="lg_treasurer">LG Treasurer</option>
              <option value="lg_officer">LG Officer</option>
              <option value="super_admin">Khrien Super Admin</option>
            </select>
          </div>

          {editRole !== 'super_admin' ? (
            <>
              <div>
                <label htmlFor="edit-user-state" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  Associated State
                </label>
                <select
                  id="edit-user-state"
                  required
                  value={editStateId}
                  onChange={(e) => {
                    setEditStateId(e.target.value);
                    setEditLgId('');
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm cursor-pointer"
                >
                  <option value="">Select State</option>
                  {states.filter(s => s.is_active).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-user-lg" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  Associated Local Government
                </label>
                <select
                  id="edit-user-lg"
                  required
                  value={editLgId}
                  onChange={(e) => setEditLgId(e.target.value)}
                  disabled={!editStateId}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm cursor-pointer disabled:opacity-50"
                >
                  <option value="">{editStateId ? 'Select Local Govt' : 'Select State first'}</option>
                  {lgs
                    .filter(lg => lg.state_id === editStateId && lg.is_active)
                    .map(lg => (
                      <option key={lg.id} value={lg.id}>
                        {lg.name}
                      </option>
                    ))
                  }
                </select>
              </div>
            </>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-700 block">Federated Platform Operations</span>
                <span className="text-[10px] text-slate-500 leading-relaxed block mt-0.5">
                  Super Admins operate across all states and local governments in the federation. No location binding is required.
                </span>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-5 space-y-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Security Settings</span>
            <div>
              <label htmlFor="edit-user-pass" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Reset Password
              </label>
              <div className="relative">
                <input
                  id="edit-user-pass"
                  type={showEditPassword ? 'text' : 'password'}
                  placeholder="Leave blank to keep current password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                >
                  {showEditPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {editPassword && (
              <div>
                <label htmlFor="edit-confirm-pass" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Confirm Reset Password
                </label>
                <div className="relative">
                  <input
                    id="edit-confirm-pass"
                    type={showEditConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={editConfirmPassword}
                    onChange={(e) => setEditConfirmPassword(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                  >
                    {showEditConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </SlideOver>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModalOpen}
        title={
          confirmType === 'delete' 
            ? 'Delete User Account' 
            : confirmType === 'revoke' 
              ? 'Revoke Access Privileges' 
              : 'Grant Access Privileges'
        }
        message={
          confirmType === 'delete'
            ? `Are you sure you want to permanently delete user "${confirmTargetUser?.name}" (${confirmTargetUser?.email})? This action cannot be undone and will erase their account settings.`
            : confirmType === 'revoke'
              ? `Are you sure you want to temporarily revoke access for user "${confirmTargetUser?.name}"? They will be immediately logged out and blocked from logging back in.`
              : `Are you sure you want to restore access privileges for user "${confirmTargetUser?.name}"? They will immediately be able to log back in to the platform.`
        }
        confirmLabel={
          confirmSubmitting 
            ? (confirmType === 'delete' ? 'Deleting...' : confirmType === 'revoke' ? 'Revoking...' : 'Restoring...')
            : (confirmType === 'delete' ? 'Delete Account' : confirmType === 'revoke' ? 'Revoke Access' : 'Restore Access')
        }
        onConfirm={handleExecuteConfirm}
        onCancel={() => setConfirmModalOpen(false)}
        variant={confirmType === 'delete' ? 'danger' : confirmType === 'revoke' ? 'warning' : 'success'}
      />
    </div>
  );
}
