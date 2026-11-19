import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
  // Frontera tienda / cliente. Una sola app, dos lados que no se importan
  // entre sí: el panel del restaurante (dashboard) y la experiencia del
  // cliente (tienda pública, carrito, pedidos). Lo que usan los dos va en
  // `lib/`, `components/ui`, `components/forms`, `components/orders`, etc.
  {
    files: [
      'app/(public)/**',
      'app/(protected)/**',
      'app/(preview)/**',
      'components/store/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/dashboard', '@/components/dashboard/*', '@/app/dashboard', '@/app/dashboard/*'],
              message:
                'El lado del cliente no importa código del panel del restaurante. Si es compartido, muévelo a lib/ o a components/ (ui, forms, …).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/dashboard/**', 'components/dashboard/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/store', '@/components/store/*', '@/app/(public)/*', '@/app/(protected)/*'],
              message:
                'El panel del restaurante no importa código de la tienda del cliente. Si es compartido, muévelo a lib/ o a components/ (ui, forms, …).',
            },
          ],
        },
      ],
    },
  },
  {
    // Playwright fixtures, not React: their `use` fixture parameter is not a
    // hook and trips the next/core-web-vitals React hooks heuristics.
    files: ['e2e/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
]

export default eslintConfig
