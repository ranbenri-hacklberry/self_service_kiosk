# Heartbeat Monitor Cloud Function

## תיאור
פונקציה שמנטרת את הפעימות (heartbeats) ממכשירי KDS ושולחת התראות SMS כשעסק יורד לאופליין.

## איך זה עובד
1. Cloud Scheduler קורא לפונקציה כל דקה
2. הפונקציה בודקת את טבלת `device_sessions` בסופבייס
3. אם אין heartbeat מעסק במשך 3+ דקות → שולח SMS למנהל
4. אם עסק חזר לאונליין אחרי שהיה אופליין → שולח SMS "חזר לפעילות"

## הגדרות
בקובץ `index.js`:
- `OFFLINE_THRESHOLD_MINUTES`: אחרי כמה דקות בלי heartbeat לשלוח התראה (ברירת מחדל: 3)
- `ALERT_COOLDOWN_MINUTES`: כמה דקות לחכות בין התראות חוזרות (ברירת מחדל: 30)
- `TEST_PHONE`: מספר לבדיקות

## פריסה

### 1. התקנת gcloud CLI
```bash
brew install google-cloud-sdk
gcloud auth login
```

### 2. פריסה ל-Cloud Functions
```bash
cd cloud-functions/heartbeat-monitor

gcloud functions deploy checkHeartbeats \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region us-central1 \
  --project repos-477613 \
  --set-env-vars SUPABASE_SERVICE_KEY=YOUR_SERVICE_KEY
```

### 3. הגדרת Cloud Scheduler (כל דקה)
```bash
gcloud scheduler jobs create http heartbeat-check-job \
  --schedule="* * * * *" \
  --uri="https://us-central1-repos-477613.cloudfunctions.net/checkHeartbeats" \
  --http-method=POST \
  --location=us-central1 \
  --project repos-477613
```

## בדיקה ידנית
```bash
curl -X POST https://us-central1-repos-477613.cloudfunctions.net/checkHeartbeats
```

## לוגים
```bash
gcloud functions logs read checkHeartbeats --limit=50
```
