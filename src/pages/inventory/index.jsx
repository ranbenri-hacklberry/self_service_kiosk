import React from 'react';
import { useNavigate } from 'react-router-dom';
import { House, RotateCcw } from 'lucide-react';
import KDSInventoryScreen from '@/pages/kds/components/KDSInventoryScreen';

const InventoryPage = () => {
    const navigate = useNavigate();

    const handleExit = () => {
        navigate('/mode-selection');
    };

    return (
        <div className="flex flex-col h-screen bg-transparent overflow-hidden">
            {/* Content - KDSInventoryScreen handles the full layout */}
            <div className="flex-1 overflow-hidden relative">
                <KDSInventoryScreen onExit={handleExit} />
            </div>
        </div>
    );
};

export default InventoryPage;
