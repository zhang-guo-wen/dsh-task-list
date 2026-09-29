import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { isAbsolute, join } from 'node:path'
import { TaskStore } from './store.ts'
import { TaskService } from './task-service.ts'

export { TaskStore } from './store.ts'
export type * from './types.ts'

export const name = 'task-list'
export const inject = []
export interface Config { file?: string; dshHome?: string }
export const Config = z.object({
  file: z.string().description('Optional absolute task SQLite path'),
  dshHome: z.string().description('Harness data home override'),
})

export function apply(ctx: Context, config: Config = {}): void {
  if (config.file && !isAbsolute(config.file)) throw new Error('task-list file path must be absolute')
  const file = config.file ?? join(resolveDshHome(config.dshHome), 'task-list', 'tasks.sqlite')
  const store = new TaskStore(file)
  ctx.effect(() => () => store.close(), 'task-list: SQLite close')
  new TaskService(ctx, store)
}
