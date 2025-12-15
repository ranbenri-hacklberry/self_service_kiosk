# Database Migrations

This folder contains all database schema changes.

## How to use

1. **Create new migration:**
   ```
   migrations/YYYYMMDD_description.sql
   ```
   Example: `20251207_add_delivery_days_to_suppliers.sql`

2. **Run on ALL environments:**
   - Production (current Supabase)
   - Demo/Dev (new Supabase project)

3. **Track in git:**
   ```bash
   git add migrations/
   git commit -m "Add migration: description"
   ```

## Migration History

| Date | File | Description | Applied to |
|------|------|-------------|------------|
| 2025-12-07 | `20251207_initial_cleanup.sql` | Drop unused tables, add delivery_days | ✅ Production |

## Environments

| Environment | Supabase URL | Purpose |
|-------------|--------------|---------|
| Production | dfwlcxlqqqxkktoctwwl.supabase.co | Live café |
| Demo/Dev | [TBD] | Testing & demos |
