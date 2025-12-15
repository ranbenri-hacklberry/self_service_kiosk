
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecipeIngredientsSchema() {
    const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
    } else {
        if (data && data.length > 0) {
            console.log("Columns:", Object.keys(data[0]));
        } else {
            console.log("Table is empty, cannot infer columns from data. Trying to insert a dummy to see error or list via alternate method if possible.");
            // Since we can't inspect schema directly easily without data, I'll assume I can just list keys from an empty select if header info was available, but supabase-js just returns data array.
            // I will trust the error message "column unit does not exist". 
            // Likely it's 'measurement_unit' or no unit column at all if it's implied by the inventory item.
        }
    }
}

checkRecipeIngredientsSchema();
