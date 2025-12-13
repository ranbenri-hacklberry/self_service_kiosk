-- Delete the fake "מפורק (הגשה נפרדת)" option from database

DELETE FROM optionvalues 
WHERE value_name LIKE '%הגשה נפרדת%' 
   OR value_name LIKE '%מוגש בנפרד%';

-- Show what was deleted
SELECT * FROM optionvalues WHERE value_name LIKE '%מפורק%';
