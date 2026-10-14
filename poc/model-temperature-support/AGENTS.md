# Agent Guidance

- Before running Node.js commands, including package scripts, compare `node --version` with the required version in `package.json`.
- If the versions differ and `nvm` is available, attempt to switch to the required version with `nvm use`. If it is not installed, attempt `nvm install` for that version, then switch to it.
- Confirm the active version with `node --version` before running Node.js commands. If switching is unavailable or unsuccessful, report the version mismatch.
- A version switch is not required when only reading or editing plans and source files and no Node.js commands will be run.
- Keep the POC self-contained: do not import Zoo Code application/source code or declare dependencies on Zoo Code workspace packages. Zoo Code may be consulted as reference material, but the POC owns its provider/model configuration and request implementations. Third-party packages must be declared by the POC itself.
- Provider adapters must send requests directly to the selected gateway; do not route test requests through Zoo Code provider handlers.
