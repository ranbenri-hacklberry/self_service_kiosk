# שינויים בבסיס הנתונים - Maya Biometric System

## סיכום השינויים שבוצעו

### 1. **טבלת `employees` - שדות ביומטריים**

- ✅ **`face_embedding`**: שונה מ-`vector(512)` ל-`vector(128)` (תואם ל-FaceAPI.js)
- ✅ **`pin_hash`**: נוסף עמודה לשמירת PIN מוצפן (fallback authentication)
- ✅ **אינדקס חדש**: `employees_face_embedding_idx` עם 128 ממדים

### 2. **טבלת `time_clock_events` - מערכת נוכחות**

- ✅ **`assigned_role`**: תפקיד שהוקצה לעובד במשמרת
- ✅ **`location`**: מיקום פיזי של אירוע הכניסה/יציאה
- ✅ **`notes`**: הערות נוספות על האירוע

### 3. **פונקציות חדשות**

#### **זיהוי פנים:**

- ✅ `match_employee_face(embedding, threshold, count)` - מחפש התאמה לפנים בבסיס הנתונים
- ✅ `update_employee_face(employee_id, embedding)` - מעדכן וקטור פנים לעובד

#### **אימות PIN:**

- ✅ `verify_employee_pin(pin, business_id)` - מאמת PIN כשיטת fallback

#### **כניסה/יציאה:**

- ✅ `clock_in_employee(business_id, employee_id, location, role)` - רושם כניסה למשמרת

---

## האם זה ייכנס לבילד?

**כן**, אבל רק אם תריץ את המיגרציה החדשה על השרת המרוחק.

### מה כבר קיים במיגרציות

- ❌ **`face_embedding`** מוגדר כ-`vector(512)` ב-`base_schema.sql` (ישן)
- ❌ **`time_clock_events`** חסרים העמודות `assigned_role`, `location`, `notes`
- ❌ **הפונקציות הביומטריות** לא קיימות במיגרציות

### מה צריך לעשות

1. **יצרתי מיגרציה חדשה**: `20260210000000_maya_biometric_system.sql`
2. **להריץ על השרת המרוחק**:

   ```bash
   # בשרת iCaffe
   cd /path/to/icaffeos
   supabase db push
   ```

---

## רשימת שינויים מלאה (לא במיגרציות)

| רכיב | שינוי | סטטוס במיגרציות |
|------|-------|------------------|
| `employees.face_embedding` | `vector(512)` → `vector(128)` | ❌ לא עודכן |
| `employees.pin_hash` | עמודה חדשה | ❌ לא קיים |
| `time_clock_events.assigned_role` | עמודה חדשה | ❌ לא קיים |
| `time_clock_events.location` | עמודה חדשה | ❌ לא קיים |
| `time_clock_events.notes` | עמודה חדשה | ❌ לא קיים |
| `match_employee_face()` | פונקציה חדשה | ❌ לא קיים |
| `update_employee_face()` | פונקציה חדשה | ❌ לא קיים |
| `verify_employee_pin()` | פונקציה חדשה | ❌ לא קיים |
| `clock_in_employee()` | פונקציה חדשה | ❌ לא קיים |

---

## הצעדים הבאים

1. **בדיקה מקומית** (אופציונלי):

   ```bash
   cd /Users/user/.gemini/antigravity/scratch/my_app/frontend_source
   supabase db reset  # יריץ את כל המיגרציות מחדש כולל החדשה
   ```

2. **פריסה לשרת המרוחק**:

   ```bash
   # העתק את המיגרציה לשרת
   scp supabase/migrations/20260210000000_maya_biometric_system.sql icaffe@server:/path/to/icaffeos/supabase/migrations/
   
   # הרץ על השרת
   ssh icaffe@server
   cd /path/to/icaffeos
   supabase db push
   ```

3. **אימות**:
   - בדוק שהפונקציות קיימות: `\df match_employee_face` ב-psql
   - בדוק שהעמודות נוספו: `\d time_clock_events`

---

**האם תרצה שאכין סקריפט אוטומטי שיעתיק וירוץ את המיגרציה על השרת המרוחק?**
