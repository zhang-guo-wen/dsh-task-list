// Test-only: reuse the actual host component sources rather than mocking their visual behavior.
// The published package is an external ModuleLoader dependency in production; its monolithic
// npm entry expects the host's complete dependency graph, which standalone tests do not have.
export { Button } from '../../../deepseek-harness/packages/client/ui-primitives/src/Button.tsx'
export { Toast } from '../../../deepseek-harness/packages/client/ui-primitives/src/Toast.tsx'
export { Tooltip } from '../../../deepseek-harness/packages/client/ui-primitives/src/Tooltip.tsx'
export { FileTypeIcon } from '../../../deepseek-harness/packages/client/ui-primitives/src/FileTypeIcon.tsx'
export { fileSizeText } from '../../../deepseek-harness/packages/client/ui-primitives/src/file-size.ts'
export { IconPaperclipOutlineRegular, IconCloseOutlineRegular } from '../../../deepseek-harness/packages/client/ui-primitives/src/icons/index.tsx'
