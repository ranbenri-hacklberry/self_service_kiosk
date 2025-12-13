import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../../lib/supabase';

const OrderHistorySection = ({ customerId }) => {
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentOrders();
  }, [customerId]);

  const loadRecentOrders = async () => {
    try {
      // Get recent orders with menu items
      const { data, error } = await supabase?.from('orders')?.select(`
          id,
          order_number,
          created_at,
          order_items (
            quantity,
            menu_items (
              name,
              price
            )
          )
        `)?.eq('customer_id', customerId)?.order('created_at', { ascending: false })?.limit(3);

      if (error) {
        console.error('Error loading orders:', error);
        return;
      }

      setRecentOrders(data || []);
    } catch (error) {
      console.error('Error loading recent orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">הזמנות אחרונות</h3>
        <div className="text-gray-500">טוען...</div>
      </div>
    );
  }

  if (recentOrders?.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">הזמנות אחרונות</h3>
        <div className="text-gray-500 text-center py-4">
          עדיין לא ביצעת הזמנות
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="mb-6"
    >
      <h3 className="text-lg font-semibold text-gray-800 mb-3">הזמנות אחרונות</h3>
      <div className="space-y-3">
        {recentOrders?.map((order, index) => (
          <motion.div
            key={order?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + (index * 0.1), duration: 0.3 }}
            className="bg-gray-50 rounded-lg p-3 text-right"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm text-gray-500">
                {formatDate(order?.created_at)}
              </span>
              <span className="font-medium text-gray-800">
                הזמנה #{order?.order_number}
              </span>
            </div>
            
            <div className="space-y-1">
              {order?.order_items?.slice(0, 2)?.map((item, itemIndex) => (
                <div key={itemIndex} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item?.quantity}x
                  </span>
                  <span className="text-gray-800">
                    {item?.menu_items?.name || 'פריט לא זמין'}
                  </span>
                </div>
              ))}
              
              {order?.order_items?.length > 2 && (
                <div className="text-sm text-gray-500 text-center">
                  ועוד {order?.order_items?.length - 2} פריטים...
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default OrderHistorySection;