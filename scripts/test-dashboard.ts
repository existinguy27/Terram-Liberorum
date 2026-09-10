import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!);

async function test() {
  console.log('Testing GM Dashboard Supabase integration...\n');

  // 1. Test: Add mail for Kael
  console.log('1. Adding mail for Kael...');
  const { data: players } = await supabase.from('players').select('id, name').eq('name', 'Kael').single();
  if (!players) {
    console.log('   ERROR: Kael not found');
    return;
  }

  const { data: mail, error: mailError } = await supabase
    .from('mail')
    .insert({
      player_id: players.id,
      title: 'Test Letter from Dashboard',
      sender: 'Test Sender',
      content: 'This mail was created via the GM Dashboard test script.'
    })
    .select()
    .single();

  if (mailError) {
    console.log('   ERROR adding mail:', mailError.message);
  } else {
    console.log('   ✓ Mail created:', mail.id, mail.title);
  }

  // 2. Test: Add a location
  console.log('\n2. Adding a location...');
  const { data: location, error: locError } = await supabase
    .from('locations')
    .insert({
      name: 'Test Location',
      continent: 'Moravia',
      x_percent: 25,
      y_percent: 75,
      brief_description: 'A test location from dashboard',
      full_description: 'This is a full description for testing.',
      notable_npcs: 'Test NPC',
      connected_quests: 'Test Quest',
      visible: true
    })
    .select()
    .single();

  if (locError) {
    console.log('   ERROR adding location:', locError.message);
  } else {
    console.log('   ✓ Location created:', location.id, location.name);

    // 3. Test: Toggle visibility
    console.log('\n3. Toggling location visibility to false...');
    const { error: toggleError } = await supabase
      .from('locations')
      .update({ visible: false })
      .eq('id', location.id);

    if (toggleError) {
      console.log('   ERROR toggling:', toggleError.message);
    } else {
      console.log('   ✓ Visibility toggled to false');

      // Verify
      const { data: verify } = await supabase.from('locations').select('visible').eq('id', location.id).single();
      console.log('   Verified visible =', verify?.visible);
    }
  }

  console.log('\n✓ All tests completed!');
}

test().catch(console.error);