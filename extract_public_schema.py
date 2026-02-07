import re
import sys

with open('remote_db_dump.sql', 'r') as f:
    content = f.read()

# Split into statements
lines = content.split('\n')

output_lines = []
in_public = True  # Start including by default
skip_until_semicolon = False
current_statement = []

for i, line in enumerate(lines):
    # Skip auth, storage, realtime, vault, graphql schemas
    if any(schema in line for schema in ['auth.', 'storage.', 'realtime.', 'vault.', 'graphql.', 'pgbouncer.', 'pgtle.', 'pgsodium', 'supabase_functions']):
        skip_until_semicolon = True
        continue
    
    # Skip extension creation that might fail
    if 'CREATE EXTENSION' in line and any(ext in line for ext in ['pg_net', 'pg_graphql', 'pg_stat_statements', 'supabase_vault', 'pgsodium']):
        skip_until_semicolon = True
        continue
        
    # Skip schema creation for internal schemas
    if 'CREATE SCHEMA' in line and any(schema in line for schema in ['auth', 'storage', 'realtime', 'vault', 'graphql', 'pgbouncer']):
        skip_until_semicolon = True
        continue
    
    if skip_until_semicolon:
        if ';' in line:
            skip_until_semicolon = False
        continue
    
    output_lines.append(line)

# Add vector extension at the beginning
header = """-- CLEAN PUBLIC SCHEMA DUMP
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public, extensions', false);
SET check_function_bodies = false;
SET row_security = off;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

"""

with open('supabase/migrations/20230101000000_base_schema.sql', 'w') as f:
    f.write(header)
    f.write('\n'.join(output_lines))

print("Done! Created clean schema file")
