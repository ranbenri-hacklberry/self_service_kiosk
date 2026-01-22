#!/bin/bash
# =============================================================================
# בדיקת זרימת לויאלטי - iCaffeOS
# משתמש ב-agent-browser לבדיקה אוטומטית
# =============================================================================

set -e

BASE_URL="http://localhost:4028"
SESSION="loyalty-$(date +%s)"
EMAIL="ran@mail.com"
PASSWORD="1234"

echo "🧪 === בדיקת זרימת לויאלטי ==="
echo "📍 URL: $BASE_URL"
echo "📧 User: $EMAIL"
echo ""

# --- 1. פתיחת הדף והמתנה לטעינה ---
echo "1️⃣ פותח דפדפן..."
agent-browser --session "$SESSION" open "$BASE_URL"
sleep 3

# --- 2. התחברות ---
echo "2️⃣ מתחבר למערכת..."
agent-browser --session "$SESSION" snapshot > /dev/null
agent-browser --session "$SESSION" fill "input[type='email'], input[placeholder*='email']" "$EMAIL" 2>/dev/null || true
agent-browser --session "$SESSION" fill "input[type='password']" "$PASSWORD"
agent-browser --session "$SESSION" click "button:has-text('התחבר')"
sleep 3
agent-browser --session "$SESSION" screenshot "tests/screenshots/01-after-login.png"
echo "   ✅ התחברות הצליחה"

# --- 3. בחירת מצב קופה ---
echo "3️⃣ בוחר מצב קופה..."
agent-browser --session "$SESSION" snapshot -i > /tmp/mode.txt
MODE_BTN=$(grep -o '@e[0-9]*' /tmp/mode.txt | head -1)
agent-browser --session "$SESSION" click "$MODE_BTN"
sleep 3
agent-browser --session "$SESSION" screenshot "tests/screenshots/02-menu.png"
echo "   ✅ נכנס לתפריט"

# --- 4. בחירת פריט (אספרסו כפול) ---
echo "4️⃣ בוחר אספרסו כפול..."
agent-browser --session "$SESSION" click "button:has-text('אספרסו כפול')"
sleep 1
agent-browser --session "$SESSION" screenshot "tests/screenshots/03-item-modal.png"

# לחיצה על "הוסף להזמנה"
agent-browser --session "$SESSION" click "button:has-text('הוסף להזמנה')"
sleep 1
echo "   ✅ פריט נוסף לעגלה"

# --- 5. הזנת טלפון (לויאלטי) ---
echo "5️⃣ מזין מספר טלפון..."
agent-browser --session "$SESSION" click "button:has-text('טלפון')"
sleep 1
agent-browser --session "$SESSION" screenshot "tests/screenshots/04-phone-keyboard.png"

# הקלדת מספר: 0548888888
agent-browser --session "$SESSION" click "button:has-text('0'):not(:has-text('10'))"
agent-browser --session "$SESSION" click "button:has-text('5')"
agent-browser --session "$SESSION" click "button:has-text('4')"
agent-browser --session "$SESSION" click "button:has-text('8')"
agent-browser --session "$SESSION" click "button:has-text('8')"
agent-browser --session "$SESSION" click "button:has-text('8')"
agent-browser --session "$SESSION" click "button:has-text('8')"
agent-browser --session "$SESSION" click "button:has-text('8')"
agent-browser --session "$SESSION" click "button:has-text('8')"
agent-browser --session "$SESSION" click "button:has-text('8')"
sleep 1
agent-browser --session "$SESSION" screenshot "tests/screenshots/05-phone-entered.png"

# לחיצה על המשך
agent-browser --session "$SESSION" click "button:has-text('המשך')"
sleep 2
agent-browser --session "$SESSION" screenshot "tests/screenshots/06-loyalty-check.png"
echo "   ✅ מספר טלפון הוזן"

# --- 6. אישור לקוח ---
echo "6️⃣ מאשר לקוח..."
# בודק אם יש כפתור אישור
if agent-browser --session "$SESSION" snapshot -i | grep -q "כן, זהו הלקוח"; then
    agent-browser --session "$SESSION" click "button:has-text('כן, זהו הלקוח')"
    sleep 1
    echo "   ✅ לקוח קיים אושר"
else
    echo "   ⚠️ לקוח חדש או לא נמצא"
fi
agent-browser --session "$SESSION" screenshot "tests/screenshots/07-loyalty-confirmed.png"

# --- 7. תשלום ---
echo "7️⃣ עובר לתשלום..."
agent-browser --session "$SESSION" click "button:has-text('לתשלום')"
sleep 2
agent-browser --session "$SESSION" screenshot "tests/screenshots/08-payment.png"

# בוחר מזומן
agent-browser --session "$SESSION" click "button:has-text('מזומן')"
sleep 3
agent-browser --session "$SESSION" screenshot "tests/screenshots/09-success.png"
echo "   ✅ תשלום בוצע"

# --- 8. אימות הצלחה ---
echo "8️⃣ מאמת הצלחה..."
if agent-browser --session "$SESSION" snapshot -i | grep -q "העסקה נרשמה"; then
    echo "   ✅✅✅ הזמנה הושלמה בהצלחה!"
    RESULT="PASS"
else
    echo "   ❌ משהו השתבש"
    RESULT="FAIL"
fi

# --- 9. סגירה ---
echo "9️⃣ סוגר דפדפן..."
agent-browser --session "$SESSION" close

echo ""
echo "=========================================="
echo "📊 תוצאת הבדיקה: $RESULT"
echo "📸 צילומי מסך: tests/screenshots/"
echo "=========================================="
