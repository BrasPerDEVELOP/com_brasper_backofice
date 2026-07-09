# Prompt maestro — Auditoría estilo Stemis (Brasper Backoffice)

Copia y pega este prompt en Cursor/Codex/Claude Code apuntando al repo `com_brasper_backofice`.

---

## PROMPT (copiar desde aquí)

```
Audita y mejora el proyecto com_brasper_backofice siguiendo el flujo de calidad de Stemis.
Lee y aplica la skill brasper-backoffice-audit (.agents/skills/brasper-backoffice-audit/SKILL.md).
También usa thermo-nuclear-code-quality-review para god files y spaghetti.

## Objetivo
- Más fluidez de desarrollo (menos errores, CI, convenciones claras)
- Misma disciplina que Stemis (4 capas de validación)
- Código limpio y mantenible
- NO cambiar diseño visual: mismos colores Brasper, mismo Tailwind, misma apariencia

## Contexto del proyecto
- Vue 3 + TypeScript + Pinia + Vite + Tailwind 4
- Clean Architecture: modules/<name>/domain → application → infrastructure → presentation
- API Django externa; adapters normalizan respuestas
- Auth: JWT en localStorage, permisos module.action
- Problema conocido: transacciones_view.vue ~5300 líneas

## Fase 1 — Solo auditoría (NO implementar aún)
1. Lee CLAUDE.md, memory/project_structure.md, AGENTS.md
2. Recorre src/interface/ y src/modules/
3. Genera docs/audits/AUDITORIA-YYYY-MM-DD.md con:
   - Resumen ejecutivo
   - Hallazgos CRITICAL / HIGH / MEDIUM / LOW (con archivo:línea)
   - Comparación vs checklist brasper-backoffice-audit
   - Plan en 4 fases (tooling, widgets, refactor transacciones, CI/E2E)
   - Lista de skills ya instaladas y cuáles faltan

## Fase 2 — Implementar solo Fase A del plan (si yo confirmo)
Sin tocar diseño visual. Solo:
- AGENTS.md y scripts npm (typecheck, test, lint, check)
- ESLint + Prettier básico para Vue/TS
- Un lockfile (eliminar el duplicado)
- interface/widgets/: PageHeader, EmptyState, AppSpinner, ConfirmDialog (misma estética actual)
- .gitea/workflows/ci.yml o .github/workflows/ci.yml (typecheck + test + build)
- README.md mínimo

## Reglas estrictas
- CERO cambios de colores, tipografía o layout visual en pantallas existentes
- CERO features nuevas de negocio
- Refactors = mismo comportamiento, mejor estructura
- Un PR conceptual por fase; no mezclar tooling + split de transacciones
- Citar evidencia file:line en cada hallazgo
- Si algo requiere cambio en API Django, solo documentarlo en docs/, no inventar endpoints

## Skills a invocar
1. brasper-backoffice-audit (principal)
2. thermo-nuclear-code-quality-review (god files)
3. vue-best-practices (patrones Vue)
4. brainstorming SOLO si propones features nuevas (no en auditoría)

Empieza por Fase 1. Al terminar el reporte, pregúntame si ejecutar Fase A.
```

---

## Variante corta (solo auditoría)

```
Skill: brasper-backoffice-audit + thermo-nuclear-code-quality-review.
Audita com_brasper_backofice sin cambiar código ni diseño.
Output: docs/audits/AUDITORIA-YYYY-MM-DD.md con hallazgos file:line y plan 4 fases.
Lee CLAUDE.md primero.
```

---

## Variante implementación Fase A (después del reporte)

```
Skill: brasper-backoffice-audit Fase A.
Implementa tooling + widgets + CI en com_brasper_backofice.
Prohibido: cambiar colores/Tailwind theme/diseño de vistas existentes.
Permitido: extraer componentes con mismas clases CSS actuales.
Scripts: typecheck, lint, test, check. Un solo lockfile. CI workflow.
```

---

## Skills instaladas en este repo

| Skill | Ruta |
|-------|------|
| brasper-backoffice-audit | `.agents/skills/brasper-backoffice-audit/` |
| brainstorming | `.agents/skills/brainstorming/` |
| thermo-nuclear-code-quality-review | `.agents/skills/thermo-nuclear-code-quality-review/` |
| vue-best-practices | `.agents/skills/vue-best-practices/` |

Espejo Cursor: `.cursor/skills/` (mismas skills copiadas).

## Qué NO se copió de Stemis (y por qué)

| Skill Stemis | Motivo |
|--------------|--------|
| shadcn-ui, next-best-practices | React/Next, no Vue |
| nestjs-best-practices, prisma-expert | Backend en otro repo (Django) |
| interface-design, ui-ux-pro-max | Diseño visual — excluido por pedido |
| dokploy-deploy, notion-stemis | Infra/documentación Stemis |
