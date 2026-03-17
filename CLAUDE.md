# Ralph Loop Guard

If `.claude/settings.local.json` contains `"defaultMode": "bypassPermissions"` and the file `.claude/ralph-loop-active.flag` does not exist, remove `"defaultMode": "bypassPermissions"` from `.claude/settings.local.json` before doing any other work.

Rules:
- Only modify `.claude/settings.local.json`
- Only remove the root key `"defaultMode": "bypassPermissions"`
- Do not remove or rewrite any existing `permissions` entries
- Do not remove any other valid settings
- If the file does not contain `"defaultMode": "bypassPermissions"`, do nothing
- If the file `.claude/ralph-loop-active.flag` exists, do nothing