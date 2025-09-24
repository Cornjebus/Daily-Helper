# Google OAuth Configuration Guide

## 🔴 Current Issue: redirect_uri_mismatch

The Google OAuth is showing "redirect_uri_mismatch" error because the redirect URI in our app doesn't match what's configured in Google Cloud Console.

## ✅ Fix Steps:

### 1. Open Google Cloud Console
Go to: https://console.cloud.google.com/apis/credentials/oauthclient/289614002650-0e57h8flgjuguh4pufa6mh6letn3kf1b.apps.googleusercontent.com?project=unified-focus-assistant-24

### 2. Add These Authorized Redirect URIs:
```
http://localhost:3000/api/auth/google/callback
http://localhost:3000/api/auth/callback/google
```

### 3. Also add JavaScript Origins:
```
http://localhost:3000
```

### 4. Save Changes
Click "SAVE" at the bottom of the OAuth client configuration page.

## 📝 Current Configuration in Code:

- **Redirect URI in our app**: `http://localhost:3000/api/auth/google/callback`
- **Client ID**: `289614002650-0e57h8flgjuguh4pufa6mh6letn3kf1b.apps.googleusercontent.com`
- **Project**: unified-focus-assistant-24

## 🎯 Test After Fixing:

1. Clear browser cookies/cache
2. Go to http://localhost:3000/dashboard
3. Click "Connect" on Gmail card
4. Should redirect to Google OAuth consent screen
5. After authorizing, should redirect back to dashboard with Gmail connected

## 🔍 Debugging Tips:

If still having issues:
1. Check browser console for exact redirect_uri being used
2. Ensure no trailing slashes in URIs
3. Make sure URIs match EXACTLY (case-sensitive)
4. Wait 5-10 minutes after saving changes in Google Cloud Console for propagation

## 📚 Required Scopes:

Our app requests these scopes:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/userinfo.email`