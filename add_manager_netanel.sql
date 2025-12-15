-- הוספת/עדכון מנהל: netanelbar9@gmail.com עם סיסמה nati1111
-- הרץ את זה ב-Supabase SQL Editor

-- שלב 1: עדכון עובד קיים (אם יש עובד עם הסיסמה/PIN הזה)
UPDATE employees 
SET 
  email = 'netanelbar9@gmail.com',
  access_level = 'Manager',
  name = 'נתנאל' -- ניתן לשנות את השם כאן אם רוצים
WHERE pin_code = 'nati1111';

-- שלב 2: אם לא היה עובד עם הסיסמה הזו, ניצור אחד חדש
INSERT INTO employees (name, pin_code, email, access_level, created_at)
SELECT 
  'נתנאל',
  'nati1111',
  'netanelbar9@gmail.com',
  'Manager',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE pin_code = 'nati1111' OR email = 'netanelbar9@gmail.com'
);

-- שלב 3: אם המשתמש כבר קיים לפי אימייל אבל עם סיסמה אחרת, נעדכן לו את הסיסמה והרשאות
UPDATE employees
SET
    pin_code = 'nati1111',
    access_level = 'Manager'
WHERE email = 'netanelbar9@gmail.com';

-- שלב 4: בדיקה שהכל עבד
SELECT id, name, email, pin_code, access_level, created_at
FROM employees 
WHERE email = 'netanelbar9@gmail.com';

