import type { InvocationDescriptor, TypertCodec, TypertRemoteContribution, TypertSchema } from '@deepseek-ai/dsh-typert-protocol'

export const REMOTE_NAMESPACE = 'taskList'
const passthrough: TypertSchema<unknown> = { parse: value => value }
function codec(typeSymbol: string): TypertCodec {
  return { mode: 'strict', typeSymbol, schema: passthrough, create: () => passthrough } as TypertCodec
}
function descriptor(method: string): InvocationDescriptor {
  const owner = `@guowenzhang/dsh-task-list#${REMOTE_NAMESPACE}/${method}`
  return {
    id: owner, service: REMOTE_NAMESPACE, namespace: REMOTE_NAMESPACE, method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: codec(`${owner}:request`) }],
    result: codec(`${owner}:result`),
  }
}
export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: '@guowenzhang/dsh-task-list',
  descriptors: [
    'capabilities', 'listTasks', 'createTask', 'updateTask', 'deleteTask', 'readTaskAttachments',
    'createSubtask', 'updateSubtask', 'deleteSubtask',
  ].map(descriptor),
}
