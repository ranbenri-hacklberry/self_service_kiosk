-- Add WhatsApp columns to businesses table safely
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_instance TEXT;
-- Reload schema cache to ensure API sees new columns
NOTIFY pgrst,
'reload schema';