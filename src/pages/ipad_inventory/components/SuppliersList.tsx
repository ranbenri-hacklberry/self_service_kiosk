import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, ChevronLeft } from 'lucide-react';
import { Supplier } from '@/pages/ipad_inventory/types';

const MotionButton = motion.button as any;

interface SuppliersListProps {
    suppliers: Supplier[];
    selectedSupplierId: string | null;
    onSelectSupplier: (id: string) => void;
    supplierCounts: Record<string, number>;
}

const SuppliersList: React.FC<SuppliersListProps> = ({
    suppliers,
    selectedSupplierId,
    onSelectSupplier,
    supplierCounts
}) => {
    // Add virtual 'uncategorized' and 'prepared' suppliers if needed
    const allSuppliers = [
        ...suppliers,
        { id: 'prepared', name: 'פריטים בהכנה' },
        { id: 'uncategorized', name: 'כללי / ללא ספק' }
    ];

    return (
        <div className="w-80 h-full bg-slate-50 border-l border-slate-200 overflow-y-auto no-scrollbar pb-20">
            <div className="p-6">
                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                    <ShoppingBag size={22} className="text-indigo-600" />
                    <span>ספקים</span>
                </h2>

                <div className="space-y-3">
                    {allSuppliers.map((supplier) => {
                        const count = supplierCounts[supplier.id] || 0;
                        const isActive = selectedSupplierId === supplier.id;

                        return (
                            <MotionButton
                                key={supplier.id}
                                onClick={() => onSelectSupplier(supplier.id)}
                                whileHover={{ x: -2 }}
                                whileTap={{ scale: 0.98 }}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${isActive
                                        ? 'bg-white shadow-md border-indigo-100 border'
                                        : 'hover:bg-slate-100 text-slate-600'
                                    }`}
                            >
                                <div className="flex flex-col items-start">
                                    <span className={`font-bold transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-800'}`}>
                                        {supplier.name}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">
                                        {count} פריטים
                                    </span>
                                </div>
                                <ChevronLeft
                                    size={18}
                                    className={`transition-all ${isActive ? 'text-indigo-400 translate-x-0' : 'text-slate-300 translate-x-1 opacity-0'}`}
                                />
                            </MotionButton>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SuppliersList;
