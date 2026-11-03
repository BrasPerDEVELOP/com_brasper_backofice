# Revisión de contabilidad: backend y frontend

Revisión estática del 28 de octubre de 2026. No se modificó código funcional ni se accedió a producción.

## Resumen

- La comisión del cliente se vuelve a calcular con catálogos actuales en la pantalla y sus exportaciones.
- El frontend puede inventar una coincidencia de tramo cuando el backend devuelve un porcentaje ausente.
- La exportación termina silenciosamente al alcanzar 20.000 movimientos.
- El permiso de consulta permite modificar la fecha de facturación sin validar el alcance del movimiento.
- No se ejecutaron tests: no existe `node_modules` en el frontend y el ejecutable Python disponible es un alias de Windows que no arranca.

## Hallazgos

| Prioridad | Ubicación | Problema y efecto | Corrección sugerida |
|---|---|---|---|
| Alta | `src/modules/contabilidad/presentation/bodies/contabilidad_view.vue:767` | `clientCommissionAmount` recalcula con el porcentaje del catálogo comercial y settings actuales, en lugar de la comisión registrada (`commission_result`). Si cambian los catálogos o la operación tiene condiciones particulares, la comisión base visible y la base usada para comisión interna, impuesto y venta pueden discrepar. PDF y Excel reutilizan este cálculo. | Usar la comisión efectiva guardada en la operación como base y centralizar el desglose contable en backend. Cubrir operaciones históricas y con descuentos. |
| Alta | `src/modules/contabilidad/presentation/bodies/contabilidad_view.vue:694` y `:775`; backend: `com_brasper_api/app/modules/transactions/infrastructure/repository.py:292` | Cuando `accounting_percentage` viene nulo porque ningún tramo coincide, el frontend busca en el catálogo y usa el último tramo si tampoco encuentra coincidencia. Además trata `max_amount=0` como infinito, a diferencia del SQL. Si no obtiene porcentaje, el desglose interno usa una escala fija. Puede mostrar un descuento vacío pero calcular la venta con un porcentaje supuesto. | Respetar el nulo de la API y mostrar el cálculo como no disponible. Unificar la resolución de rangos y evitar catálogos o escalas alternativas silenciosas. |
| Media | `src/modules/transacciones/presentation/controllers/use_transactions_store_controller.ts:261` | La exportación recorre como máximo 200 páginas de 100 filas y devuelve el resultado acumulado sin comprobar si faltan filas. Con más de 20.000 registros, el archivo se presenta como completo. | Exportación en servidor o error explícito al alcanzar el límite sin completar el total. |
| Media | Backend: `com_brasper_api/app/modules/transactions/adapters/router/transaction_routes.py:407` | El PUT de fecha exige únicamente `accounting.view` y recibe cualquier ID. No aplica `_scope_transaction_user` ni una validación de propietario equivalente a la usada para restringir el listado. Un usuario con ese permiso puede escribir una fecha incluso fuera de su alcance de consulta si conoce el ID. | Definir permiso de escritura y aplicar validación de alcance/estado antes de actualizar. Si todos los contadores deben poder editar globalmente, dejarlo explícito en la política y probarlo. |

Los efectos anteriores se deducen de las rutas y funciones revisadas; no constituyen una reproducción contra una base de datos real. La política deseada de permisos debe confirmarse al corregir el último punto.

## Plan de mejoras

1. **A — Validación:** preparar entornos y ejecutar tests contables, de adapters, permisos y exportación existentes; añadir casos dirigidos a estos hallazgos al corregirlos.
2. **B — Cálculos:** definir el importe efectivo del cliente y devolver el desglose desde backend con una única política de redondeo y de datos ausentes.
3. **C — Frontend:** consumir ese desglose en tabla, PDF y Excel; extraer las reglas de la vista extensa sin alterar el diseño.
4. **D — Integración:** probar permisos restringidos, tramos sin coincidencia, cambios de configuración y exportaciones superiores al límite.

## Alcance y criterio de cierre

No cambiar colores ni diseño durante las correcciones. No resolver diferencias de backend introduciendo más reglas alternativas en el frontend.

Se considera cerrado cuando pantalla, PDF y Excel usan los mismos importes efectivos; los datos incompletos se indican explícitamente; las exportaciones no se truncan sin aviso; los permisos de lectura y escritura están definidos y probados; y las comprobaciones de ambos proyectos pasan en un entorno preparado.
