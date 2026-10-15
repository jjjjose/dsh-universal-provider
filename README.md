# Universal Chat Provider para DeepSeek Harness

Plugin oficial empaquetado para DeepSeek Harness (DSH v0.2.1-alpha.2 y versiones compatibles), que permite conectar cuentas OAuth (Claude, Codex, Antigravity, Kimi, xAI Grok, Devin, Meta Muse) y endpoints compatibles con OpenAI para utilizarlos de forma transparente en el chat nativo de DeepSeek Harness.

El resultado es un paquete distribuible precompilado (`.tgz`) que se integra de manera limpia a través de los contratos nativos de Cordis y DSH (`dsh.bundle`, `ctx.llm.registerAdapter`, `dsh-typert-loader` y `plugins.bundle.config`), sin modificar el core de la aplicación ni ejecutar servidores de chat paralelos.

---

## 1. Características Principales y Paridad

| Capacidad | Estado | Detalle |
|---|---|---|
| **Ruta del Adaptador LLM** | ✅ Nativo | Registrado bajo `universal-chat-provider` en `ctx.llm`. |
| **Streaming y Respuestas** | ✅ Completo | Traducción hacia `/v1/responses` SSE con deltas de texto, pensamiento (`thinking`), uso de tokens y finalización balanceada. |
| **Llamadas a Herramientas** | ✅ Nativo | Las herramientas se definen, validan y ejecutan bajo las políticas y sandboxing de DSH. |
| **Cuentas OAuth** | ✅ 7 Proveedores | Botones directos para ChatGPT/Codex y Google Antigravity; los demás proveedores siguen disponibles en «Otros proveedores». Admite varias cuentas por proveedor. |
| **Endpoints OpenAI Compatibles** | ✅ Soportado | Soporte para Ollama, vLLM, LMStudio, OpenRouter o endpoints corporativos con clave write-only. |
| **Cuotas de Proveedores** | ✅ 5 Proveedores | Monitoreo de ventanas de uso y cálculo de resets para Codex (5h/7d), Claude, Antigravity (por modelo), Grok y Kimi. |
| **Panel de Gestión** | ✅ Nativo | Panel propio dentro de **Plugins → Universal Provider** (`plugins.bundle.config`), con slots del cliente web y tokens de tema. |
| **Supervisor de CLIProxyAPI** | ✅ Supervisado | Modo **Managed** (descarga con hash SHA-256, lock de propietario, loopback `127.0.0.1`, proceso controlado por `ctx.subprocess`) y modo **External** (conexión remota sin tocar binarios). |
| **Modelos Auxiliares** | ✅ Integrado | Configuración de títulos mediante `configEditor`, compactación nativa en `dsh-compaction-basic` y borrador de commits sobre `git diff --cached`. |

---

## 2. Instalación y Desinstalación

### Requisitos
- DeepSeek Harness `0.2.1-alpha.2` o posterior.
- Node.js 22+ y pnpm instalados (o usando las herramientas empaquetadas en `$DSH_HOME/dsh-runtimes/`).

### Instalación desde GitHub
En el instalador de plugins de DSH, selecciona **Git repository** e introduce:

```text
https://github.com/jjjjose/dsh-universal-provider
```

También puedes instalarlo desde la CLI:

```bash
dsh plugin --profile <tu-perfil> add https://github.com/jjjjose/dsh-universal-provider
```

La raíz del repositorio es el paquete `universal-provider` y declara `dsh.bundle`.
Los artefactos precompilados de `lib/` están incluidos en el repositorio, por lo que
la instalación Git no necesita ejecutar scripts de compilación ni autorizar builds.
Para crear una distribución local, los mantenedores ejecutan `pnpm run build` antes
de empaquetar.

### Instalación en un perfil
El plugin se distribuye como un archivo tarball precompilado (`universal-provider-0.30.0.tgz`). Para instalarlo en el perfil deseado (por ejemplo, `default` o un perfil personalizado):

```bash
dsh plugin --profile <tu-perfil> add /ruta/a/universal-provider-0.30.0.tgz
```

Al iniciar DSH con ese perfil (`dsh --profile <tu-perfil>`), el plugin se activará automáticamente sin necesidad de scripts de compilación adicionales.

### Desinstalación
Para desinstalar el paquete del perfil:

```bash
dsh plugin --profile <tu-perfil> remove universal-provider
```

### Limpieza de datos y credenciales
Los datos del plugin se almacenan de forma segura y aislada:
- **Configuración y credenciales locales:** `$DSH_HOME/universal-provider/<identidad-del-perfil>/`
- **Caché de binarios y catálogos:** `$DSH_HOME/cache/universal-provider/`

Para eliminar por completo los datos persistidos tras desinstalar:
```bash
rm -rf "$DSH_HOME/universal-provider/<tu-perfil>"
rm -rf "$DSH_HOME/cache/universal-provider"
```

---

## 3. Configuración y Modos de Ejecución

La configuración y gestión de cuentas se realizan desde **Plugins → Universal Provider**. Los parámetros del servidor también pueden definirse en la capa de parches del perfil `cordis.patch.yml`:

```yaml
- insert:
    - id: universal-provider
      name: 'universal-provider'
      config:
        serverMode: 'managed'        # 'managed' o 'external'
        externalUrl: 'http://127.0.0.1:8317'
        port: 8317
        serverVersion: 'latest'     # Mínimo 8.0.3
        requestLogging: false
```

### Modo Managed (Recomendado)
- Descarga bajo demanda el binario oficial de `CLIProxyAPI` verificado con SHA-256 desde GitHub Releases.
- Se ejecuta exclusivamente en `127.0.0.1`, en un puerto libre, con acceso remoto deshabilitado (`allow-remote: false`) y claves generadas aleatoriamente (`32 bytes hex`).
- El ciclo de vida es administrado por `ctx.subprocess` sin procesos detached y respetando el drenaje de peticiones al descargar o recargar el plugin.
- Protección con lock exclusivo (`server.lock`) para evitar colisiones entre instancias.

### Modo External
- Permite conectar DSH a un servidor CLIProxyAPI que ya esté corriendo en una máquina local o remota.
- No descarga binarios ni ejecuta procesos en segundo plano. Requiere configurar la URL base y las claves correspondientes en `ctx.credentials`.

---

## 4. Uso del Panel de Gestión

En **Plugins**, abre los detalles de **Universal Provider**. El panel de gestión aparece debajo de la descripción del plugin; las cuentas OAuth se muestran al entrar:

1. **Estado:** Muestra si el servidor está listo (`ready`), el modo activo, el puerto y el conteo de peticiones activas.
2. **Cuentas OAuth:**
   - Haz clic en *Conectar Google Antigravity* o *Conectar ChatGPT / OpenAI Codex*; los demás proveedores OAuth compatibles están en *Otros proveedores*.
   - Se abre el flujo oficial en el navegador. Si el navegador bloquea la ventana, usa el enlace manual mostrado en el panel.
   - La sección espera la confirmación, permite cancelar el flujo y muestra la cuenta enlazada. Puedes repetirlo para registrar varias cuentas del mismo proveedor.
   - Al completarse el inicio de sesión, Universal Provider actualiza la lista de cuentas y consulta los modelos mediante el registro LLM nativo de DSH; selecciónalos desde el selector de modelos.
3. **Endpoints OpenAI Compatibles:**
   - Permite agregar endpoints locales (como Ollama en `http://localhost:11434/v1`) con alias y modelos personalizados.
4. **Cuotas:**
   - Muestra el porcentaje restante y el tiempo estimado para el reinicio de las cuotas de 5 horas y semanales.
5. **Diagnóstico:**
   - Visor de los últimos eventos del servidor con redacción estricta de tokens Bearer, API Keys y secretos.

---

## 5. Selección de Modelos y Modelos Auxiliares

### En el Chat
Una vez que el proveedor descubra los modelos disponibles a través de CLIProxyAPI (o uses el modelo universal predeterminado `universal-chat`), podrás seleccionarlos directamente desde el selector de modelos nativo en la barra del compositor de DSH.

### Títulos de Sesión
Puedes configurar el generador de títulos existente en DSH para utilizar un modelo del Universal Provider ejecutando la acción desde el panel o configurando `dsh-session-title-first-prompt-llm` mediante `configEditor`.

### Compactación de Contexto
El adaptador se integra con `@deepseek-ai/dsh-compaction-basic`: configurando `summarizationProvider: 'universal-chat-provider'` y el modelo deseado, las sesiones largas se resumirán conservando el prefijo cálido del historial.

### Borrador de Commits
La operación `generateCommitDraft` analiza los cambios en stage (`git diff --cached`) usando la ejecución sandboxed de DSH y genera un mensaje con formato Conventional Commits. No realiza staging ni crea commits automáticos; si no hay archivos en stage, informa al usuario sin llamar al modelo.

---

## 6. Pruebas y Verificación

El proyecto incluye una suite de pruebas automatizadas con Vitest que cubre el 100% de los módulos esenciales:
- **Flujos SSE y ensamble de streaming:** Bloques balanceados, deltas, deltas de pensamiento y llamadas a herramientas (`tests/sse.test.ts`).
- **Formato y cálculo de cuotas:** Normalización y conteos de reinicio (`tests/quota.test.ts`).
- **Citas Codex:** Sustitución de glifos privados por enlaces Markdown válidos (`tests/citations.test.ts`).
- **Catálogo de modelos:** Emparejamiento por slugs y sufijos (`tests/catalog.test.ts`).
- **Supervisor de servidor:** Generación de configuración segura y leases de peticiones (`tests/server.test.ts`).
- **Métodos RPC Remote:** Verificación de las 11 operaciones del servicio (`tests/service.test.ts`).
- **Modelos auxiliares:** Generación de commit drafts y edición segura de configuración (`tests/auxiliary.test.ts`).
- **Integración con Mock CLIProxyAPI:** Simulación end-to-end de servidor HTTP/SSE (`tests/mock-server.test.ts`).
- **Integración con Cordis:** Montaje y ciclo de vida en contexto Cordis (`tests/integration.test.ts`).

Para ejecutar las pruebas:
```bash
pnpm test
```
