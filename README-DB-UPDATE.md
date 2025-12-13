# Database Update Required for "Delayed Items" Feature

To enable the "Fire Later" feature fully, the `submit_order` function in your database needs to be updated to accept and store the `item_status`.

Please run the SQL script located at `apply_kds_updates.sql` in your Supabase SQL Editor.

### Steps:
1. Open Supabase Dashboard.
2. Go to the **SQL Editor**.
3. Create a new query.
4. Copy the contents of `apply_kds_updates.sql` and paste it there.
5. Click **Run**.

This will update the backend logic to support items with `pending` status (delayed items). Without this update, all items will default to `in_progress` immediately.

