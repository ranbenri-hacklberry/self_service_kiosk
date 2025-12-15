-- Inspect table columns to find correct names
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('optiongroups', 'option_groups', 'optionvalues', 'option_values', 'menuitemoptions', 'menu_item_options')
ORDER BY table_name, ordinal_position;
