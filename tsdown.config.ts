import { defineConfig } from 'tsdown'
import ts from 'typescript'

const DECORATOR_SYNTAX = /^\s*@[A-Za-z_$][\w$]*/m

const decoratorLoweringPlugin = {
  name: 'lower-decorators',
  transform(code: string, id: string) {
    const file = id.split('?', 1)[0] ?? id
    if (!/\.[cm]?tsx?$/.test(file) || !DECORATOR_SYNTAX.test(code)) return
    const result = ts.transpileModule(code, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2024,
        module: ts.ModuleKind.ESNext,
        sourceMap: true,
      },
    })
    return {
      code: result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
      map: result.sourceMapText,
    }
  },
}

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/types.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: false,
    plugins: [decoratorLoweringPlugin],
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    outputOptions: {
      entryFileNames: 'client.js',
    },
    banner: 'window.__ModuleLoader__.load({ id: "universal-provider", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
])
