import React from 'react';
import { Layers, ArrowRightLeft, X, Pencil, Archive } from 'lucide-react';

export default function InventoryManagement({
  branches,
  productBranch,
  setProductBranch,
  name,
  setName,
  batch,
  setBatch,
  costPrice,
  setCostPrice,
  price,
  setPrice,
  initialQuantity,
  setInitialQuantity,
  quantity,
  setQuantity,
  setImageFile,
  handleSaveProduct,
  uploading,
  editingProduct,
  handleCancelEditProduct,
  handleOpenBatchTransfer,
  showArchived,
  setShowArchived,
  selectedBatchFilter,
  setSelectedBatchFilter,
  uniqueBatches,
  filteredProducts,
  handleUpdateStockVolume,
  handleStartEditProduct,
  handleArchiveProduct
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      
      {/* INVENTORY FORM */}
      <div className="xl:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
        <div className="flex justify-between items-center mb-5 pb-3 border-b">
          <h3 className="font-semibold text-sm uppercase text-gray-800">
            {editingProduct ? 'Edit Product' : 'Add to Stock'}
          </h3>
          {editingProduct && (
            <button onClick={handleCancelEditProduct} className="text-gray-400 hover:text-red-500 text-xs flex font-medium">
              <X className="w-4 h-4 mr-1" /> Cancel
            </button>
          )}
        </div>
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Assign To Workspace</label>
            <select 
              value={productBranch} 
              onChange={e => setProductBranch(e.target.value)} 
              className="w-full border border-gray-300 p-3 text-sm rounded-lg bg-gray-50 font-medium text-gray-900 focus:ring-2 focus:ring-[#0f172a] outline-none" 
              required
            >
              <option value="">HQ Main Stock</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <input 
            type="text" 
            placeholder="Product Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
            required 
          />
          <input 
            type="text" 
            placeholder="Batch Reference" 
            value={batch} 
            onChange={e => setBatch(e.target.value)} 
            className="w-full border border-gray-300 p-3 text-sm rounded-lg uppercase focus:ring-2 focus:ring-[#0f172a] outline-none" 
            required 
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Cost Price</label>
              <input 
                type="number" 
                value={costPrice} 
                onChange={e => setCostPrice(e.target.value)} 
                className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Retail Price</label>
              <input 
                type="number" 
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
                required 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Init Quantity</label>
              <input 
                type="number" 
                value={initialQuantity} 
                onChange={e => setInitialQuantity(e.target.value)} 
                className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Current Stock</label>
              <input 
                type="number" 
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
                className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
                required 
              />
            </div>
          </div>
          <input 
            type="file" 
            accept="image/*" 
            onChange={e => setImageFile(e.target.files[0])} 
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" 
          />
          <button 
            type="submit" 
            disabled={uploading} 
            className="w-full bg-[#0f172a] hover:bg-gray-800 text-white text-sm py-3 rounded-lg font-semibold transition-colors"
          >
            {uploading ? 'Uploading...' : 'Save Inventory Entry'}
          </button>
        </form>
      </div>

      {/* INVENTORY TABLE */}
      <div className="xl:col-span-3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between pb-4 border-b gap-4 items-center">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-sm uppercase text-gray-800 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-indigo-600" /> Inventory Catalogue
            </h3>
            <button 
              onClick={handleOpenBatchTransfer}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs transition-all"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transfert Groupé (QG → Succursales)</span>
            </button>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowArchived(!showArchived)} 
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              {showArchived ? 'View Active' : 'View Archived'}
            </button>
            <select 
              value={selectedBatchFilter} 
              onChange={e => setSelectedBatchFilter(e.target.value)} 
              className="border border-gray-300 px-3 py-2 text-xs rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#0f172a] outline-none"
            >
              {uniqueBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Location</th>
                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Item Name</th>
                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Cost / Retail Price</th>
                <th className="p-4 font-semibold text-center text-gray-600 text-xs uppercase tracking-wider">Stock Lvl</th>
                <th className="p-4 font-semibold text-center text-gray-600 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map(p => (
                <tr key={p.id} className={`${p.is_archived ? 'opacity-50 bg-gray-50' : 'bg-white hover:bg-gray-50/80'} transition-colors`}>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${!p.branch_id ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                      {branches.find(b => b.id === p.branch_id)?.name || 'HQ Main'}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-gray-900 flex items-center gap-3">
                    <img src={p.image_url} alt="" className="w-10 h-10 rounded object-cover border border-gray-200 shadow-sm" />
                    <div>
                      <p>{p.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Batch: {p.batch_reference}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">Cost: {p.cost_price?.toLocaleString()} FCFA</span>
                      <span className="font-semibold text-emerald-600">Retail: {p.price?.toLocaleString()} FCFA</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <input 
                      type="number" 
                      value={p.quantity} 
                      onChange={(e) => handleUpdateStockVolume(p.id, e.target.value)} 
                      className="w-16 border border-gray-300 text-center p-1.5 rounded-md font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center space-x-3">
                      <button title="Edit Product" onClick={() => handleStartEditProduct(p)} className="text-blue-500 hover:text-blue-700 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        title={p.is_archived ? "Restore" : "Archive"} 
                        onClick={() => handleArchiveProduct(p.id, !p.is_archived)} 
                        className={`${p.is_archived ? "text-emerald-500 hover:text-emerald-700" : "text-gray-400 hover:text-red-500"} transition-colors`}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}