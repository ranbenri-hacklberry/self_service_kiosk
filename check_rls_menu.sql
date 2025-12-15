SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'menu_items';

SELECT * FROM pg_policies WHERE tablename = 'menu_items';
