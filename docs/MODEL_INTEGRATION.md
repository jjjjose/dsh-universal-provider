# Modelos y esfuerzo en DeepSeek Harness

Contrato verificado con `@deepseek-ai/dsh-llm` **0.2.1-alpha.2**.

- `UniversalLlmAdapter` extiende el `LlmAdapter` del host; las dependencias
  `@deepseek-ai/*` permanecen externas en el bundle del servidor.
- `listModels(provider)` consulta los modelos reales de CLIProxyAPI para todas
  las cuentas y endpoints. El RPC de configuración utiliza el mismo adaptador.
- Cuando cambian los modelos o sus metadatos, el adaptador llama al registro
  `replace(['universal-chat-provider'])`. DSH emite `llm/adapters-updated`, que
  refresca el selector nativo. No se emiten eventos desde la interfaz del plugin.
- OAuth completado, eliminación de cuenta y guardado de endpoint actualizan el
  catálogo en el servidor. Abrir la página o pulsar «Actualizar modelos» también
  consulta y publica cambios. Un catálogo vacío elimina los modelos anunciados.
- `resolveModel` publica `reasoning.efforts` desde `supported_reasoning_levels`.
  Conserva los IDs del proveedor, incluido `off`, y solo declara un valor
  predeterminado si el proveedor lo informa y pertenece a esa lista. Sin
  metadatos no se inventan niveles de esfuerzo.
- DSH valida la selección; el transporte envía `reasoningEffort` como
  `reasoning.effort` junto al ID exacto del modelo.

## Verificación

`tests/integration.test.ts` usa el servicio `LlmRuntime` real y un servidor HTTP
aislado: comprueba catálogo, notificaciones sin bucles, retirada de modelos,
metadatos de esfuerzo, rechazo de esfuerzos inválidos y envío de `off`.
Las pruebas no sustituyen la comprobación visual en el Desktop instalado.

## Referencias

- [Guía oficial de adaptadores](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/practice/llm-adapter.md)
- [Servicio LLM oficial](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm/src/index.ts)
- Referencia local: `dsh-agy/src/index.ts`, publicación del catálogo mediante
  el handle de registro, y `dsh-agy/docs/ARCHITECTURE.md`.
