import React, { useEffect, useState } from 'react';
import type { CategorizationRule, Category } from '../../types';
import { api } from '../../api/client';
import { Sliders, Plus, FolderTree } from 'lucide-react';

export const RulesView: React.FC = () => {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // New Rule Form
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState('KEYWORD');
  const [categoryId, setCategoryId] = useState<number>(0);

  // New Category Form
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [catColor, setCatColor] = useState('#6366f1');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rls, cats] = await Promise.all([
        api.getRules(),
        api.getCategories()
      ]);
      setRules(rls);
      setCategories(cats);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRule({
        name,
        pattern,
        match_type: matchType,
        category_id: categoryId || undefined
      });
      setName('');
      setPattern('');
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCategory({
        name: catName,
        type: catType,
        color: catColor
      });
      setCatName('');
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          Categorization Rules & Chart of Accounts
        </h2>
        <p className="text-xs text-slate-400 font-medium">Configure pattern matching rules and manage category hierarchies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Rules List & Rule Creator */}
        <div className="lg:col-span-2 space-y-6">
          {/* Create Rule */}
          <div className="glass-card p-5">
            <h3 className="font-bold text-white text-base mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" /> Create New Categorization Rule
            </h3>
            <form onSubmit={handleCreateRule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Amazon Settlement"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Pattern String</label>
                <input
                  type="text"
                  placeholder="e.g. AMAZON"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  className="glass-input w-full font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Match Type</label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value)}
                  className="glass-input w-full bg-slate-900"
                >
                  <option value="KEYWORD">Keyword Match</option>
                  <option value="REGEX">Regex Pattern</option>
                  <option value="EXACT">Exact Match</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="glass-input w-full bg-slate-900"
                >
                  <option value={0}>Select Category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold"
                >
                  Add Categorization Rule
                </button>
              </div>
            </form>
          </div>

          {/* Active Rules List */}
          <div className="glass-card p-5">
            <h3 className="font-bold text-white text-base mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" /> Active Matching Rules ({rules.length})
            </h3>

            <div className="space-y-2">
              {rules.map((r) => {
                const cat = categories.find(c => c.id === r.category_id);
                return (
                  <div key={r.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{r.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-semibold">
                          {r.match_type}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-indigo-400 mt-1 block">
                        Pattern: "{r.pattern}"
                      </span>
                    </div>

                    {cat && (
                      <span className="text-xs font-semibold text-slate-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                        {cat.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Category Hierarchy */}
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="font-bold text-white text-base mb-3 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-purple-400" /> Add Custom Category
            </h3>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rent & Utilities"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="glass-input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Type</label>
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as any)}
                  className="glass-input w-full bg-slate-900"
                >
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category Color</label>
                <input
                  type="color"
                  value={catColor}
                  onChange={(e) => setCatColor(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-xs font-semibold"
              >
                Save Category
              </button>
            </form>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-bold text-white text-base mb-3">Chart of Accounts</h3>
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-semibold text-slate-200">{c.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    c.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {c.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
