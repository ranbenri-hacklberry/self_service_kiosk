import subprocess
import json

def get_table_data(table_name):
    cmd = [
        "docker", "exec", "supabase_db_scarlet-zodiac", 
        "psql", "-U", "postgres", "-d", "postgres", "-c", 
        f"COPY (SELECT * FROM {table_name}) TO STDOUT WITH (FORMAT CSV, HEADER, QUOTE '\"', ESCAPE '\"')"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error fetching {table_name}: {result.stderr}")
        return None
    return result.stdout

def format_sql_value(val, col_type=None):
    if val is None or val == '':
        return 'NULL'
    # Escape single quotes
    val_str = str(val).replace("'", "''")
    return f"'{val_str}'"

def generate_injection_script():
    tables = ['businesses', 'employees']
    script_lines = [
        "-- iCaffe Production Data Injection Script",
        "-- Generated for new Docker environment migration",
        "BEGIN;",
        ""
    ]
    
    for table in tables:
        # Get column names and types
        cmd_cols = [
            "docker", "exec", "supabase_db_scarlet-zodiac", 
            "psql", "-U", "postgres", "-d", "postgres", "-t", "-c", 
            f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}' ORDER BY ordinal_position"
        ]
        cols = subprocess.run(cmd_cols, capture_output=True, text=True).stdout.strip().split('\n')
        cols = [c.strip() for c in cols if c.strip()]
        
        # Get full data rows using CSV format for easier parsing
        cmd_data = [
            "docker", "exec", "supabase_db_scarlet-zodiac", 
            "psql", "-U", "postgres", "-d", "postgres", "-c", 
            f"COPY (SELECT * FROM {table}) TO STDOUT WITH (FORMAT CSV, HEADER, QUOTE '\"', ESCAPE '\"')"
        ]
        data_csv = subprocess.run(cmd_data, capture_output=True, text=True).stdout
        
        import csv
        import io
        
        reader = csv.DictReader(io.StringIO(data_csv))
        
        script_lines.append(f"-- Data for {table}")
        for row in reader:
            columns_str = ", ".join(cols)
            values = []
            for col in cols:
                val = row.get(col)
                if val is None:
                    values.append("NULL")
                else:
                    # Special handling for JSON fields if needed, but CSV parsing usually handles it
                    val_escaped = val.replace("'", "''")
                    values.append(f"'{val_escaped}'")
            
            values_str = ", ".join(values)
            # Use ON CONFLICT to avoid errors if some IDs already exist
            script_lines.append(f"INSERT INTO {table} ({columns_str}) VALUES ({values_str}) ON CONFLICT (id) DO UPDATE SET {', '.join([f'{c} = EXCLUDED.{c}' for c in cols if c != 'id'])};")
        
        script_lines.append("")

    script_lines.append("COMMIT;")
    
    output_path = "/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/scripts/inject_production_data.sql"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(script_lines))
    
    print(f"✅ Injection script created at: {output_path}")

if __name__ == "__main__":
    generate_injection_script()
