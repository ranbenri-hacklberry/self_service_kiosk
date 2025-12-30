import React from 'react';
import { motion } from 'framer-motion';

const LoyaltyProgressIndicator = ({ loyaltyCount, loyaltyMessage }) => {
  const progressPercentage = ((loyaltyCount % 10) / 10) * 100;
  const completedCycles = Math.floor(loyaltyCount / 10);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="mb-6"
    >
      <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">נקודות נאמנות</h3>
        
        {/* Circular Progress Indicator */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <path
                className="text-gray-300"
                stroke="currentColor"
                strokeWidth="3"
                fill="transparent"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Progress circle */}
              <motion.path
                className="text-amber-500"
                stroke="currentColor"
                strokeWidth="3"
                fill="transparent"
                strokeLinecap="round"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                strokeDasharray={`${progressPercentage}, 100`}
                initial={{ strokeDasharray: "0, 100" }}
                animate={{ strokeDasharray: `${progressPercentage}, 100` }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </svg>
            
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="text-center"
              >
                <div className="text-2xl font-bold text-amber-700">
                  {loyaltyCount % 10}/10
                </div>
                <div className="text-sm text-gray-600">קפה</div>
              </motion.div>
            </div>
          </div>

          {/* Completed cycles indicator */}
          {completedCycles > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="flex items-center gap-1 mt-2"
            >
              <span className="text-sm text-gray-600">קפה חינם:</span>
              {[...Array(completedCycles)]?.map((_, index) => (
                <div key={`loyalty-${index}`} className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">
                  ✓
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Loyalty message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-lg font-medium text-center text-amber-800"
        >
          {loyaltyMessage}
        </motion.p>
      </div>
    </motion.div>
  );
};

export default LoyaltyProgressIndicator;