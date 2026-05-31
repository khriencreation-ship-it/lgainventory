'use client';

import { useState, useEffect, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Loader2, Building2, ShieldAlert, Check, Edit3, Trash2, 
  Calendar, Info, MapPin, Phone, Mail, FileText, Users, Bookmark, X, AlertTriangle, ChevronRight
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
  state_id: string;
  name: string;
  code: string;
  jurisdiction?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
  state_name: string;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  flutterwave_subaccount_id?: string | null;
  flutterwave_subaccount_code?: string | null;
  khrien_split_percentage?: number | string | null;
  payment_setup_status?: 'not_configured' | 'payment_setup_incomplete' | 'active' | null;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmStyle: 'amber' | 'red';
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmStyle,
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"
      ></div>

      <div className="relative bg-white border border-slate-200/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            confirmStyle === 'red' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
        </div>
        
        <p className="text-xs text-slate-500 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer ${
              confirmStyle === 'red' 
                ? 'bg-red-600 hover:bg-red-750 shadow-md shadow-red-500/10' 
                : 'bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/10'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'EcoBank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '090479', name: 'First Heritage Microfinance Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '000030', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '090267', name: 'Kuda Bank' },
  { code: '100004', name: 'Opay' },
  { code: '100033', name: 'PalmPay' },
  { code: '327', name: 'Paga' },
  { code: '090110', name: 'VFD Microfinance Bank' }
];

export default function LgDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lg, setLg] = useState<LgRecord | null>(null);
  const [states, setStates] = useState<StateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // General metrics/counts
  const [lgUserCount, setLgUserCount] = useState(0);
  const [lgClientCount, setLgClientCount] = useState(0);
  const [lgBillCount, setLgBillCount] = useState(0);

  // Tab state
  const [detailsTab, setDetailsTab] = useState<'general' | 'levies' | 'banking'>('general');

  // Operational states
  const [retryingPayment, setRetryingPayment] = useState(false);

  // Edit details states
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editStateId, setEditStateId] = useState('');
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editJurisdiction, setEditJurisdiction] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editLogoPreview, setEditLogoPreview] = useState('');
  const [editUploadingLogo, setEditUploadingLogo] = useState(false);
  const [editStatus, setEditStatus] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Activation/Deactivation/Delete confirmation modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<'deactivate' | 'activate' | 'delete'>('deactivate');

  // Levy categories & items states
  const [detailCategories, setDetailCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  // Category modals
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [submittingCat, setSubmittingCat] = useState(false);

  const [showEditCatModal, setShowEditCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [submittingEditCat, setSubmittingEditCat] = useState(false);

  const [showDelCatConfirm, setShowDelCatConfirm] = useState(false);
  const [delCatTarget, setDelCatTarget] = useState<any>(null);

  // Levy Item modals
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemCategory, setAddItemCategory] = useState<any>(null);
  const [newItemName, setNewItemName] = useState('');
  const [submittingItem, setSubmittingItem] = useState(false);

  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editItemName, setEditItemName] = useState('');
  const [submittingEditItem, setSubmittingEditItem] = useState(false);

  const [showDelItemConfirm, setShowDelItemConfirm] = useState(false);
  const [delItemTarget, setDelItemTarget] = useState<any>(null);

  // Bank Accounts states
  const [detailBankAccounts, setDetailBankAccounts] = useState<any[]>([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);

  // Bank account modals
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [addBankCode, setAddBankCode] = useState('');
  const [addBankAccountNumber, setAddBankAccountNumber] = useState('');
  const [addBankAccountName, setAddBankAccountName] = useState('');
  const [verifyingBankAcc, setVerifyingBankAcc] = useState(false);
  const [bankAccVerified, setBankAccVerified] = useState(false);
  const [bankAccManual, setBankAccManual] = useState(false);
  const [submittingBankAcc, setSubmittingBankAcc] = useState(false);

  const [showDelBankConfirm, setShowDelBankConfirm] = useState(false);
  const [delBankTarget, setDelBankTarget] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchLgDetails();
      fetchStates();
    }
  }, [id]);

  useEffect(() => {
    if (id && detailsTab === 'levies') {
      fetchLgCategories();
    }
  }, [id, detailsTab]);

  useEffect(() => {
    if (id && detailsTab === 'banking') {
      fetchLgBankAccounts();
    }
  }, [id, detailsTab]);

  async function fetchStates() {
    try {
      const res = await fetch('/api/super-admin/states');
      const data = await res.json();
      if (res.ok) {
        setStates(data.states || []);
      }
    } catch (err) {
      console.error('Error fetching states list:', err);
    }
  }

  async function fetchLgDetails() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}`);
      const data = await res.json();
      if (res.ok) {
        setLg(data.lg);
        setLgUserCount(data.lg.user_count || 0);
        setLgClientCount(data.lg.client_count || 0);
        setLgBillCount(data.lg.bill_count || 0);
      } else {
        setError(data.error || 'Failed to retrieve Local Government details');
      }
    } catch (err) {
      setError('Network error fetching details');
    } finally {
      setLoading(false);
    }
  }

  async function fetchLgCategories() {
    setLoadingCategories(true);
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/categories`);
      const data = await res.json();
      if (res.ok) {
        setDetailCategories(data.categories || []);
      } else {
        setError(data.error || 'Failed to retrieve categories');
      }
    } catch (err) {
      setError('Network error retrieving categories');
    } finally {
      setLoadingCategories(false);
    }
  }

  async function fetchLgBankAccounts() {
    setLoadingBankAccounts(true);
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/bank-accounts`);
      const data = await res.json();
      if (res.ok) {
        setDetailBankAccounts(data.bankAccounts || []);
      } else {
        setError(data.error || 'Failed to retrieve bank accounts');
      }
    } catch (err) {
      setError('Network error retrieving bank accounts');
    } finally {
      setLoadingBankAccounts(false);
    }
  }

  const toggleCategoryExpand = async (catId: string) => {
    const isCurrentlyExpanded = expandedCats[catId];
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
    
    if (!isCurrentlyExpanded) {
      try {
        const res = await fetch(`/api/super-admin/lgs/${id}/categories/${catId}/items`);
        const data = await res.json();
        if (res.ok) {
          setDetailCategories(prev => prev.map(cat => 
            cat.id === catId ? { ...cat, items: data.items || [] } : cat
          ));
        }
      } catch (err) {
        console.error('Error fetching levy items:', err);
      }
    }
  };

  const verifyAddAccountNumber = async () => {
    if (!addBankAccountNumber || addBankAccountNumber.length < 10 || !addBankCode) return;
    setVerifyingBankAcc(true);
    setAddBankAccountName('');
    setBankAccVerified(false);
    setBankAccManual(false);
    setError('');
    try {
      const res = await fetch('/api/super-admin/lgs/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_number: addBankAccountNumber, account_bank: addBankCode })
      });
      const data = await res.json();
      if (res.ok && data.account_name) {
        setAddBankAccountName(data.account_name);
        setBankAccVerified(true);
      } else {
        setError(data.error || 'Could not verify account number');
        setBankAccManual(true);
      }
    } catch (err) {
      setError('Network error verifying account');
      setBankAccManual(true);
    } finally {
      setVerifyingBankAcc(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSubmittingCat(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName, description: newCatDesc })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Category "${newCatName}" created successfully.`);
        setNewCatName('');
        setNewCatDesc('');
        setShowAddCatModal(false);
        fetchLgCategories();
      } else {
        setError(data.error || 'Failed to create category');
      }
    } catch (err) {
      setError('Network error creating category');
    } finally {
      setSubmittingCat(false);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !editCatName.trim()) return;
    setSubmittingEditCat(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/categories/${editingCat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCatName, description: editCatDesc })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Category updated successfully.');
        setShowEditCatModal(false);
        setEditingCat(null);
        fetchLgCategories();
      } else {
        setError(data.error || 'Failed to update category');
      }
    } catch (err) {
      setError('Network error updating category');
    } finally {
      setSubmittingEditCat(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!delCatTarget) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/categories/${delCatTarget.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Category deleted successfully.');
        setShowDelCatConfirm(false);
        setDelCatTarget(null);
        fetchLgCategories();
      } else {
        setError(data.error || 'Failed to delete category');
      }
    } catch (err) {
      setError('Network error deleting category');
    }
  };

  const handleCreateLevyItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addItemCategory || !newItemName.trim()) return;
    setSubmittingItem(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/categories/${addItemCategory.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Levy item "${newItemName}" added successfully.`);
        setNewItemName('');
        setShowAddItemModal(false);
        // Refresh items list for expanded category
        const itemRes = await fetch(`/api/super-admin/lgs/${id}/categories/${addItemCategory.id}/items`);
        const itemData = await itemRes.json();
        if (itemRes.ok) {
          setDetailCategories(prev => prev.map(cat => 
            cat.id === addItemCategory.id ? { ...cat, items: itemData.items || [], item_count: (cat.item_count || 0) + 1 } : cat
          ));
        }
        setAddItemCategory(null);
      } else {
        setError(data.error || 'Failed to add levy item');
      }
    } catch (err) {
      setError('Network error adding levy item');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleEditLevyItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editItemName.trim()) return;
    setSubmittingEditItem(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editItemName })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Levy item updated successfully.');
        setShowEditItemModal(false);
        // Refresh items list
        const itemRes = await fetch(`/api/super-admin/lgs/${id}/categories/${editingItem.category_id}/items`);
        const itemData = await itemRes.json();
        if (itemRes.ok) {
          setDetailCategories(prev => prev.map(cat => 
            cat.id === editingItem.category_id ? { ...cat, items: itemData.items || [] } : cat
          ));
        }
        setEditingItem(null);
      } else {
        setError(data.error || 'Failed to update levy item');
      }
    } catch (err) {
      setError('Network error updating levy item');
    } finally {
      setSubmittingEditItem(false);
    }
  };

  const handleDeleteLevyItem = async () => {
    if (!delItemTarget) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/items/${delItemTarget.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Levy item deleted successfully.');
        setShowDelItemConfirm(false);
        // Refresh items list
        const itemRes = await fetch(`/api/super-admin/lgs/${id}/categories/${delItemTarget.category_id}/items`);
        const itemData = await itemRes.json();
        if (itemRes.ok) {
          setDetailCategories(prev => prev.map(cat => 
            cat.id === delItemTarget.category_id ? { ...cat, items: itemData.items || [], item_count: Math.max(0, (cat.item_count || 0) - 1) } : cat
          ));
        }
        setDelItemTarget(null);
      } else {
        setError(data.error || 'Failed to delete levy item');
      }
    } catch (err) {
      setError('Network error deleting levy item');
    }
  };

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addBankCode || !addBankAccountNumber || !addBankAccountName) return;
    setSubmittingBankAcc(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/bank-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_name: addBankCode, account_number: addBankAccountNumber, account_name: addBankAccountName })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Bank account added successfully.');
        setAddBankCode('');
        setAddBankAccountNumber('');
        setAddBankAccountName('');
        setBankAccVerified(false);
        setBankAccManual(false);
        setShowAddBankModal(false);
        fetchLgBankAccounts();
      } else {
        setError(data.error || 'Failed to add bank account');
      }
    } catch (err) {
      setError('Network error adding bank account');
    } finally {
      setSubmittingBankAcc(false);
    }
  };

  const handleSetPrimaryBank = async (bankAccId: string) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/bank-accounts/${bankAccId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Primary account updated. Flutterwave settlement account has been updated.');
        fetchLgBankAccounts();
        fetchLgDetails();
      } else {
        setError(data.error || 'Failed to update primary bank account');
      }
    } catch (err) {
      setError('Network error updating primary bank account');
    }
  };

  const handleDeleteBank = async (bankAccId: string) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}/bank-accounts/${bankAccId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Bank account deleted successfully.');
        fetchLgBankAccounts();
      } else {
        setError(data.error || 'Failed to delete bank account');
      }
    } catch (err) {
      setError('Network error deleting bank account');
    }
  };

  const handleOpenEdit = () => {
    if (!lg) return;
    setEditStateId(lg.state_id);
    setEditName(lg.name);
    setEditCode(lg.code);
    setEditJurisdiction(lg.jurisdiction || '');
    setEditAddress(lg.address || '');
    setEditPhone(lg.phone || '');
    setEditEmail(lg.email || '');
    setEditLogoUrl(lg.logo_url || '');
    setEditLogoPreview(lg.logo_url || '');
    setEditStatus(lg.is_active);
    setError('');
    setSuccess('');
    setShowEditPanel(true);
  };

  const handleEditLg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName || !editCode || !editStateId) {
      setError('Please fill in all required fields.');
      return;
    }

    setEditSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/super-admin/lgs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state_id: editStateId,
          name: editName,
          code: editCode,
          jurisdiction: editJurisdiction,
          address: editAddress,
          phone: editPhone,
          email: editEmail,
          logo_url: editLogoUrl,
          is_active: editStatus
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`Local Government details updated successfully!`);
        setShowEditPanel(false);
        fetchLgDetails();
      } else {
        setError(data.error || 'Failed to update Local Government');
      }
    } catch (err) {
      setError('Network error updating Local Government');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditLogoPreview(URL.createObjectURL(file));
    setEditUploadingLogo(true);
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
        setEditLogoUrl(data.url);
      } else {
        setError(data.error || 'Failed to upload logo');
        setEditLogoPreview('');
      }
    } catch (err) {
      setError('Network error uploading logo');
      setEditLogoPreview('');
    } finally {
      setEditUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setEditLogoUrl('');
    setEditLogoPreview('');
  };

  const triggerStatusConfirm = (isCurrentlyActive: boolean) => {
    setConfirmType(isCurrentlyActive ? 'deactivate' : 'activate');
    setConfirmOpen(true);
  };

  const triggerDeleteConfirm = () => {
    setConfirmType('delete');
    setConfirmOpen(true);
  };

  const executeStatusToggle = async (isCurrentlyActive: boolean) => {
    try {
      setError('');
      setSuccess('');
      const res = await fetch(`/api/super-admin/lgs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isCurrentlyActive }),
      });

      const data = await res.json();

      if (res.ok) {
        const actionWord = isCurrentlyActive ? 'deactivated' : 'activated';
        setSuccess(`Local Government has been ${actionWord} successfully.`);
        fetchLgDetails();
      } else {
        setError(data.error || 'Failed to update Local Government status');
      }
    } catch (err) {
      setError('Network error updating Local Government');
    }
  };

  const executeDelete = async () => {
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/super-admin/lgs/${id}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/super-admin/lgs');
      } else {
        setError(data.error || 'Failed to delete Local Government');
      }
    } catch (err) {
      setError('Network error deleting Local Government');
    }
  };

  const handleConfirmAction = () => {
    setConfirmOpen(false);

    if (confirmType === 'deactivate') {
      executeStatusToggle(true);
    } else if (confirmType === 'activate') {
      executeStatusToggle(false);
    } else if (confirmType === 'delete') {
      executeDelete();
    }
  };

  const handleRetryPayment = async () => {
    if (!lg) return;
    setRetryingPayment(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/super-admin/lgs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retry_payment_setup: true })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || 'Payment setup completed successfully!');
        fetchLgDetails();
      } else {
        setError(data.error || 'Failed to retry payment setup');
      }
    } catch (err) {
      setError('Network error retrying payment setup');
    } finally {
      setRetryingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Link href="/super-admin/lgs" className="hover:text-amber-700 transition flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              <span>Tenants</span>
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-500 font-bold">{lg?.name || 'Local Government Profile'}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Link 
              href="/super-admin/lgs" 
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span>Tenant Profile</span>
          </h1>
        </div>

        {/* Header CTA Row */}
        {lg && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenEdit}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-750 text-sm font-semibold rounded-xl transition cursor-pointer"
            >
              Edit Details
            </button>
            {lg.is_active ? (
              <button
                onClick={() => triggerStatusConfirm(true)}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-655 text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                Deactivate
              </button>
            ) : (
              <>
                <button
                  onClick={() => triggerStatusConfirm(false)}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-750 text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Activate
                </button>
                <button
                  onClick={triggerDeleteConfirm}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-655 text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Purge LGA
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 flex items-center gap-2 animate-fade-in">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-amber-50 border border-amber-100 text-amber-800 text-sm rounded-xl p-4 flex items-center gap-2 animate-fade-in">
          <Check className="h-5 w-5 shrink-0 text-amber-600" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400 bg-white border border-slate-200/60 rounded-3xl shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-amber-600 mb-2" />
          <p className="text-xs font-bold tracking-wider uppercase">Loading tenant profile...</p>
        </div>
      ) : lg ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column - Mini profile card */}
          <div className="lg:col-span-1 bg-white border border-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col items-center text-center gap-3 pb-6 border-b border-slate-100">
              {lg.logo_url ? (
                <img 
                  src={lg.logo_url} 
                  alt={`${lg.name} Logo`} 
                  className="w-24 h-24 rounded-2xl object-cover bg-slate-50 border border-slate-200 p-1 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 font-black text-4xl flex items-center justify-center uppercase shadow-md">
                  {lg.code.slice(0, 2)}
                </div>
              )}

              <div className="space-y-1 mt-2">
                <h2 className="text-xl font-black text-slate-850 tracking-tight">{lg.name}</h2>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 font-extrabold rounded uppercase tracking-wider">
                    {lg.code}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded">
                    {lg.state_name} State
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                    lg.is_active 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                      : 'bg-red-50 border-red-100 text-red-655'
                  }`}>
                    {lg.is_active ? 'Active' : 'Deactivated'}
                  </span>
                </div>
              </div>
            </div>

            {/* General metrics */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">LGA Statistics</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Users className="h-4 w-4 text-slate-400 mx-auto mb-1" />
                  <span className="text-[9px] text-slate-400 font-bold block">Officers</span>
                  <span className="text-sm font-black text-slate-805">{lgUserCount}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Building2 className="h-4 w-4 text-slate-400 mx-auto mb-1" />
                  <span className="text-[9px] text-slate-400 font-bold block">Clients</span>
                  <span className="text-sm font-black text-slate-805">{lgClientCount}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <FileText className="h-4 w-4 text-slate-400 mx-auto mb-1" />
                  <span className="text-[9px] text-slate-400 font-bold block">Bills</span>
                  <span className="text-sm font-black text-slate-805">{lgBillCount}</span>
                </div>
              </div>
            </div>

            {/* Administrative Metadata */}
            <div className="space-y-3 pt-6 border-t border-slate-100 text-xs text-slate-500 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>Onboarded: {new Date(lg.created_at).toLocaleDateString([], { dateStyle: 'medium' })}</span>
              </div>
            </div>
          </div>

          {/* Right Column - Tab Layout & Controls */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tabs control bar */}
            <div className="bg-white border border-slate-200/60 rounded-2xl p-2.5 shadow-sm flex items-center gap-3">
              <button
                onClick={() => setDetailsTab('general')}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  detailsTab === 'general'
                    ? 'bg-amber-600 text-white shadow shadow-amber-500/10'
                    : 'text-slate-455 hover:bg-slate-50'
                }`}
              >
                General Info
              </button>
              <button
                onClick={() => setDetailsTab('levies')}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  detailsTab === 'levies'
                    ? 'bg-amber-600 text-white shadow shadow-amber-500/10'
                    : 'text-slate-455 hover:bg-slate-50'
                }`}
              >
                Levy Management
              </button>
              <button
                onClick={() => setDetailsTab('banking')}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  detailsTab === 'banking'
                    ? 'bg-amber-600 text-white shadow shadow-amber-500/10'
                    : 'text-slate-455 hover:bg-slate-50'
                }`}
              >
                Bank Accounts
              </button>
            </div>

            {/* Tab content wrapper */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm min-h-[400px]">
              
              {/* General Tab */}
              {detailsTab === 'general' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Flutterwave onboarding error warning */}
                  {lg.payment_setup_status === 'payment_setup_incomplete' && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse">
                      <div className="flex gap-2.5 items-start">
                        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black text-red-750">Flutterwave Settlement Account Setup Incomplete</h4>
                          <p className="text-[10px] text-slate-550 leading-relaxed max-w-md">
                            Automatic creation of subaccount failed during onboarding. Transferred split routes will not function until resolved.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleRetryPayment}
                        disabled={retryingPayment}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-750 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {retryingPayment ? 'Retrying...' : 'Retry Payment Setup'}
                      </button>
                    </div>
                  )}

                  {/* Operational Settings parameters */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-805 tracking-tight border-b border-slate-100 pb-2">Operational Parameters</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs leading-relaxed text-slate-655">
                      <div className="flex items-start gap-2.5">
                        <Bookmark className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-slate-400 font-black uppercase block">Jurisdiction</span>
                          <span className="font-extrabold text-slate-800">{lg.jurisdiction || 'Not configured'}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <MapPin className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-slate-400 font-black uppercase block">Official Address</span>
                          <span className="font-extrabold text-slate-800">{lg.address || 'Not configured'}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Phone className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-slate-400 font-black uppercase block">Contact Phone</span>
                          {lg.phone ? (
                            <a href={`tel:${lg.phone}`} className="font-extrabold text-amber-700 hover:underline">{lg.phone}</a>
                          ) : (
                            <span className="font-extrabold text-slate-800">Not configured</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Mail className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-slate-400 font-black uppercase block">Contact Email</span>
                          {lg.email ? (
                            <a href={`mailto:${lg.email}`} className="font-extrabold text-amber-700 hover:underline">{lg.email}</a>
                          ) : (
                            <span className="font-extrabold text-slate-800">Not configured</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Bank Settlement Account details */}
                  {(lg.bank_name || lg.bank_account_number || lg.flutterwave_subaccount_code) && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-805 tracking-tight">Primary Settlement Bank</h3>
                        <span className="text-[9px] font-black text-amber-700 uppercase bg-amber-50 border border-amber-100 rounded px-2 py-0.5">★ Primary settlement</span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-[9px] text-slate-400 font-black uppercase block">Settlement Bank</span>
                          <strong className="text-slate-805">
                            {NIGERIAN_BANKS.find(b => b.code === lg.bank_name)?.name || lg.bank_name || 'Designated Bank'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-black uppercase block">Account Number</span>
                          <strong className="text-slate-805 font-mono">{lg.bank_account_number || '----------'}</strong>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[9px] text-slate-400 font-black uppercase block">Account Holder Name</span>
                          <strong className="text-slate-805">{lg.bank_account_name || '---'}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-black uppercase block">Khrien split percentage</span>
                          <strong className="text-slate-805">{lg.khrien_split_percentage ? `${lg.khrien_split_percentage}%` : '5.00%'}</strong>
                        </div>
                        {lg.flutterwave_subaccount_code && (
                          <div>
                            <span className="text-[9px] text-slate-400 font-black uppercase block">Flutterwave Subaccount Code</span>
                            <span className="font-mono text-[10px] text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded block w-fit mt-0.5">
                              {lg.flutterwave_subaccount_code}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Levy categories management panel */}
              {detailsTab === 'levies' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-slate-850 tracking-tight">Levy Categories</h3>
                      <p className="text-[10px] text-slate-400 leading-snug">Add, edit, and expand scoped categories.</p>
                    </div>
                    <button
                      onClick={() => {
                        setNewCatName('');
                        setNewCatDesc('');
                        setShowAddCatModal(true);
                      }}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Category</span>
                    </button>
                  </div>

                  {loadingCategories ? (
                    <div className="py-12 text-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Loading Categories...</span>
                    </div>
                  ) : detailCategories.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                      No categories found for this Local Government.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {detailCategories.map((cat) => {
                        const isExpanded = expandedCats[cat.id];
                        return (
                          <div key={cat.id} className="border border-slate-200/60 rounded-2xl bg-white overflow-hidden shadow-sm hover:border-slate-300 transition-all">
                            
                            {/* Category Banner Summary */}
                            <div className="flex items-center justify-between p-4 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                              <div 
                                onClick={() => toggleCategoryExpand(cat.id)}
                                className="flex-1 flex flex-col cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-extrabold text-slate-850">{cat.name}</span>
                                  {cat.is_seeded && (
                                    <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-1.5 py-0.2 rounded">Seeded Template</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-455 font-bold mt-1">
                                  {cat.item_count || 0} items configured {cat.description ? `• ${cat.description}` : ''}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <button
                                  onClick={() => {
                                    setEditingCat(cat);
                                    setEditCatName(cat.name);
                                    setEditCatDesc(cat.description || '');
                                    setShowEditCatModal(true);
                                  }}
                                  className="p-2 hover:bg-slate-200/50 text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer"
                                  title="Edit Category Name"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDelCatTarget(cat);
                                    setShowDelCatConfirm(true);
                                  }}
                                  className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-655 rounded-lg transition cursor-pointer"
                                  title="Delete Category"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => toggleCategoryExpand(cat.id)}
                                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition text-[10px] font-black uppercase cursor-pointer"
                                >
                                  {isExpanded ? 'Hide' : 'Expand'}
                                </button>
                              </div>
                            </div>

                            {/* Expanded items section table */}
                            {isExpanded && (
                              <div className="border-t border-slate-100 p-4 bg-white space-y-4">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                  <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest">Items Index</span>
                                  <button
                                    onClick={() => {
                                      setAddItemCategory(cat);
                                      setNewItemName('');
                                      setShowAddItemModal(true);
                                    }}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-750 text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                                  >
                                    + Add Levy Item
                                  </button>
                                </div>

                                {!cat.items ? (
                                  <div className="py-4 text-center text-slate-400">
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto text-amber-600" />
                                  </div>
                                ) : cat.items.length === 0 ? (
                                  <div className="text-center text-[10px] text-slate-400 py-4 italic">
                                    No items configure under this category. Click "+ Add Levy Item" to add one.
                                  </div>
                                ) : (
                                  <div className="divide-y divide-slate-100 text-xs">
                                    {cat.items.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between py-2.5 text-slate-700">
                                        <span className="font-extrabold text-slate-800">{item.name}</span>
                                        
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              setEditingItem(item);
                                              setEditItemName(item.name);
                                              setShowEditItemModal(true);
                                            }}
                                            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer"
                                            title="Edit Item"
                                          >
                                            <Edit3 className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={() => {
                                              setDelItemTarget(item);
                                              setShowDelItemConfirm(true);
                                            }}
                                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-655 rounded transition cursor-pointer"
                                            title="Delete Item"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Bank Accounts management panel */}
              {detailsTab === 'banking' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-slate-850 tracking-tight">Bank Accounts</h3>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        Manage multiple accounts. The primary account handles Flutterwave routing split settlements.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setAddBankCode('');
                        setAddBankAccountNumber('');
                        setAddBankAccountName('');
                        setBankAccVerified(false);
                        setBankAccManual(false);
                        setShowAddBankModal(true);
                      }}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Account</span>
                    </button>
                  </div>

                  {loadingBankAccounts ? (
                    <div className="py-12 text-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Loading Bank Accounts...</span>
                    </div>
                  ) : detailBankAccounts.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                      No bank accounts configured for this local government.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {detailBankAccounts.map((acc) => (
                        <div 
                          key={acc.id} 
                          className={`border rounded-2xl p-4 bg-white shadow-sm flex flex-col justify-between gap-4 relative transition-all ${
                            acc.is_primary ? 'border-amber-500 bg-amber-50/5' : 'border-slate-200 hover:border-slate-350'
                          }`}
                        >
                          {acc.is_primary && (
                            <div className="absolute right-4 top-4 bg-amber-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                              <span>★ Primary</span>
                            </div>
                          )}

                          <div className="space-y-1.5 pr-16 text-xs">
                            <span className="text-[9px] text-slate-400 font-black uppercase block">Revenue Account</span>
                            <span className="text-sm font-extrabold text-slate-900 block leading-tight truncate">{acc.account_name}</span>
                            <span className="text-slate-700 font-bold block">
                              {NIGERIAN_BANKS.find(b => b.code === acc.bank_name)?.name || acc.bank_name} &bull; <span className="font-mono">{acc.account_number}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                            {!acc.is_primary ? (
                              <>
                                <button
                                  onClick={() => handleSetPrimaryBank(acc.id)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                                >
                                  Set as Primary
                                </button>
                                <button
                                  onClick={() => {
                                    setDelBankTarget(acc);
                                    setShowDelBankConfirm(true);
                                  }}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-655 text-[10px] font-bold rounded-lg transition cursor-pointer"
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <span className="text-[9.5px] font-bold text-amber-708 italic">
                                Active Flutterwave settlement account. Deletion disabled.
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-400 text-xs py-10 bg-white border rounded-3xl shadow-sm">
          Failed to load Local Government details.
        </p>
      )}

      {/* Floating Toast Notification */}
      <Toast message={error} type="error" onClose={() => setError('')} />

      {/* Edit View Drawer SlideOver */}
      <SlideOver
        isOpen={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        title="Edit Local Govt"
        icon={<Edit3 className="h-5 w-5 text-amber-600" />}
        footer={
          <>
            <button
              onClick={() => setShowEditPanel(false)}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-550 hover:text-slate-705 text-sm font-semibold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-lg-form"
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
        <form onSubmit={handleEditLg} id="edit-lg-form" className="space-y-5">
          <div>
            <label htmlFor="edit-lg-state" className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Parent State *
            </label>
            <select
              id="edit-lg-state"
              required
              value={editStateId}
              onChange={(e) => setEditStateId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all text-sm cursor-pointer"
            >
              <option value="">Select a State</option>
              {states.map(s => (
                <option key={s.id} value={s.id}>{s.name} {!s.is_active && '(Deactivated)'}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-lg-name" className="block text-xs font-bold text-slate-500 uppercase mb-2">
                LG Name *
              </label>
              <input
                id="edit-lg-name"
                type="text"
                required
                placeholder="e.g. Ibadan North"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
              />
            </div>

            <div>
              <label htmlFor="edit-lg-code" className="block text-xs font-bold text-slate-500 uppercase mb-2">
                LG Code Prefix *
              </label>
              <input
                id="edit-lg-code"
                type="text"
                required
                placeholder="e.g. ibn"
                maxLength={10}
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
              LG Status
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditStatus(true)}
                className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  editStatus 
                    ? 'bg-amber-50 border-amber-255 text-amber-755 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setEditStatus(false)}
                className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  !editStatus 
                    ? 'bg-red-50 border-red-200 text-red-650 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-55'
                }`}
              >
                Deactivated
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="edit-lg-jurisdiction" className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Jurisdiction scope
            </label>
            <input
              id="edit-lg-jurisdiction"
              type="text"
              placeholder="Metropolitan Area"
              value={editJurisdiction}
              onChange={(e) => setEditJurisdiction(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-lg-address" className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Address Location
            </label>
            <input
              id="edit-lg-address"
              type="text"
              placeholder="Secretariat Road, Ibadan"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-lg-phone" className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Official Phone
              </label>
              <input
                id="edit-lg-phone"
                type="tel"
                placeholder="+234 803 000 0000"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
              />
            </div>

            <div>
              <label htmlFor="edit-lg-email" className="block text-xs font-bold text-slate-505 uppercase mb-2">
                Official Email
              </label>
              <input
                id="edit-lg-email"
                type="email"
                placeholder="contact@lga.gov.ng"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              LGA Logo Image
            </label>
            
            {editLogoPreview ? (
              <div className="relative rounded-2xl border border-slate-200 p-4 bg-slate-55 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={editLogoPreview} 
                    alt="Logo Preview" 
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200/50 bg-white shadow-sm shrink-0"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Uploaded Logo</span>
                    {editUploadingLogo ? (
                      <span className="text-[10px] text-amber-605 font-bold animate-pulse block">Uploading...</span>
                    ) : (
                      <span className="text-[10px] text-emerald-655 font-bold block">Ready</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={editUploadingLogo}
                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-655 text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative group rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-500/50 p-6 bg-slate-50 hover:bg-amber-50/10 flex flex-col items-center justify-center text-center gap-2 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Upload LGA logo</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Drag & drop or click to choose file</span>
                </div>
              </div>
            )}
          </div>
        </form>
      </SlideOver>

      {/* Confirmation Modal (Activate/Deactivate/Purge) */}
      <ConfirmationModal
        isOpen={confirmOpen}
        title={
          confirmType === 'deactivate' 
            ? 'Deactivate Local Government' 
            : confirmType === 'activate' 
              ? 'Activate Local Government' 
              : 'Delete Local Government'
        }
        message={
          confirmType === 'deactivate'
            ? `Are you sure you want to deactivate this Local Government? This suspends dashboard access and bill generation.`
            : confirmType === 'activate'
              ? `Are you sure you want to activate this Local Government? This restores immediate access and operations.`
              : `Are you sure you want to permanently delete this Local Government? This action cannot be undone and purges all data.`
        }
        confirmLabel={
          confirmType === 'deactivate' 
            ? 'Deactivate' 
            : confirmType === 'activate' 
              ? 'Activate' 
              : 'Purge Tenant'
        }
        confirmStyle={confirmType === 'activate' ? 'amber' : 'red'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Add New Category Modal */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setShowAddCatModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"></div>
          <div className="relative bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
            <h3 className="text-base font-extrabold text-slate-900">Add New Category</h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Health & Safety"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional brief description"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCat}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  {submittingCat && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Create Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditCatModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setShowEditCatModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"></div>
          <div className="relative bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
            <h3 className="text-base font-extrabold text-slate-900">Edit Category</h3>
            <form onSubmit={handleEditCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-505 uppercase mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-505 uppercase mb-1">Description</label>
                <input
                  type="text"
                  value={editCatDesc}
                  onChange={(e) => setEditCatDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditCatModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEditCat}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  {submittingEditCat && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {showDelCatConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setShowDelCatConfirm(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"></div>
          <div className="relative bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Category?</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to delete the category "{delCatTarget?.name}"? All levy items inside this category will also be deleted. This action cannot be undone.
            </p>
            {delCatTarget?.is_used && (
              <p className="text-xs font-bold text-red-655 bg-red-55/70 border border-red-100 p-2.5 rounded-xl">
                ⚠️ Blocked: This category's items are used in existing demand bills and cannot be deleted.
              </p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDelCatConfirm(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={delCatTarget?.is_used}
                className="px-4 py-2 bg-red-600 hover:bg-red-750 disabled:bg-red-400 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Levy Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setShowAddItemModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"></div>
          <div className="relative bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
            <h3 className="text-base font-extrabold text-slate-900">Add Levy Item</h3>
            <form onSubmit={handleCreateLevyItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
                <input
                  type="text"
                  readOnly
                  value={addItemCategory?.name || ''}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-250 rounded-xl text-slate-500 font-bold text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Levy Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Rent Fee"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingItem}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-705 disabled:bg-amber-600/50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  {submittingItem && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Add Levy Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Levy Item Modal */}
      {showEditItemModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setShowEditItemModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"></div>
          <div className="relative bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
            <h3 className="text-base font-extrabold text-slate-900">Edit Levy Item</h3>
            <form onSubmit={handleEditLevyItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Levy Item Name *</label>
                <input
                  type="text"
                  required
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditItemModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEditItem}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  {submittingEditItem && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Levy Item Confirmation Modal */}
      {showDelItemConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setShowDelItemConfirm(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"></div>
          <div className="relative bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Levy Item?</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to delete the levy item "{delItemTarget?.name}"? This action cannot be undone.
            </p>
            {delItemTarget?.is_used && (
              <p className="text-xs font-bold text-red-655 bg-red-55/70 border border-red-100 p-2.5 rounded-xl">
                ⚠️ Blocked: This item is used in existing demand bills and cannot be deleted.
              </p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDelItemConfirm(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLevyItem}
                disabled={delItemTarget?.is_used}
                className="px-4 py-2 bg-red-600 hover:bg-red-750 disabled:bg-red-400 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bank Account Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setShowAddBankModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"></div>
          <div className="relative bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
            <h3 className="text-base font-extrabold text-slate-900">Add Bank Account</h3>
            <form onSubmit={handleAddBankAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bank Name *</label>
                <select
                  required
                  value={addBankCode}
                  onChange={(e) => {
                    setAddBankCode(e.target.value);
                    setAddBankAccountName('');
                    setBankAccVerified(false);
                    setBankAccManual(false);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white text-sm cursor-pointer"
                >
                  <option value="">Select Bank</option>
                  {NIGERIAN_BANKS.map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-505 uppercase mb-1">Account Number *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0123456789"
                    maxLength={10}
                    value={addBankAccountNumber}
                    onChange={(e) => {
                      const num = e.target.value.replace(/\D/g, '');
                      setAddBankAccountNumber(num);
                      setAddBankAccountName('');
                      setBankAccVerified(false);
                      setBankAccManual(false);
                    }}
                    onBlur={verifyAddAccountNumber}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white text-sm"
                  />
                  {verifyingBankAcc && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-slate-400 gap-1 text-xs font-semibold bg-white pl-2">
                      <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                      <span>Verifying...</span>
                    </div>
                  )}
                  {!verifyingBankAcc && bankAccVerified && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-emerald-600 gap-1 text-xs font-extrabold bg-white pl-2">
                      <Check className="h-4 w-4" />
                      <span>Verified</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-505 uppercase mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  readOnly={!bankAccManual}
                  placeholder={bankAccManual ? "Enter account name manually" : "Auto-resolved account name"}
                  value={addBankAccountName}
                  onChange={bankAccManual ? (e) => setAddBankAccountName(e.target.value) : undefined}
                  className={`w-full px-3 py-2 border border-slate-200 rounded-xl font-bold focus:outline-none text-sm ${
                    bankAccManual 
                      ? 'bg-slate-55 text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white' 
                      : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                  }`}
                />
                {bankAccManual && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 leading-snug">
                    ⚠️ Verification service is unavailable. Please input the account name manually.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBankAcc || (!bankAccVerified && !bankAccManual) || !addBankAccountName}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-705 disabled:bg-amber-600/50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  {submittingBankAcc && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Add Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Bank Account Confirmation Modal */}
      {showDelBankConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setShowDelBankConfirm(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"></div>
          <div className="relative bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Bank Account?</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to delete the bank account "{delBankTarget?.account_number}" ({delBankTarget?.account_name})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDelBankConfirm(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBank(delBankTarget.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-750 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
