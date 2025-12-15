# Environment Variables Setup

## Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Backend Configuration (if using local backend)
VITE_BACKEND_URL=http://localhost:8080
```

## How to Get Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy the Project URL and anon/public key

## Common Issues

- **Menu edits not saving**: Missing Supabase credentials
- **Build failures**: Environment variables not set
- **Database connection errors**: Wrong URL or keys

## Vercel Deployment

For Vercel deployment, add these variables in:
Project Settings → Environment Variables
