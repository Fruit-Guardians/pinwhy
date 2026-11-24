# pinwhy-cli

Thin npm executable wrapper for [Pinwhy](https://github.com/Fruit-Guardians/pinwhy). Requires Node.js >= 18.

## Install

```sh
npm install -g pinwhy-cli
pinwhy --version
pinwhy-ultra --version
```

`pinwhy-cli` pins the matching `pinwhy` runtime version and delegates directly to its CLI. Install either `pinwhy` or `pinwhy-cli` globally; both expose the `pinwhy` and `pinwhy-ultra` binaries.

## Quick Start

```sh
cd /path/to/project
pinwhy init --title "My project"
pinwhy skill install
pinwhy serve --open
```

Installing the package does not initialize projects, install hooks, or start background services automatically. Integrations can query `pinwhy capabilities --json` to resolve runtime CLI and Skill paths under `resources`.

## Related Packages

- `pinwhy`: Complete CLI, built Web workspace, and Agent Skills
- `pinwhy-core`: Zero-dependency Node.js SDK
- `dsh-pinwhy`: DeepSeek Harness plugin

## License

MIT
