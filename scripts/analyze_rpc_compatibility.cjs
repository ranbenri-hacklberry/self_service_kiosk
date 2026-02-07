
/**
 * Utility script to check for RPC function discrepancies between Frontend usage and Database definitions.
 * 
 * Logic:
 * 1. Scans frontend source tables (`src/`) for `supabase.rpc('function_name', { args... })` calls.
 * 2. Parses the function name and the keys of the arguments object.
 * 3. Fetches the actual function definitions from the database using a specialized SQL query.
 * 4. Compares the frontend usage (argument count and names) with the database definition.
 * 5. Reports any missing functions or argument mismatches.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const SUPABASE_URL = process.env.LOCAL_SUPABASE_URL || process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_LOCAL_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.LOCAL_SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
    console.error("❌ Missing Service Key. Please run: export SUPABASE_SERVICE_ROLE_KEY=...");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// 1. Scan Frontend Code
function scanFrontendForRPCs() {
    const rpcCalls = [];
    // Grep for rpc calls, recursively
    try {
        const grepOutput = execSync(`grep -r "supabase.rpc" ./src | grep -v ".test.js"`, { encoding: 'utf-8' });
        const lines = grepOutput.split('\n');

        lines.forEach(line => {
            if (!line) return;
            // Improved regex to capture function name and args object
            // Matches: supabase.rpc('my_func', { arg1: val, arg2: val })
            // Or: supabase.rpc('my_func')
            const match = line.match(/supabase\.rpc\(['"](\w+)['"]\s*(?:,\s*({[^}]*}))?/);
            if (match) {
                const funcName = match[1];
                let args = [];
                if (match[2]) {
                    // Primitive parsing of keys from the string representation of the object
                    // This is not perfect but good enough for static analysis of common patterns
                    const argsString = match[2];
                    const keyMatches = argsString.match(/(\w+)\s*:/g);
                    if (keyMatches) {
                        args = keyMatches.map(k => k.replace(':', '').trim());
                    }
                }

                rpcCalls.push({ name: funcName, args: args, file: line.split(':')[0] });
            }
        });
    } catch (e) {
        // Grep might fail if no matches, that's fine
    }
    return rpcCalls;
}

// 2. Fetch DB Definitions
async function fetchDbFunctions() {
    // Determine Postgres version implicitly by just trying to query
    // Query to get function parameters
    const { data, error } = await supabase.rpc('run_sql', {
        query_text: `
            SELECT 
                p.proname as function_name, 
                pg_get_function_arguments(p.oid) as arguments
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
        `
    });

    if (error) {
        // Fallback: Try a direct query if run_sql is not available or fails (common in RLS restricted envs without proper setup)
        // But for this script we assume service role can access helpful items or we rely on what we have.
        // Actually, let's use a simpler approach if run_sql fails:
        console.error("⚠️ Could not fetch DB functions via run_sql. Ensure 'run_sql' RPC exists and you are admin.");
        return [];
    }

    return data;
}

// 3. Main Comparison Logic
async function compare() {
    console.log("🔍 Scanning Frontend Code for RPC calls...");
    const frontendCalls = scanFrontendForRPCs();
    console.log(`✅ Found ${frontendCalls.length} RPC usage instances.`);

    console.log("🔍 Fetching Database Function Definitions...");

    // Quick map of DB Functions
    // Fetching via direct SQL command run from Node since we have container access strategy in mind usually,
    // but here we are a script. Let's try to infer from 'run_sql' result.
    // If 'run_sql' doesn't exist, we can't easily introspect without psql.
    // BUT wait, we are running this in the container environment usually? 
    // Let's assume we can use the 'run_sql' RPC we saw earlier in the codebase.

    let dbFuncs = [];
    try {
        dbFuncs = await fetchDbFunctions();
        console.log("DEBUG: dbFuncs type:", typeof dbFuncs);
        if (dbFuncs && !Array.isArray(dbFuncs)) {
            console.log("DEBUG: dbFuncs content:", JSON.stringify(dbFuncs).slice(0, 200));
        }
    } catch (e) {
        console.error("Failed to fetch DB funcs", e);
    }

    if (!dbFuncs || !Array.isArray(dbFuncs) || dbFuncs.length === 0) {
        console.warn("⚠️ Cannot compare against DB: No valid functions list returned.");
        return;
    }

    const dbFuncMap = {};
    dbFuncs.forEach(f => {
        // Parse arguments string: "p_id integer, p_name text" -> ['p_id', 'p_name']
        const cleanArgs = f.arguments.split(',')
            .map(s => s.trim().split(' ')[0]) // Get first word (param name)
            .filter(s => s && s !== '');

        if (!dbFuncMap[f.function_name]) {
            dbFuncMap[f.function_name] = [];
        }
        dbFuncMap[f.function_name].push(cleanArgs);
    });

    console.log("\n📊 Analysis Results:\n");
    let issuesFound = 0;

    // Group frontend calls by function name to avoid spam
    const callsByName = {};
    frontendCalls.forEach(c => {
        if (!callsByName[c.name]) callsByName[c.name] = [];
        callsByName[c.name].push(c);
    });

    Object.keys(callsByName).forEach(funcName => {
        const calls = callsByName[funcName];

        // Check if function exists at all
        if (!dbFuncMap[funcName]) {
            console.error(`❌ [MISSING] '${funcName}' is called in frontend but NOT found in public schema.`);
            calls.forEach(c => console.log(`   ↳ Used in: ${c.file}`));
            issuesFound++;
            return;
        }

        // Check signatures
        // DB might have overloads, so we check if ANY DB signature matches the frontend call
        calls.forEach(call => {
            const usedArgs = call.args; // Array of param names used in JS object

            // Check if any overload matches
            const hasMatch = dbFuncMap[funcName].some(dbArgs => {
                // In Postgres, you can call with named params. 
                // We check if all 'usedArgs' exist in 'dbArgs'.
                // (Ignoring types for now, just checking names)
                if (usedArgs.length === 0) return true; // Function called without args, assume valid if DB func exists

                const missingInDb = usedArgs.filter(arg => !dbArgs.includes(arg));
                return missingInDb.length === 0;
            });

            if (!hasMatch) {
                console.warn(`⚠️ [MISMATCH] '${funcName}' called with args [${usedArgs.join(', ')}] in ${call.file}`);
                console.warn(`   ↳ Available DB signatures:`);
                dbFuncMap[funcName].forEach(sig => console.warn(`      (${sig.join(', ')})`));
                issuesFound++;
            }
        });
    });

    if (issuesFound === 0) {
        console.log("🎉 All frontend RPC calls appear to have matching DB definitions!");
    } else {
        console.log(`\n🛑 Found ${issuesFound} potential issues. Please review above.`);
    }
}

compare();
