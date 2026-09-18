# Contrato de plataforma

## PlatformServices

La aplicacion recibe un objeto estable que agrupa capacidades. Las features consumen interfaces, no detectan `window.__TAURI__`, `Capacitor.isNativePlatform()` ni user-agent.

## LifecyclePort

Eventos: active, background, resume, close-requested y back-requested. La suscripcion devuelve unsubscribe. Web adapta visibility/pagehide; Tauri adapta ventana; Capacitor adapta App lifecycle y Android back.

Close/back permiten responder si la navegacion fue manejada o debe continuar. Ningun listener promete tiempo ilimitado para red.

## SecureStoragePort

Operaciones get/set/remove con namespace de aplicacion. La sesion Supabase actual usa una clave pre-auth unica y contiene el user ID necesario tras restaurar; no requiere conocer usuario antes de leerla. Web usa `localStorage` versionado, aceptando el threat model de un cliente web publico. Tauri usa keyring del SO. Capacitor usa `@aparajita/capacitor-secure-storage`, con iCloud sync desactivado y limpieza de namespace en instalacion nueva. Logout elimina credenciales.

## DraftStoragePort

Guarda contenido potencialmente sensible por `userId + routineId`: version de journal, document envelope, revision base, generacion monotona, fecha local y timestamp absoluto. Debe ser atomico, versionado y limitado. Web/WebViews usan IndexedDB app-local. Logout explicito elimina tras resolver; expiracion lo conserva bloqueado para el mismo usuario.

## TimerStoragePort

Guarda un snapshot pequeño por usuario/contexto en IndexedDB app-local, separado de drafts. Debe ser atomico/versionado y eliminarse en Cancel, Dismiss y logout. No ejecuta tareas en background.

## AudioPort

Prepara audio desde gesto, reproduce señal y tolera bloqueo/fallo. Web Audio es implementacion base; un adaptador nativo solo se agrega si aporta una necesidad verificada.

## NavigationPort

Expone ruta actual, push, replace y back para navegacion interna. El router React sigue siendo fuente de verdad.

## ExternalLinksPort

Abre URLs `http/https` validadas en el navegador o handler del sistema. Nunca reemplaza el WebView principal y rechaza otros esquemas salvo contrato futuro.

## PlatformInfo

Valores: web, desktop o mobile; sistema operativo opcional; capacidades booleanas verificadas. Solo se usa para adaptacion necesaria, no para duplicar dominio.

## Reglas

- Adaptadores no conocen rutinas, Activities ni completions.
- Features no importan implementaciones.
- Fakes deterministas existen para unitarias.
- Toda capability Tauri y permiso Capacitor se justifica y prueba.
- Si DraftStorage falla, el editor muestra estado critico, bloquea salida y no afirma que el cambio esta protegido.
