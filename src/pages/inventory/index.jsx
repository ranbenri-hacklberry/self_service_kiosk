import React from 'react';
import { useNavigate } from 'react-router-dom';
import { House, RotateCcw } from 'lucide-react';
import KDSInventoryScreen from '../kds/components/KDSInventoryScreen';

const InventoryPage = () => {
    const navigate = useNavigate();

    const handleExit = () => {
        navigate('/mode-selection');
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 overflow-hidden" dir="rtl">
            {/* Content - KDSInventoryScreen now handles the full layout including header */}
            <div className="flex-1 overflow-hidden relative">
                <KDSInventoryScreen onExit={handleExit} />
            </div>
        </div>
    );
};

export default InventoryPage;
