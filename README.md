# Universal Chat Provider para DeepSeek Harness

Plugin oficial empaquetado para DeepSeek Harness (DSH v0.2.1-alpha.2 y versiones compatibles), que permite conectar cuentas OAuth (Claude, Codex, Antigravity, Kimi, xAI Grok, Devin, Meta Muse) y endpoints compatibles con OpenAI para utilizarlos de forma transparente en el chat nativo de DeepSeek Harness.

El resultado es un paquete distribuible precompilado (`.tgz`) que se integra de manera limpia a través de los contratos nativos de Cordis y DSH (`dsh.bundle`, `ctx.llm.registerAdapter`, `dsh-typert-loader` y `settings.section`), sin modificar el core de la aplicación ni ejecutar servidores de chat paralelos.

---

## 1. Características Principales y Paridad

| Capacidad | Estado | Detalle |
|---|---|---|
| **Ruta del Adaptador LLM** | ✅ Nativo | Registrado bajo `universal-chat-provider` en `ctx.llm`. |
| **Streaming y Respuestas** | ✅ Completo | Traducción hacia `/v1/responses` SSE con deltas de texto, pensamiento (`thinking`), uso de tokens y finalización balanceada. |
| **Llamadas a Herramientas** | ✅ Nativo | Las herramientas se definen, validan y ejecutan bajo las políticas y sandboxing de DSH. |
| **Cuentas OAuth** | ✅ 7 Proveedores | OpenAI Codex, Anthropic Claude, Google Antigravity, Moonshot Kimi, xAI Grok, Devin y Meta Muse. |
| **Endpoints OpenAI Compatibles** | ✅ Soportado | Soporte para Ollama, vLLM, LMStudio, OpenRouter o endpoints corporativos con clave write-only. |
| **Cuotas de Proveedores** | ✅ 5 Proveedores | Monitoreo de ventanas de uso y cálculo de resets para Codex (5h/7d), Claude, Antigravity (por modelo), Grok y Kimi. |
| **Panel de Gestión** | ✅ Nativo | Integrado como pestaña en `Settings` (`settings.section`) con slots del cliente web y tokens de tema. |
| **Supervisor de CLIProxyAPI** | ✅ Supervisado | Modo **Managed** (descarga con hash SHA-256, lock de propietario, loopback `127.0.0.1`, proceso controlado por `ctx.subprocess`) y modo **External** (conexión remota sin tocar binarios). |
| **Modelos Auxiliares** | ✅ Integrado | Configuración de títulos mediante `configEditor`, compactación nativa en `dsh-compaction-basic` y borrador de commits sobre `git diff --cached`. |

---

## 2. Instalación y Desinstalación

### Requisitos
- DeepSeek Harness `0.2.1-alpha.2` o posterior.
- Node.js 22+ y pnpm instalados (o usando las herramientas empaquetadas en `$DSH_HOME/dsh-runtimes/`).

### Instalación en un perfil
El plugin se distribuye como un archivo tarball precompilado (`universal-provider-1.0.0.tgz`). Para instalarlo en el perfil deseado (por ejemplo, `default` o un perfil personalizado):

```bash
dsh plugin --profile <tu-perfil> add /ruta/a/universal-provider-1.0.0.tgz
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

La configuración se gestiona en el panel de **Settings → Universal Provider** o mediante la capa de parches del perfil en `cordis.patch.yml`:

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

Al abrir **Settings** en la interfaz web de DeepSeek Harness, se dispondrá de la sección **Universal Provider**:

1. **Estado:** Muestra si el servidor está listo (`ready`), el modo activo, el puerto y el conteo de peticiones activas.
2. **Cuentas OAuth:**
   - Selecciona el proveedor (ej: *OpenAI Codex*, *Anthropic Claude*, *Google Antigravity*).
   - Haz clic en *Iniciar Inicio de Sesión*. Se abrirá la URL oficial del proveedor en tu navegador.
   - Tras completar la autenticación, el servidor enlazará la cuenta y podrás verla listada con su correo y etiquetas.
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

---

## 7. Licencia y Atribuciones

- Licencia MIT.
- Se preservan las atribuciones y referencias originales de [vscode-universal-chat-provider](https://github.com/maxdewald/vscode-universal-chat-provider) bajo licencia MIT.
- El repositorio upstream permanece en `upstream/` como referencia inmutable sin modificaciones.
