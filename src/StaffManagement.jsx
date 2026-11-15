import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserPlus, UserCheck, UserX, Clock, Folder, ChevronDown, ChevronRight, Key, Edit, XCircle, ShieldAlert } from 'lucide-react';

export default function StaffManagement({ 
  supabase, 
  branches = [], 
  staffList = [], 
  fetchStaffFromSupabase, 
  verifyAdminPinBeforeAction,
  staffName,
  setStaffName,
  staffPin,
  setStaffPin,
  staffRole,
  setStaffRole,
  staffBranch,
  setStaffBranch,
  editingStaff,
  setEditingStaff,
  handleSaveStaff,
  handleToggleStaffStatus,
  handleStartEditStaff
}) {
  const [salesHistory, setSalesHistory] = useState([]);
  const [expandedMonths, setExpandedMonths] = useState({});

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_history')
        .select('*')
        .not('staff_id', 'is', null)
        .order('created_at', { ascending: false });
      if (!error && data) setSalesHistory(data);
    } catch (err) {
      console.error("Error fetching sales history:", err);
    }
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
      const staffName = sale.staff_name || staffMap[sale.staff_id] || 'Inconnu';
      const total = sale.total || 0;

      if (saleDate >= shiftStart) {
        if (!todayData[staffName]) todayData[staffName] = { count: 0, total: 0 };
        todayData[staffName].count += 1;
        todayData[staffName].total += total;
      } else {
        const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = saleDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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
        
        {/* Formulaire Créer / Modifier */}
        <div className={`bg-white p-5 rounded-2xl border shadow-sm h-fit transition-all duration-300 ${editingStaff ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-200/80'}`}>
          <h3 className={`font-bold text-xs uppercase pb-2 border-b border-slate-100 mb-4 flex items-center ${editingStaff ? 'text-blue-600' : 'text-slate-700'}`}>
            {editingStaff ? <Edit className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            {editingStaff ? 'Modifier le Compte Staff' : 'Créer un Compte Staff'}
          </h3>
          
          <form onSubmit={handleSaveStaff} className="space-y-3">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nom Complet</label>
              <input 
                type="text" 
                placeholder="Ex: John Doe" 
                value={staffName}
                onChange={e => setStaffName(e.target.value)}
                className="w-full border border-slate-200 p-2.5 text-xs rounded-xl outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Code PIN (Sécurité)</label>
              <input 
                type="password" 
                placeholder="Ex: 1234" 
                value={staffPin}
                onChange={e => setStaffPin(e.target.value)}
                className="w-full border border-slate-200 p-2.5 text-xs rounded-xl outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Rôle</label>
              <select 
                value={staffRole} 
                onChange={e => setStaffRole(e.target.value)}
                className="w-full border border-slate-200 p-2.5 text-xs rounded-xl outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white transition-all font-medium cursor-pointer"
              >
                <option value="staff">Vendeur (Staff)</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>

            {branches.length > 0 && (
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Succursale Assignée</label>
                <select 
                  value={staffBranch} 
                  onChange={e => setStaffBranch(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 text-xs rounded-xl outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white transition-all font-medium cursor-pointer"
                >
                  <option value="">Siège Principal / Global</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button 
                type="submit" 
                className={`w-full text-white text-xs font-bold py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer active:scale-95 ${editingStaff ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'}`}
              >
                {editingStaff ? 'Enregistrer les modifications (PIN requis)' : 'Créer le compte (PIN requis)'}
              </button>
              
              {editingStaff && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingStaff(null);
                    setStaffName('');
                    setStaffPin('');
                    setStaffRole('staff');
                    setStaffBranch('');
                  }} 
                  className="w-full flex justify-center items-center gap-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold py-2.5 rounded-xl uppercase transition-colors cursor-pointer active:scale-95"
                >
                  <XCircle className="w-3.5 h-3.5" /> Annuler l'édition
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Staff List Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="pb-3 border-b border-slate-100 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-bold text-xs uppercase text-slate-700 flex items-center">
              <span>Comptes Existants ({staffList.length})</span>
            </h3>
            <span className="text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold border border-amber-200/60">
              <ShieldAlert className="w-3 h-3 text-amber-600" /> Actions sécurisées par code PIN Administrateur
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="p-3 font-bold text-slate-500 uppercase text-[10px]">Nom</th>
                  <th className="p-3 font-bold text-slate-500 uppercase text-[10px]">Code PIN</th>
                  <th className="p-3 font-bold text-slate-500 uppercase text-[10px]">Rôle</th>
                  <th className="p-3 font-bold text-slate-500 uppercase text-[10px]">Statut</th>
                  <th className="p-3 font-bold text-slate-500 uppercase text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map(staff => (
                  <tr key={staff.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-bold text-slate-800">{staff.full_name}</td>
                    <td className="p-3 font-mono text-slate-400 tracking-widest">••••</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${staff.role === 'admin' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-slate-100 text-slate-600'}`}>
                        {staff.role}
                      </span>
                    </td>
                    <td className="p-3">
                      {staff.is_active ? 
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg flex items-center w-fit font-semibold"><UserCheck className="w-3 h-3 mr-1"/> Actif</span> : 
                        <span className="text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg flex items-center w-fit font-semibold"><UserX className="w-3 h-3 mr-1"/> Inactif</span>
                      }
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <button 
                          onClick={() => handleStartEditStaff(staff)} 
                          className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all border border-blue-100 flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                          title="Modifier le compte"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Toggle Status Button */}
                        {staff.role !== 'admin' && (
                          <button 
                            onClick={() => handleToggleStaffStatus(staff.id, staff.is_active)} 
                            className={`p-2 rounded-xl transition-all border flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs ${
                              staff.is_active 
                                ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-600 hover:text-white' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white'
                            }`}
                            title={staff.is_active ? "Désactiver le compte" : "Activer le compte"}
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
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="font-black text-xs uppercase text-slate-700 pb-2 border-b border-slate-100 flex items-center">
          <Clock className="w-4 h-4 mr-2 text-amber-500" /> 
          Ventes du Jour (Depuis 06:00 AM)
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Object.keys(todayStats).length > 0 ? Object.entries(todayStats).map(([name, data]) => (
            <div key={name} className="p-4 border border-amber-100 rounded-2xl bg-amber-50/30 text-center hover:shadow-sm transition-all">
              <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{name}</p>
              <p className="text-base sm:text-lg font-black text-slate-900 mt-1">{(data.total || 0).toLocaleString()} FCFA</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{data.count} transaction(s)</p>
            </div>
          )) : (
            <p className="text-xs text-slate-400 italic col-span-full bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">Aucune vente enregistrée depuis 6h00.</p>
          )}
        </div>

        <h3 className="font-black text-xs uppercase text-slate-700 pb-2 border-b border-slate-100 flex items-center pt-4">
          <Folder className="w-4 h-4 mr-2 text-slate-500" /> Archives Mensuelles des Vendeurs
        </h3>
        
        <div className="space-y-3">
          {Object.entries(monthlyArchives).length > 0 ? Object.entries(monthlyArchives).map(([monthKey, archive]) => {
            const isOpen = expandedMonths[monthKey];
            return (
              <div key={monthKey} className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <button onClick={() => toggleMonth(monthKey)} className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 text-left transition-colors cursor-pointer">
                  <span className="font-black text-xs uppercase text-slate-700">{archive.label}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                </button>
                {isOpen && (
                  <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100">
                    {Object.entries(archive.staffData).map(([name, data]) => (
                      <div key={name} className="flex justify-between items-center p-3.5 border border-slate-200/60 rounded-xl bg-slate-50/50 hover:bg-white transition-all">
                        <span className="font-bold text-xs text-slate-800">{name}</span>
                        <div className="text-right">
                          <span className="block font-black text-sm text-slate-900">{(data.total || 0).toLocaleString()} FCFA</span>
                          <span className="block text-[10px] text-slate-400">{data.count} ventes</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }) : (
            <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">Aucune archive mensuelle disponible pour le moment.</p>
          )}
        </div>
      </div>

    </div>
  );
}