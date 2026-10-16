# Changelog

Todas las novedades, cambios y mejoras notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Unreleased]

## [0.32.3] - 2026-10-16

### Mejorado
- **Panel de cuotas:** Las cuotas se muestran en una rejilla adaptable con una barra de progreso por entrada, coloreada según el porcentaje restante (>50% verde, >20% amarillo, >10% naranja, resto rojo) y con el porcentaje acotado a 0–100. Se añade `role="progressbar"` con valores ARIA, se muestra «Sin datos» cuando no hay porcentaje y los fondos respetan el tema (`--dsw-alias-*`).

## [0.32.2] - 2026-10-16

### Corregido
- **Contrato Typert de cuotas:** El esquema estricto de `QuotaReportView` ahora declara `models` (cuota por modelo con `remainingPercent`/`resetsAt`), `account` y `error`, además de `balance`/`resetsAt` en `windows`. Antes solo contemplaba `provider` y `windows[].label/remainingPercent`, por lo que las cuotas por modelo de Google (y las cuentas/errores) no pasaban la validación del RPC.

### Añadido
- **Prueba de empaquetado:** Verifica que el esquema `getQuotas` del paquete, el generado y el del host aceptan y preservan las cuotas por modelo.

## [0.32.1] - 2026-10-16

### Añadido
- **Opciones de contexto anunciadas por el modelo:** `ModelView.contextOptions` publica las ventanas que anuncia cada modelo (base y máximo a partir de `context_length`/`context_window`/`max_context_window` y del catálogo), con etiquetas legibles que suman la salida máxima, igual que en VS Code.
- **Descubrimiento de contexto:** Nuevo `modelContextOptions()` en `src/core/models/context.ts` que combina descubrimiento y catálogo, calcula los tokens de salida y devuelve `1M (sin metadatos)` cuando el endpoint no publica límites.

### Cambiado
- **Valor por defecto por modelo:** `listModels` y `resolveModel` usan la mayor opción anunciada por el modelo en lugar de un 1M fijo, y respetan el contexto configurado; `maxOutputTokens` sale del descubrimiento/catálogo en vez de 4096 fijo.
- **Panel:** El selector por modelo usa las opciones reales que anuncia cada modelo en lugar de presets fijos, y muestra «Entrada activa».
- **Caché de catálogo:** `resolveModel` carga el catálogo si aún no está disponible y propaga el `AbortSignal` a `fetchCatalog`.

## [0.32.0] - 2026-10-16

### Añadido
- **Contexto por modelo configurable:** Nuevo almacén persistente `ModelContextSettings` (`model-contexts.json` bajo el perfil, con escrituras atómicas y serializadas) y **1 000 000 de tokens por defecto**. Valida que el valor sea un entero positivo.
- **RPC `setModelContext`:** El servicio expone `setModelContext({ model, contextWindow })` → `boolean` y el contrato Typert lo declara con el esquema estricto `ModelContextOptions`.
- **Editor de contexto en el panel:** Selector por modelo con presets (100k, 128k, 200k, 272k, 500k, 1M, 2M) y valor personalizado, con estado de guardado y refresco del catálogo al cambiar el valor.
- **`contextWindow` en `ModelView`:** `listModels` publica el contexto efectivo de cada modelo y el catálogo toma `context_window` de `limit.context` de models.dev.

### Cambiado
- **Resolución de contexto:** `resolveModel` usa el valor configurado del modelo (por defecto 1M) en lugar de inferirlo de `entry.context_length`/`metadata.context_window`.

### Corregido
- **Ventana por defecto:** Un `context_length` descubierto menor ya no reduce el contexto efectivo a 128k; el respaldo pasa a ser 1M salvo que se configure otro valor.

## [0.31.1] - 2026-10-15

### Añadido
- **Cuotas por modelo (Antigravity/Google):** `QuotaReportView` expone `models` y el nuevo `quotaEntries()` combina las ventanas con la cuota restante por modelo, incluyendo su tiempo de reinicio. El panel muestra cada cuenta con sus barras de cuota y maneja los estados vacío, de carga y de error.
- **Normalización de uso de tokens:** Nuevo `normalizeUsage()` que unifica los formatos OpenAI (`prompt_tokens`/`completion_tokens`/`input_tokens_details`) y Anthropic (`cache_read_input_tokens`/`cache_creation_input_tokens`), suma la caché al input en Anthropic, calcula `totalTokens` y omite `cacheReadTokens` cuando no existe.

## [0.31.0] - 2026-10-15

### Añadido
- **Integración con `@deepseek-ai/dsh-llm`:** `UniversalLlmAdapter` ahora extiende la clase base `LlmAdapter` del host y declara `@deepseek-ai/dsh-llm` como dependencia y peer. El cliente de proxy incorpora las cabeceras de atribución (`attributionHeaders()`).
- **Esfuerzos de razonamiento:** `resolveModel` publica `reasoning.efforts` a partir de `supported_reasoning_levels`, conservando los IDs del proveedor (incluido `off`) y estableciendo `defaultEffort` solo si el proveedor lo informa y pertenece a la lista.
- **Actualización del catálogo ante cambios:** El servicio refresca los modelos al completar OAuth y al eliminar una cuenta, y el adaptador notifica al registro de modelos cuando el catálogo o sus metadatos cambian.
- **Documentación:** Nueva guía `docs/MODEL_INTEGRATION.md` sobre el contrato de modelos y esfuerzo con `dsh-llm` 0.2.1-alpha.2.

### Cambiado
- **Errores tipados:** `resolveModel` y `stream` usan `LlmError` (`PROVIDER_UNAVAILABLE`, `MODEL_UNAVAILABLE`) en lugar de un texto simulado de reserva cuando el servidor o el modelo no están disponibles.
- **Empaquetado:** `tsdown` deja de empaquetar las dependencias `@deepseek-ai/*` (`neverBundle`), que permanecen externas en el bundle del servidor.

## [0.30.6] - 2026-10-15

### Corregido
- **Contrato Typert de `listModels`:** El generador de contratos (`scripts/build-typert.mjs`) declara el método `listModels` y el esquema estricto `ModelsList`, de modo que el host y el cliente remoto exponen realmente la invocación `universal-provider#universalProvider/listModels`. Antes faltaba en los artefactos generados y la llamada del panel no estaba tipada ni validada.

### Añadido
- **Prueba de empaquetado:** La suite verifica que los descriptores del paquete y los generados coinciden para `listModels`, incluyendo la firma, la cancelación por `signal` y la validación de `ModelsList` (acepta modelos y lista vacía, rechaza entradas incompletas).

## [0.30.5] - 2026-10-15

### Añadido
- **Descubrimiento de modelos vía RPC propio:** Nueva interfaz `ModelView` (`provider`, `id`, `name`, `description`, `inputModalities`) y método remoto `listModels` en `UniversalProviderService`, de modo que la consulta de modelos ya no depende del espacio de nombres `remote.llm` del host.
- **Sección "Modelos disponibles":** El panel muestra la lista de modelos descubiertos con botón *Actualizar modelos*, estado de carga y aviso cuando no hay modelos para las cuentas y endpoints configurados.

### Cambiado
- **Adaptador LLM:** `UniversalLlmAdapter` reutiliza `ModelView` para la información de modelos y expone `listModels` con soporte de `AbortSignal`; se elimina el respaldo `universal-chat` y el caché de descubrimientos previos.
- **Instancia única del adaptador:** El adaptador se crea una sola vez en `apply` y se comparte entre el servicio y `ctx.llm.registerAdapter`.

### Corregido
- **Refresco de modelos:** La lista se actualiza al abrir el panel, al cambiar de pestaña (cuentas y endpoints) y tras añadir o eliminar cuentas y endpoints, en lugar de quedarse desactualizada.

## [0.30.4] - 2026-10-15

### Corregido
- **Apertura de la autorización OAuth:** La reserva de pestaña durante el gesto del usuario se envuelve en `try/catch`, ya que los hosts de escritorio pueden rechazar URLs vacías o abrir el navegador externamente sin devolver una `Window`. Antes, un `window.open('')` fallido abortaba el inicio de sesión.
- **Vinculación en hosts de escritorio:** Cuando `window.open` no devuelve una ventana (por ejemplo, cuando DSH delega en el navegador del sistema), la URL de autorización se abre igualmente con `noopener,noreferrer` y no se marca como error.

### Mejorado
- **Mensajes del panel:** El enlace manual y el aviso de fallo ahora usan un texto más claro (`Si no se abrió el navegador, abrir autorización manualmente`) y ya no confunden la delegación al navegador del sistema con un bloqueo del navegador.

## [0.30.3] - 2026-10-15

### Corregido
- **Panel de gestión:** El cliente desenvuelve el sobre `RemoteResult` (`{ ok, value }`) de las llamadas remotas; antes guardaba el sobre como si fuera el valor, el panel rompía con `accounts.map is not a function` y se quedaba sin cuentas ni botones de vinculación.
- **Vinculación OAuth:** El sondeo `pollOAuth` y la cancelación `cancelOAuth` también desenvuelven el resultado, así que el flujo de vinculación completa y refresca cuentas, modelos y estado.

## [0.30.2] - 2026-10-15

### Corregido
- **Arranque del cliente:** Se elimina el retorno del fiber de `ctx.inject()` en `apply`, que Cordis rechazaba como effect (`Invalid effect`), desactivaba el plugin, ocultaba el panel de gestión y los botones de vinculación, y podía impedir el arranque de la interfaz web.

## [0.30.1] - 2026-10-15

### Corregido
- **Activación del cliente:** Se declara la dependencia del servicio `remote` y se espera el montaje de sus contratos, evitando el fallo `cannot get property "remote" without inject`.
- **Acceso a configuración:** Se añade el acceso **Configurar** de la fila del plugin, reutilizando el panel del paquete.
- **Carga inicial de cuentas:** El panel consulta las cuentas OAuth al abrirse.
- **Orden de compilación:** Los contratos Typert se generan antes de empaquetar el cliente para evitar incorporar artefactos anteriores.

### Mejorado
- **Panel visible en Plugins:** El cliente declara el servicio `slots`, se carga de inmediato y registra la gestión en `plugins.bundle.config`, con botones de cuentas directamente en la página del plugin.
- **Instalación desde Git sin scripts:** Se eliminan `prepare` y `prepack`; las instalaciones consumen `lib/` precompilado y no requieren incluir el paquete en la allowlist `allowBuilds` de pnpm.
- **Vinculación de cuentas en DSH:** Botones directos para Antigravity y ChatGPT/Codex, espera OAuth cancelable con límite de tiempo, lista de varias cuentas y consulta de modelos después de autenticar.
- **Descubrimiento nativo de modelos:** Tras completar OAuth, la interfaz consulta los modelos del proveedor LLM nativo de DSH para que puedan seleccionarse desde el picker.

## [0.30.0] - 2026-10-15

### Añadido

#### Motor de Inferencia y Streaming Nativo
- **Adaptador LLM para DeepSeek Harness:** Implementación de `UniversalLlmAdapter` registrado bajo la ruta `universal-chat-provider` en `ctx.llm.registerAdapter`.
- **Streaming de Respuestas SSE:** Soporte completo para el protocolo `/v1/responses` con deltas de texto, emisión de secciones de razonamiento/pensamiento (`thinking`), bloques balanceados y terminación garantizada.
- **Herramientas y Function Calling:** Ensamble de llamadas a herramientas multi-turno con validación JSON de argumentos. Las herramientas son invocadas y ejecutadas por DSH bajo sus políticas de sandboxing y permisos.
- **Reporte de Uso y Caché:** Extracción y reporte de métricas de tokens (prompt, completion, total y tokens leídos de caché) hacia los frames de uso de DSH.
- **Renderizado de Citas Codex:** Sustitución automática de glifos privados de citación de ChatGPT (`\uE200cite...`) por enlaces Markdown navegables y seguros.
- **Catálogo de Modelos Inteligente:** Descubrimiento dinámico de modelos desde `/v1/models` enriquecido con metadatos de contexto, modalidades de entrada (texto e imagen) y emparejamiento con catálogos externos.

#### Gestión de Cuentas y Proveedores
- **7 Proveedores OAuth Soportados:** Integración con flujos de autenticación para:
  - OpenAI Codex (ChatGPT / Codex)
  - Anthropic Claude (Claude Code)
  - Google Antigravity
  - Moonshot Kimi
  - xAI Grok (Grok Build)
  - Devin (Cognition)
  - Meta Muse (Muse Code)
- **Ciclo de Vida OAuth Completo:** Inicio de sesión con apertura de navegador y soporte de código de dispositivo, sondeo de estado (`pollOAuth`), cancelación de sesión y eliminación de cuentas.
- **Endpoints OpenAI Compatibles:** Configuración y persistencia dinámica de proveedores compatibles con la API de OpenAI (Ollama, vLLM, LM Studio, OpenRouter o despliegues locales).

#### Sistema de Cuotas y Límites
- **Monitoreo de Cuotas para 5 Proveedores:**
  - **Codex:** Ventanas de 5 horas, 7 días y saldo de créditos.
  - **Claude:** Ventanas de 5 horas, 7 días y límites por familias de modelos (`seven_day_<family>`).
  - **Antigravity:** Fracciones de cuota restante por modelo específico y tiempos de reset.
  - **Grok:** Saldo de créditos y consumo on-demand.
  - **Kimi:** Ventanas de cuota rodante, cuota semanal y límite vitalicio.
- **Temporizadores y Resets:** Formateo de conteos regresivos de reinicio de cuota y gestión de backoff ante códigos HTTP 429 con cabecera `Retry-After`.

#### Supervisor de Servidor y Seguridad
- **Modo Administrado (Managed):**
  - Descarga automática de releases oficiales de `CLIProxyAPI` v8 (mínimo 8.0.3).
  - Verificación estricta de sumas de comprobación SHA-256 por arquitectura y plataforma.
  - Extracción segura de archivos previniendo ataques de *directory traversal*.
  - Ejecución en loopback (`127.0.0.1`), en un puerto libre, con acceso remoto deshabilitado (`allow-remote: false`).
  - Claves criptográficas aleatorias generadas por sesión (32 bytes hex) para inferencia y gestión.
  - Ciclo de vida supervisado por `ctx.subprocess` (sin procesos detached ni uso de shell) y drenaje de peticiones activas antes del apagado.
  - Bloqueo exclusivo de propietario (`server.lock`) para prevenir colisiones entre instancias DSH.
- **Modo Externo (External):** Conexión segura a servidores CLIProxyAPI existentes en local o remoto mediante credenciales en `ctx.credentials`, sin modificar procesos externos.
- **Aislamiento de Rutas:** Resolución estricta de rutas con `@deepseek-ai/dsh-home-paths` bajo `$DSH_HOME/universal-provider/<perfil>/` y `$DSH_HOME/cache/universal-provider/` con permisos `0o700` y `0o600`.

#### Interfaz de Usuario y RPC Typert
- **Panel Nativo en Settings:** Pestaña integrada en `settings.section` de la GUI web de DeepSeek Harness con componentes React, estilos vinculados a los tokens de diseño (`--dsw-alias-*`) y soporte bilingüe (español e inglés).
- **Protocolo Typert RPC:** Servicio `UniversalProviderService` con 14 métodos de gestión tipados con validación estricta Zod en el host y montaje en el cliente (`ctx.remote.$mount`), sin exponer tokens crudos al navegador.
- **Cancelación Uniforme:** Propagación de `AbortSignal` a través de todas las operaciones RPC y streams.

#### Modelos Auxiliares
- **Títulos de Sesión:** Configuración del proveedor nativo de títulos mediante `configEditor` conservando límites de tokens y presupuesto.
- **Compactación de Conversaciones:** Configuración de `summarizationProvider` en `dsh-compaction-basic` para rutas elegibles.
- **Borrador de Mensajes de Commit:** Generación asistida de mensajes Conventional Commits basada en `git diff --cached` sandboxed, reportando sin llamar al modelo cuando el stage está vacío.
- **Visor de Diagnóstico:** Consulta de registros del servidor con redacción automática de tokens Bearer, API keys y contraseñas.

#### Calidad y Empaquetado
- **Suite de Pruebas Automatizadas:** 10 suites de test con Vitest y 30 casos de prueba unitarios y de integración con servidor mock (100% de éxito).
- **Distribución:** Paquete precompilado distribuible en formato tarball (`universal-provider-0.30.0.tgz`), instalable limpiamente con `dsh plugin --profile <perfil> add`.
