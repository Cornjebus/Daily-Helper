# Supabase Auth Fix Instructions

The production Supabase instance is experiencing a "Database error saving new user" issue. This is preventing new user signups.

## Problem
The auth.users table or its triggers/constraints are failing when trying to insert new users. Error code: 500 - "Database error saving new user"

## Immediate Workaround
Use the local Supabase instance for development:
- Local Supabase is already configured at http://localhost:54321
- Run `npx supabase start` to ensure it's running
- The app will automatically use local Supabase in development mode

## Permanent Fix (requires Supabase Dashboard access)

1. Go to https://supabase.com/dashboard/project/bfvmawxtremndtlqhdpv/sql

2. Run this diagnostic query:
```sql
-- Check auth schema
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- Check for any failed triggers
SELECT * FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- Check constraints
SELECT conname, contype, condeferrable, condeferred
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass;
```

3. Potential fixes to try:

```sql
-- Reset auth schema permissions
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role;

-- Check if raw_user_meta_data column exists (common issue)
ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb;

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

4. If the above doesn't work, check Supabase Dashboard:
   - Go to Authentication > Settings
   - Ensure "Enable Email Signup" is checked
   - Check if there are any rate limits or restrictions

5. As a last resort, contact Supabase support with:
   - Project ID: bfvmawxtremndtlqhdpv
   - Error: "Database error saving new user" (500)
   - Users can be listed but not created

## Testing the Fix

After applying fixes, test with:
```bash
node scripts/check-auth-tables.js
```

Or try signing up at http://localhost:3000/signup