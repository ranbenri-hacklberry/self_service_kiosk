SELECT json_agg(row_to_json(t))
FROM (SELECT * FROM suppliers ORDER BY id) t;
