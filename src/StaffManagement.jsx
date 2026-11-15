import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserPlus, UserCheck, UserX, Clock, Folder, ChevronDown, ChevronRight, Key, Edit, XCircle, ShieldAlert } from 'lucide-react';

export default function StaffManagement({ supabase, branches = [] }) {
  const [staffList, setStaffList] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [expandedMonths, setExpandedMonths] = useState({});
  
  // Form State (used for Creation and Editing)
  const [formData, setFormData] = useState({ fullName: '', pinCode: '', role: 'staff', branchId: '' });
  const [editingStaff, setEditingStaff] = useState(null);

  // Modal Security State (Replaces window.prompt)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const pendingActionRef = useRef(null);

  useEffect(() => {
    fetchStaff();
    fetchSales();
  }, []);

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setStaffList(data);
  };

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('customer_history')
      .select('*')
      .not('staff_id', 'is', null)
      .order('created_at', { ascending: false });
    if (!error && data) setSalesHistory(data);
  };

  // 🔒 Admin Authentication Trigger using useRef for mobile stability
  const requestAdminAuth = (actionCallback) => {
    setAdminPinInput('');
    setPinError('');
    pendingActionRef.current = actionCallback;
    setIsPinModalOpen(true);
  };

  // 🔒 PIN Verification inside Modal (Fixed with input blur for iOS Chrome compatibility)
  const handleVerifyAdminPin = (e) => {
    e.preventDefault();

    // Blur active input to dismiss iOS virtual keyboard smoothly and prevent Chrome white screen crash
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const verifyingAdmin = staffList.find(s => s.pin_code === adminPinInput.trim() && s.role === 'admin' && s.is_active);

    if (!verifyingAdmin) {
      setPinError("❌ Incorrect or unauthorized administrator PIN code.");
      return;
    }

    setIsPinModalOpen(false);
    
    // Safely delay state execution to let iOS Chrome finish keyboard dismissal animation
    setTimeout(() => {
      if (pendingActionRef.current) {
        const callback = pendingActionRef.current;
        pendingActionRef.current = null;
        callback();
      }
    }, 100);
  };

  // --- STAFF ACTIONS ---

  const handleStartEdit = (staff) => {
    requestAdminAuth(() => {
      setEditingStaff(staff);
      setFormData({
        fullName: staff.full_name || '',
        pinCode: staff.pin_code || '',
        role: staff.role || 'staff',
        branchId: staff.branch_id || ''
      });
    });
  };

  const handleCancelEdit = () => {
    setEditingStaff(null);
    setFormData({ fullName: '', pinCode: '', role: 'staff', branchId: '' });
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.pinCode) return alert("Full name and PIN are required");

    const payload = {
      full_name: formData.fullName.trim(),
      pin_code: formData.pinCode.trim(),
      role: formData.role,
      branch_id: formData.branchId || null
    };

    if (editingStaff) {
      // EDITING
      const { error } = await supabase.from('staff').update(payload).eq('id', editingStaff.id);
      if (error) {
        alert("Error updating staff account.");
      } else {
        alert("Staff account updated successfully!");
        handleCancelEdit();
        fetchStaff();
      }
    } else {
      // CREATION
      const { error } = await supabase.from('staff').insert([payload]);
      if (error) {
        alert(error.code === '23505' ? "This PIN code is already in use." : "Error creating account.");
      } else {
        alert("Staff account created successfully!");
        handleCancelEdit();
        fetchStaff();
      }
    }
  };

  const toggleStaffStatus = (id, currentStatus) => {
    requestAdminAuth(async () => {
      const { error } = await supabase.from('staff').update({ is_active: !currentStatus }).eq('id', id);
      if (!error) {
        fetchStaff();
        alert(`Account status updated (${!currentStatus ? 'Active' : 'Inactive'}).`);
      } else {
        alert("Error updating status.");
      }
    });
  };

  // --- SALES DISPLAY LOGIC ---
  
  const toggleMonth = (monthKey) => setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));

  const staffMap = useMemo(() => {
    const map = {};
    staffList.forEach(s => { map[s.id] = s.full_name; });
    return map;
  }, [staffList]);

  const { todayStats, monthlyArchives } = useMemo(() => {
    const now = new Date();
    const shiftStart = new Date(now);
    if (now.getHours() < 6) shiftStart.setDate(shiftStart.getDate() - 1); 
    shiftStart.setHours(6, 0, 0, 0);

    const todayData = {};
    const archives = {};

    salesHistory.forEach(sale => {
      const saleDate = new Date(sale.created_at);
      const staffName = sale.staff_name || staffMap[sale.staff_id] || 'Unknown';
      const total = sale.total || 0;

      if (saleDate >= shiftStart) {
        if (!todayData[staffName]) todayData[staffName] = { count: 0, total: 0 };
        todayData[staffName].count += 1;
        todayData[staffName].total += total;
      } else {
        const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = saleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        if (!archives[monthKey]) archives[monthKey] = { label: monthLabel, staffData: {} };
        if (!archives[monthKey].staffData[staffName]) archives[monthKey].staffData[staffName] = { count: 0, total: 0 };
        
        archives[monthKey].staffData[staffName].count += 1;
        archives[monthKey].staffData[staffName].total += total;
      }
    });

    return { todayStats: todayData, monthlyArchives: archives };
  }, [salesHistory, staffMap]);

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: ACCOUNT CREATION & MANAGEMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create/Edit Form */}
        <div className={`bg-white p-5 rounded-xl border shadow-sm h-fit transition-all duration-300 ${editingStaff ? 'border-blue-400 ring-2 ring-blue-50' : 'border-gray-200'}`}>
          <h3 className={`font-bold text-xs uppercase pb-2 border-b mb-4 flex items-center ${editingStaff ? 'text-blue-600' : 'text-gray-700'}`}>
            {editingStaff ? <Edit className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            {editingStaff ? 'Edit Staff Account' : 'Create Staff Account'}
          </h3>
          <form onSubmit={handleSaveStaff} className="space-y-3">
            <input 
              type="text" placeholder="Full Name" value={formData.fullName}
              onChange={e => setFormData({...formData, fullName: e.target.value})}
              className="w-full border p-2.5 text-xs rounded-lg outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50 focus:bg-white transition-all"
            />
            <input 
              type="password" placeholder="PIN Code (e.g., 1234)" value={formData.pinCode}
              onChange={e => setFormData({...formData, pinCode: e.target.value})}
              className="w-full border p-2.5 text-xs rounded-lg outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50 focus:bg-white transition-all"
            />
            <select 
              value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
              className="w-full border p-2.5 text-xs rounded-lg outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50 focus:bg-white transition-all"
            >
              <option value="staff">Staff (Vendor)</option>
              <option value="admin">Administrator</option>
            </select>

            {branches.length > 0 && (
              <select 
                value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})}
                className="w-full border p-2.5 text-xs rounded-lg outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50 focus:bg-white transition-all"
              >
                <option value="">Global / Headquarters Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button type="submit" className={`w-full text-white text-xs font-bold py-2.5 rounded-lg uppercase transition-colors shadow-sm ${editingStaff ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#0f172a] hover:bg-slate-800'}`}>
                {editingStaff ? 'Save Changes' : 'Create Account'}
              </button>
              
              {editingStaff && (
                <button type="button" onClick={handleCancelEdit} className="w-full flex justify-center items-center gap-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold py-2.5 rounded-lg uppercase transition-colors">
                  <XCircle className="w-3.5 h-3.5" /> Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Staff List */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="pb-2 border-b mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-bold text-xs uppercase text-gray-700 flex items-center">
              <span>Existing Accounts</span>
            </h3>
            <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded-md flex items-center gap-1 font-semibold border border-orange-100">
              <ShieldAlert className="w-3 h-3" /> Edit / Deactivation protected by PIN code
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 font-semibold text-gray-600">Name</th>
                  <th className="p-3 font-semibold text-gray-600">PIN Code</th>
                  <th className="p-3 font-semibold text-gray-600">Role</th>
                  <th className="p-3 font-semibold text-gray-600">Status</th>
                  <th className="p-3 font-semibold text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staffList.map(staff => (
                  <tr key={staff.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 font-bold text-gray-800">{staff.full_name}</td>
                    <td className="p-3 font-mono text-gray-400 tracking-widest">••••</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${staff.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {staff.role}
                      </span>
                    </td>
                    <td className="p-3">
                      {staff.is_active ? 
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded flex items-center w-fit font-semibold"><UserCheck className="w-3 h-3 mr-1"/> Active</span> : 
                        <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded flex items-center w-fit font-semibold"><UserX className="w-3 h-3 mr-1"/> Inactive</span>
                      }
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <button 
                          onClick={() => handleStartEdit(staff)} 
                          className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors border border-blue-100 flex items-center gap-1 group"
                          title="Edit (PIN required)"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Toggle Status Button */}
                        {staff.role !== 'admin' && (
                          <button 
                            onClick={() => toggleStaffStatus(staff.id, staff.is_active)} 
                            className={`p-1.5 rounded-md transition-colors border flex items-center gap-1 ${
                              staff.is_active 
                                ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white'
                            }`}
                            title={staff.is_active ? "Deactivate (PIN required)" : "Activate (PIN required)"}
                          >
                            {staff.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 2: PERFORMANCE TRACKING */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-bold text-xs uppercase text-gray-700 pb-2 border-b mb-4 flex items-center">
          <Clock className="w-4 h-4 mr-2 text-orange-500" /> 
          Today's Sales (Since 06:00 AM)
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.keys(todayStats).length > 0 ? Object.entries(todayStats).map(([name, data]) => (
            <div key={name} className="p-4 border rounded-xl bg-orange-50/50 border-orange-100 text-center hover:shadow-md transition-shadow">
              <p className="text-[10px] text-gray-500 font-bold uppercase">{name}</p>
              <p className="text-lg font-black text-gray-800">#{data.total.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">{data.count} transaction(s)</p>
            </div>
          )) : (
            <p className="text-xs text-gray-400 italic col-span-full bg-gray-50 p-3 rounded-lg border border-dashed">No sales recorded since 6:00 AM.</p>
          )}
        </div>

        <h3 className="font-bold text-xs uppercase text-gray-700 pb-2 border-b mb-4 flex items-center mt-8">
          <Folder className="w-4 h-4 mr-2 text-gray-500" /> Staff Monthly Archives
        </h3>
        <div className="space-y-3">
          {Object.entries(monthlyArchives).length > 0 ? Object.entries(monthlyArchives).map(([monthKey, archive]) => {
            const isOpen = expandedMonths[monthKey];
            return (
              <div key={monthKey} className="border rounded-xl overflow-hidden shadow-sm">
                <button onClick={() => toggleMonth(monthKey)} className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 text-left transition-colors">
                  <span className="font-black text-xs uppercase text-gray-700">{archive.label}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                </button>
                {isOpen && (
                  <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-3 border-t">
                    {Object.entries(archive.staffData).map(([name, data]) => (
                      <div key={name} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50/50 hover:bg-white hover:border-gray-300 transition-colors">
                        <span className="font-bold text-xs text-gray-800">{name}</span>
                        <div className="text-right">
                          <span className="block font-black text-sm text-gray-700">#{data.total.toLocaleString()}</span>
                          <span className="block text-[10px] text-gray-500">{data.count} sales</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }) : (
            <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-dashed">No monthly archives available at the moment.</p>
          )}
        </div>
      </div>

      {/* 🔒 ADMIN PIN SECURITY MODAL */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs uppercase text-gray-800">Administrator Security</h3>
                <p className="text-[11px] text-gray-500">Authorization required for this action</p>
              </div>
            </div>

            <form onSubmit={handleVerifyAdminPin} className="space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="••••"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className="w-full border p-3 text-center text-lg tracking-[0.3em] font-mono rounded-lg outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50 focus:bg-white transition-all"
                />
                {pinError && (
                  <p className="text-red-500 text-[11px] mt-2 font-medium text-center">{pinError}</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="w-1/2 py-2.5 bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold rounded-lg uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#0f172a] text-white hover:bg-slate-800 text-xs font-bold rounded-lg uppercase transition-colors shadow-sm"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}