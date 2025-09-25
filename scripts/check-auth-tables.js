const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bfvmawxtremndtlqhdpv.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdm1hd3h0cmVtbmR0bHFoZHB2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczMjY3NSwiZXhwIjoyMDc0MzA4Njc1fQ.ySY6ukghovI6WRd3LbNzha5lCtniMt2is-5BHwn6Ngs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuthTables() {
  console.log('Checking Supabase Auth configuration...\n');

  // Check if we have any users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('Error listing users:', usersError);
  } else {
    console.log(`Total users in database: ${users.users.length}`);
    if (users.users.length > 0) {
      console.log('Sample user:', users.users[0].email);
    }
  }

  // Try to check auth settings
  console.log('\nTrying to fetch auth config...');

  // Check if email auth is enabled
  const testEmail = `test_${Date.now()}@example.com`;
  console.log(`\nAttempting to create test user: ${testEmail}`);

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'Test123!@#',
    email_confirm: true,
    user_metadata: {
      test: true
    }
  });

  if (createError) {
    console.error('Error creating user:', createError);
  } else {
    console.log('Test user created successfully!');
    console.log('User ID:', newUser.user.id);

    // Clean up - delete the test user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(newUser.user.id);
    if (deleteError) {
      console.error('Error deleting test user:', deleteError);
    } else {
      console.log('Test user cleaned up successfully');
    }
  }
}

checkAuthTables();