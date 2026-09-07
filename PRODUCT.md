# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Operadores internos de Brasper, analistas de tesorería, administradores de plataforma, soporte y oficiales de cumplimiento. Trabajan en la gestión, validación, conciliación y liquidación de transferencias y operaciones de cambio transfronterizas (Brasil - Perú).

## Product Purpose
Proveer un panel de administración y control operativo seguro y eficiente para gestionar el ciclo de vida completo de transacciones financieras, usuarios, cuentas bancarias corporativas y de clientes, tasas de cambio, comisiones, cupones y auditoría de eventos.

## Positioning
Backoffice financiero especializado en operaciones de cambio y remesas Brasil-Perú (Brasper), con control granular de permisos por rol, soporte multicuentas, cálculo automático de comisiones y trazabilidad total de operaciones.

## Operating Context
- Entorno de trabajo: Escritorio web (desktop), uso continuo en jornada laboral por equipos de operaciones y finanzas.
- Integración: Frontend SPA (Vue 3 + TypeScript + Pinia) consumiendo una API externa Django con autenticación basada en tokens y permisos por módulo/acción (`module.action`).
- Flujos críticos: Monitoreo y cambio de estado de transacciones en tiempo real, validación de comprobantes de pago (MediaViewer), configuración de tasas de cambio y administración de cuentas bancarias.

## Capabilities and Constraints
- **Capacidades:**
  - Consulta y gestión de transacciones (filtros avanzados, estados, múltiples destinos).
  - Administración de usuarios y sus múltiples identificaciones/cuentas bancarias.
  - Gestión de cuentas operativas Brasper (razón social, banco, moneda, país).
  - Configuración de tasas de cambio, cálculo de comisiones y cupones de descuento.
  - Auditoría de accesos y eventos del sistema.
  - Gestión de contenido institucional (blog, banners de inicio).
- **Restricciones técnicas:**
  - Arquitectura limpia modular por capas (Presentation -> Store -> Use Case -> Adapter -> API).
  - No modificar la paleta ni alterar el diseño visual existente sin requerimiento explícito.
  - UI completamente en Español; código, variables y tipos en Inglés.
  - Gateo estricto de acciones mutables basado en permisos de usuario (`auth.hasPermission`).

## Brand Commitments
- Nombre: Brasper Backoffice.
- Identidad visual: Corporativa, profesional, sobria y orientada a la productividad.
- Interfaz en Español para los operadores.

## Evidence on Hand
- Especificación de arquitectura y contratos API en `FEATURE_MAP.md` y `AGENTS.md`.
- Rutas de aplicación y control de acceso definidos en `src/interface/router/index.ts`.
- Modelos de dominio y permisos en `src/modules/auth/domain/models/permissions.ts`.

## Product Principles
1. **Seguridad y Precisión Operativa:** Toda acción de mutación financiera debe estar validada, confirmada y sujeta a permisos explícitos.
2. **Escaneo y Densidad Eficiente (Operate Mode):** Las tablas, filtros y visores deben priorizar la velocidad de lectura, claridad de estados y facilidad de procesamiento para el operador.
3. **Resiliencia y Feedback Inmediato:** Manejo robusto de errores de red o API Django, diálogos de confirmación destructivos y estados de carga no bloqueantes.
4. **Consistencia Modular:** Reutilización de widgets base (`PageHeader`, `EmptyState`, `ConfirmDialog`, `AppSpinner`, `DataTable`, `MediaViewerDialog`) manteniendo la separación estricta de capas.
