-- RUN THIS IN SUPABASE SQL EDITOR TO FIX MISSING TIME DISPLAY
-- פקודה זו תתקן את ההזמנות הישנות שבהן לא מופיע "זמן הכנה"

UPDATE public.orders 
SET updated_at = COALESCE(ready_at, created_at) 
WHERE updated_at IS NULL;

-- בנוסף, נבצע רענון למטמון כדי שהשינויים יופיעו מיד
NOTIFY pgrst, 'reload schema';
