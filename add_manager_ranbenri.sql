-- הוספת/עדכון מנהל: ranbenri@gmail.com עם PIN 2102
-- הרץ את זה ב-Supabase SQL Editor

-- שלב 1: וודא שיש שדה email בטבלה (אם עדיין לא הוספת)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS email TEXT;

-- שלב 2: עדכון עובד קיים (אם יש עובד עם PIN 2102)
UPDATE employees 
SET 
  email = 'ranbenri@gmail.com',
  access_level = 'Manager'
WHERE pin_code = '2102';

-- שלב 3: אם לא היה עובד עם PIN הזה, ניצור אחד חדש
INSERT INTO employees (name, pin_code, email, access_level, created_at)
SELECT 
  'רן בן רי',
  '2102',
  'ranbenri@gmail.com',
  'Manager',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE pin_code = '2102'
);

-- שלב 4: בדיקה שהכל עבד
SELECT id, name, email, pin_code, access_level, created_at
FROM employees 
WHERE email = 'ranbenri@gmail.com' OR pin_code = '2102';
