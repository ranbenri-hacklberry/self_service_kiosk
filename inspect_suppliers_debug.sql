-- Inspect RLS Policies on Suppliers
select * from pg_policies where schemaname = 'public' and tablename = 'suppliers';

-- Inspect Suppliers Content (count per business)
select business_id, count(*) from suppliers group by business_id;

-- Show sample suppliers
select * from suppliers limit 10;
