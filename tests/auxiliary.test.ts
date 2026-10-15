import { describe, expect, it } from 'vitest'
import {
  generateCommitDraft,
  configureAuxiliaryTitles,
  configureAuxiliaryCompaction,
} from '../src/host/auxiliary.ts'

describe('Auxiliary Models and Commits', () => {
  it('returns hasStagedChanges: false without calling model when diff is empty', async () => {
    let modelCalled = false
    const mockCtx = {
      subprocess: {
        spawn: () => ({
          done: Promise.resolve({ exitCode: 0 }),
          collected: { stdout: { readFrom: () => '' } },
        }),
      },
      llm: {
        stream: async function* () {
          modelCalled = true
          yield { type: 'text-delta', text: 'feat: something' }
        },
      },
    } as any

    const result = await generateCommitDraft(mockCtx, '/workspace')
    expect(result.hasStagedChanges).toBe(false)
    expect(result.message).toContain('No hay cambios en stage')
    expect(modelCalled).toBe(false)
  })

  it('generates conventional commit draft when staged changes exist', async () => {
    let promptReceived = ''
    const mockCtx = {
      subprocess: {
        spawn: () => ({
          done: Promise.resolve({ exitCode: 0 }),
          collected: {
            stdout: {
              readFrom: () => 'diff --git a/file.ts b/file.ts\n+console.log("hello")',
            },
          },
        }),
      },
      llm: {
        stream: async function* (options: any) {
          promptReceived = options.messages[0].content[0].text
          yield { type: 'text-delta', text: 'feat(core): add hello log' }
        },
      },
    } as any

    const result = await generateCommitDraft(mockCtx, '/workspace')
    expect(result.hasStagedChanges).toBe(true)
    expect(result.draft).toBe('feat(core): add hello log')
    expect(promptReceived).toContain('Conventional Commits')
  })

  it('configures session titles using configEditor without altering other fields', async () => {
    let savedConfig: any = null
    const mockTitleEntry = {
      name: '@deepseek-ai/dsh-session-title-first-prompt-llm',
      options: {},
    }
    const mockCtx = {
      configEditor: {
        entries: () => [mockTitleEntry],
        edit: async (_entry: any, mutate: (c: any) => any) => {
          savedConfig = mutate({
            maxInputBytes: 4096,
            maxOutputTokens: 4096,
            targetWords: 5,
            provider: 'deepseek-official',
            model: 'deepseek-flash',
          })
        },
      },
    } as any

    await configureAuxiliaryTitles(mockCtx, 'claude-3-7-sonnet')
    expect(savedConfig.provider).toBe('universal-chat-provider')
    expect(savedConfig.model).toBe('claude-3-7-sonnet')
    expect(savedConfig.maxInputBytes).toBe(4096)
    expect(savedConfig.targetWords).toBe(5)
  })

  it('configures compaction using configEditor without altering thresholdRatio', async () => {
    let savedConfig: any = null
    const mockCompactionEntry = {
      name: '@deepseek-ai/dsh-compaction-basic',
      options: {},
    }
    const mockCtx = {
      configEditor: {
        entries: () => [mockCompactionEntry],
        edit: async (_entry: any, mutate: (c: any) => any) => {
          savedConfig = mutate({
            thresholdRatio: 0.8,
            headroomTokens: 65536,
          })
        },
      },
    } as any

    await configureAuxiliaryCompaction(mockCtx, 'gpt-4o')
    expect(savedConfig.summarizationProvider).toBe('universal-chat-provider')
    expect(savedConfig.summarizationModel).toBe('gpt-4o')
    expect(savedConfig.thresholdRatio).toBe(0.8)
    expect(savedConfig.headroomTokens).toBe(65536)
  })
})
