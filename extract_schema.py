
import re

dump_path = '/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/remote_db_dump.sql'
out_path = '/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/supabase/migrations/20230101000000_base_schema.sql'

with open(dump_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern for CREATE TABLE public.*
tables = re.findall(r'CREATE TABLE public\..*?\(.*?\);', content, re.DOTALL)
# Pattern for CREATE INDEX public.*
indices = re.findall(r'CREATE INDEX .*? ON public\..*?;', content, re.DOTALL)
# Pattern for CREATE TYPE public.*
types = re.findall(r'CREATE TYPE public\..*? AS .*?;', content, re.DOTALL)
# Pattern for CREATE FUNCTION public.* (greedy but careful)
functions = re.findall(r'CREATE FUNCTION public\..*?LANGUAGE .*?;', content, re.DOTALL)

with open(out_path, 'w', encoding='utf-8') as f:
    f.write("-- RECONSTRUCTED BASE SCHEMA (PUBLIC ONLY)\n")
    f.write("SET search_path = public, extensions;\n\n")
    f.write("\n\n-- TYPES\n")
    f.write("\n\n".join(types) + "\n\n")
    f.write("\n\n-- TABLES\n")
    f.write("\n\n".join(tables) + "\n\n")
    f.write("\n\n-- INDICES\n")
    f.write("\n\n".join(indices) + "\n\n")
    f.write("\n\n-- FUNCTIONS\n")
    f.write("\n\n".join(functions) + "\n\n")
