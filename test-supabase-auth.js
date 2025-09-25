const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bfvmawxtremndtlqhdpv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdm1hd3h0cmVtbmR0bHFoZHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzI2NzUsImV4cCI6MjA3NDMwODY3NX0.Sg-kxYldVsPxhFNbPF3InmZJ7ww73WHlmfDtPXUEL5k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
  console.log('Testing Supabase Auth signup...');

  // Generate a test email
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'Test123!@#';

  try {
    // Test signup
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        emailRedirectTo: 'http://localhost:3000/dashboard'
      }
    });

    if (error) {
      console.error('Signup error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.details
      });
    } else {
      console.log('Signup successful!');
      console.log('User:', data.user);
      console.log('Session:', data.session);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }

  // Also test if we can query the auth schema
  try {
    const { error: pingError } = await supabase
      .from('_dummy_table_that_does_not_exist')
      .select('*')
      .limit(1);

    console.log('Database connection test completed');
  } catch (err) {
    console.log('Database connection test error (expected):', err.message);
  }
}

testSignup();