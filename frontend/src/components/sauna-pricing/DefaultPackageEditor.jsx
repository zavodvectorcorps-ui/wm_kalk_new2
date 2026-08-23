import React from 'react';
import { Label } from '../ui/label';

/**
 * Editor for a model/variant "default package".
 * value shape: { [categoryId]: [optionId, ...] }  (radio → single-element array)
 */
export const DefaultPackageEditor = ({ categories = [], value = {}, onChange, idPrefix = 'pkg' }) => {
  const pkg = value || {};

  const setRadio = (catId, optId) => {
    const next = { ...pkg };
    if (!optId) delete next[catId];
    else next[catId] = [optId];
    onChange(next);
  };

  const toggleCheckbox = (catId, optId) => {
    const next = { ...pkg };
    const arr = new Set(next[catId] || []);
    if (arr.has(optId)) arr.delete(optId);
    else arr.add(optId);
    if (arr.size === 0) delete next[catId];
    else next[catId] = Array.from(arr);
    onChange(next);
  };

  const visibleCats = (categories || []).filter(c => (c.options || []).length > 0);
  const configuredCount = Object.values(pkg).filter(v => (v || []).length > 0).length;

  if (visibleCats.length === 0) {
    return <p className="text-xs text-gray-400 italic">Нет категорий опций для комплекта.</p>;
  }

  return (
    <div className="space-y-2" data-testid={`${idPrefix}-editor`}>
      <div className="text-[11px] text-emerald-700">Задано категорий: {configuredCount}</div>
      {visibleCats.map(cat => {
        const isCheckbox = cat.inputType === 'checkbox';
        const sel = pkg[cat.id] || [];
        return (
          <div key={cat.id} className="border rounded p-2 bg-white" data-testid={`${idPrefix}-cat-${cat.id}`}>
            <Label className="text-xs font-medium text-gray-700">
              {cat.name}{isCheckbox ? ' · можно несколько' : ''}
            </Label>
            {isCheckbox ? (
              <div className="mt-1 grid grid-cols-1 gap-0.5 max-h-32 overflow-y-auto">
                {(cat.options || []).map(o => (
                  <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-emerald-50 p-0.5 rounded">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-emerald-600"
                      checked={sel.includes(o.id)}
                      onChange={() => toggleCheckbox(cat.id, o.id)}
                      data-testid={`${idPrefix}-opt-${cat.id}-${o.id}`}
                    />
                    <span>{o.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <select
                className="mt-1 w-full h-8 text-sm border rounded px-2 bg-white"
                value={sel[0] || ''}
                onChange={(e) => setRadio(cat.id, e.target.value)}
                data-testid={`${idPrefix}-select-${cat.id}`}
              >
                <option value="">— не входит в комплект —</option>
                {(cat.options || []).map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DefaultPackageEditor;
