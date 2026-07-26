import { qwikVite } from '@builder.io/qwik/optimizer';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: false,
  plugins: [qwikVite()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/lifecycle.test.tsx'],
  },
});
