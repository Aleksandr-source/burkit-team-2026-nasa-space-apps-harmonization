# Secrets and deployment

## What belongs in GitHub

Source code, reproducible study inputs, reports, screenshots and `.env.example`.
The repository does **not** need the team's NASA key to build, test or open bundled cases.

## What stays private

Keep the actual `.env` file only on your local machine. For public hosting, put `FIRMS_MAP_KEY` in the hosting provider's server-side environment/secrets settings. Do not upload `.env`, put a key in a GitHub Actions workflow, or create a browser-visible `VITE_` variable.

GitHub Actions in this repository runs without secrets. A GitHub Actions secret is not automatically available to a separately hosted application. Configure the secret at the actual application host.

If a key is ever committed, deleting the file does not remove it from history; replace the exposed key and clean the history as appropriate. Never paste the key into a public issue or deployment log.

## Current deployment boundary

This repository contains a runnable local application, not a configured public hosting account. `npm ci`, `npm run build`, and `npm start` serve the application locally at `127.0.0.1:3001` (or the configured `PORT`). The Node server is required for `/api/firms` and `/api/search`.

GitHub Pages serves static files and cannot run these server routes. Full public deployment needs a Node-capable host, a host-configurable listen address (currently hardcoded to loopback), a server-side NASA secret, request limits and HTTP compression. Choose the host before changing its deployment configuration. No public application URL or completed deployment is claimed here.
