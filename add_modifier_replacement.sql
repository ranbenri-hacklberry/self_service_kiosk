-- Add column to track if modifier is a replacement
-- Correcting table name to 'optionvalues' based on application code
ALTER TABLE optionvalues 
ADD COLUMN IF NOT EXISTS is_replacement BOOLEAN DEFAULT false;
