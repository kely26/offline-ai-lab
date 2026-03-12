# Hackloi AI Cyber Lab

Hackloi AI Cyber Lab is a local-first AI workstation that combines coding assistance, scan analysis, multi-agent workflows, and cybersecurity tooling in one Tauri desktop application. It runs with local Ollama models, keeps user files on the machine, and does not require cloud routing for normal use.

## Overview

Hackloi AI Cyber Lab is designed for users who want one desktop workspace for:

- local AI chat with coding and analysis support
- a lightweight code workspace with Monaco Editor
- scan and terminal output analysis
- guided local tool workflows
- multiple specialist agents for coding, analysis, documentation, and coordination

The application preserves a local-private workflow:

- Ollama runs on loopback
- user files stay local
- cybersecurity commands remain explicit and user-confirmed
- no hidden execution is performed

## Features

- Streaming local AI chat with markdown rendering, code blocks, copy actions, prompt history, and attachments
- Code Workspace with Monaco Editor, project import, file tree, tabs, save/save as, search, replace, and AI code actions
- Multi-agent system with Coding, Analysis, Documentation, and Coordinator agents
- Model Manager with installed models, loaded runtime models, recommendations, and onboarding/setup guidance
- Tool Launcher for `nmap`, `ffuf`, `httpx`, `subfinder`, `nikto`, `whois`, and `dig`
- Scan Analyzer with local parsing and structured findings for common scan outputs
- Dashboard telemetry for CPU, RAM, disk, Ollama status, active model, workspace, and recent jobs
- Settings, About, onboarding, and release-ready desktop presentation

## Local AI And Privacy

Hackloi AI Cyber Lab is built around local execution:

- Local Ollama endpoint: `http://127.0.0.1:11434`
- Local app UI host: `127.0.0.1`
- No cloud requirement for chat, workspace, scan analysis, or agent workflows
- No remote file upload
- Tool execution requires explicit user confirmation

## Installation

### Option A: Install A Linux Package

Builds produce Linux desktop installers in:

```text
src-tauri/target/release/bundle/
```

The default packaging target is a Debian package:

```text
src-tauri/target/release/bundle/deb/Hackloi AI Cyber Lab_0.1.0_amd64.deb
```

To install a downloaded or locally built package on Debian, Ubuntu, Kali, or similar systems:

```bash
sudo apt install ./Hackloi\ AI\ Cyber\ Lab_0.1.0_amd64.deb
```

After installation, launch the app from your desktop menu or by running:

```bash
hackloi-ai-cyber-lab
```

### Option B: Run From Source

Install desktop prerequisites:

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

From the repository root, install project dependencies:

```bash
npm install
```

Install Ollama and recommended starter models if needed:

```bash
./setup-local-ai.sh --profile fast
ollama pull phi4-mini
ollama pull qwen2.5-coder:7b
ollama pull deepseek-coder:6.7b
```

Run the desktop app in development mode:

```bash
npm run tauri:dev
```

## Quick Demo

Use the files in [`demo-data/`](demo-data/) for a clean product demo.

1. Open Hackloi AI Cyber Lab and start on `Dashboard`.
2. Open `Chat` and ask the Coding Agent to explain [`demo-data/sample-script.py`](demo-data/sample-script.py).
3. Open `Code Workspace`, import the `demo-data` folder, and show editing the sample script.
4. Open `Scan Analyzer`, paste [`demo-data/sample-scan.txt`](demo-data/sample-scan.txt), and run `Analyze locally`.
5. Show the structured findings and then run the Analysis Agent on the same scan.
6. Open `Agents` and show model assignments and the Coordinator workflow.
7. Open `Models` and show the currently selected local model and recommendations.

## Demo Data

The demo assets are stored in [`demo-data/`](demo-data/):

- [`sample-script.py`](demo-data/sample-script.py)
- [`sample-terminal-output.log`](demo-data/sample-terminal-output.log)
- [`sample-scan.txt`](demo-data/sample-scan.txt)
- [`sample-config.json`](demo-data/sample-config.json)

## Screenshots

Screenshot capture notes live in [`docs/screenshots/README.md`](docs/screenshots/README.md).

Recommended screenshot set:

- Dashboard
- Chat panel
- Code Workspace
- Scan Analyzer
- Agents page
- Model Manager

## Development

Run the desktop app in development mode:

```bash
npm run tauri:dev
```

What development mode does:

- starts the existing local web UI server
- serves the frontend on `http://127.0.0.1:3000`
- opens the Tauri desktop window titled `Hackloi AI Cyber Lab`

## Build

Build the desktop package:

```bash
npm run tauri:build
```

Primary installer output:

```text
src-tauri/target/release/bundle/deb/Hackloi AI Cyber Lab_0.1.0_amd64.deb
```

## Product Presentation Assets

Additional release and marketing copy lives in [`docs/`](docs/):

- [`docs/landing-page-copy.md`](docs/landing-page-copy.md)
- [`docs/release-description.md`](docs/release-description.md)
- [`docs/release-checklist.md`](docs/release-checklist.md)

## Repository Structure

```text
offline-ai-lab/
├── demo-data/
├── docs/
│   ├── landing-page-copy.md
│   ├── release-checklist.md
│   ├── release-description.md
│   └── screenshots/
│       └── README.md
├── lib/
├── src-tauri/
├── webui/
├── README.md
└── package.json
```

## Release Notes

This repository keeps the existing Hackloi AI Cyber Lab product intact:

- current Tauri desktop architecture
- current local Ollama workflow
- current chat, workspace, tools, scan analyzer, dashboard, settings, onboarding, and agents

This pass improves packaging, installation clarity, demo readiness, and product presentation. It does not rebuild or replace the application.
