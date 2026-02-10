import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseWranglerCronTriggers(content) {
  const triggersBlockMatch = content.match(/\[triggers\][\s\S]*?(?:\n\[[^\]]+\]|\s*$)/);
  if (!triggersBlockMatch) {
    throw new Error('Missing [triggers] block in wrangler.toml');
  }

  const triggersBlock = triggersBlockMatch[0];
  const cronArrayMatch = triggersBlock.match(/crons\s*=\s*\[([\s\S]*?)\]/);
  if (!cronArrayMatch) {
    throw new Error('Missing triggers.crons in wrangler.toml');
  }

  const cronValues = [];
  const quotedValueRegex = /"([^"]+)"/g;
  let match;
  while ((match = quotedValueRegex.exec(cronArrayMatch[1])) !== null) {
    cronValues.push(match[1]);
  }
  return cronValues;
}

function parseAllowedSchedules(content) {
  const cronValues = [];
  const cronRegex = /cron:\s*'([^']+)'/g;
  let match;
  while ((match = cronRegex.exec(content)) !== null) {
    cronValues.push(match[1]);
  }
  if (cronValues.length === 0) {
    throw new Error('No cron values found in api/src/constants/schedules.ts');
  }
  return cronValues;
}

function formatList(values) {
  return values.join(', ');
}

const root = resolve('.');
const wranglerToml = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');
const scheduleConstants = readFileSync(resolve(root, 'api/src/constants/schedules.ts'), 'utf8');

const wranglerCrons = parseWranglerCronTriggers(wranglerToml);
const allowedCrons = parseAllowedSchedules(scheduleConstants);

const wranglerSet = new Set(wranglerCrons);
const allowedSet = new Set(allowedCrons);

const missingInWrangler = allowedCrons.filter((cron) => !wranglerSet.has(cron));
const missingInAllowed = wranglerCrons.filter((cron) => !allowedSet.has(cron));

if (missingInWrangler.length > 0 || missingInAllowed.length > 0) {
  console.error('Schedule mismatch detected.');
  if (missingInWrangler.length > 0) {
    console.error(`Present in ALLOWED_SCHEDULES only: ${formatList(missingInWrangler)}`);
  }
  if (missingInAllowed.length > 0) {
    console.error(`Present in wrangler.toml only: ${formatList(missingInAllowed)}`);
  }
  process.exit(1);
}

console.log('Schedule config is in sync.');
