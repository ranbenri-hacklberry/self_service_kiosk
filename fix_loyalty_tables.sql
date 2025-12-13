-- Add missing columns to public.loyalty_cards if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loyalty_cards' AND column_name = 'total_coffees_purchased') THEN
        ALTER TABLE public.loyalty_cards ADD COLUMN total_coffees_purchased INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loyalty_cards' AND column_name = 'total_free_coffees_redeemed') THEN
        ALTER TABLE public.loyalty_cards ADD COLUMN total_free_coffees_redeemed INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add missing columns to demo.loyalty_cards if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'demo' AND table_name = 'loyalty_cards' AND column_name = 'total_coffees_purchased') THEN
        ALTER TABLE demo.loyalty_cards ADD COLUMN total_coffees_purchased INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'demo' AND table_name = 'loyalty_cards' AND column_name = 'total_free_coffees_redeemed') THEN
        ALTER TABLE demo.loyalty_cards ADD COLUMN total_free_coffees_redeemed INTEGER DEFAULT 0;
    END IF;
END $$;
