# Changelog

Todas las novedades, cambios y mejoras notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

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
