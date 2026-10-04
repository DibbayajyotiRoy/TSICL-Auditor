# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Deploying on Vercel

1. `git init && git add -A && git commit -m "init"`, create a GitHub repo, `git remote add origin <url> && git push -u origin main`.
2. Import the repo in Vercel (framework Vite is auto-detected via `vercel.json`).
3. Set env vars in Vercel → Project → Settings → Environment Variables (Bedrock path):
   `AWS_REGION` (default `us-east-1`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
   optional `AWS_SESSION_TOKEN` / `BEDROCK_MODEL_ID` (default `amazon.nova-micro-v1:0`).
   Or set `ANTHROPIC_API_KEY` instead to use the Anthropic fallback (Bedrock takes precedence).
   Without any key, `/api/ask` returns 503 and the app uses its offline answers.
4. Deploy — `/api/ask` runs as a serverless function (`api/ask.ts`), SPA routes fall back to `index.html`.
# TSICL-Auditor
