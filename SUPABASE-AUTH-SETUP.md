# Supabase Auth Configuration Guide

## 🔐 Setting Up OAuth Providers in Supabase

### Access Supabase Dashboard
```bash
open "https://supabase.com/dashboard/project/bfvmawxtremndtlqhdpv/auth/providers"
```

---

## 1️⃣ Enable Google OAuth

1. Go to **Authentication → Providers → Google**
2. Toggle **Enable Sign in with Google** to ON
3. Add your Google OAuth credentials:
   - **Client ID**: `[YOUR_GOOGLE_CLIENT_ID]`
   - **Client Secret**: `[YOUR_GOOGLE_CLIENT_SECRET]`
4. Copy the **Callback URL** from Supabase
5. Add it to Google Cloud Console:
   - Go to your [Google OAuth Credentials](https://console.cloud.google.com/apis/credentials?project=unified-focus-assistant-24)
   - Edit your OAuth 2.0 Client
   - Add the Supabase callback URL to Authorized redirect URIs
   - Should be: `https://[YOUR_SUPABASE_PROJECT_ID].supabase.co/auth/v1/callback`

---

## 2️⃣ Enable Email/Password Auth (Already Enabled by Default)

1. Go to **Authentication → Providers → Email**
2. Ensure **Enable Email Signup** is ON
3. Configure settings:
   - **Confirm email**: ON (recommended)
   - **Secure email change**: ON
   - **Secure password change**: ON

---

## 3️⃣ Enable GitHub OAuth (Optional)

1. First, create a GitHub OAuth App:
   - Go to [GitHub Settings → Developer Settings → OAuth Apps](https://github.com/settings/developers)
   - Click **New OAuth App**
   - Fill in:
     - **Application name**: Junie
     - **Homepage URL**: http://localhost:3000
     - **Authorization callback URL**: Get from Supabase Dashboard
2. Copy Client ID and Secret
3. In Supabase Dashboard:
   - Go to **Authentication → Providers → GitHub**
   - Toggle **Enable Sign in with GitHub** to ON
   - Paste Client ID and Secret

---

## 4️⃣ Configure Auth Settings

### Go to **Authentication → Settings**

1. **Site URL**: `http://localhost:3000`
2. **Redirect URLs** (add these):
   - `http://localhost:3000/**`
   - `http://localhost:3000/dashboard`
   - For production later: `https://your-domain.com/**`

3. **Email Templates** (optional):
   - Customize confirmation emails
   - Customize password reset emails

---

## 5️⃣ Test Your Setup

### Test Email/Password:
1. Go to http://localhost:3000/login
2. Click "Sign Up"
3. Enter email and password
4. Check email for confirmation (if enabled)

### Test Google OAuth:
1. Go to http://localhost:3000/login
2. Click "Continue with Google"
3. Authorize with your Google account
4. Should redirect to /dashboard

---

## 🎯 Quick Links

- **Supabase Auth Dashboard**: [Open](https://supabase.com/dashboard/project/bfvmawxtremndtlqhdpv/auth/providers)
- **Google Cloud Console**: [Open](https://console.cloud.google.com/apis/credentials?project=unified-focus-assistant-24)
- **Test Login Page**: http://localhost:3000/login

---

## ⚠️ Important Notes

1. **Google OAuth Redirect**: You MUST add Supabase's callback URL to Google Cloud Console
2. **Local Testing**: Use http://localhost:3000 for development
3. **Production**: Update URLs when deploying to Vercel

---

## 🔍 Verify Setup

Run this to check if auth is working:
```javascript
// In browser console at http://localhost:3000
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)
```