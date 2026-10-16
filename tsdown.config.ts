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

// `npm run build` cleans lib and generates Typert before either bundle starts.
// Both outputs share lib with those generated inputs, so neither may clean it.
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
    deps: { neverBundle: [/^@deepseek-ai\//] },
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
    // `react` is a platform seed word resolved by the DSH client module table,
    // so it must stay a runtime require. `zod` is NOT seeded: it must be
    // inlined or the web boot fails with "require(\"zod\") missed the module table".
    deps: {
      neverBundle: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
      alwaysBundle: ['zod'],
    },
    outputOptions: {
      entryFileNames: 'client.js',
    },
    banner: 'window.__ModuleLoader__.load({ id: "universal-provider", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
])
