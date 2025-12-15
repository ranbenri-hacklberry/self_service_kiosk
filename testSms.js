import { sendSms } from './src/services/smsService.js';

sendSms('0548317887', 'בדיקה: הודעה מה‑iCaffe Kiosk').then((result) => {
    console.log('SMS result:', result);
}).catch((err) => {
    console.error('SMS error:', err);
});
