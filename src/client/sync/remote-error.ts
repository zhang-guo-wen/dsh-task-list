import type { RemoteErrorCode, RemoteErrorDetailsMap } from '@deepseek-ai/dsh-typert-protocol'

/** Browser-local structural error; the Host discriminates by marker/code, never instanceof.
 * Avoid loading the host protocol entry (which imports Cordis) through the browser module table. */
export class RemoteError<C extends RemoteErrorCode = RemoteErrorCode> extends Error {
  readonly isDSHRemoteError = true
  constructor(readonly code: C, message: string, readonly details: RemoteErrorDetailsMap[C], options?: ErrorOptions) {
    super(message, options)
    this.name = 'RemoteError'
  }
}
