import React from 'react';
import { Send, X, AlertCircle, ArrowRight, Check } from 'lucide-react';

export default function BatchTransferModal({
  batchTransferOpen,
  setBatchTransferOpen,
  batchTransferStep,
  setBatchTransferStep,
  batchTransferError,
  hqProductsForTransfer,
  selectedBatchItems,
  handleToggleBatchItemSelect,
  handleUpdateBatchItemDetail,
  branches,
  activeSelectedArray,
  handleProceedToBatchReview,
  handleConfirmBatchTransfer,
  batchTransferLoading
}) {
  if (!batchTransferOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex justify-between items-center border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-black tracking-tight uppercase flex items-center space-x-2">
              <Send className="w-5 h-5 text-indigo-400" />
              <span>Transfert Groupé QG vers Succursales</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {batchTransferStep === 'select' ? '1. Sélectionnez les produits, les quantités et la succursale de destination' : '2. Vérifiez et confirmez le transfert'}
            </p>
          </div>
          <button onClick={() => setBatchTransferOpen(false)} className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {batchTransferError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{batchTransferError}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {batchTransferStep === 'select' ? (
            <div>
              <p className="text-xs text-gray-500 mb-4 font-medium">
                Cochez les produits du QG que vous souhaitez transférer. Indiquez la quantité et la succursale cible pour chacun.
              </p>

              {hqProductsForTransfer.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-400 text-xs">Aucun produit disponible au QG pour le transfert.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hqProductsForTransfer.map(product => {
                    const isSelected = !!selectedBatchItems[product.id]?.selected;
                    const itemData = selectedBatchItems[product.id] || {};

                    return (
                      <div 
                        key={product.id} 
                        className={`p-3.5 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                          isSelected ? 'border-indigo-600 bg-indigo-50/30 shadow-xs' : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3 w-full md:w-auto flex-1">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleBatchItemSelect(product)}
                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                          />
                          <img src={product.image_url} alt="" className="w-11 h-11 object-cover rounded-lg border bg-gray-100 shrink-0" />
                          <div>
                            <h4 className="text-sm font-extrabold text-black line-clamp-1">{product.name}</h4>
                            <p className="text-[11px] text-gray-500">Stock QG disponible: <span className="font-bold text-black">{product.quantity}</span> | Prix: {product.price?.toLocaleString()} FCFA</p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center space-x-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Destination</span>
                              <select 
                                value={itemData.targetBranch}
                                onChange={(e) => handleUpdateBatchItemDetail(product.id, 'targetBranch', e.target.value)}
                                className="bg-white border border-gray-300 rounded-lg text-xs py-1.5 px-2 focus:outline-none focus:border-indigo-600 font-medium"
                              >
                                <option value="">-- Choisir --</option>
                                {branches.map(b => (
                                  <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="flex flex-col w-24">
                              <span className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Quantité</span>
                              <input 
                                type="number" 
                                min="1"
                                max={product.quantity}
                                value={itemData.qty}
                                onChange={(e) => handleUpdateBatchItemDetail(product.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                className="bg-white border border-gray-300 rounded-lg text-xs py-1.5 px-2 focus:outline-none focus:border-indigo-600 font-bold text-center"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Résumé du transfert groupé</h3>
                <p className="text-xs text-indigo-700 mt-0.5">Veuillez vérifier les éléments sélectionnés ci-dessous et cliquer sur Confirmer pour valider.</p>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-[11px] font-bold text-gray-600 uppercase border-b border-gray-200">
                      <th className="p-3">Produit</th>
                      <th className="p-3">Quantité</th>
                      <th className="p-3">Succursale Cible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {activeSelectedArray.map((item, idx) => {
                      const targetBranchObj = branches.find(b => b.id === item.targetBranch);
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-3 flex items-center space-x-2.5">
                            <img src={item.product.image_url} alt="" className="w-8 h-8 object-cover rounded border" />
                            <span className="font-bold text-black">{item.product.name}</span>
                          </td>
                          <td className="p-3 font-black text-indigo-600">-{item.qty} unités</td>
                          <td className="p-3 font-medium text-gray-800">{targetBranchObj ? targetBranchObj.name : item.targetBranch}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          {batchTransferStep === 'review' ? (
            <button 
              onClick={() => setBatchTransferStep('select')} 
              className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              ← Retour aux sélections
            </button>
          ) : (
            <span className="text-xs text-gray-500 font-bold">
              {activeSelectedArray.length} produit(s) sélectionné(s)
            </span>
          )}

          <div className="flex space-x-3 ml-auto">
            <button 
              onClick={() => setBatchTransferOpen(false)} 
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>

            {batchTransferStep === 'select' ? (
              <button 
                onClick={handleProceedToBatchReview}
                disabled={activeSelectedArray.length === 0}
                className="bg-black hover:bg-zinc-800 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-1.5"
              >
                <span>Vérifier le transfert</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button 
                onClick={handleConfirmBatchTransfer}
                disabled={batchTransferLoading}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md"
              >
                {batchTransferLoading ? (
                  <span>Transfert en cours...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmer et Transférer (OK)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}