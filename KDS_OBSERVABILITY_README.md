# 🚀 KDS Observability Module - Installation Guide

## ✅ מה הותקן עד עכשיו (בסביבת פיתוח מקומית):

1. ✅ **KDSObservability Component** - `/src/components/super-admin/KDSObservability.jsx`
2. ✅ **SuperAdminPortal Updated** - הוספנו כפתור וmodal חדש
3. ✅ **SQL Schema** - `CREATE_SYSTEM_ALERTS_TABLE.sql` מוכן להרצה

---

## 📋 שלבים נותרים:

### **שלב 1: הרץ את ה-SQL Schema ב-Supabase**

1. פתח את [Supabase Dashboard](https://gxzsxvbercpkgxraiaex.supabase.co)
2. עבור ל- **SQL Editor**
3. העתק והדבק את התוכן מ-`CREATE_SYSTEM_ALERTS_TABLE.sql`
4. לחץ **Run** ✅

**וידוא:**
```sql
-- בדוק שהטבלה נוצרה
SELECT * FROM system_alerts ORDER BY created_at DESC LIMIT 5;
```

---

### **שלב 2: צור תיקיית Screenshots בPublic**

```bash
# בסביבת הפיתוח
cd /Users/user/.gemini/antigravity/scratch/my_app/frontend_source
mkdir -p public/screenshots

# צור קובץ dummy לבדיקה (או העתק צילום מסך אמיתי)
cp public/clerk_1.png public/screenshots/latest_kds.png
```

---

### **שלב 3: הרץ את הפרויקט והתנסה**

```bash
# התחל את הפרויקט
cd /Users/user/.gemini/antigravity/scratch/my_app/frontend_source
npm run dev

# או אם יש לך קומנד אחר:
# npm start
```

**גש ל:**
```
http://localhost:4028/super-admin
```

**לחץ על הכפתור החדש:** "צפייה ב-KDS" ✅

---

### **שלב 4: בדוק שה-Component עובד**

1. ✅ המודל נפתח בלחיצה על הכפתור
2. ✅ הצילום מסך מוצג (או הודעת "אין צילום מסך זמין")
3. ✅ כפתור Fullscreen עובד
4. ✅ רענון אוטומטי (30 שניות)

---

## 🚀 פריסה למחשב המרוחק (iCaffe)

### **שלב 1: העתק screenshot.sh המעודכן**

**מהדסקטופ בMacBook:**
```bash
# הקובץ screenshot.sh נמצא ב:
# /sessions/brave-trusting-darwin/mnt/outputs/screenshot.sh

scp ~/Desktop/screenshot.sh icaffe@100.97.166.104:/home/icaffe/screenshot.sh
ssh icaffe@100.97.166.104 "chmod +x /home/icaffe/screenshot.sh"
```

**עדכן את ה-Supabase Service Key בקובץ:**
```bash
ssh icaffe@100.97.166.104
nano /home/icaffe/screenshot.sh

# שנה את השורה:
SUPABASE_SERVICE_KEY="[השלם את ה-KEY המלא מ-.env]"
```

---

### **שלב 2: בדוק שה-Screenshot.sh עובד**

```bash
ssh icaffe@100.97.166.104

# הרץ את הסקריפט ידנית
/home/icaffe/screenshot.sh

# בדוק שנוצרו קבצים
ls -lh /home/icaffe/icaffe_logs/screenshots/
ls -lh /home/icaffe/icaffeos/public/screenshots/latest_kds.png
```

---

### **שלב 3: Push הקוד לGit ופרוס**

```bash
# בסביבת הפיתוח
cd /Users/user/.gemini/antigravity/scratch/my_app/frontend_source

# Commit השינויים
git add src/components/super-admin/KDSObservability.jsx
git add src/pages/super-admin/SuperAdminPortal.jsx
git add CREATE_SYSTEM_ALERTS_TABLE.sql
git commit -m "✨ Add KDS Observability Module with self-cleaning & fail-safe"

# Push ל-remote
git push origin main
```

**במחשב המרוחק:**
```bash
ssh icaffe@100.97.166.104
cd /home/icaffe/icaffeos
git pull origin main

# Restart services
pm2 restart all
# או
npm run build
```

---

### **שלב 4: וודא שה-Cron רץ**

```bash
ssh icaffe@100.97.166.104

# בדוק crontab
crontab -l

# אמור לראות:
# */5 * * * * /bin/bash /home/icaffe/screenshot.sh >> /home/icaffe/screenshot_monitor.log 2>&1

# בדוק logs
tail -f /home/icaffe/screenshot_monitor.log
```

---

## 🧪 בדיקות סופיות:

### **1. בדיקת Web Access:**
```
http://100.97.166.104:4028/screenshots/latest_kds.png
```

### **2. בדיקת SuperAdmin:**
1. התחבר ל-http://100.97.166.104:4028/super-admin
2. לחץ על "צפייה ב-KDS"
3. אמור לראות את צילום המסך האחרון ✅

### **3. בדיקת Fail-Safe:**
```bash
# עצור את ה-KDS כדי לגרום ל-scrot לכשל
# בדוק שנוצר alert ב-Supabase:
SELECT * FROM system_alerts WHERE alert_type = 'UI_HALT' ORDER BY created_at DESC LIMIT 1;
```

---

## 📊 תכונות המודול:

✅ **Self-Cleaning** - מוחק אוטומטית צילומי מסך ישנים מעל 24 שעות
✅ **Static Ref** - `latest_kds.png` תמיד מצביע על הקובץ האחרון
✅ **Fail-Safe** - אם `scrot` נכשל, שולח alert ל-Supabase
✅ **Live Monitoring** - רענון אוטומטי כל 30 שניות
✅ **Fullscreen View** - לחיצה על התמונה פותחת fullscreen
✅ **Mobile Friendly** - עובד מצוין גם מהPixel 8!

---

## 🚨 Troubleshooting:

### **בעיה: Component לא נטען**
```bash
# בדוק שהקובץ קיים
ls -la /Users/user/.gemini/antigravity/scratch/my_app/frontend_source/src/components/super-admin/KDSObservability.jsx

# בדוק errors בconsole
npm run dev
```

### **בעיה: צילום מסך לא מופיע**
```bash
# בדוק שהתיקייה קיימת
ls -la public/screenshots/

# בדוק שיש קובץ
ls -la public/screenshots/latest_kds.png
```

### **בעיה: Supabase Alert לא נשלח**
```bash
# בדוק את ה-service key
grep SUPABASE_SERVICE_KEY /home/icaffe/screenshot.sh

# נסה לשלוח alert ידנית
curl -X POST "https://gxzsxvbercpkgxraiaex.supabase.co/rest/v1/system_alerts" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"alert_type":"UI_HALT","severity":"critical","message":"Test"}'
```

---

## ✅ סיימנו!

**עכשיו Ran יכול לצפות ב-KDS מכל מקום בלי SSH!** 🎉
- 📱 מהPixel 8
- 💻 מהMacBook Pro 14
- 🌍 מכל דפדפן

**Antigravity Prompt fulfilled! ✨**
