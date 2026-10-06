import React, { useState, useEffect, useRef } from 'react';
import { Package, Users, Eye, EyeOff, UserCog, Store, Filter, Lock, Globe } from 'lucide-react';
import SalesLedger from './SalesLedger';
import InventoryManagement from './components/InventoryManagement';
import BranchManagement from './components/BranchManagement';
import BatchTransferModal from './components/BatchTransferModal';
import StaffManagement from './StaffManagement';

export default function AdminApp({ currentUser, supabase }) {
  const isAdmin = currentUser?.role === 'admin';
  
  const [activeTab, setActiveTab] = useState(isAdmin ? 'inventory' : 'customers'); 

  // Global Data states
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  
  // Privacy / Financial Visibility States
  const [showFinancials, setShowFinancials] = useState(false);
  const autoHideTimerRef = useRef(null);

  // Secure Admin PIN Modal States
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinResolve, setAdminPinResolve] = useState(null);
  const [adminPinError, setAdminPinError] = useState('');

  // Branch Context Filters
  const [viewingBranch, setViewingBranch] = useState(''); 
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [showArchived, setShowArchived] = useState(false);

  // Storefront Specific Branch Filter State
  const [storefrontBranch, setStorefrontBranch] = useState(() => {
    return localStorage.getItem('donchike_storefront_branch') || '';
  });
  
  // Live Public Storefront Control State (stores branch_id or '' for HQ)
  const [liveStoreBranch, setLiveStoreBranch] = useState('');

  useEffect(() => {
    localStorage.setItem('donchike_storefront_branch', storefrontBranch);
  }, [storefrontBranch]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, []);

  // Branch form states
  const [branchName, setBranchName] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [editingBranch, setEditingBranch] = useState(null);

  // Staff form states
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [staffRole, setStaffRole] = useState('staff');
  const [staffBranch, setStaffBranch] = useState('');
  const [editingStaff, setEditingStaff] = useState(null);

  // Inventory forms states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [batch, setBatch] = useState('');
  const [productBranch, setProductBranch] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Batch Transfer States
  const [batchTransferOpen, setBatchTransferOpen] = useState(false);
  const [batchTransferStep, setBatchTransferStep] = useState('select'); 
  const [selectedBatchItems, setSelectedBatchItems] = useState({}); 
  const [batchTransferLoading, setBatchTransferLoading] = useState(false);
  const [batchTransferError, setBatchTransferError] = useState('');

  // Determine active branch context
  const activeBranchId = isAdmin ? viewingBranch : (currentUser?.branch_id || '');

  useEffect(() => {
    fetchBranchesFromSupabase();
    fetchProducts();
    fetchCustomersFromSupabase();
    if (isAdmin) {
      fetchStaffFromSupabase();
      fetchStoreSettings(); 
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (viewingBranch !== 'ALL') {
      setProductBranch(viewingBranch);
    } else {
      setProductBranch('');
    }
  }, [viewingBranch]);

  // --- FETCH GLOBAL STORE SETTINGS ---
  const fetchStoreSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('active_branch')
        .single();
      
      if (data) {
        setLiveStoreBranch(data.active_branch || '');
      }
    } catch (err) {
      console.log("Paramètres de la boutique non configurés (normal au premier lancement).");
    }
  };

  // --- UPDATE LIVE STOREFRONT (Saves branch_id or '' for HQ) ---
  const handleUpdateLiveBranch = async (newBranchId) => {
    if (!(await verifyAdminPinBeforeAction())) return;
    try {
      const { error } = await supabase
        .from('store_settings')
        .upsert({ id: 1, active_branch: newBranchId }, { onConflict: 'id' });
      
      if (error) throw error;
      setLiveStoreBranch(newBranchId);
      const branchObj = branches.find(b => b.id === newBranchId);
      const branchDisplayName = branchObj ? branchObj.name : 'Siège Principal';
      alert(`Succès ! L'application client affiche maintenant les stocks de : ${branchDisplayName}`);
    } catch (err) {
      alert(`Erreur lors de la mise à jour : ${err.message}`);
    }
  };

  const fetchBranchesFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('branches').select('*').order('created_at', { ascending: true });
      if (!error && data) setBranches(data);
    } catch (err) { console.error("Erreur branches:", err); }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data) setProducts(data);
    } catch (err) { console.error("Erreur produits:", err); }
  };

  const fetchCustomersFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*, customer_history(*)').order('created_at', { ascending: false });
      if (!error && data) {
        const formatted = data.map(c => {
          const rawHistory = c.customer_history || c.history || [];
          const formattedHistory = rawHistory.map(h => {
            let parsedItems = [];
            if (h.items) {
              if (typeof h.items === 'string') {
                try { parsedItems = JSON.parse(h.items); } catch (e) { parsedItems = []; }
              } else if (Array.isArray(h.items)) {
                parsedItems = h.items;
              }
            }
            return {
              ...h,
              id: h.id,
              total: parseFloat(h.total_amount ?? h.total ?? h.amount ?? 0),
              items: parsedItems,
              productId: h.product_id || h.productId
            };
          }).sort((a, b) => b.id - a.id);

          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            branch_id: c.branch_id,
            totalDebt: parseFloat(c.total_debt ?? c.totalDebt ?? c.debt ?? 0),
            history: formattedHistory
          };
        });
        setCustomers(formatted);
      }
    } catch (err) { console.error("Erreur clients:", err.message); }
  };

  const fetchStaffFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
      if (!error && data) setStaffList(data);
    } catch (err) { console.error("Erreur personnel:", err); }
  };

  const verifyAdminPinBeforeAction = () => {
    return new Promise((resolve) => {
      setAdminPinInput('');
      setAdminPinError('');
      setAdminPinResolve(() => resolve);
      setAdminPinModalOpen(true);
    });
  };

  // --- FINANCIAL MASKING TOGGLE & AUTO-HIDE TIMER ---
  const handleToggleFinancialVisibility = async () => {
    if (showFinancials) {
      setShowFinancials(false);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    } else {
      if (await verifyAdminPinBeforeAction()) {
        setShowFinancials(true);
        if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = setTimeout(() => {
          setShowFinancials(false);
        }, 10 * 60 * 1000);
      }
    }
  };

  const formatMoney = (amount) => {
    if (!showFinancials) return '******';
    return `${(amount || 0).toLocaleString()} FCFA`;
  };

  // --- BRANCH HANDLERS ---
  const handleSaveBranch = async (e) => {
    e.preventDefault();
    if (!branchName) return;
    try {
      const payload = { name: branchName.trim(), location: branchLocation.trim() };
      if (editingBranch) {
        await supabase.from('branches').update(payload).eq('id', editingBranch.id);
        alert('Succursale mise à jour !');
      } else {
        await supabase.from('branches').insert([payload]);
        alert('Nouvelle succursale créée !');
      }
      setBranchName(''); setBranchLocation(''); setEditingBranch(null);
      fetchBranchesFromSupabase();
    } catch (err) { alert(`Erreur: ${err.message}`); }
  };

  const handleDeleteBranch = async (branchId) => {
    if (!(await verifyAdminPinBeforeAction())) return;
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette succursale ? Cette action est irréversible.')) return;
    try {
      const { error } = await supabase.from('branches').delete().eq('id', branchId);
      if (error) throw error;
      alert('Succursale supprimée !');
      
      if (viewingBranch === branchId) setViewingBranch('');
      if (storefrontBranch === branchId) setStorefrontBranch('');
      
      fetchBranchesFromSupabase();
    } catch (err) {
      alert(`Erreur lors de la suppression: ${err.message}`);
    }
  };

  const handleReassignStaff = async (staffId, newBranchId) => {
    if (!(await verifyAdminPinBeforeAction())) return;
    try {
      const targetBranch = newBranchId || null;
      const { error } = await supabase.from('staff').update({ branch_id: targetBranch }).eq('id', staffId);
      if (error) throw error;
      alert('Personnel réassigné avec succès !');
      fetchStaffFromSupabase();
    } catch (err) {
      alert(`Erreur lors de la réassignation: ${err.message}`);
    }
  };

  // --- STAFF HANDLERS ---
  const handleStartEditStaff = async (staffMember) => {
    if (!(await verifyAdminPinBeforeAction())) return;
    setEditingStaff(staffMember);
    setStaffName(staffMember.full_name || '');
    setStaffPin(staffMember.pin_code || '');
    setStaffRole(staffMember.role || 'staff');
    setStaffBranch(staffMember.branch_id || '');
    setActiveTab('staff');
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!staffName || !staffPin) return;
    if (!(await verifyAdminPinBeforeAction())) return;

    try {
      const payload = {
        full_name: staffName.trim(),
        pin_code: staffPin.trim(),
        role: staffRole,
        branch_id: staffBranch || null,
        is_active: true
      };
      if (editingStaff) {
        await supabase.from('staff').update(payload).eq('id', editingStaff.id);
        alert('Personnel mis à jour !');
      } else {
        await supabase.from('staff').insert([payload]);
        alert('Nouveau membre ajouté !');
      }
      setStaffName(''); setStaffPin(''); setStaffRole('staff'); setStaffBranch(''); setEditingStaff(null);
      fetchStaffFromSupabase();
    } catch (err) { alert(`Erreur: ${err.message}`); }
  };

  const handleToggleStaffStatus = async (id, currentStatus) => {
    if (!(await verifyAdminPinBeforeAction())) return;
    try {
      const { error } = await supabase.from('staff').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      fetchStaffFromSupabase(); 
      alert(currentStatus ? 'Personnel désactivé !' : 'Personnel réactivé !');
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  // --- IMAGE COMPRESSION ---
  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => { 
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image(); img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          if (width > height) { if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; } }
          else { if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', quality);
        };
      };
    });
  };

  // --- PRODUCT HANDLERS ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name || !price || quantity === '' || !batch) return;
    setUploading(true);
    let image_url = editingProduct ? editingProduct.image_url : 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=800&q=80';
    try {
      if (imageFile) {
        let fileToUpload = await compressImage(imageFile, 800, 800, 0.75);
        const fileName = `${Date.now()}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, fileToUpload);
        if (upErr) throw upErr;
        image_url = supabase.storage.from('product-images').getPublicUrl(fileName)?.data?.publicUrl || image_url;
      }
      
      const parsedQty = parseInt(quantity) || 0;
      const parsedInitQty = initialQuantity !== '' ? parseInt(initialQuantity) : (editingProduct ? editingProduct.initial_quantity : parsedQty);

      const payload = { 
        name: name.trim(), 
        description: description.trim(), 
        price: parseFloat(price),
        cost_price: parseFloat(costPrice) || 0,
        image_url, 
        quantity: parsedQty, 
        initial_quantity: parsedInitQty || parsedQty,
        stock_status: parsedQty > 0, 
        batch_reference: batch.trim().toUpperCase(),
        branch_id: productBranch || null,
        is_archived: false
      };

      if (editingProduct) await supabase.from('products').update(payload).eq('id', editingProduct.id);
      else await supabase.from('products').insert([payload]);

      handleCancelEditProduct();
      await fetchProducts();
      alert('Inventaire enregistré avec succès !');
    } catch (err) { alert(`Erreur: ${err.message}`); } finally { setUploading(false); }
  };

  // --- BATCH TRANSFER HANDLERS ---
  const handleOpenBatchTransfer = () => {
    setSelectedBatchItems({});
    setBatchTransferStep('select');
    setBatchTransferError('');
    setBatchTransferOpen(true);
  };

  const handleToggleBatchItemSelect = (product) => {
    setSelectedBatchItems(prev => {
      const copy = { ...prev };
      if (copy[product.id]?.selected) {
        delete copy[product.id];
      } else {
        copy[product.id] = {
          product,
          selected: true,
          targetBranch: branches[0]?.id || '',
          qty: 1
        };
      }
      return copy;
    });
  };

  const handleUpdateBatchItemDetail = (productId, field, value) => {
    setSelectedBatchItems(prev => {
      if (!prev[productId]) return prev;
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          [field]: value
        }
      };
    });
  };

  const handleProceedToBatchReview = () => {
    const activeItems = Object.values(selectedBatchItems).filter(item => item.selected);
    if (activeItems.length === 0) {
      setBatchTransferError("Veuillez sélectionner au moins un produit à transférer.");
      return;
    }

    for (const item of activeItems) {
      if (!item.targetBranch) {
        setBatchTransferError("Veuillez assigner une succursale de destination pour tous les produits sélectionnés.");
        return;
      }
      if (item.qty <= 0) {
        setBatchTransferError(`La quantité pour "${item.product.name}" doit être supérieure à 0.`);
        return;
      }
      if (item.qty > item.product.quantity) {
        setBatchTransferError(`Quantité insuffisante au QG pour "${item.product.name}" (Max: ${item.product.quantity}).`);
        return;
      }
    }

    setBatchTransferError('');
    setBatchTransferStep('review');
  };

  const handleConfirmBatchTransfer = async () => {
    setBatchTransferLoading(true);
    setBatchTransferError('');

    try {
      const activeItems = Object.values(selectedBatchItems).filter(item => item.selected);

      for (const item of activeItems) {
        const { product, targetBranch, qty } = item;

        const newHqQty = product.quantity - qty;
        const { error: hqError } = await supabase
          .from('products')
          .update({ quantity: newHqQty, stock_status: newHqQty > 0 })
          .eq('id', product.id);

        if (hqError) throw hqError;

        const existingTargetProd = products.find(p => 
          p.name.trim().toLowerCase() === product.name.trim().toLowerCase() && 
          String(p.batch_reference || '') === String(product.batch_reference || '') && 
          String(p.branch_id || '') === String(targetBranch)
        );

        if (existingTargetProd) {
          const newTargetQty = (existingTargetProd.quantity || 0) + Number(qty);
          const { error: updateError } = await supabase
            .from('products')
            .update({ quantity: newTargetQty, stock_status: newTargetQty > 0 })
            .eq('id', existingTargetProd.id);

          if (updateError) throw updateError;
        } else {
          const { id, created_at, ...prodData } = product;
          prodData.branch_id = targetBranch;
          prodData.quantity = Number(qty);
          prodData.initial_quantity = Number(qty);
          prodData.stock_status = true;
          const { error: insertError } = await supabase.from('products').insert([prodData]);

          if (insertError) throw insertError;
        }
      }

      setBatchTransferLoading(false);
      setBatchTransferOpen(false);
      await fetchProducts();
      alert("Transfert groupé effectué avec succès !");
    } catch (err) {
      console.error("Batch transfer error:", err);
      setBatchTransferError(`Erreur lors du transfert: ${err.message}`);
      setBatchTransferLoading(false);
    }
  };

  const handleStartEditProduct = (p) => {
    setEditingProduct(p); setName(p.name); setPrice(p.price); setCostPrice(p.cost_price || '');
    setQuantity(p.quantity); setInitialQuantity(p.initial_quantity !== undefined ? p.initial_quantity : p.quantity);
    setDescription(p.description || ''); setBatch(p.batch_reference || ''); setProductBranch(p.branch_id || '');
  };

  const handleCancelEditProduct = () => {
    setEditingProduct(null); setName(''); setPrice(''); setCostPrice(''); setQuantity(''); 
    setInitialQuantity(''); setDescription(''); setBatch(''); setImageFile(null); setProductBranch('');
  };

  const handleUpdateStockVolume = async (id, newVolume) => {
    const parsedVolume = parseInt(newVolume) || 0;
    await supabase.from('products').update({ quantity: parsedVolume, stock_status: parsedVolume > 0 }).eq('id', id);
    setProducts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, quantity: parsedVolume, stock_status: parsedVolume > 0 } : p));
  };

  const handleArchiveProduct = async (id, archiveState = true) => {
    if (!window.confirm(archiveState ? 'Archiver ce produit ?' : 'Restaurer ce produit ?')) return;
    await supabase.from('products').update({ is_archived: archiveState }).eq('id', id);
    setProducts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, is_archived: archiveState } : p));
  };

  // ---- CONTEXT FILTERING & FINANCIAL CALCULATION ----
  const contextProducts = products.filter(p => {
    if (activeBranchId === 'ALL' || activeBranchId === '') return true;
    return String(p.branch_id || '') === String(activeBranchId);
  });

  const contextCustomers = customers.filter(c => {
    if (activeBranchId === 'ALL' || activeBranchId === '') return true;
    return String(c.branch_id || '') === String(activeBranchId);
  });

  const getProductSoldQty = (productId) => {
    return contextCustomers.reduce((acc, c) => acc + (c.history || []).reduce((hAcc, h) => {
      if (h.items && Array.isArray(h.items) && h.items.length > 0) {
        const item = h.items.find(i => String(i.productId || i.product_id || i.id) === String(productId));
        return hAcc + (item ? (parseInt(item.qty || item.quantity) || 0) : 0);
      } else {
        const isMatch = String(h.productId || h.product_id || '') === String(productId);
        return hAcc + (isMatch ? (parseInt(h.qty || h.quantity) || 1) : 0);
      }
    }, 0), 0);
  };

  const getTrueInitialQty = (p) => {
    if (p.initial_quantity !== undefined && p.initial_quantity !== null && p.initial_quantity !== '') return parseInt(p.initial_quantity);
    return (parseInt(p.quantity) || 0) + getProductSoldQty(p.id);
  };

  const totalInventoryCost = contextProducts.reduce((acc, p) => acc + ((parseFloat(p.cost_price) || 0) * getTrueInitialQty(p)), 0);
  const totalExpectedRevenue = contextProducts.reduce((acc, p) => acc + ((parseFloat(p.price) || 0) * getTrueInitialQty(p)), 0);
  const totalPotentialRetail = contextProducts.filter(p => !p.is_archived).reduce((acc, p) => acc + ((parseFloat(p.price) || 0) * (parseInt(p.quantity) || 0)), 0);
  
  const totalGoodsSoldCost = contextProducts.reduce((acc, p) => {
    const soldQty = getProductSoldQty(p.id);
    const unitCost = parseFloat(p.cost_price || p.costPrice) || 0;
    return acc + (unitCost * soldQty);
  }, 0);

  const totalSalesRevenue = contextCustomers.reduce((acc, c) => {
    const customerSales = (c.history || []).reduce((hAcc, h) => hAcc + (parseFloat(h.total || h.total_amount || h.amount) || 0), 0);
    return acc + customerSales;
  }, 0);

  const totalOutstandingDebt = contextCustomers.reduce((acc, c) => acc + (parseFloat(c.totalDebt || c.total_debt) || 0), 0);

  const uniqueBatches = ['ALL', ...new Set(contextProducts.map(p => p.batch_reference).filter(Boolean))];
  const filteredProducts = contextProducts.filter(p => {
    const matchesBatch = selectedBatchFilter === 'ALL' || p.batch_reference === selectedBatchFilter;
    const matchesArchiveState = showArchived ? p.is_archived : !p.is_archived;
    return matchesBatch && matchesArchiveState;
  });

  const storefrontFilteredProducts = products.filter(p => {
    if (p.is_archived || parseInt(p.quantity) < 1) return false;
    if (storefrontBranch === '') {
      return !p.branch_id || p.branch_id === '';
    }
    return String(p.branch_id || '') === String(storefrontBranch);
  });

  const hqProductsForTransfer = products.filter(p => (!p.branch_id || p.branch_id === '') && !p.is_archived && parseInt(p.quantity) > 0);
  const activeSelectedArray = Object.values(selectedBatchItems).filter(i => i.selected);

  return (
    <div className="bg-[#f8f9fa] text-gray-800 font-sans p-3 sm:p-6 lg:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER NAVIGATION */}
        {isAdmin ? (
          <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveTab('inventory')} className={`px-5 py-2.5 text-sm font-semibold rounded-lg flex items-center space-x-2 transition-all ${activeTab === 'inventory' ? 'bg-[#0f172a] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><Package className="w-4 h-4" /> <span>Inventory</span></button>
                <button onClick={() => setActiveTab('customers')} className={`px-5 py-2.5 text-sm font-semibold rounded-lg flex items-center space-x-2 transition-all ${activeTab === 'customers' ? 'bg-[#0f172a] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><Users className="w-4 h-4" /> <span>Sales Ledger</span></button>
                <button onClick={() => setActiveTab('storefront')} className={`px-5 py-2.5 text-sm font-semibold rounded-lg flex items-center space-x-2 transition-all ${activeTab === 'storefront' ? 'bg-[#0f172a] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><Eye className="w-4 h-4" /> <span>Storefront</span></button>
                <button onClick={() => setActiveTab('staff')} className={`px-5 py-2.5 text-sm font-semibold rounded-lg flex items-center space-x-2 transition-all ${activeTab === 'staff' ? 'bg-[#0f172a] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><UserCog className="w-4 h-4" /> <span>Staff</span></button>
                <button onClick={() => setActiveTab('branches')} className={`px-5 py-2.5 text-sm font-semibold rounded-lg flex items-center space-x-2 transition-all ${activeTab === 'branches' ? 'bg-[#0f172a] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><Store className="w-4 h-4" /> <span>Branches & HQ</span></button>
              </div>

              {/* ADMIN BRANCH GLOBAL FILTER */}
              <div className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg bg-gray-50 shadow-sm">
                <Filter className="w-4 h-4 text-gray-500" />
                <select value={viewingBranch} onChange={(e) => setViewingBranch(e.target.value)} className="bg-transparent text-sm font-semibold text-gray-800 outline-none cursor-pointer">
                  <option value="">HQ Main Stock (Default)</option>
                  <option value="ALL">Global View (All Branches)</option>
                  <option value="divider" disabled>──────────</option>
                  {branches.map(b => <option key={b.id} value={b.id}>View: {b.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0f172a]" /> Staff Portal - {currentUser.full_name}
            </h2>
            <span className="text-xs font-semibold bg-blue-50 px-3 py-1.5 rounded-full text-blue-700 border border-blue-100">
              {branches.find(b => b.id === currentUser.branch_id)?.name || 'HQ / Main'}
            </span>
          </div>
        )}

        {/* FINANCIAL METRICS */}
        {isAdmin && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-gray-400" /> Performance Financière
              </span>
              <button
                onClick={handleToggleFinancialVisibility}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-gray-100 text-gray-700 transition-all border border-gray-200 shadow-sm cursor-pointer"
              >
                {showFinancials ? (
                  <>
                    <EyeOff className="w-4 h-4 text-red-500" />
                    <span>Masquer les chiffres</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>Afficher les chiffres (PIN requis)</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">Total Asset Cost</p>
                <p className="text-lg font-bold text-gray-900 mt-2">{formatMoney(totalInventoryCost)}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">Expected Revenue</p>
                <p className="text-lg font-bold text-indigo-700 mt-2">{formatMoney(totalExpectedRevenue)}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">Current Stock Value</p>
                <p className="text-lg font-bold text-emerald-600 mt-2">{formatMoney(totalPotentialRetail)}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">Cost of Goods Sold</p>
                <p className="text-lg font-bold text-purple-700 mt-2">{formatMoney(totalGoodsSoldCost)}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">Total Sales (Rev)</p>
                <p className="text-lg font-bold text-blue-700 mt-2">{formatMoney(totalSalesRevenue)}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-red-500">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">Outstanding Debts</p>
                <p className="text-lg font-bold text-red-600 mt-2">{formatMoney(totalOutstandingDebt)}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: BRANCHES & HQ MANAGEMENT */}
        {isAdmin && activeTab === 'branches' && (
          <BranchManagement 
            branches={branches}
            branchName={branchName}
            setBranchName={setBranchName}
            branchLocation={branchLocation}
            setBranchLocation={setBranchLocation}
            editingBranch={editingBranch}
            setEditingBranch={setEditingBranch}
            handleSaveBranch={handleSaveBranch}
            handleDeleteBranch={handleDeleteBranch} 
            staffList={staffList}                   
            handleReassignStaff={handleReassignStaff} 
          />
        )}

        {/* TAB 2: INVENTORY MANAGEMENT */}
        {isAdmin && activeTab === 'inventory' && (
          <InventoryManagement 
            branches={branches}
            productBranch={productBranch}
            setProductBranch={setProductBranch}
            name={name}
            setName={setName}
            description={description}           
            setDescription={setDescription}     
            batch={batch}
            setBatch={setBatch}
            costPrice={costPrice}
            setCostPrice={setCostPrice}
            price={price}
            setPrice={setPrice}
            initialQuantity={initialQuantity}
            setInitialQuantity={setInitialQuantity}
            quantity={quantity}
            setQuantity={setQuantity}
            setImageFile={setImageFile}
            handleSaveProduct={handleSaveProduct}
            uploading={uploading}
            editingProduct={editingProduct}
            handleCancelEditProduct={handleCancelEditProduct}
            handleOpenBatchTransfer={handleOpenBatchTransfer}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            selectedBatchFilter={selectedBatchFilter}
            setSelectedBatchFilter={setSelectedBatchFilter}
            uniqueBatches={uniqueBatches}
            filteredProducts={filteredProducts}
            handleUpdateStockVolume={handleUpdateStockVolume}
            handleStartEditProduct={handleStartEditProduct}
            handleArchiveProduct={handleArchiveProduct}
          />
        )}

        {/* TAB 3: SALES LEDGER */}
        {activeTab === 'customers' && (
          <SalesLedger 
            products={contextProducts}
            customers={contextCustomers}
            fetchProducts={fetchProducts}
            fetchCustomers={fetchCustomersFromSupabase}
            supabase={supabase}
            currentUser={currentUser}
            activeBranchId={activeBranchId} 
          />
        )}

        {/* TAB 4: STOREFRONT PREVIEW & GLOBAL STORE CONTROL */}
        {isAdmin && activeTab === 'storefront' && (
          <div className="space-y-6">
            
            {/* LIVE STORE CONFIGURATION CARD */}
            <div className="bg-white p-5 sm:p-6 rounded-xl border-2 border-emerald-500/20 shadow-sm bg-gradient-to-r from-emerald-50/50 to-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-emerald-900 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-emerald-600" />
                    Configuration de la Boutique Publique
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Sélectionnez la succursale dont le stock sera <span className="font-semibold text-emerald-700">actuellement visible</span> par vos clients sur le lien public. (PIN Admin requis)
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm min-w-[220px]">
                   <div className="flex flex-col w-full">
                     <span className="text-[10px] uppercase font-bold text-gray-400">Succursale Active en Ligne</span>
                     <select 
                       value={liveStoreBranch}
                       onChange={(e) => handleUpdateLiveBranch(e.target.value)}
                       className="text-sm font-bold text-gray-900 bg-transparent outline-none cursor-pointer w-full mt-0.5"
                     >
                       <option value="">Siège Principal (HQ)</option>
                       {branches.map(b => (
                         <option key={b.id} value={b.id}>{b.name}</option>
                       ))}
                     </select>
                   </div>
                </div>
              </div>
            </div>

            {/* STOREFRONT PREVIEW CATALOGUE */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-indigo-600" />
                    Aperçu du Catalogue de la Vitrine Publique
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Visualisez les articles actuellement affichés aux clients pour la succursale sélectionnée.
                  </p>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={storefrontBranch}
                    onChange={(e) => setStorefrontBranch(e.target.value)}
                    className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-semibold text-gray-800 outline-none cursor-pointer w-full sm:w-auto"
                  >
                    <option value="">Aperçu : Siège Principal (HQ)</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>Aperçu : {b.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      const url = window.location.origin;
                      navigator.clipboard.writeText(url);
                      alert("Lien de la boutique copié dans le presse-papier !");
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    Copier le lien
                  </button>
                </div>
              </div>

              {/* PRODUCTS GRID */}
              {storefrontFilteredProducts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-700">Aucun produit disponible dans cette succursale</p>
                  <p className="text-xs text-gray-500 mt-1">Ajoutez du stock ou transférez des articles vers cette succursale pour les afficher.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {storefrontFilteredProducts.map(product => (
                    <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
                      <div className="h-48 bg-gray-100 relative overflow-hidden">
                        <img 
                          src={product.image_url || 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=800&q=80'} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 right-2 bg-black/65 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                          Stock : {product.quantity}
                        </span>
                      </div>
                      <div className="p-4 flex flex-col flex-1 justify-between space-y-3">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{product.name}</h4>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{product.description || 'Aucune description fournie.'}</p>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-400 uppercase font-mono">Ref: {product.batch_reference || 'N/A'}</span>
                          <span className="text-sm font-extrabold text-emerald-600">{(product.price || 0).toLocaleString()} FCFA</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: STAFF MANAGEMENT */}
        {isAdmin && activeTab === 'staff' && (
          <StaffManagement 
            supabase={supabase}
            branches={branches}
            staffList={staffList}
            fetchStaffFromSupabase={fetchStaffFromSupabase}
            verifyAdminPinBeforeAction={verifyAdminPinBeforeAction}
            staffName={staffName}
            setStaffName={setStaffName}
            staffPin={staffPin}
            setStaffPin={setStaffPin}
            staffRole={staffRole}
            setStaffRole={setStaffRole}
            staffBranch={staffBranch}
            setStaffBranch={setStaffBranch}
            editingStaff={editingStaff}
            setEditingStaff={setEditingStaff}
            handleSaveStaff={handleSaveStaff}
            handleToggleStaffStatus={handleToggleStaffStatus}
            handleStartEditStaff={handleStartEditStaff}
          />
        )}
      </div>

      {/* MULTI-PRODUCT BATCH TRANSFER MODAL */}
      <BatchTransferModal 
        batchTransferOpen={batchTransferOpen}
        setBatchTransferOpen={setBatchTransferOpen}
        batchTransferStep={batchTransferStep}
        setBatchTransferStep={setBatchTransferStep}
        batchTransferError={batchTransferError}
        hqProductsForTransfer={hqProductsForTransfer}
        selectedBatchItems={selectedBatchItems}
        handleToggleBatchItemSelect={handleToggleBatchItemSelect}
        handleUpdateBatchItemDetail={handleUpdateBatchItemDetail}
        branches={branches}
        activeSelectedArray={activeSelectedArray}
        handleProceedToBatchReview={handleProceedToBatchReview}
        handleConfirmBatchTransfer={handleConfirmBatchTransfer}
        batchTransferLoading={batchTransferLoading}
      />

      {/* SECURE ADMIN PIN MODAL */}
      {adminPinModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Sécurité Admin</h3>
                <p className="text-xs text-gray-500">Entrez votre code PIN Administrateur pour confirmer :</p>
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const verifyingAdmin = staffList.find(s => s.pin_code === adminPinInput && s.role === 'admin' && s.is_active);
              if (!verifyingAdmin) {
                setAdminPinError("Code PIN incorrect.");
                return;
              }
              setAdminPinModalOpen(false);
              if (adminPinResolve) adminPinResolve(true);
            }} className="space-y-4">
              <div>
                <input 
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value);
                    if (adminPinError) setAdminPinError('');
                  }}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-center text-xl tracking-widest font-mono focus:bg-white focus:ring-2 focus:ring-[#0f172a] focus:outline-none transition-all"
                />
                {adminPinError && (
                  <p className="text-xs text-red-600 mt-1.5 font-medium text-center">{adminPinError}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdminPinModalOpen(false);
                    if (adminPinResolve) adminPinResolve(false);
                  }}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-[#0f172a] hover:bg-slate-800 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer"
                >
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}