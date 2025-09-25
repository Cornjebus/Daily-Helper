-- Fix Supabase Auth Schema Issues
-- This script ensures the auth schema is properly configured

-- 1. Check if auth schema exists and create if needed
CREATE SCHEMA IF NOT EXISTS auth;

-- 2. Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO postgres, service_role;

-- 3. Enable necessary extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 4. Check and create auth.users table if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'auth' AND table_name = 'users') THEN
        -- This shouldn't happen in a Supabase project, but just in case
        RAISE NOTICE 'auth.users table is missing! This requires Supabase dashboard intervention.';
    END IF;
END $$;

-- 5. Check for any constraints that might be causing issues
SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'auth'
ORDER BY tc.table_name;