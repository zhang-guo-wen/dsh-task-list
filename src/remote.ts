import type { InvocationDescriptor, TypertCodec, TypertRemoteContribution, TypertSchema } from '@deepseek-ai/dsh-typert-protocol'
import { AUTH_METHODS, parseAuthRequest, parseAuthResponse, type AuthMethod } from './sync/oauth-validation.ts'
import { parseSyncRequest, parseSyncResponse } from './sync/validation.ts'
import { SYNC_METHODS, type SyncMethod } from './sync/dto.ts'

export const REMOTE_NAMESPACE = 'taskList'

const SYNC_METHOD_SET = new Set<string>(SYNC_METHODS)

function codec(typeSymbol: string, parse: (value: unknown) => unknown): TypertCodec {
  const schema: TypertSchema<unknown> = { parse }
  return { mode: 'strict', typeSymbol, schema, create: () => schema } as TypertCodec
}

/**
 * Legacy CRUD methods keep their passthrough codec; the 14 sync methods get a
 * closed codec so an untrusted request is validated with `parseSyncRequest` and
 * a Host result is validated with `parseSyncResponse` before it crosses the
 * wire — the closed response guard is applied on the way out, not just on the
 * way in.
 */
function descriptor(method: string): InvocationDescriptor {
  const owner = `@guowenzhang/dsh-task-list#${REMOTE_NAMESPACE}/${method}`
  const auth = AUTH_METHODS.includes(method as AuthMethod)
  const sync = SYNC_METHOD_SET.has(method)
  const requestParse = auth ? (value: unknown) => parseAuthRequest(method as AuthMethod, value) : sync
    ? (value: unknown) => parseSyncRequest(method as SyncMethod, value).request
    : (value: unknown) => value
  const resultParse = auth ? (value: unknown) => parseAuthResponse(method as AuthMethod, value) : sync
    ? (value: unknown) => parseSyncResponse(method as SyncMethod, value).response
    : (value: unknown) => value
  return {
    id: owner, service: REMOTE_NAMESPACE, namespace: REMOTE_NAMESPACE, method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: codec(`${owner}:request`, requestParse) }],
    result: codec(`${owner}:result`, resultParse),
  }
}

export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: '@guowenzhang/dsh-task-list',
  descriptors: [
    'capabilities', 'listTasks', 'createTask', 'updateTask', 'deleteTask', 'readTaskAttachments',
    'createSubtask', 'updateSubtask', 'deleteSubtask', 'calculateStatistics',
    'startStatistics', 'getStatisticsRun', 'cancelStatistics',
    ...SYNC_METHODS, ...AUTH_METHODS,
  ].map(descriptor),
}
