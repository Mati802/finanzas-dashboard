import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.TZ = 'America/Argentina/Buenos_Aires';
});
