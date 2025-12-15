-- קובץ תיקון והגדרה מלאה למנהל נתנאל
-- הרץ את זה ב-Supabase SQL Editor

-- 1. וידוא שהעמודה email קיימת (מונע שגיאות אם לא קיימת)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'email') THEN 
        ALTER TABLE employees ADD COLUMN email TEXT; 
    END IF; 
END $$;

-- 2. ניקוי כפילויות אם יש (משאיר רק אחד אם יש כמה לאותו אימייל או פין)
-- זהירות: זה מוחק שורות כפולות אם יש בטעות
DELETE FROM employees 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM employees 
    WHERE email = 'netanelbar9@gmail.com' OR pin_code = 'nati1111'
);

-- 3. עדכון או יצירה של המשתמש בצורה המדויקת ביותר
INSERT INTO employees (name, pin_code, email, access_level, created_at)
SELECT 'נתנאל', 'nati1111', 'netanelbar9@gmail.com', 'Manager', NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM employees WHERE email = 'netanelbar9@gmail.com' OR pin_code = 'nati1111'
);

UPDATE employees 
SET 
    name = 'נתנאל',
    pin_code = 'nati1111',
    access_level = 'Manager',
    email = 'netanelbar9@gmail.com' -- מוודא שאין רווחים
WHERE email = 'netanelbar9@gmail.com' OR pin_code = 'nati1111';

-- 4. וידוא שהמשתמש נוצר - זה מה שצריך להופיע ב-Results
SELECT * FROM employees WHERE email = 'netanelbar9@gmail.com';

