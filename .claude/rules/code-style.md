# Code Style Rules

These rules are auto-loaded by Claude Code at the start of every session.

## TypeScript

- Strict mode is always enabled — do not add `@ts-ignore` or `@ts-expect-error` without justification
- Use `.js` extensions in all import paths (e.g., `import { foo } from "./bar.js"`)
- Prefer `const` over `let`; never use `var`
- Use explicit return types on exported functions
- Use `interface` for object shapes; use `type` for unions and aliases

## Formatting

- 2-space indentation
- Insert final newline in all files
- Trim trailing whitespace
- Max line width guideline: 100 characters (not enforced by tooling, but preferred)

## Error Handling

- Use custom error classes (extend `Error`, set `this.name`)
- Error messages must be user-friendly when they reach Discord (no stack traces)
- Catch specific error types; avoid bare `catch` when possible

## Testing

- Test framework: Vitest
- Test files live in `tests/` at the project root
- Naming convention: `*.test.ts`
- Every public function in `src/lib/` should have corresponding tests
