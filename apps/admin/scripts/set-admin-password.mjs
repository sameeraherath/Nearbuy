#!/usr/bin/env node
// Sets (or resets) an admin's password. Run on your own computer:
//   pnpm --filter @nearbuy/admin set-password
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from apps/admin/.env.local.
// The password is typed hidden and is never printed or stored in a file.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // no env file; rely on the environment
  }
}
loadEnv(new URL('../.env.local', import.meta.url));

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write('*');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

function normalize(input) {
  let d = input.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  const national = d.startsWith('94') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d;
  const e164 = `+94${national}`;
  return /^\+947\d{8}$/.test(e164) ? e164 : null;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/admin/.env.local first.');
  process.exit(1);
}

const phone = normalize(await ask('Admin mobile number: '));
if (!phone) {
  console.error('Not a Sri Lankan mobile number.');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: profile, error } = await supabase
  .from('profiles')
  .select('id, full_name, role')
  .eq('phone', phone)
  .maybeSingle();
if (error) {
  console.error(error.message);
  process.exit(1);
}
if (!profile || profile.role !== 'admin') {
  console.error(`${phone} is not an admin.`);
  process.exit(1);
}

const password = await ask(`New password for ${profile.full_name || phone} (min 10 characters): `, true);
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}
const again = await ask('Type it again: ', true);
if (again !== password) {
  console.error('Passwords do not match.');
  process.exit(1);
}

const email = `${phone.slice(1)}@admin.nearbuy.lk`;
const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
  email,
  email_confirm: true,
  password,
});
if (updateError) {
  console.error(updateError.message);
  process.exit(1);
}
console.log(`Done. ${profile.full_name || phone} can now sign in to the admin panel with ${phone.replace('+94', '0')} and this password.`);
