-- Update Demo Admin PIN to 0000
UPDATE public.employees
SET pin_code = '0000'
WHERE whatsapp_phone = '0500000000';

-- Update Demo Staff PIN to 1111
UPDATE public.employees
SET pin_code = '1111'
WHERE whatsapp_phone = '0501111111';
