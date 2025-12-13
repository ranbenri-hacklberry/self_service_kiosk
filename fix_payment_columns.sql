-- הרץ את הפקודות הבאות ב-SQL Editor ב-Supabase כדי להוסיף את העמודות החסרות
-- זה יאפשר לכפתור התשלום להופיע ולעבוד

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);

-- אופציונלי: עדכון הזמנות קיימות למזומן אם אין להן שיטת תשלום
-- UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL;
