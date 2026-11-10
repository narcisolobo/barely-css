import { defineConfig } from '@playwright/test';

const PORT = 4173;
const engines = ['chromium', 'firefox', 'webkit'];
const schemes = ['light', 'dark'];

const browserProjects = engines.flatMap((browserName) =>
  schemes.map((colorScheme) => ({
    name: `${browserName}-${colorScheme}`,
    testDir: 'tests/browser',
    testIgnore: /forced-colors\.spec\.js/,
    use: { browserName, colorScheme },
  })),
);

const forcedProjects = [
  ['chromium', 'light'],
  ['chromium', 'dark'],
  ['firefox', 'light'],
  ['firefox', 'dark'],
  ['webkit', 'light'],
].map(([browserName, colorScheme]) => ({
  name: `${browserName}-${colorScheme}-forced`,
  testDir: 'tests/browser',
  testMatch: /(keyboard|forced-colors)\.spec\.js/,
  // WebKit only reports the media query as matching; it does not force rendered colors.
  // forcedMode() returns 'media-only' there, so tests skip rendered-color assertions.
  use: { browserName, colorScheme, forcedColors: 'active' },
}));

export default defineConfig({
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: 'node scripts/serve.js',
    url: `http://localhost:${PORT}/package.json`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'unit', testDir: 'tests/unit' }, ...browserProjects, ...forcedProjects],
});
