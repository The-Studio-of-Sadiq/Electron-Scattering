import React, { useState } from 'react';
import { X, Search, Sparkles } from 'lucide-react';
import { ELEMENTS_DATABASE, getElementByZ } from '../data/elements';

interface PeriodicTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectZ: (z: number) => void;
  currentZ: number;
}

export const PeriodicTableModal: React.FC<PeriodicTableModalProps> = ({
  isOpen,
  onClose,
  onSelectZ,
  currentZ,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Grid layout for 1-103 elements
  const allElements = Array.from({ length: 103 }, (_, i) => getElementByZ(i + 1));

  const filteredElements = allElements.filter((el) => {
    const q = searchTerm.toLowerCase();
    return (
      el.name.toLowerCase().includes(q) ||
      el.symbol.toLowerCase().includes(q) ||
      el.z.toString() === q
    );
  });

  return (
    <div id="periodic-table-modal-overlay" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="periodic-table-modal" className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-lg text-slate-800">Periodic Table Element Picker</h3>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, symbol, or Z..."
                className="bg-slate-50 text-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
              />
            </div>
            <button
              id="close-periodic-table-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Elements Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 bg-slate-50/50">
          {filteredElements.map((el) => {
            const isSelected = el.z === currentZ;
            return (
              <button
                key={el.z}
                id={`element-btn-${el.z}`}
                onClick={() => {
                  onSelectZ(el.z);
                  onClose();
                }}
                className={`flex flex-col items-center justify-between p-2 rounded-lg border transition-all text-left ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <div className="w-full flex justify-between items-center text-[10px] text-slate-500">
                  <span className={isSelected ? 'text-indigo-100 font-bold' : 'font-medium'}>{el.z}</span>
                  <span className="truncate max-w-[40px] text-[9px]">{el.group.split(' ')[0]}</span>
                </div>
                <div className="text-base font-black my-0.5 tracking-tight">{el.symbol}</div>
                <div className="text-[10px] truncate max-w-full font-medium opacity-90">{el.name}</div>
                <div className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>{el.atomicMass.toFixed(1)}</div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Click any element to load its atomic charge Z, Dirac-Fock potential parameters, and dipole polarizability.</span>
          <button
            id="close-modal-footer-btn"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-300 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
