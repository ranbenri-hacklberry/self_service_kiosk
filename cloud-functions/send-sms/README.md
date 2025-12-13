# SMS Cloud Function - Deployment Guide

## Overview
This Google Cloud Function acts as a secure proxy for sending SMS messages via GlobalSMS API.
It provides:
- **Static IP**: Can be configured with Cloud NAT for a fixed IP address
- **Security**: API key is stored server-side, not exposed in client code
- **Validation**: Input validation and error handling

## Prerequisites
1. Google Cloud account with billing enabled
2. `gcloud` CLI installed and authenticated
3. GlobalSMS account with approved sender number

## Deployment Steps

### 1. Install Google Cloud CLI
```bash
# macOS
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate and Set Project
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 3. Deploy the Function
```bash
cd cloud-functions/send-sms

gcloud functions deploy sendSms \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region us-central1 \
  --entry-point sendSms
```

### 4. Get the Function URL
After deployment, you'll receive a URL like:
```
https://us-central1-YOUR_PROJECT.cloudfunctions.net/sendSms
```

### 5. Configure Static IP (Optional but Recommended)

#### Create a Cloud NAT with Static IP:
```bash
# Reserve a static IP
gcloud compute addresses create sms-static-ip --region=us-central1

# Get the IP address
gcloud compute addresses describe sms-static-ip --region=us-central1 --format="get(address)"

# Create Cloud Router
gcloud compute routers create sms-router --network=default --region=us-central1

# Create Cloud NAT
gcloud compute routers nats create sms-nat \
  --router=sms-router \
  --region=us-central1 \
  --nat-external-ip-pool=sms-static-ip \
  --nat-all-subnet-ip-ranges
```

#### Send the static IP to GlobalSMS:
Email the IP address to `sales@globalsms.co.il` for whitelisting.

### 6. Update Client Code
Update `src/services/smsService.js` to use the Cloud Function URL:

```javascript
const CLOUD_FUNCTION_URL = 'https://us-central1-YOUR_PROJECT.cloudfunctions.net/sendSms';

export const sendSms = async (phone, message) => {
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, message })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ SMS sent:', data);
    return data;
  } catch (error) {
    console.error('❌ SMS error:', error);
    return { error: error.message };
  }
};
```

## Testing

### Test the function locally:
```bash
npm install
npx @google-cloud/functions-framework --target=sendSms
```

### Test with curl:
```bash
curl -X POST https://YOUR_FUNCTION_URL/sendSms \
  -H "Content-Type: application/json" \
  -d '{"phone":"0501234567","message":"Test message"}'
```

## Cost Estimation
- Cloud Functions: ~$0.40 per million requests
- Cloud NAT: ~$0.045 per hour + $0.045 per GB processed
- Static IP: ~$0.005 per hour when in use

For a small cafe, monthly cost should be under $5.

## Security Notes
- The API key is stored in the function code (not exposed to clients)
- Consider using Google Secret Manager for production
- The function validates Israeli phone number format
- CORS is enabled for your frontend domain

## Troubleshooting
- Check logs: `gcloud functions logs read sendSms`
- Verify IP is whitelisted with GlobalSMS
- Ensure billing is enabled on your Google Cloud project
