-- Allow users to update their own emails for batch operations
DROP POLICY IF EXISTS "Users can update own emails" ON emails;
CREATE POLICY "Users can update own emails"
ON emails
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Also ensure emails table has RLS enabled
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;