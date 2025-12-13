# אפליקציית React Native עם Expo - סוכן ניהול נתונים

## התקנה והרצה

### 1. התקנת תלויות
```bash
# העתק את package-expo.json ל-package.json (או התקן ישירות)
cp package-expo.json package.json
npm install
```

**לשדרוג ל-SDK 54:**
```bash
# עדכן את כל התלויות לגרסאות תואמות
npx expo install --fix

# בדוק בעיות נוספות
npx expo-doctor
```

**גרסאות מותקנות:**
- Expo SDK: 54.0.0
- React: 19.1.0
- React Native: 0.81.5
- expo-status-bar: ~3.0.8

### 2. הרצת האפליקציה

**לפיתוח:**
```bash
npm start
# או
expo start
```

**לפלטפורמות ספציפיות:**
```bash
npm run web      # להרצה בדפדפן
npm run ios      # להרצה ב-iOS Simulator
npm run android  # להרצה ב-Android Emulator
```

## מבנה האפליקציה

האפליקציה מכילה קובץ יחיד `App.js` עם:

1. **אזור עליון (Data Display):** טבלה לקריאה בלבד להצגת נתונים
2. **אזור תחתון (Chat Interface):** ממשק צ'אט לשליחת פקודות

## תכונות

- ✅ תמיכה ב-RTL (עברית)
- ✅ תמיכה ב-Web ו-Mobile
- ✅ חיבור ל-Backend Cloud Run
- ✅ הצגת טבלאות דינמיות
- ✅ כפתור אישור שינויים (כאשר נדרש)
- ✅ ממשק צ'אט אינטראקטיבי

## Backend

האפליקציה מתחברת ל:
- URL: `https://aimanageragentrani-625352399481.europe-west1.run.app`
- Method: POST
- Payload: `{ "command": "טקסט המשתמש" }`

## לוגיקת תצוגה

### מקרה 1: הצגת נתונים (קריאה)
כאשר השרת מחזיר `"action": "display_editable_form"` (או כל action אחר שאינו אישור):
- הטבלה מוצגת לקריאה בלבד
- אין כפתור אישור

### מקרה 2: שינוי ואימות (עדכון)
כאשר השרת מחזיר `"action": "display_read_only_form_for_approval"`:
- הטבלה מוצגת לקריאה בלבד
- מוצג כפתור "אשר שינויים" בולט
- לחיצה על הכפתור שולחת פקודת אישור לשרת

