import React, { useEffect, useState } from 'react';
import type { Party, Category } from '../../types';
import { api } from '../../api/client';
import { GitMerge } from 'lucide-react';

export const PartiesView: React.FC = () => {
  const [parties, setParties] = useState<Party[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Merge state
  const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
  const [targetPartyId, setTargetPartyId] = useState<number>(0);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prts, cats] = await Promise.all([
        api.getParties(),
        api.getCategories()
      ]);
      setParties(prts);
      setCategories(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedForMerge(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedForMerge.length < 2 || !targetPartyId) return;

    const sources = selectedForMerge.filter(id => id !== targetPartyId);
    try {
      await api.mergeParties(sources, targetPartyId);
      setIsMergeModalOpen(false);
      setSelectedForMerge([]);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Merge failed');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Party & Counterparty Management
          </h2>
          <p className="text-xs text-slate-400">Consolidate vendors, buyers, and marketplace payment entities</p>
        </div>

        {selectedForMerge.length >= 2 && (
          <button
            onClick={() => {
              setTargetPartyId(selectedForMerge[0]);
              setIsMergeModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30"
          >
            <GitMerge className="w-4 h-4" /> Merge Selected Parties ({selectedForMerge.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading parties...</div>
      ) : parties.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-500">No parties registered yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parties.map((p) => {
            const isSelected = selectedForMerge.includes(p.id);
            const aliasesList: string[] = JSON.parse(p.aliases || '[]');
            const cat = categories.find(c => c.id === p.category_id);

            return (
              <div
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                className={`glass-card p-5 cursor-pointer border transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold text-sm">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{p.name}</h3>
                      {cat && (
                        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-semibold inline-block mt-0.5">
                          {cat.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                </div>

                {aliasesList.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold mb-1">Known Aliases</span>
                    <div className="flex flex-wrap gap-1">
                      {aliasesList.map((alias, idx) => (
                        <span key={idx} className="text-[11px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded font-mono">
                          {alias}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Merge Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-indigo-400" /> Merge Parties
            </h3>
            <p className="text-xs text-slate-400">
              Select the primary party to keep. All transactions and rules associated with other selected parties will be merged into this primary party.
            </p>

            <form onSubmit={handleMerge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Target Party</label>
                <select
                  value={targetPartyId}
                  onChange={(e) => setTargetPartyId(Number(e.target.value))}
                  className="glass-input w-full bg-slate-900"
                  required
                >
                  {parties.filter(p => selectedForMerge.includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsMergeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold"
                >
                  Confirm Merge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
