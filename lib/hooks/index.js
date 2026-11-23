// Claude Code integration. Hooks write raw activity; the Agent writes semantic
// logic nodes. Keeping those layers separate prevents the pinwhy from
// becoming a terminal transcript.

export {
  ACTIVITY_HOOK_EVENT,
  HOOK_EVENTS,
  resolveNodeBinary,
  shellQuote,
} from './settings.js';

export {
  inspectIntegrationPaths,
  installHooks,
  installLauncher,
  installSkill,
  integrationStatus,
  uninstallHooks,
} from './install.js';

export {
  redactSensitive,
  runHook,
} from './runner.js';
