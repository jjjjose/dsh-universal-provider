import { rmSync } from 'node:fs'

// Resolve from this script so cleanup is independent of the caller's cwd.
rmSync(new URL('../lib/', import.meta.url), { recursive: true, force: true })
