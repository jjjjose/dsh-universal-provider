import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const DEFAULT_MODEL_CONTEXT = 1000000

export class ModelContextSettings {
  private pending: Promise<unknown> = Promise.resolve()

  constructor(private readonly path?: string) {}

  private async read(): Promise<Record<string, number>> {
    if (!this.path) return {}
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'))
      return Object.fromEntries(Object.entries(data).filter(([, value]) =>
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0)) as Record<string, number>
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw error
    }
  }

  async all(): Promise<Record<string, number>> {
    await this.pending
    return this.read()
  }

  async get(model: string): Promise<number> {
    const values = await this.all()
    return Object.hasOwn(values, model) ? values[model]! : DEFAULT_MODEL_CONTEXT
  }

  async set(model: string, contextWindow: number): Promise<void> {
    if (!model.trim() || !Number.isSafeInteger(contextWindow) || contextWindow <= 0)
      throw new Error('El contexto debe ser un número entero positivo de tokens.')
    const task = this.pending.then(async () => {
      if (!this.path) throw new Error('No se ha configurado el almacenamiento de contextos.')
      const values = { ...await this.read(), [model]: contextWindow }
      await mkdir(dirname(this.path), { recursive: true })
      await writeFile(`${this.path}.tmp`, JSON.stringify(values, null, 2), 'utf8')
      await rename(`${this.path}.tmp`, this.path)
    })
    this.pending = task.catch(() => {})
    await task
  }
}
