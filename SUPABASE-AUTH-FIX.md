# 🔧 Fix Google OAuth Redirect Issue

## The Problem
After Google OAuth, you're being redirected back to login instead of dashboard.

## The Solution

### 1. Update Supabase Redirect URLs
Go to: https://supabase.com/dashboard/project/bfvmawxtremndtlqhdpv/auth/url-configuration

Add these to **Redirect URLs**:
```
http://localhost:3000/auth/callback
http://localhost:3000/dashboard
http://localhost:3000/**
```

### 2. Update Google Cloud Console
Go to: https://console.cloud.google.com/apis/credentials/oauthclient/289614002650-0e57h8flgjuguh4pufa6mh6letn3kf1b.apps.googleusercontent.com?project=unified-focus-assistant-24

Make sure you have this callback URL:
```
https://bfvmawxtremndtlqhdpv.supabase.co/auth/v1/callback
```

### 3. Clear Browser Data
Sometimes OAuth sessions get stuck:
1. Open Chrome DevTools (F12)
2. Go to Application tab
3. Clear Storage → Clear site data
4. Try logging in again

### 4. Test the Flow

#### Test with Email/Password First:
1. Go to http://localhost:3000/login
2. Sign up with email/password
3. Should redirect to /dashboard

#### Test Google OAuth:
1. Clear cookies/storage
2. Go to http://localhost:3000/login
3. Click "Continue with Google"
4. Should redirect to /dashboard after authorization

## 🎯 Quick Debug

Open browser console and run:
```javascript
// Check current session
const supabase = window.supabase || createClient()
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)

// Check user
const { data: { user } } = await supabase.auth.getUser()
console.log('User:', user)
```

## ✅ What I Fixed in Code:
1. Added session check on page load
2. Created `/auth/callback` route for proper OAuth handling
3. Updated auth state change listener

## 🚨 Important Settings in Supabase Dashboard:

### Authentication → Settings:
- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: Must include `/auth/callback`

### Authentication → Providers → Google:
- ✅ Enabled
- ✅ Client ID and Secret added
- ✅ Skip nonce check: Try enabling this if still having issues