
import fetch from 'node-fetch';

async function checkInventory() {
    const URL = 'https://gxzsxvbercpkgxraiaex.supabase.co/rest/v1/menu_items?select=name';
    const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
    try {
        const resp = await fetch(URL, { headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY } });
        const data = await resp.json();
        console.log(JSON.stringify(data.map(i => i.name)));
    } catch (e) {
        console.error(e);
    }
}
checkInventory();
