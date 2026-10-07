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
  
  // Live Public Storefront Control State
  const [liveStoreBranch, setLiveStoreBranch] = useState('');

  // --- BULLETPROOF AMOUNT PARSER ---
  const parseAmt = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    // Strips out letters, spaces, and commas to prevent parsing errors like "25,000 FCFA" -> 25
    return parseFloat(String(val).replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
  };

  useEffect(() => {
    localStorage.setItem('donchike_storefront_branch', storefrontBranch);
  }, [storefrontBranch]);

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
  const [transferHistoryOpen, setTransferHistoryOpen] = useState(false);

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

  const fetchStoreSettings = async () => {
    try {
      const { data } = await supabase.from('store_settings').select('active_branch').single();
      if (data) setLiveStoreBranch(data.active_branch || '');
    } catch (err) {
      console.log("Paramètres de la boutique non configurés.");
    }
  };

  const handleUpdateLiveBranch = async (newBranchId) => {
    if (!(await verifyAdminPinBeforeAction())) return;
    try {
      const { error } = await supabase.from('store_settings').upsert({ id: 1, active_branch: newBranchId }, { onConflict: 'id' });
      if (error) throw error;
      setLiveStoreBranch(newBranchId);
      const branchObj = branches.find(b => b.id === newBranchId);
      alert(`Succès ! L'application client affiche maintenant les stocks de : ${branchObj ? branchObj.name : 'Siège Principal'}`);
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

  // --- REWRITTEN & BULLETPROOF CUSTOMER/SALES FETCHING ---
  const fetchCustomersFromSupabase = async () => {
    try {
      // 1. Fetch all customers
      const { data: cData } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      let rawCustomers = cData || [];

      // 2. Fetch sales from ALL possible tables simultaneously to bypass broken relations
      const [res1, res2, res3] = await Promise.all([
        supabase.from('customer_history').select('*').catch(() => ({ data: [] })),
        supabase.from('sales_ledger').select('*').catch(() => ({ data: [] })),
        supabase.from('sales').select('*').catch(() => ({ data: [] }))
      ]);

      let historyData = [];
      if (res1?.data?.length) historyData = [...historyData, ...res1.data];
      if (res2?.data?.length) historyData = [...historyData, ...res2.data];
      if (res3?.data?.length) historyData = [...historyData, ...res3.data];

      // Deduplicate to ensure we don't double-count views or matching IDs
      const uniqueHistory = Array.from(new Map(historyData.map(item => [item.id, item])).values());

      // 3. Attach history directly matching customer IDs
      rawCustomers = rawCustomers.map(c => {
        const cHist = uniqueHistory.filter(h => 
          String(h.customer_id || h.customerId || h.client_id) === String(c.id)
        );
        return { ...c, customer_history: cHist };
      });

      // 4. Safely handle orphan sales (sales not linked to any specific customer)
      const orphanSales = uniqueHistory.filter(h => 
        !rawCustomers.some(c => String(c.id) === String(h.customer_id || h.customerId || h.client_id))
      );

      if (orphanSales.length > 0) {
        rawCustomers.push({
          id: 'virtual_global_client',
          name: 'Ventes Directes Client / Walk-in',
          phone: '',
          branch_id: null,
          total_debt: 0,
          customer_history: orphanSales
        });
      }

      // 5. Structure and safely parse amounts using parseAmt
      const formatted = rawCustomers.map(c => {
        const rawHistory = c.customer_history || [];
        const formattedHistory = rawHistory.map(h => {
          let parsedItems = [];
          if (h.items) {
            if (typeof h.items === 'string') {
              try { parsedItems = JSON.parse(h.items); } catch (e) { parsedItems = []; }
            } else if (Array.isArray(h.items)) {
              parsedItems = h.items;
            }
          }

          const itemSum = parsedItems.reduce((acc, it) => {
            const pr = parseAmt(it.price ?? it.unit_price);
            const qt = parseInt(it.qty ?? it.quantity ?? 1) || 1;
            return acc + (pr * qt);
          }, 0);

          const totalAmt = parseAmt(h.total_amount ?? h.total ?? h.amount ?? h.grand_total ?? h.total_price) || itemSum;
          const paidAmt = parseAmt(h.amount_paid ?? h.paid ?? h.paid_amount);
          let debtAmt = parseAmt(h.debt ?? h.balance ?? h.amount_due);

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

        const directDebt = parseAmt(c.total_debt ?? c.totalDebt ?? c.debt ?? c.balance);
        const historyDebtSum = formattedHistory.reduce((acc, h) => acc + parseAmt(h.debt), 0);

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
      const { data, error } = await supabase.from('stock_transfers').select('*').order('created_at', { ascending: false });
      if (!error && data) setTransferLogs(data);
    } catch (err) {}
  };

  const verifyAdminPinBeforeAction = () => {
    return new Promise((resolve) => {
      setAdminPinInput('');
      setAdminPinError('');
      setAdminPinResolve(() => resolve);
      setAdminPinModalOpen(true);
    });
  };

  const handleToggleFinancialVisibility = async () => {
    if (showFinancials) {
      setShowFinancials(false);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    } else {
      if (await verifyAdminPinBeforeAction()) {
        setShowFinancials(true);
        if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = setTimeout(() => setShowFinancials(false), 10 * 60 * 1000);
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
      await supabase.from('branches').delete().eq('id', branchId);
      alert('Succursale supprimée !');
      if (viewingBranch === branchId) setViewingBranch('');
      if (storefrontBranch === branchId) setStorefrontBranch('');
      fetchBranchesFromSupabase();
    } catch (err) { alert(`Erreur lors de la suppression: ${err.message}`); }
  };

  const handleReassignStaff = async (staffId, newBranchId) => {
    if (!(await verifyAdminPinBeforeAction())) return;
    try {
      await supabase.from('staff').update({ branch_id: newBranchId || null }).eq('id', staffId);
      alert('Personnel réassigné avec succès !');
      fetchStaffFromSupabase();
    } catch (err) { alert(`Erreur: ${err.message}`); }
  };

  const handleStartEditStaff = async (staffMember) => {
    if (!(await verifyAdminPinBeforeAction())) return;
    setEditingStaff(staffMember); setStaffName(staffMember.full_name || ''); setStaffPin(staffMember.pin_code || '');
    setStaffRole(staffMember.role || 'staff'); setStaffBranch(staffMember.branch_id || ''); setActiveTab('staff');
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!staffName || !staffPin) return;
    if (!(await verifyAdminPinBeforeAction())) return;
    try {
      const payload = { full_name: staffName.trim(), pin_code: staffPin.trim(), role: staffRole, branch_id: staffBranch || null, is_active: true };
      if (editingStaff) await supabase.from('staff').update(payload).eq('id', editingStaff.id);
      else await supabase.from('staff').insert([payload]);
      setStaffName(''); setStaffPin(''); setStaffRole('staff'); setStaffBranch(''); setEditingStaff(null);
      fetchStaffFromSupabase();
      alert('Personnel enregistré !');
    } catch (err) { alert(`Erreur: ${err.message}`); }
  };

  const handleToggleStaffStatus = async (id, currentStatus) => {
    if (!(await verifyAdminPinBeforeAction())) return;
    try {
      await supabase.from('staff').update({ is_active: !currentStatus }).eq('id', id);
      fetchStaffFromSupabase(); alert(currentStatus ? 'Personnel désactivé !' : 'Personnel réactivé !');
    } catch (err) { alert(`Erreur: ${err.message}`); }
  };

  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => { 
    return new Promise((resolve) => {
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

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name || !price || quantity === '' || !batch) return;
    setUploading(true);
    let image_url = editingProduct ? editingProduct.image_url : 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=800&q=80';
    try {
      if (imageFile) {
        let fileToUpload = await compressImage(imageFile, 800, 800, 0.75);
        const fileName = `${Date.now()}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        await supabase.storage.from('product-images').upload(fileName, fileToUpload);
        image_url = supabase.storage.from('product-images').getPublicUrl(fileName)?.data?.publicUrl || image_url;
      }
      
      const parsedQty = parseInt(quantity) || 0;
      const payload = { 
        name: name.trim(), description: description.trim(), price: parseFloat(price), cost_price: parseFloat(costPrice) || 0,
        image_url, quantity: parsedQty, initial_quantity: initialQuantity !== '' ? parseInt(initialQuantity) : (editingProduct ? editingProduct.initial_quantity : parsedQty),
        stock_status: parsedQty > 0, batch_reference: batch.trim().toUpperCase(), branch_id: productBranch || null, is_archived: false
      };

      if (editingProduct) await supabase.from('products').update(payload).eq('id', editingProduct.id);
      else await supabase.from('products').insert([payload]);

      handleCancelEditProduct(); await fetchProducts(); alert('Inventaire enregistré avec succès !');
    } catch (err) { alert(`Erreur: ${err.message}`); } finally { setUploading(false); }
  };

  const handleOpenBatchTransfer = () => {
    setSelectedBatchItems({}); setBatchTransferStep('select'); setBatchTransferError(''); setBatchTransferOpen(true);
  };
  const handleOpenTransferHistory = () => { fetchTransferLogs(); setTransferHistoryOpen(true); };

  const handleToggleBatchItemSelect = (product) => {
    setSelectedBatchItems(prev => {
      const copy = { ...prev };
      if (copy[product.id]?.selected) delete copy[product.id];
      else copy[product.id] = { product, selected: true, targetBranch: branches[0]?.id || '', qty: 1 };
      return copy;
    });
  };

  const handleUpdateBatchItemDetail = (productId, field, value) => {
    setSelectedBatchItems(prev => prev[productId] ? { ...prev, [productId]: { ...prev[productId], [field]: value } } : prev);
  };

  const handleProceedToBatchReview = () => {
    const activeItems = Object.values(selectedBatchItems).filter(item => item.selected);
    if (activeItems.length === 0) return setBatchTransferError("Veuillez sélectionner au moins un produit.");
    for (const item of activeItems) {
      if (!item.targetBranch) return setBatchTransferError("Veuillez assigner une succursale.");
      if (item.qty <= 0) return setBatchTransferError(`Quantité pour "${item.product.name}" doit être > 0.`);
      if (item.qty > item.product.quantity) return setBatchTransferError(`Stock insuffisant pour "${item.product.name}".`);
    }
    setBatchTransferError(''); setBatchTransferStep('review');
  };

  const handleConfirmBatchTransfer = async () => {
    setBatchTransferLoading(true); setBatchTransferError('');
    try {
      const activeItems = Object.values(selectedBatchItems).filter(item => item.selected);
      const transferRef = `TRF-${Date.now().toString().slice(-6)}`;
      const transferSummary = [];

      for (const item of activeItems) {
        const { product, targetBranch, qty } = item;
        const transferQty = Number(qty) || 0;

        const newHqQty = product.quantity - transferQty;
        await supabase.from('products').update({ quantity: newHqQty, stock_status: newHqQty > 0 }).eq('id', product.id);

        const existingTargetProd = products.find(p => p.name.trim().toLowerCase() === product.name.trim().toLowerCase() && 
          String(p.batch_reference || '').trim().toUpperCase() === String(product.batch_reference || '').trim().toUpperCase() && String(p.branch_id || '') === String(targetBranch)
        );

        if (existingTargetProd) {
          const newTargetQty = (existingTargetProd.quantity || 0) + transferQty;
          await supabase.from('products').update({ quantity: newTargetQty, stock_status: newTargetQty > 0 }).eq('id', existingTargetProd.id);
        } else {
          const { id, created_at, ...prodData } = product;
          prodData.branch_id = targetBranch; prodData.quantity = transferQty; prodData.initial_quantity = transferQty; prodData.stock_status = true;
          await supabase.from('products').insert([prodData]);
        }
        
        transferSummary.push({
          product_id: product.id, product_name: product.name, batch_reference: product.batch_reference || 'N/A', qty: transferQty,
          cost_price: product.cost_price || 0, price: product.price || 0, target_branch_id: targetBranch, target_branch_name: branches.find(b => String(b.id) === String(targetBranch))?.name || 'Succursale'
        });
      }

      const newLogRecord = { transfer_ref: transferRef, items: transferSummary, created_by: currentUser?.full_name || 'Admin HQ', created_at: new Date().toISOString() };
      setTransferLogs(prev => [newLogRecord, ...prev]);
      try {
        const { data } = await supabase.from('stock_transfers').insert([newLogRecord]).select();
        if (data?.length > 0) setTransferLogs(prev => prev.map(l => l.transfer_ref === transferRef ? data[0] : l));
      } catch (e) {}

      setBatchTransferLoading(false); setBatchTransferOpen(false);
      await fetchProducts(); await fetchTransferLogs(); alert(`Transfert effectué ! Réf: ${transferRef}`);
    } catch (err) { setBatchTransferError(`Erreur: ${err.message}`); setBatchTransferLoading(false); }
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

  // ---- FIXED CONTEXT FILTERING ----
  const contextProducts = products.filter(p => {
    if (activeBranchId === 'ALL') return true;
    if (activeBranchId === '') return !p.branch_id || p.branch_id === '';
    return String(p.branch_id || '') === String(activeBranchId);
  });

  const contextCustomers = customers.filter(c => {
    if (activeBranchId === 'ALL') return true;
    if (activeBranchId === '') return !c.branch_id || c.branch_id === '';
    return String(c.branch_id || '') === String(activeBranchId);
  });

  const lowStockProducts = contextProducts.filter(p => !p.is_archived && (parseInt(p.quantity) || 0) <= 3);
  const hasLowStock = lowStockProducts.length > 0;

  // ---- SAFE & ACCURATE FINANCIAL CALCULATIONS USING parseAmt ----
  const totalSalesRevenue = contextCustomers.reduce((acc, c) => {
    const customerSales = (c.history || []).reduce((hAcc, h) => {
      let rev = parseAmt(h.total ?? h.total_amount ?? h.amount ?? h.grand_total ?? h.total_price);
      if (rev === 0 && Array.isArray(h.items) && h.items.length > 0) {
        rev = h.items.reduce((iAcc, it) => iAcc + (parseAmt(it.price ?? it.unit_price ?? it.total) * (parseInt(it.qty ?? it.quantity ?? 1) || 1)), 0);
      }
      return hAcc + rev;
    }, 0);
    return acc + customerSales;
  }, 0);

  const totalGoodsSoldCost = contextCustomers.reduce((acc, c) => {
    const customerCOGS = (c.history || []).reduce((hAcc, h) => {
      const items = Array.isArray(h.items) ? h.items : [];
      if (items.length > 0) {
        return hAcc + items.reduce((iAcc, it) => {
          const matchedProd = products.find(p => String(p.id) === String(it.productId || it.product_id || it.id) || p.name.trim().toLowerCase() === String(it.name || it.product_name || '').trim().toLowerCase());
          const unitCost = parseAmt(it.cost_price ?? it.costPrice ?? matchedProd?.cost_price ?? matchedProd?.costPrice);
          return iAcc + (unitCost * (parseInt(it.qty ?? it.quantity ?? 1) || 1));
        }, 0);
      } else {
        const matchedProd = products.find(p => String(p.id) === String(h.productId || h.product_id) || p.name.trim().toLowerCase() === String(h.product_name || h.name || '').trim().toLowerCase());
        return hAcc + (parseAmt(h.cost_price ?? h.costPrice ?? matchedProd?.cost_price) * (parseInt(h.qty ?? h.quantity ?? 1) || 1));
      }
    }, 0);
    return acc + customerCOGS;
  }, 0);

  const totalOutstandingDebt = contextCustomers.reduce((acc, c) => {
    const directDebt = parseAmt(c.totalDebt ?? c.total_debt ?? c.debt ?? c.balance ?? c.outstanding_debt);
    const historyDebt = (c.history || []).reduce((hAcc, h) => {
      let recordDebt = parseAmt(h.debt ?? h.balance ?? h.amount_due);
      if (recordDebt === 0) {
        let recordTotal = parseAmt(h.total ?? h.total_amount ?? h.amount ?? h.grand_total);
        if (recordTotal === 0 && Array.isArray(h.items) && h.items.length > 0) recordTotal = h.items.reduce((iAcc, it) => iAcc + (parseAmt(it.price || it.unit_price) * (parseInt(it.qty || it.quantity) || 1)), 0);
        const recordPaid = parseAmt(h.amount_paid ?? h.paid ?? h.paid_amount);
        if (recordTotal > recordPaid && recordPaid > 0) recordDebt = recordTotal - recordPaid;
      }
      return hAcc + recordDebt;
    }, 0);
    return acc + Math.max(directDebt, historyDebt);
  }, 0);

  const getProductSoldQty = (productId) => contextCustomers.reduce((acc, c) => acc + (c.history || []).reduce((hAcc, h) => {
    if (h.items && Array.isArray(h.items) && h.items.length > 0) {
      const item = h.items.find(i => String(i.productId || i.product_id || i.id) === String(productId));
      return hAcc + (item ? (parseInt(item.qty || item.quantity) || 0) : 0);
    }
    return hAcc + (String(h.productId || h.product_id || '') === String(productId) ? (parseInt(h.qty || h.quantity) || 1) : 0);
  }, 0), 0);

  const getTrueInitialQty = (p) => (p.initial_quantity !== undefined && p.initial_quantity !== null && p.initial_quantity !== '') ? parseInt(p.initial_quantity) : (parseInt(p.quantity) || 0) + getProductSoldQty(p.id);

  const totalInventoryCost = contextProducts.reduce((acc, p) => acc + (parseAmt(p.cost_price) * getTrueInitialQty(p)), 0);
  const totalExpectedRevenue = contextProducts.reduce((acc, p) => acc + (parseAmt(p.price) * getTrueInitialQty(p)), 0);
  const totalPotentialRetail = contextProducts.filter(p => !p.is_archived).reduce((acc, p) => acc + (parseAmt(p.price) * (parseInt(p.quantity) || 0)), 0);

  const uniqueBatches = ['ALL', ...new Set(contextProducts.map(p => p.batch_reference).filter(Boolean))];
  const filteredProducts = contextProducts.filter(p => (selectedBatchFilter === 'ALL' || p.batch_reference === selectedBatchFilter) && (showArchived ? p.is_archived : !p.is_archived) && (showLowStockOnly ? (parseInt(p.quantity) || 0) <= 3 : true));
  
  const storefrontFilteredProducts = products.filter(p => {
    if (p.is_archived || parseInt(p.quantity) < 1) return false;
    if (storefrontBranch === '') return !p.branch_id || p.branch_id === '';
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
                <button 
                  onClick={() => { setActiveTab('inventory'); setShowLowStockOnly(prev => !prev); }}
                  className={`px-3 py-2 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer ${hasLowStock ? (showLowStockOnly ? 'bg-red-700 text-white ring-2 ring-red-400' : 'bg-red-600 text-white animate-pulse ring-2 ring-red-300') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title={hasLowStock ? `${lowStockProducts.length} produit(s) en stock critique (≤ 3)` : 'Stock normal'}
                >
                  <AlertTriangle className={`w-4 h-4 ${hasLowStock ? 'text-amber-300 animate-bounce' : 'text-gray-400'}`} />
                  <span>{showLowStockOnly ? `Filtré: Stock Bas (${lowStockProducts.length})` : `Stock Critique (${lowStockProducts.length})`}</span>
                </button>

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
            <h2 className="text-sm font-bold uppercase text-gray-800 flex items-center gap-2"><Users className="w-5 h-5 text-[#0f172a]" /> Staff Portal - {currentUser.full_name}</h2>
            <span className="text-xs font-semibold bg-blue-50 px-3 py-1.5 rounded-full text-blue-700 border border-blue-100">{branches.find(b => b.id === currentUser.branch_id)?.name || 'HQ / Main'}</span>
          </div>
        )}

        {/* FINANCIAL METRICS */}
        {isAdmin && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-gray-400" /> Performance Financière
              </span>
              <button onClick={handleToggleFinancialVisibility} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-gray-100 text-gray-700 transition-all border border-gray-200 shadow-sm cursor-pointer">
                {showFinancials ? <><EyeOff className="w-4 h-4 text-red-500" /><span>Masquer les chiffres</span></> : <><Eye className="w-4 h-4 text-emerald-600" /><span>Afficher les chiffres (PIN requis)</span></>}
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
          <BranchManagement branches={branches} branchName={branchName} setBranchName={setBranchName} branchLocation={branchLocation} setBranchLocation={setBranchLocation} editingBranch={editingBranch} setEditingBranch={setEditingBranch} handleSaveBranch={handleSaveBranch} handleDeleteBranch={handleDeleteBranch} staffList={staffList} handleReassignStaff={handleReassignStaff} />
        )}

        {/* TAB 2: INVENTORY MANAGEMENT */}
        {isAdmin && activeTab === 'inventory' && (
          <InventoryManagement branches={branches} productBranch={productBranch} setProductBranch={setProductBranch} name={name} setName={setName} description={description} setDescription={setDescription} batch={batch} setBatch={setBatch} costPrice={costPrice} setCostPrice={setCostPrice} price={price} setPrice={setPrice} initialQuantity={initialQuantity} setInitialQuantity={setInitialQuantity} quantity={quantity} setQuantity={setQuantity} setImageFile={setImageFile} handleSaveProduct={handleSaveProduct} uploading={uploading} editingProduct={editingProduct} handleCancelEditProduct={handleCancelEditProduct} handleOpenBatchTransfer={handleOpenBatchTransfer} handleOpenTransferHistory={handleOpenTransferHistory} showArchived={showArchived} setShowArchived={setShowArchived} selectedBatchFilter={selectedBatchFilter} setSelectedBatchFilter={setSelectedBatchFilter} uniqueBatches={uniqueBatches} filteredProducts={filteredProducts} handleUpdateStockVolume={handleUpdateStockVolume} handleStartEditProduct={handleStartEditProduct} handleArchiveProduct={handleArchiveProduct} />
        )}

        {/* TAB 3: SALES LEDGER */}
        {activeTab === 'customers' && (
          <SalesLedger products={contextProducts} customers={contextCustomers} fetchProducts={fetchProducts} fetchCustomers={fetchCustomersFromSupabase} supabase={supabase} currentUser={currentUser} activeBranchId={activeBranchId} />
        )}

        {/* TAB 4: STOREFRONT PREVIEW & GLOBAL STORE CONTROL */}
        {isAdmin && activeTab === 'storefront' && (
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-xl border-2 border-emerald-500/20 shadow-sm bg-gradient-to-r from-emerald-50/50 to-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-emerald-900 flex items-center gap-2"><Globe className="w-5 h-5 text-emerald-600" /> Configuration de la Boutique Publique</h3>
                  <p className="text-sm text-gray-600 mt-1">Sélectionnez la succursale dont le stock sera <span className="font-semibold text-emerald-700">actuellement visible</span> par vos clients sur le lien public.</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm min-w-[220px]">
                   <div className="flex flex-col w-full">
                     <span className="text-[10px] uppercase font-bold text-gray-400">Succursale Active en Ligne</span>
                     <select value={liveStoreBranch} onChange={(e) => handleUpdateLiveBranch(e.target.value)} className="text-sm font-bold text-gray-900 bg-transparent outline-none cursor-pointer w-full mt-0.5">
                       <option value="">Siège Principal (HQ)</option>
                       {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                     </select>
                   </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-gray-900 flex items-center gap-2"><Eye className="w-5 h-5 text-indigo-600" /> Aperçu du Catalogue</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Visualisez les articles actuellement affichés aux clients pour la succursale sélectionnée.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select value={storefrontBranch} onChange={(e) => setStorefrontBranch(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-semibold text-gray-800 outline-none cursor-pointer w-full sm:w-auto">
                    <option value="">Aperçu : Siège Principal (HQ)</option>
                    {branches.map(b => (<option key={b.id} value={b.id}>Aperçu : {b.name}</option>))}
                  </select>
                  <button onClick={() => { navigator.clipboard.writeText(window.location.origin); alert("Lien copié !"); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer">Copier le lien</button>
                </div>
              </div>

              {storefrontFilteredProducts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-700">Aucun produit disponible dans cette succursale</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {storefrontFilteredProducts.map(product => (
                    <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
                      <div className="h-48 bg-gray-100 relative overflow-hidden">
                        <img src={product.image_url || 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=800&q=80'} alt={product.name} className="w-full h-full object-cover" />
                        <span className="absolute top-2 right-2 bg-black/65 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Stock : {product.quantity}</span>
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
          <StaffManagement supabase={supabase} branches={branches} staffList={staffList} fetchStaffFromSupabase={fetchStaffFromSupabase} verifyAdminPinBeforeAction={verifyAdminPinBeforeAction} staffName={staffName} setStaffName={setStaffName} staffPin={staffPin} setStaffPin={setStaffPin} staffRole={staffRole} setStaffRole={setStaffRole} staffBranch={staffBranch} setStaffBranch={setStaffBranch} editingStaff={editingStaff} setEditingStaff={setEditingStaff} handleSaveStaff={handleSaveStaff} handleToggleStaffStatus={handleToggleStaffStatus} handleStartEditStaff={handleStartEditStaff} />
        )}
      </div>

      <BatchTransferModal batchTransferOpen={batchTransferOpen} setBatchTransferOpen={setBatchTransferOpen} batchTransferStep={batchTransferStep} setBatchTransferStep={setBatchTransferStep} batchTransferError={batchTransferError} hqProductsForTransfer={hqProductsForTransfer} selectedBatchItems={selectedBatchItems} handleToggleBatchItemSelect={handleToggleBatchItemSelect} handleUpdateBatchItemDetail={handleUpdateBatchItemDetail} branches={branches} activeSelectedArray={activeSelectedArray} handleProceedToBatchReview={handleProceedToBatchReview} handleConfirmBatchTransfer={handleConfirmBatchTransfer} batchTransferLoading={batchTransferLoading} />
      <TransferHistoryModal isOpen={transferHistoryOpen} onClose={() => setTransferHistoryOpen(false)} transferLogs={transferLogs} branches={branches} />

      {adminPinModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Lock className="w-5 h-5" /></div>
              <div><h3 className="text-base font-bold text-gray-900">Sécurité Admin</h3><p className="text-xs text-gray-500">Entrez votre code PIN Administrateur pour confirmer :</p></div>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const verifyingAdmin = staffList.find(s => s.pin_code === adminPinInput && s.role === 'admin' && s.is_active);
              if (!verifyingAdmin) { setAdminPinError("Code PIN incorrect."); return; }
              setAdminPinModalOpen(false); if (adminPinResolve) adminPinResolve(true);
            }} className="space-y-4">
              <div>
                <input type="password" value={adminPinInput} onChange={(e) => { setAdminPinInput(e.target.value); if (adminPinError) setAdminPinError(''); }} placeholder="••••••••" autoFocus className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-center text-xl tracking-widest font-mono focus:bg-white focus:ring-2 focus:ring-[#0f172a] focus:outline-none transition-all" />
                {adminPinError && <p className="text-xs text-red-600 mt-1.5 font-medium text-center">{adminPinError}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setAdminPinModalOpen(false); if (adminPinResolve) adminPinResolve(false); }} className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-all cursor-pointer">Annuler</button>
                <button type="submit" className="flex-1 py-2.5 px-4 bg-[#0f172a] hover:bg-slate-800 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer">Confirmer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}