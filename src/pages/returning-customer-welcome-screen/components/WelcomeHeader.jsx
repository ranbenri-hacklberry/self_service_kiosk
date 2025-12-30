import React from 'react';
import { motion } from 'framer-motion';

const WelcomeHeader = ({ customerName }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-6"
    >
      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        שלום {customerName}! 👋
      </h1>
      <p className="text-lg text-gray-600">
        טוב לראות אותך שוב...
      </p>
    </motion.div>
  );
};

export default WelcomeHeader;