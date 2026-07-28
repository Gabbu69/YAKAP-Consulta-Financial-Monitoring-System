import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/frontend/setup.ts'],
        include: [
            'resources/js/**/*.test.{ts,tsx}',
            'tests/frontend/**/*.test.{ts,tsx}',
        ],
        css: true,
        restoreMocks: true,
    },
});
