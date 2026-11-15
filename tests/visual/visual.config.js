import { defineConfig } from '@playwright/test';

const PORT = 4173;
const engines = ['chromium', 'firefox', 'webkit'];
const schemes = ['light', 'dark'];

const common = { testDir: '.', testMatch: /capture\.spec\.js/ };

const normal = engines.flatMap((browserName) =>
  schemes.map((colorScheme) => ({
    ...common,
    name: `${browserName}-${colorScheme}`,
    use: { browserName, colorScheme },
  })),
);

const forced = ['chromium', 'firefox'].flatMap((browserName) =>
  schemes.map((colorScheme) => ({
    ...common,
    name: `${browserName}-${colorScheme}-forced`,
    use: { browserName, colorScheme, forcedColors: 'active' },
  })),
);

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  workers: process.env.VISUAL_WORKERS ? Number(process.env.VISUAL_WORKERS) : undefined,
  reporter: [['list']],
  globalSetup: './setup.js',
  globalTeardown: './report.js',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: 'node scripts/serve.js',
    cwd: new URL('../../', import.meta.url).pathname,
    url: `http://localhost:${PORT}/package.json`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
  projects: [...normal, ...forced],
});
