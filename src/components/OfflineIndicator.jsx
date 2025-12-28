/**
 * Offline Status Indicator Component
 * Shows connection status and last sync time
 */

import React from 'react';
import { Wifi, WifiOff, RefreshCw, Database } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

const OfflineIndicator = ({ compact = false }) => {
    const {
        online,
        syncing,
        lastSyncTime,
        hasLocalData,
        refresh
    } = useOffline();

    const formatTime = (date) => {
        if (!date) return 'Never';
        return new Date(date).toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                {online ? (
                    <Wifi size={16} className="text-green-500" />
                ) : (
                    <WifiOff size={16} className="text-red-500 animate-pulse" />
                )}
                {syncing && (
                    <RefreshCw size={14} className="text-blue-500 animate-spin" />
                )}
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-50">
            <div className={`
        flex items-center gap-3 px-4 py-2 rounded-xl shadow-lg
        ${online
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200 animate-pulse'
                }
      `}>
                {/* Connection Status */}
                <div className="flex items-center gap-2">
                    {online ? (
                        <>
                            <Wifi size={18} className="text-green-600" />
                            <span className="text-green-700 font-medium text-sm">Online</span>
                        </>
                    ) : (
                        <>
                            <WifiOff size={18} className="text-red-600" />
                            <span className="text-red-700 font-medium text-sm">Offline</span>
                        </>
                    )}
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-gray-300" />

                {/* Local Data Status */}
                <div className="flex items-center gap-2">
                    <Database size={14} className={hasLocalData ? 'text-blue-500' : 'text-gray-400'} />
                    <span className="text-gray-600 text-xs">
                        {hasLocalData ? 'Data cached' : 'No cache'}
                    </span>
                </div>

                {/* Sync Status */}
                {online && (
                    <>
                        <div className="w-px h-4 bg-gray-300" />
                        <button
                            onClick={refresh}
                            disabled={syncing}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs"
                        >
                            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Sync'}
                        </button>
                    </>
                )}

                {/* Last Sync Time */}
                {lastSyncTime && (
                    <span className="text-gray-400 text-xs">
                        {formatTime(lastSyncTime)}
                    </span>
                )}
            </div>
        </div>
    );
};

export default OfflineIndicator;
