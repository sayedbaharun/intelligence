#!/usr/bin/env node
/**
 * Generate a TELEGRAM_SESSION (GramJS StringSession).
 *
 * Usage:
 *   cd scripts
 *   TELEGRAM_API_ID=... TELEGRAM_API_HASH=... node telegram/session-auth-simple.mjs
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import readline from 'node:readline';

const apiId = parseInt(String(process.env.TELEGRAM_API_ID || ''), 10);
const apiHash = String(process.env.TELEGRAM_API_HASH || '');

if (!apiId || !apiHash) {
  console.error('Missing TELEGRAM_API_ID or TELEGRAM_API_HASH');
  process.exit(1);
}

function ask(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const phoneNumber = await ask('Phone number (with country code, e.g. +971...): ');
  const password = await ask('2FA password (press enter if none): ');

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.start({
    phoneNumber: () => Promise.resolve(phoneNumber),
    password: () => Promise.resolve(password || undefined),
    phoneCode: () => ask('Verification code from Telegram: '),
    onError: (err) => console.error(err),
  });

  const session = client.session.save();
  console.log('\nGenerated session. Add this as a Railway env var:');
  console.log(`TELEGRAM_SESSION=${session}`);

  await client.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
