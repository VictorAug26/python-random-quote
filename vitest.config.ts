import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      // Valores de teste, sem relação com produção.
      SESSAO_SECRET: 'segredo-de-teste-nao-usar-em-producao',
      IP_HASH_PEPPER: 'pepper-de-teste-nao-usar-em-producao',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
