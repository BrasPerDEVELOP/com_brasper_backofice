# Actualizaciones del panel

El HTML se obtiene con NetworkFirst; no se precachea index.html. La caché de navegación solo se usa cuando falla la red. Los archivos con hash conservan el precache y permiten mantener pestañas antiguas durante el despliegue.

La aplicación registra /sw.js con updateViaCache=none y comprueba cambios al abrir, al volver a la pestaña y cada 60 segundos mientras esté visible. Un nuevo worker toma control y muestra un aviso con Actualizar ahora; no recarga formularios automáticamente ni elimina la sesión.

Nginx debe devolver Cache-Control: no-store, no-cache, must-revalidate para HTML, rutas SPA, sw.js, registerSW.js y manifest.webmanifest. Los assets con hash válidos pueden usar public, max-age=31536000, immutable; los ausentes deben responder 404, nunca index.html.

Publicar assets primero y después index.html y sw.js. Conservar assets anteriores para pestañas abiertas. Verificar nginx -t antes de recargar y comprobar las cabeceras por HTTPS.

Migración: un worker antiguo puede servir el HTML anterior en la primera visita. Su comprobación habitual instala el nuevo worker; una recarga normal posterior carga la versión actual. No hay código nuevo que pueda ejecutarse retroactivamente en una pestaña que solo contiene JavaScript antiguo.
