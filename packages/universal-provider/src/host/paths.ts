import { dshCachePath, dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { join } from 'node:path'

export interface ProviderPaths {
  profileRoot: string
  authDir: string
  configPath: string
  logPath: string
  lockPath: string
  binDir: string
  cacheDir: string
}

export function resolveProviderPaths(profileId: string): ProviderPaths {
  const sanitizedProfile = profileId.replace(/[^a-zA-Z0-9._-]/g, '_') || 'default'
  const profileRoot = dshHomePath('universal-provider', sanitizedProfile)
  const cacheDir = dshCachePath('universal-provider')
  return {
    profileRoot,
    authDir: join(profileRoot, 'auth'),
    configPath: join(profileRoot, 'config.yaml'),
    logPath: join(profileRoot, 'server.log'),
    lockPath: join(profileRoot, 'server.lock'),
    binDir: join(cacheDir, 'bin'),
    cacheDir,
  }
}
