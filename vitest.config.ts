import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'frontend',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'happy-dom',
          globals: true,
          setupFiles: ['./src/test-setup.ts'],
        },
      },
      {
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
    ],
  },
});
