# 🚀 Terminal Commands Cheat Sheet

מדריך מהיר לכל הפקודות שצריך לפרויקט.

---

## 📦 התקנה ועדכון

```bash
# התקנת כל החבילות
npm install

# עדכון חבילות
npm update

# בדיקת פגיעויות אבטחה
npm audit

# תיקון פגיעויות אוטומטי
npm audit fix

# תיקון פגיעויות (כולל שבירת תאימות)
npm audit fix --force

# מחיקה והתקנה מחדש (אם משהו תקוע)
rm -rf node_modules && npm install
```

---

## 🖥️ הרצת הפרויקט

```bash
# הרצה לפיתוח (development)
npm run dev
# פתח: http://localhost:4028

# הרצה על פורט אחר
npx vite --host --port 5555

# בניית פרודקשן
npm run build

# תצוגה מקדימה של build
npm run preview
```

---

## 🧪 בדיקות (Testing)

```bash
# הרצת בדיקות עם watch mode (מריץ מחדש בכל שינוי)
npm test

# הרצת בדיקות חד-פעמית
npm run test:run

# הרצת בדיקות עם דוח coverage
npm run test:coverage
```

---

## 🔍 בדיקת קוד (Linting)

```bash
# בדיקת ESLint על כל הקוד
npx eslint src/ --ext .js,.jsx

# תיקון אוטומטי של שגיאות
npx eslint src/ --fix
```

---

## 🌿 Git - ניהול גרסאות

### פעולות יומיומיות

```bash
# בדיקת סטטוס
git status

# הוספת כל השינויים
git add -A

# commit עם הודעה
git commit -m "תיאור השינויים"

# דחיפה ל-develop
git push origin develop

# משיכת שינויים
git pull origin develop
```

### העלאה לפרודקשן (main)

```bash
# העלאה מלאה מ-develop ל-main
git add -A && git commit -m "תיאור" && git push origin develop && git checkout main && git merge develop && git push origin main && git checkout develop
```

### יצירת גרסה (tag)

```bash
# יצירת tag
git tag -a v2.1.0 -m "Version 2.1.0 - תיאור"

# דחיפת tags
git push origin --tags
```

### מעבר בין branches

```bash
# מעבר ל-develop
git checkout develop

# מעבר ל-main
git checkout main

# יצירת branch חדש
git checkout -b feature/new-feature
```

---

## 🗄️ Supabase - בסיס נתונים

### הרצת SQL Migration

1. פתח: <https://supabase.com/dashboard>
2. לך לפרויקט → **SQL Editor**
3. העתק את תוכן קובץ ה-`.sql` מתיקיית `migrations/`
4. לחץ **Run**

---

## 🗃️ ניהול מסד נתונים (Database Management)

### יצירת Dump מהפרודקשן (Supabase)

```bash
# פקודה ליצירת Dump מלא (מבנה + נתונים) מהשרת המרוחק
PGPASSWORD='your_password' pg_dump -h aws-1-eu-central-1.pooler.supabase.com \
  -p 5432 -U postgres.gxzsxvbercpkgxraiaex -d postgres \
  -F p -f remote_db_dump.sql --no-owner --no-privileges
```

### סנכרון נתונים (Remote to Local)

ניתן להשתמש בסקריפט הסנכרון הקיים:

```bash
node scripts/sync-remote-to-local.mjs
```

### Migrations קיימים

```
migrations/
├── 20251215_device_sessions.sql        # מעקב מכשירים
├── 20251215_fix_kds_heartbeat.sql      # heartbeat למכשירים
├── 20251215_get_order_for_editing.sql  # עריכת הזמנות
├── 20251216_get_sales_data.sql         # נתוני מכירות
```

---

## 🔧 פתרון בעיות

### הפורט תפוס

```bash
# מצא את התהליך שמשתמש בפורט
lsof -i :4028

# הרוג את התהליך
kill -9 <PID>
```

### מחיקת cache

```bash
# מחיקת cache של npm
npm cache clean --force

# מחיקת cache של Vite
rm -rf node_modules/.vite
```

### בעיות הרשאות npm

```bash
# תיקון הרשאות
sudo chown -R $(whoami) ~/.npm
```

### איפוס מלא

```bash
rm -rf node_modules
rm package-lock.json
npm install
```

---

## 📱 Vercel - Deployment

### Rollback (חזרה לגרסה קודמת)

1. Vercel Dashboard → הפרויקט
2. **Deployments** tab
3. מצא גרסה קודמת → **⋮** → **Promote to Production**

### Environment Variables

1. Vercel Dashboard → הפרויקט
2. **Settings** → **Environment Variables**
3. הוסף:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## 🏃 פקודות מהירות

```bash
# === הרצה מהירה ===
npm run dev

# === בדיקה מהירה ===
npm run test:run

# === העלאה מהירה ל-main ===
git add -A && git commit -m "Quick fix" && git push origin develop && git checkout main && git merge develop && git push origin main && git checkout develop

# === build + בדיקה ===
npm run build && npm run preview
```

---

## 📋 סדר עבודה מומלץ

```bash
# 1. משוך שינויים אחרונים
git pull origin develop

# 2. עבוד על הקוד...

# 3. בדוק שהבדיקות עוברות
npm run test:run

# 4. בדוק build
npm run build

# 5. commit ו-push
git add -A
git commit -m "תיאור מפורט של השינויים"
git push origin develop

# 6. אם הכל טוב - העלה ל-main
git checkout main && git merge develop && git push origin main && git checkout develop
```

---

**Last Updated:** December 16, 2025 | **Version:** 2.0.0

---

## 🎵 מוזיקה (Music Encryption)

### הצפנה והכנה להעלאה

```bash
# הצפנת תיקיית מוזיקה (יוצר תיקייה encrypted_music_output)
node scripts/encrypt_upload.js /path/to/my/music

# דוגמה עם כונן חיצוני
node scripts/encrypt_upload.js /Volumes/Ran1/Music

# 🔥 אוטומציה: כתיבה ישירה לגוגל דרייב (אם מותקן)
# החלף את הנתיב השני בנתיב האמיתי של התיקייה בדרייב שלך
node scripts/encrypt_upload.js /Volumes/Ran1/Music "/Volumes/GoogleDrive/My Drive/Music Encrypted"
```

*הערה: הסקריפט מדלג אוטומטית על קבצים שכבר הוצפנו.*
