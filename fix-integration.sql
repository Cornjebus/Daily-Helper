-- Fix Gmail integration for existing user
INSERT INTO user_integrations (user_id, service, is_connected, connected_at, settings)
VALUES (
  '83716f89-16d6-4099-b0f0-1333af2c35db',
  'gmail',
  true,
  NOW(),
  '{"email": "cornelius@chuqlab.com", "scopes": ["gmail.readonly", "gmail.modify", "userinfo.email"]}'::jsonb
)
ON CONFLICT (user_id, service)
DO UPDATE SET
  is_connected = true,
  connected_at = NOW();