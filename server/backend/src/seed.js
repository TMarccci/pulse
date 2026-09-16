// CLI helpers:
//   node src/seed.js admin <username> <password>   create/update an admin
//   node src/seed.js key [label]                   mint an enrollment key
//   node src/seed.js                               create default admin + key
import { db, now } from './db.js';
import { hashPassword, randomToken } from './auth.js';
import { config } from './config.js';

const [cmd, a, b] = process.argv.slice(2);

function upsertAdmin(username, password) {
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?').run(hashPassword(password), existing.id);
    console.log(`Updated admin "${username}".`);
  } else {
    db.prepare('INSERT INTO admins (username, pass_hash, created_at) VALUES (?,?,?)')
      .run(username, hashPassword(password), now());
    console.log(`Created admin "${username}".`);
  }
}

function mintKey(label) {
  const key = randomToken(18);
  db.prepare('INSERT INTO enroll_keys (key, label, created_at) VALUES (?,?,?)')
    .run(key, label || null, now());
  console.log(`Enrollment key${label ? ` (${label})` : ''}: ${key}`);
}

if (cmd === 'admin') {
  if (!a || !b) { console.error('usage: seed.js admin <username> <password>'); process.exit(1); }
  upsertAdmin(a, b);
} else if (cmd === 'key') {
  mintKey(a);
} else {
  const user = config.bootstrapAdminUser;
  const pass = config.bootstrapAdminPass || randomToken(9);
  upsertAdmin(user, pass);
  if (!config.bootstrapAdminPass) console.log(`Generated admin password: ${pass}`);
  mintKey('default');
}
