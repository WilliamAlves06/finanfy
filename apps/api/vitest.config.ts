import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.test.ts', 'test/**/*.e2e-spec.ts'],
  },
  plugins: [
    // necessário p/ decorators + metadata do NestJS nos testes
    swc.vite({ module: { type: 'es6' } }),
  ],
});
