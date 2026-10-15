import type { Context } from '@deepseek-ai/cordis'

export interface CommitDraftResult {
  hasStagedChanges: boolean
  message?: string
  draft?: string
}

export async function generateCommitDraft(
  ctx: Context,
  cwd: string,
  model = 'universal-mock',
  signal?: AbortSignal,
): Promise<CommitDraftResult> {
  signal?.throwIfAborted()

  // 1. Get staged diff using ctx.subprocess
  let diffOutput = ''
  const subprocess = (ctx as any).subprocess
  if (subprocess && typeof subprocess.spawn === 'function') {
    const handle = subprocess.spawn({
      argv: ['git', 'diff', '--cached'],
      cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 64 * 1024 },
        stderr: { maxBytes: 16 * 1024 },
      },
      graceMs: 3000,
    })
    const { exitCode } = await handle.done
    if (exitCode === 0 && handle.collected?.stdout) {
      diffOutput = handle.collected.stdout.readFrom(0)?.trim() || ''
    }
  }

  if (!diffOutput) {
    return {
      hasStagedChanges: false,
      message: 'No hay cambios en stage (git diff --cached está vacío). Agrega archivos con git add antes de generar un borrador.',
    }
  }

  // 2. Call LLM to generate conventional commit draft
  const llm = (ctx as any).llm
  if (!llm) {
    throw new Error('LLM service is not available.')
  }

  const prompt = `Eres un asistente experto en Git. Genera un mensaje de commit claro, conciso y siguiendo las convenciones de Conventional Commits (feat, fix, refactor, docs, chore...) basado en el diff de cambios staged proporcionado. Responde ÚNICAMENTE con el mensaje de commit sin explicaciones ni bloques de markdown adicionales.\n\nDiff:\n${diffOutput.slice(0, 32000)}`

  let draft = ''
  for await (const chunk of llm.stream({
    provider: 'universal-chat-provider',
    model,
    messages: [
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ],
    signal,
  })) {
    if (chunk.type === 'text-delta') {
      draft += chunk.text
    }
  }

  return {
    hasStagedChanges: true,
    draft: draft.trim(),
  }
}

export async function configureAuxiliaryTitles(
  ctx: Context,
  model: string,
): Promise<void> {
  const configEditor = (ctx as any).configEditor
  if (!configEditor || typeof configEditor.edit !== 'function') return

  const entries = configEditor.entries()
  const titleEntry = entries.find((e: any) => e.name?.includes('session-title'))
  if (!titleEntry) return

  await configEditor.edit(titleEntry, (current: any) => ({
    ...current,
    provider: 'universal-chat-provider',
    model,
  }))
}

export async function configureAuxiliaryCompaction(
  ctx: Context,
  model: string,
): Promise<void> {
  const configEditor = (ctx as any).configEditor
  if (!configEditor || typeof configEditor.edit !== 'function') return

  const entries = configEditor.entries()
  const compactionEntry = entries.find((e: any) => e.name?.includes('compaction-basic'))
  if (!compactionEntry) return

  await configEditor.edit(compactionEntry, (current: any) => ({
    ...current,
    summarizationProvider: 'universal-chat-provider',
    summarizationModel: model,
  }))
}
