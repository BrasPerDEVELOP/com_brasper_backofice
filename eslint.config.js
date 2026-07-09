import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// Flat config para Vue 3 + TypeScript.
// - `flat/essential`: solo reglas Vue críticas (evita ruido de orden de atributos, etc.).
// - `vueTsConfigs.recommended`: reglas TS recomendadas (sin type-checking, rápido).
// - `skipFormatting`: desactiva reglas de estilo que colisionan con Prettier.
export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/dev-dist/**',
      '**/coverage/**',
      '**/node_modules/**'
    ]
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    name: 'app/rule-overrides',
    rules: {
      // Los nombres de componentes en bodies/ suelen ser de una palabra (por vista).
      'vue/multi-word-component-names': 'off',
      // `vue-tsc` ya bloquea variables sin usar (noUnusedLocals/Parameters);
      // en ESLint lo dejamos como aviso para no duplicar el gate y no romper `check`.
      '@typescript-eslint/no-unused-vars': 'warn',
      // Deuda técnica existente: preferimos `unknown`, pero avisamos sin bloquear.
      '@typescript-eslint/no-explicit-any': 'warn',
      // `@ts-nocheck` heredado en el store de calculator; su remoción es un refactor
      // aparte (Fase C), no parte del tooling. Avisamos sin romper el gate.
      '@typescript-eslint/ban-ts-comment': 'warn'
    }
  }
)
