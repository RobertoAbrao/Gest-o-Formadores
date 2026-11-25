import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// Configuração base recomendada pelo Next (React, hooks, regras do Next).
// `next/typescript` ficou de fora de propósito: ele proíbe `any`, e o código tem
// centenas — viraria ruído e esconderia o que importa.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', 'node_modules/**', 'out/**', 'public/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // Reclama de aspas e apóstrofos em texto de tela ("Salvar", d'água) — comuns em
      // português e exibidos sem problema pelo React. Era a única regra com erro (20
      // ocorrências, todas desse tipo) quando o lint entrou, em 25/11/2026.
      'react/no-unescaped-entities': 'off',
    },
  },
];
