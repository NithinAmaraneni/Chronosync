const fs = require('fs');
const { spawnSync } = require('child_process');

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const separator = trimmed.indexOf('=');
  if (separator < 0) continue;

  const key = trimmed.slice(0, separator);
  let value = trimmed.slice(separator + 1);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

env.NODE_ENV = 'production';
env.FRONTEND_URL = 'https://frontend-olive-nu-66.vercel.app';
delete env.PORT;

const keys = [
  'NODE_ENV',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_FROM',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'FRONTEND_URL',
];

for (const key of keys) {
  if (!env[key]) continue;

  process.stdout.write(`Adding ${key}... `);
  const result = spawnSync(
    'vercel',
    ['env', 'add', key, 'production', '--value', env[key], '--yes', '--force', '--sensitive'],
    { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }
  );

  if (result.status !== 0) {
    console.log('failed');
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  console.log('ok');
}
