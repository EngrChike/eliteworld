import React, { useState, useEffect, useRef } from 'react';
import { Package, Users, Eye, EyeOff, UserCog, Store, Filter, Lock, Globe, ReceiptText, AlertTriangle } from 'lucide-react';
import SalesLedger from './SalesLedger';
import InventoryManagement from './components/InventoryManagement';
import BranchManagement from './components/BranchManagement';
import BatchTransferModal from './components/BatchTransferModal';
import TransferHistoryModal from './components/TransferHistoryModal';
import StaffManagement from './StaffManagement';

export default function AdminApp({ currentUser, supabase }) {
  const isAdmin = currentUser?.role === 'admin';
  
  const [activeTab, setActiveTab] = useState(isAdmin ? 'inventory' : 'customers'); 

  // Global Data states
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [transferLogs, setTransferLogs] = useState([]);
  
  // Privacy / Financial Visibility States
  const [showFinancials, setShowFinancials] = useState(false);
  const autoHideTimerRef = useRef(null);

  // Secure Admin PIN Modal States
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinResolve, setAdminPinResolve] = useState(null);
  const [adminPinError, setAdminPinError] = useState('');

  // Branch Context Filters & Low Stock Filter State
  const [viewingBranch, setViewingBranch] = useState(''); 
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

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

  // Transfer History Modal State
  const [transferHistoryOpen, setTransferHistoryOpen] = useState(false);

  // Determine active branch context
  const activeBranchId = isAdmin ? viewingBranch : (currentUser?.branch_id || '');

  useEffect(() => {
    fetchBranchesFromSupabase();
    fetchProducts();
    fetchCustomersFromSupabase();
    fetchTransferLogs();
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

  // --- BULLETPROOF CUSTOMER & SALES FETCHING ---
  const fetchCustomersFromSupabase = async () => {
    try {
      let rawCustomers = [];
      let historyData = [];

      // 1. Fetch Customers independently
      const { data: cData } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      rawCustomers = cData || [];

      // 2. Fetch Sales History independently to capture EVERY transaction (including walk-ins with no customer_id)
      const tablesToTry = ['customer_history', 'sales_ledger', 'sales'];
      for (const table of tablesToTry) {
        const { data: hData } = await supabase.from(table).select('*').order('created_at', { ascending: false });
        if (hData && hData.length > 0) {
          historyData = hData;
          break; // Stop once we find the correct history table
        }
      }

      // 3. Find unassigned / walk-in sales
      const unlinkedSales = historyData.filter(h => !h.customer_id && !h.customerId && !h.client_id);

      // Group unlinked sales by branch so revenue accurately attributes to the branch that made the direct sale
      const unlinkedByBranch = {};
      unlinkedSales.forEach(h => {
        const bId = h.branch_id || '';
        if (!unlinkedByBranch[bId]) unlinkedByBranch[bId] = [];
        unlinkedByBranch[bId].push(h);
      });

      Object.keys(unlinkedByBranch).forEach(bId => {
        rawCustomers.push({
          id: `walk_in_virtual_client_${bId || 'hq'}`,
          name: `Ventes Directes (${bId ? 'Succursale' : 'Siège Principal'})`,
          phone: '-',
          branch_id: bId || null,
          total_debt: 0
        });
      });

      const formatted = rawCustomers.map(c => {
        let cHist = [];
        
        // Attach history
        if (String(c.id).startsWith('walk_in_virtual_client_')) {
          const bId = c.branch_id || '';
          cHist = unlinkedByBranch[bId] || [];
        } else {
          cHist = historyData.filter(h => String(h.customer_id || h.customerId || h.client_id) === String(c.id));
        }

        const formattedHistory = cHist.map(h => {
          let parsedItems = [];
          if (h.items) {
            if (typeof h.items === 'string') {
              try { parsedItems = JSON.parse(h.items); } catch (e) { parsedItems = []; }
            } else if (Array.isArray(h.items)) {
              parsedItems = h.items;
            }
          }

          const itemSum = parsedItems.reduce((acc, it) => {
            const pr = parseFloat(it.price || it.unit_price || 0) || 0;
            const qt = parseInt(it.qty || it.quantity || 1) || 1;
            return acc + (pr * qt);
          }, 0);

          let dbTotal = parseFloat(h.total_amount ?? h.total ?? h.amount ?? h.grand_total);
          const totalAmt = !isNaN(dbTotal) ? dbTotal : itemSum;

          let dbPaid = parseFloat(h.amount_paid ?? h.paid ?? h.paid_amount);
          const paidAmt = !isNaN(dbPaid) ? dbPaid : totalAmt;

          let debtAmt = parseFloat(h.debt ?? h.balance ?? h.amount_due ?? 0) || 0;
          if (debtAmt === 0 && totalAmt > paidAmt && paidAmt > 0) {
            debtAmt = totalAmt - paidAmt;
          }

          return {
            ...h,
            id: h.id,
            total: totalAmt,
            total_amount: totalAmt,
            amount_paid: paidAmt,
            debt: debtAmt,
            items: parsedItems,
            productId: h.product_id || h.productId
          };
        }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        const directDebt = parseFloat(c.total_debt ?? c.totalDebt ?? c.debt ?? c.balance ?? 0) || 0;
        const historyDebtSum = formattedHistory.reduce((acc, h) => acc + (parseFloat(h.debt) || 0), 0);

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          branch_id: c.branch_id,
          totalDebt: Math.max(directDebt, historyDebtSum),
          history: formattedHistory
        };
      });

      setCustomers(formatted);
    } catch (err) { 
      console.error("Erreur clients:", err.message); 
    }
  };

  const fetchStaffFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
      if (!error && data) setStaffList(data);
    } catch (err) { console.error("Erreur personnel:", err); }
  };

  const fetchTransferLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_transfers')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setTransferLogs(data);
      }
    } catch (err) {
      console.log("Transfers history table optional initialization.");
    }
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

  const handleOpenTransferHistory = () => {
    fetchTransferLogs();
    setTransferHistoryOpen(true);
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

  // --- SAFE & ACCURATE BATCH TRANSFER CONFIRMATION ---
  const handleConfirmBatchTransfer = async () => {
    setBatchTransferLoading(true);
    setBatchTransferError('');

    try {
      const activeItems = Object.values(selectedBatchItems).filter(item => item.selected);
      if (activeItems.length === 0) {
        setBatchTransferError("Aucun produit sélectionné pour le transfert.");
        setBatchTransferLoading(false);
        return;
      }

      for (const item of activeItems) {
        const transferQty = Number(item.qty) || 0;
        if (!item.targetBranch) {
          throw new Error(`Veuillez sélectionner une succursale de destination pour "${item.product.name}".`);
        }
        if (transferQty <= 0) {
          throw new Error(`La quantité à transférer pour "${item.product.name}" doit être supérieure à 0.`);
        }
        if (transferQty > item.product.quantity) {
          throw new Error(`Quantité insuffisante au QG pour "${item.product.name}" (Stock dispo: ${item.product.quantity}).`);
        }
      }

      const transferRef = `TRF-${Date.now().toString().slice(-6)}`;
      const transferSummary = [];

      for (const item of activeItems) {
        const { product, targetBranch, qty } = item;
        const transferQty = Number(qty) || 0;

        const newHqQty = product.quantity - transferQty;
        const { error: hqError } = await supabase
          .from('products')
          .update({ quantity: newHqQty, stock_status: newHqQty > 0 })
          .eq('id', product.id);

        if (hqError) throw hqError;

        const existingTargetProd = products.find(p => 
          p.name.trim().toLowerCase() === product.name.trim().toLowerCase() && 
          String(p.batch_reference || '').trim().toUpperCase() === String(product.batch_reference || '').trim().toUpperCase() && 
          String(p.branch_id || '') === String(targetBranch)
        );

        if (existingTargetProd) {
          const newTargetQty = (existingTargetProd.quantity || 0) + transferQty;
          const { error: updateError } = await supabase
            .from('products')
            .update({ quantity: newTargetQty, stock_status: newTargetQty > 0 })
            .eq('id', existingTargetProd.id);

          if (updateError) throw updateError;
        } else {
          const { id, created_at, ...prodData } = product;
          prodData.branch_id = targetBranch;
          prodData.quantity = transferQty;
          prodData.initial_quantity = transferQty;
          prodData.stock_status = true;
          const { error: insertError } = await supabase.from('products').insert([prodData]);

          if (insertError) throw insertError;
        }

        const targetBranchObj = branches.find(b => String(b.id) === String(targetBranch));
        transferSummary.push({
          product_id: product.id,
          product_name: product.name,
          batch_reference: product.batch_reference || 'N/A',
          qty: transferQty,
          cost_price: product.cost_price || 0,
          price: product.price || 0,
          target_branch_id: targetBranch,
          target_branch_name: targetBranchObj?.name || 'Succursale'
        });
      }

      const newLogRecord = {
        transfer_ref: transferRef,
        items: transferSummary,
        created_by: currentUser?.full_name || 'Admin HQ',
        created_at: new Date().toISOString()
      };

      setTransferLogs(prev => [newLogRecord, ...prev]);

      try {
        const { data: insertedData, error: logErr } = await supabase
          .from('stock_transfers')
          .insert([newLogRecord])
          .select();

        if (logErr) {
          console.warn("Notice: stock_transfers DB table notice:", logErr.message);
        } else if (insertedData && insertedData.length > 0) {
          setTransferLogs(prev => prev.map(l => l.transfer_ref === transferRef ? insertedData[0] : l));
        }
      } catch (logErr) {
        console.warn("Table stock_transfers non encore disponible en BD:", logErr);
      }

      setBatchTransferLoading(false);
      setBatchTransferOpen(false);
      
      await fetchProducts();
      await fetchTransferLogs();

      alert(`Transfert groupé effectué avec succès ! Réf: ${transferRef}`);
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

  // ---- CONTEXT FILTERING & LOW-STOCK DETECTOR ----
  const contextProducts = products.filter(p => {
    if (activeBranchId === 'ALL') return true;
    return String(p.branch_id || '') === String(activeBranchId || '');
  });

  const contextCustomers = customers.filter(c => {
    if (activeBranchId === 'ALL') return true;
    return String(c.branch_id || '') === String(activeBranchId || '');
  });

  const lowStockProducts = contextProducts.filter(p => !p.is_archived && (parseInt(p.quantity) || 0) <= 3);
  const hasLowStock = lowStockProducts.length > 0;

  // ---- ACCURATE FINANCIAL CALCULATIONS ----
  const totalSalesRevenue = contextCustomers.reduce((acc, c) => {
    const customerSales = (c.history || []).reduce((hAcc, h) => {
      let rev = parseFloat(h.total ?? h.total_amount ?? h.amount ?? h.grand_total ?? h.total_price ?? 0) || 0;
      
      if (rev === 0 && Array.isArray(h.items) && h.items.length > 0) {
        rev = h.items.reduce((iAcc, it) => {
          const itemPrice = parseFloat(it.price ?? it.unit_price ?? it.total ?? 0) || 0;
          const itemQty = parseInt(it.qty ?? it.quantity ?? 1) || 1;
          return iAcc + (itemPrice * itemQty);
        }, 0);
      }
      return hAcc + rev;
    }, 0);
    return acc + customerSales;
  }, 0);

  const totalGoodsSoldCost = contextCustomers.reduce((acc, c) => {
    const customerCOGS = (c.history || []).reduce((hAcc, h) => {
      const items = Array.isArray(h.items) ? h.items : [];
      if (items.length > 0) {
        const hCogs = items.reduce((iAcc, it) => {
          const matchedProd = products.find(p => 
            String(p.id) === String(it.productId || it.product_id || it.id) ||
            p.name.trim().toLowerCase() === (it.name || it.product_name || '').trim().toLowerCase()
          );

          const unitCost = parseFloat(it.cost_price ?? it.costPrice ?? matchedProd?.cost_price ?? matchedProd?.costPrice ?? 0) || 0;
          const qty = parseInt(it.qty ?? it.quantity ?? 1) || 1;
          return iAcc + (unitCost * qty);
        }, 0);
        return hAcc + hCogs;
      } else {
        const matchedProd = products.find(p => 
          String(p.id) === String(h.productId || h.product_id) ||
          p.name.trim().toLowerCase() === (h.product_name || h.name || '').trim().toLowerCase()
        );
        const unitCost = parseFloat(h.cost_price ?? h.costPrice ?? matchedProd?.cost_price ?? 0) || 0;
        const qty = parseInt(h.qty ?? h.quantity ?? 1) || 1;
        return hAcc + (unitCost * qty);
      }
    }, 0);
    return acc + customerCOGS;
  }, 0);

  const totalOutstandingDebt = contextCustomers.reduce((acc, c) => {
    const directDebt = parseFloat(c.totalDebt ?? c.total_debt ?? c.debt ?? c.balance ?? c.outstanding_debt ?? 0) || 0;
    
    const historyDebt = (c.history || []).reduce((hAcc, h) => {
      let recordDebt = parseFloat(h.debt ?? h.balance ?? h.amount_due ?? 0) || 0;
      
      if (recordDebt === 0) {
        let recordTotal = parseFloat(h.total ?? h.total_amount ?? h.amount ?? h.grand_total ?? 0) || 0;
        if (recordTotal === 0 && Array.isArray(h.items) && h.items.length > 0) {
          recordTotal = h.items.reduce((iAcc, it) => iAcc + ((parseFloat(it.price || it.unit_price) || 0) * (parseInt(it.qty || it.quantity) || 1)), 0);
        }
        const recordPaid = parseFloat(h.amount_paid ?? h.paid ?? h.paid_amount ?? 0) || 0;
        if (recordTotal > recordPaid && recordPaid > 0) {
          recordDebt = recordTotal - recordPaid;
        }
      }
      return hAcc + recordDebt;
    }, 0);

    return acc + Math.max(directDebt, historyDebt);
  }, 0);

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

  const uniqueBatches = ['ALL', ...new Set(contextProducts.map(p => p.batch_reference).filter(Boolean))];
  const filteredProducts = contextProducts.filter(p => {
    const matchesBatch = selectedBatchFilter === 'ALL' || p.batch_reference === selectedBatchFilter;
    const matchesArchiveState = showArchived ? p.is_archived : !p.is_archived;
    const matchesLowStock = showLowStockOnly ? (parseInt(p.quantity) || 0) <= 3 : true;
    return matchesBatch && matchesArchiveState && matchesLowStock;
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

              <div className="flex items-center gap-3">
                {/* BLINKING LOW STOCK ALERT BUTTON */}
                <button 
                  onClick={() => {
                    setActiveTab('inventory');
                    setShowLowStockOnly(prev => !prev);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer ${
                    hasLowStock 
                      ? (showLowStockOnly 
                          ? 'bg-red-700 text-white ring-2 ring-red-400' 
                          : 'bg-red-600 text-white animate-pulse ring-2 ring-red-300')
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={hasLowStock ? `${lowStockProducts.length} produit(s) en stock critique (≤ 3)` : 'Stock normal'}
                >
                  <AlertTriangle className={`w-4 h-4 ${hasLowStock ? 'text-amber-300 animate-bounce' : 'text-gray-400'}`} />
                  <span>
                    {showLowStockOnly 
                      ? `Filtré: Stock Bas (${lowStockProducts.length})` 
                      : `Stock Critique (${lowStockProducts.length})`}
                  </span>
                </button>

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
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                {showFinancials ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showFinancials ? "Masquer les données" : "Afficher (10 min)"}
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-xl border-l-4 border-[#0f172a] shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Chiffre d'Affaires Brut</p>
                <p className="text-2xl font-bold text-gray-800 tracking-tight">{formatMoney(totalSalesRevenue)}</p>
                {showFinancials && <p className="text-[10px] text-gray-400 mt-1">Total des ventes enregistrées</p>}
              </div>

              <div className="bg-white p-5 rounded-xl border-l-4 border-amber-500 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Coût des Marchandises (COGS)</p>
                <p className="text-2xl font-bold text-amber-600 tracking-tight">{formatMoney(totalGoodsSoldCost)}</p>
                {showFinancials && <p className="text-[10px] text-gray-400 mt-1">Coût d'achat du stock vendu</p>}
              </div>

              <div className="bg-white p-5 rounded-xl border-l-4 border-emerald-500 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Marge Brute Réalisée</p>
                <p className="text-2xl font-bold text-emerald-600 tracking-tight">{formatMoney(totalSalesRevenue - totalGoodsSoldCost)}</p>
                {showFinancials && <p className="text-[10px] text-gray-400 mt-1">Bénéfice estimé sur ventes</p>}
              </div>

              <div className="bg-white p-5 rounded-xl border-l-4 border-blue-500 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Dettes Clients Actuelles</p>
                <p className="text-2xl font-bold text-blue-600 tracking-tight">{formatMoney(totalOutstandingDebt)}</p>
                {showFinancials && <p className="text-[10px] text-gray-400 mt-1">Total impayés à recouvrer</p>}
              </div>

              <div className="bg-white p-5 rounded-xl border-l-4 border-purple-500 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Valeur Stock Potentielle</p>
                <p className="text-2xl font-bold text-purple-600 tracking-tight">{formatMoney(totalPotentialRetail)}</p>
                {showFinancials && <p className="text-[10px] text-gray-400 mt-1">Si tout le stock actuel est vendu</p>}
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT RENDERING */}
        {activeTab === 'inventory' && (
          <InventoryManagement
            isAdmin={isAdmin}
            products={contextProducts}
            filteredProducts={filteredProducts}
            uniqueBatches={uniqueBatches}
            selectedBatchFilter={selectedBatchFilter}
            setSelectedBatchFilter={setSelectedBatchFilter}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            handleStartEditProduct={handleStartEditProduct}
            handleArchiveProduct={handleArchiveProduct}
            handleUpdateStockVolume={handleUpdateStockVolume}
            formatMoney={formatMoney}
            editingProduct={editingProduct}
            handleCancelEditProduct={handleCancelEditProduct}
            handleSaveProduct={handleSaveProduct}
            name={name} setName={setName}
            price={price} setPrice={setPrice}
            costPrice={costPrice} setCostPrice={setCostPrice}
            quantity={quantity} setQuantity={setQuantity}
            initialQuantity={initialQuantity} setInitialQuantity={setInitialQuantity}
            description={description} setDescription={setDescription}
            batch={batch} setBatch={setBatch}
            productBranch={productBranch} setProductBranch={setProductBranch}
            setImageFile={setImageFile}
            uploading={uploading}
            branches={branches}
            handleOpenBatchTransfer={handleOpenBatchTransfer}
            handleOpenTransferHistory={handleOpenTransferHistory}
          />
        )}

        {activeTab === 'customers' && (
          <SalesLedger 
            products={contextProducts} 
            customers={contextCustomers} 
            setCustomers={setCustomers} 
            supabase={supabase} 
            activeBranchId={activeBranchId} 
          />
        )}

        {activeTab === 'storefront' && isAdmin && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  Gestionnaire de Vitrine Client
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Définissez quelle succursale est visible par vos clients via l'application vitrine en direct.
                </p>
              </div>

              <div className="flex flex-col items-end gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">État actuel (En ligne)</span>
                <span className="text-sm font-bold text-blue-900 bg-white px-3 py-1 rounded-md shadow-sm">
                  {liveStoreBranch === '' ? 'Siège Principal (HQ)' : branches.find(b => b.id === liveStoreBranch)?.name || 'Inconnu'}
                </span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-gray-500" /> 1. Prévisualisation locale
                </h4>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Choisir une succursale à prévisualiser</label>
                  <select
                    value={storefrontBranch}
                    onChange={(e) => setStorefrontBranch(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Siège Principal (HQ) - {products.filter(p => (!p.branch_id || p.branch_id === '') && !p.is_archived && p.quantity > 0).length} articles</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} - {products.filter(p => p.branch_id === b.id && !p.is_archived && p.quantity > 0).length} articles
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 bg-green-50 p-5 rounded-xl border border-green-200 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-green-600" /> 2. Mise à jour de l'Application Client
                  </h4>
                  <p className="text-xs text-green-700 mb-4">
                    Appliquez la succursale sélectionnée ci-contre à l'application vitrine publique. Tous les clients verront instantanément ce stock.
                  </p>
                </div>
                <button
                  onClick={() => handleUpdateLiveBranch(storefrontBranch)}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-md transition-colors flex justify-center items-center gap-2"
                >
                  <Globe className="w-4 h-4" />
                  Appliquer à la Vitrine Publique
                </button>
              </div>
            </div>

            <div className="mt-8 border-t border-gray-100 pt-6">
              <h4 className="text-sm font-bold text-gray-800 mb-4">Aperçu du stock : {storefrontBranch === '' ? 'Siège Principal (HQ)' : branches.find(b => b.id === storefrontBranch)?.name}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {storefrontFilteredProducts.length > 0 ? (
                  storefrontFilteredProducts.map((p) => (
                    <div key={p.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 group">
                      <div className="relative">
                        <img src={p.image_url} alt={p.name} className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute top-0 right-0 bg-black/60 text-white text-[10px] font-bold px-2 py-1 m-1 rounded backdrop-blur-sm">
                          Stock: {p.quantity}
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="font-bold text-gray-800 text-xs truncate" title={p.name}>{p.name}</h4>
                        <p className="text-blue-600 font-extrabold text-sm mt-1">{p.price.toLocaleString()} FCFA</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    Aucun produit disponible dans cette succursale pour le moment.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branches' && isAdmin && (
          <BranchManagement
            branches={branches}
            branchName={branchName}
            setBranchName={setBranchName}
            branchLocation={branchLocation}
            setBranchLocation={setBranchLocation}
            handleSaveBranch={handleSaveBranch}
            editingBranch={editingBranch}
            setEditingBranch={setEditingBranch}
            handleDeleteBranch={handleDeleteBranch}
            products={products}
            staffList={staffList}
          />
        )}

        {activeTab === 'staff' && isAdmin && (
          <StaffManagement
            staffList={staffList}
            branches={branches}
            staffName={staffName} setStaffName={setStaffName}
            staffPin={staffPin} setStaffPin={setStaffPin}
            staffRole={staffRole} setStaffRole={setStaffRole}
            staffBranch={staffBranch} setStaffBranch={setStaffBranch}
            editingStaff={editingStaff}
            handleSaveStaff={handleSaveStaff}
            handleStartEditStaff={handleStartEditStaff}
            handleToggleStaffStatus={handleToggleStaffStatus}
            handleReassignStaff={handleReassignStaff}
            setEditingStaff={setEditingStaff}
          />
        )}

      </div>

      {/* --- BATCH TRANSFER MODAL --- */}
      {batchTransferOpen && (
        <BatchTransferModal
          batchTransferStep={batchTransferStep}
          setBatchTransferStep={setBatchTransferStep}
          setBatchTransferOpen={setBatchTransferOpen}
          batchTransferError={batchTransferError}
          setBatchTransferError={setBatchTransferError}
          hqProductsForTransfer={hqProductsForTransfer}
          selectedBatchItems={selectedBatchItems}
          handleToggleBatchItemSelect={handleToggleBatchItemSelect}
          handleUpdateBatchItemDetail={handleUpdateBatchItemDetail}
          handleProceedToBatchReview={handleProceedToBatchReview}
          branches={branches}
          activeSelectedArray={activeSelectedArray}
          handleConfirmBatchTransfer={handleConfirmBatchTransfer}
          batchTransferLoading={batchTransferLoading}
        />
      )}

      {/* --- TRANSFER HISTORY MODAL --- */}
      {transferHistoryOpen && (
        <TransferHistoryModal
          setTransferHistoryOpen={setTransferHistoryOpen}
          transferLogs={transferLogs}
        />
      )}

      {/* --- ADMIN SECURE PIN MODAL --- */}
      {adminPinModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl transform transition-all">
            <div className="flex flex-col items-center mb-6">
              <div className="bg-red-50 p-3 rounded-full mb-3">
                <Lock className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-gray-800">Action Sécurisée</h3>
              <p className="text-sm text-gray-500 text-center mt-2">Veuillez entrer votre PIN administrateur pour confirmer cette action.</p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (adminPinInput === currentUser.pin_code) {
                setAdminPinModalOpen(false);
                if (adminPinResolve) adminPinResolve(true);
              } else {
                setAdminPinError('PIN incorrect. Accès refusé.');
              }
            }}>
              <div className="mb-6">
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className={`w-full text-center text-2xl tracking-[0.5em] font-bold p-4 border-2 rounded-xl outline-none transition-all ${adminPinError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#0f172a] focus:ring-4 focus:ring-slate-100'}`}
                  placeholder="••••••"
                  maxLength={6}
                  autoFocus
                />
                {adminPinError && <p className="text-red-500 text-xs font-bold mt-2 text-center">{adminPinError}</p>}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAdminPinModalOpen(false);
                    if (adminPinResolve) adminPinResolve(false);
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#0f172a] hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-lg shadow-slate-200 transition-all"
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