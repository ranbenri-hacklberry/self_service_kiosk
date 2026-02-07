
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFilter() {
    const business_id = '22222222-2222-2222-2222-222222222222'; // iCaffe

    const now = new Date(); // Local time
    const businessTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    const todayIdx = businessTime.getDay();
    const dateStr = businessTime.toLocaleDateString('en-CA');

    console.log(`Current Time: ${now.toISOString()} | Business Time: ${businessTime.toISOString()} | DayIdx: ${todayIdx} | Date: ${dateStr}`);

    const { data: rawTasks } = await supabase
        .from('recurring_tasks')
        .select('*')
        .eq('business_id', business_id)
        .eq('is_active', true);

    const scheduled = (rawTasks || []).filter(t => {
        const schedule = t.weekly_schedule || {};
        if (schedule && Object.keys(schedule).length > 0) {
            const config = schedule[todayIdx];
            return config && config.qty > 0;
        }
        if (t.day_of_week !== null && t.day_of_week !== undefined) {
            return Number(t.day_of_week) === todayIdx;
        }
        return true;
    });

    console.log(`Total Tasks: ${rawTasks.length} | Scheduled for today: ${scheduled.length}`);

    const { data: logs } = await supabase
        .from('task_completions')
        .select('recurring_task_id')
        .eq('business_id', business_id)
        .eq('completion_date', dateStr);

    const completedIds = new Set(logs?.map(l => l.recurring_task_id));
    console.log(`Completions today: ${completedIds.size}`);

    const activeTasks = scheduled.filter(t => !completedIds.has(t.id));
    console.log(`Active Tasks: ${activeTasks.length}`);

    activeTasks.forEach(t => {
        console.log(` - ${t.name} (Category: ${t.category})`);
    });
}

debugFilter();
