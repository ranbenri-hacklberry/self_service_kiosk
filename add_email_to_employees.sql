-- הוספת שדה email לטבלת employees לאימות מנהלים
-- הרץ את זה ב-Supabase SQL Editor

-- 1. הוספת שדה email
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. יצירת אינדקס לאימייל (לא חובה אבל משפר ביצועים)
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- 3. עדכון מנהלים קיימים עם אימיילים (דוגמה - עדכן לפי הצרכים שלך)
-- UPDATE employees 
-- SET email = 'manager@example.com' 
-- WHERE id = 'your-employee-id' AND access_level IN ('Manager', 'Admin');

-- הערות:
-- - שדה email הוא אופציונלי (NULL) כדי לא לשבור עובדים קיימים
-- - ניתן להוסיף UNIQUE constraint אם רוצים שכל אימייל יהיה ייחודי
-- - ניתן להוסיף CHECK constraint לוודא שהאימייל תקין

