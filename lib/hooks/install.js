// Skill, Claude Code hook, and launcher installation & status inspection.

import fs from 'node:fs';
import path from 'node:path';
import { skillDestination } from './skill-targets.js';
import { TOOL_MATCHER } from './runner.js';
import {
  ACTIVITY_HOOK_EVENT,
  ALL_HOOK_EVENTS,
  HOOK_EVENTS,
  editClaudeSettings,
  hookCommand,
  isOurHook,
  launcherBody,
  launcherDir,
  launcherName,
  resolveNodeBinary,
  settingsPathFor,
  withoutOurHooks,
} from './settings.js';

/** Installation evidence only; a file on disk does not prove an Agent loaded it. */
export function integrationStatus(cwd = process.cwd()) {
  const errors = [];
  const skill = (agent) => Object.fromEntries(['project', 'user'].map((scope) => [
    scope, fs.existsSync(path.join(skillDestination({ scope, cwd, agent }), 'SKILL.md')),
  ]));
  const hooks = Object.fromEntries(['project', 'user'].map((scope) => {
    const file = settingsPathFor({ scope, cwd });
    if (!fs.existsSync(file)) return [scope, []];
    try {
      const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
      return [scope, ALL_HOOK_EVENTS.filter((event) =>
        Array.isArray(settings.hooks?.[event]) && settings.hooks[event].some((entry) => isOurHook(entry, event)))];
    } catch (error) {
      errors.push({ file, error: error.message });
      return [scope, []];
    }
  }));
  return {
    claude: { skill: skill('claude'), hooks },
    codex: { skill: skill('codex') },
    errors,
  };
}

export function installHooks({ cwd = process.cwd(), write = false, cli, scope = 'project', withActivity = false }) {
  return editClaudeSettings({ scope, cwd, write }, (hooks) => {
    for (const ev of withActivity ? ALL_HOOK_EVENTS : HOOK_EVENTS) {
      const cmd = hookCommand(cli, ev);
      if (!hooks[ev]) hooks[ev] = [];
      const arr = hooks[ev];
      const mine = arr.filter((entry) => isOurHook(entry, ev));
      if (!mine.length) {
        arr.push(ev === ACTIVITY_HOOK_EVENT
          ? { matcher: TOOL_MATCHER, hooks: [{ type: 'command', shell: 'bash', command: cmd }] }
          : { hooks: [{ type: 'command', shell: 'bash', command: cmd }] });
      } else {
        // Reinstall also refreshes commands and matchers: the CLI or node binary
        // may have moved since the last install, and a stale path fails silently.
        for (const entry of mine) {
          entry.matcher = ev === ACTIVITY_HOOK_EVENT ? TOOL_MATCHER : entry.matcher;
          entry.hooks = (entry.hooks || []).filter((h) => !(h.type === 'command' && isOurHook(h, ev)));
          entry.hooks.push({ type: 'command', shell: 'bash', command: cmd });
        }
      }
    }
    // Activity capture is opt-in. A plain install also retires one an older
    // version installed by default, leaving unrelated hooks untouched.
    const removed = [];
    if (!withActivity && hooks[ACTIVITY_HOOK_EVENT]) {
      const entries = hooks[ACTIVITY_HOOK_EVENT];
      const kept = withoutOurHooks(entries, ACTIVITY_HOOK_EVENT);
      if (entries.some((entry) => isOurHook(entry, ACTIVITY_HOOK_EVENT))) removed.push(ACTIVITY_HOOK_EVENT);
      if (kept.length) hooks[ACTIVITY_HOOK_EVENT] = kept;
      else delete hooks[ACTIVITY_HOOK_EVENT];
    }
    return { withActivity, removed };
  });
}

export function uninstallHooks({ cwd = process.cwd(), write = false, scope = 'project' }) {
  return editClaudeSettings({ scope, cwd, write }, (hooks) => {
    for (const ev of ALL_HOOK_EVENTS) {
      const kept = withoutOurHooks(hooks[ev] || [], ev);
      if (kept.length) hooks[ev] = kept;
      else delete hooks[ev];
    }
  });
}

/** Install the complete Skill package, leaving unrelated destination files untouched. */
function installSkillTree(source, destination, cli) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourceFile = new URL(`${encodeURIComponent(entry.name)}${entry.isDirectory() ? '/' : ''}`, source);
    const destinationFile = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      installSkillTree(sourceFile, destinationFile, cli);
    } else if (entry.name.endsWith('.md')) {
      const content = fs.readFileSync(sourceFile, 'utf8');
      fs.writeFileSync(destinationFile, content.replace(/__PINWHY_CLI__/g, () => cli));
    } else {
      fs.copyFileSync(sourceFile, destinationFile);
    }
  }
}

export function installSkill({ cwd = process.cwd(), cli, scope = 'project', agent = 'claude' }) {
  const dir = skillDestination({ scope, cwd, agent });
  installSkillTree(new URL('../../skills/pinwhy/', import.meta.url), dir, cli);
  const note = '\nInstalled files do not mean the current host has loaded them; refresh through the host or start a new session.';
  return `Installed Skill (${agent}/${scope}): ${path.join(dir, 'SKILL.md')}\nCLI: "${resolveNodeBinary()}" "${cli}"${note}`;
}

/** Inspect installed bytes without executing commands or returning their contents. */
export function inspectIntegrationPaths({ cwd = process.cwd(), cli }) {
  const entries = [];
  const readInstalled = (entry, inspect) => {
    try {
      const content = fs.readFileSync(entry.file, 'utf8');
      inspect(content);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      entries.push({ ...entry, state: 'invalid', error: /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'INVALID_CONTENT' });
    }
  };
  for (const scope of ['project', 'user']) {
    for (const agent of ['claude', 'codex']) {
      const entry = { kind: 'skill', agent, scope, file: path.join(skillDestination({ scope, cwd, agent }), 'SKILL.md') };
      readInstalled(entry, (content) => {
        const state = content.includes('__PINWHY_CLI__') ? 'unexpanded'
          : content.includes(`node "${cli}"`) ? 'current' : 'stale';
        entries.push({ ...entry, state });
      });
    }
    const hook = { kind: 'hook', agent: 'claude', scope, file: settingsPathFor({ scope, cwd }) };
    readInstalled(hook, (content) => {
      const settings = JSON.parse(content);
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('invalid settings');
      if (settings.hooks != null && (typeof settings.hooks !== 'object' || Array.isArray(settings.hooks))) throw new Error('invalid hooks');
      for (const event of ALL_HOOK_EVENTS) {
        const hooks = settings.hooks?.[event];
        if (hooks == null) continue;
        if (!Array.isArray(hooks)) throw new Error('invalid event hooks');
        for (const group of hooks) {
          if (!isOurHook(group, event)) continue;
          const commands = Array.isArray(group?.hooks) ? group.hooks.filter((handler) => isOurHook(handler, event)) : [];
          const state = commands.some((handler) => handler.command?.includes('__PINWHY_CLI__')) ? 'unexpanded'
            : commands.length && commands.every((handler) => handler.type === 'command' && handler.shell === 'bash' && handler.command === hookCommand(cli, event)) ? 'current' : 'stale';
          entries.push({ ...hook, event, state });
        }
      }
    });
    const launcher = { kind: 'launcher', agent: null, scope, file: path.join(launcherDir(scope, cwd), launcherName()) };
    readInstalled(launcher, (content) => entries.push({ ...launcher, state: content === launcherBody(cli) ? 'current' : 'stale' }));
  }
  return entries;
}

/**
 * A `pinwhy` launcher on PATH, so the agent can call `pinwhy fact "..."` the way the
 * skill describes instead of typing a long node path.
 */
export function installLauncher({ cli, scope = 'user' }) {
  const dir = launcherDir(scope);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, launcherName());
  fs.writeFileSync(target, launcherBody(cli), { mode: 0o755 });
  const onPath = (process.env.PATH || '').split(path.delimiter).includes(dir);
  return { file: target, dir, onPath };
}
