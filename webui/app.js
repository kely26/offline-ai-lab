const storageKey = "hackloi-ai-session-v2";
const legacySettingsKey = "hackloi-ai-settings-v2";
const isTauriRuntime = Boolean(window.__TAURI_INTERNALS__) || navigator.userAgent.includes("Tauri");
const apiBase = isTauriRuntime ? "http://127.0.0.1:3000" : "";
const DEFAULT_SYSTEM_PROMPT = 'You are Hackloi AI, a cybersecurity assistant running inside a Kali Linux lab. Welcome the user with "Welcome Hackloi". Help with Linux, cybersecurity learning, programming tasks, and offline workflows.';
const DEFAULT_EDITOR_TEXT = "# Welcome Hackloi\n\nImport or create a file in the workspace.";
const CHAT_HISTORY_MESSAGE_LIMIT = 6;
const MAX_SESSION_IMPORT_BYTES = 2_500_000;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([".txt", ".log", ".json", ".py", ".sh", ".js", ".md", ".csv", ".xml", ".yaml", ".yml", ".html", ".conf", ".ini", ".out", ".scan"]);

const assistantModes = {
  standard: {
    label: "Standard",
    description: "Balanced Hackloi AI mode for local Linux, coding, and cybersecurity workflows.",
    overlay: "Keep answers practical, concise, and grounded in local offline workflows.",
  },
  pentest: {
    label: "Pentest Assistant",
    description: "Adds structured pentest-oriented guidance while keeping the workflow local and explicit.",
    overlay: "Act as a pentest assistant. Focus on recon interpretation, manual validation ideas, Linux tooling, and safe next steps. Do not assume hidden execution or internet access.",
  },
};

const scanPresets = {
  nmap: {
    label: "Nmap",
    description: "Summarize hosts, open ports, services, and likely next manual checks.",
    prompt: "Analyze the following Nmap output. Use exactly these sections: Findings, Services / Technologies, Possible Vulnerabilities, Suggested Next Steps, Security Notes.",
  },
  ffuf: {
    label: "ffuf",
    description: "Highlight interesting directories, status codes, and fuzzing follow-up ideas.",
    prompt: "Analyze the following ffuf output. Use exactly these sections: Findings, Services / Technologies, Possible Vulnerabilities, Suggested Next Steps, Security Notes.",
  },
  httpx: {
    label: "httpx",
    description: "Extract live hosts, titles, technologies, and web-focused next steps.",
    prompt: "Analyze the following httpx output. Use exactly these sections: Findings, Services / Technologies, Possible Vulnerabilities, Suggested Next Steps, Security Notes.",
  },
  nikto: {
    label: "Nikto",
    description: "Summarize web findings, risky headers, and quick verification ideas.",
    prompt: "Analyze the following Nikto output. Use exactly these sections: Findings, Services / Technologies, Possible Vulnerabilities, Suggested Next Steps, Security Notes.",
  },
  generic: {
    label: "Generic Terminal Output",
    description: "Turn arbitrary local command output into structured notes and follow-up actions.",
    prompt: "Analyze the following local terminal output. Use exactly these sections: Findings, Services / Technologies, Possible Vulnerabilities, Suggested Next Steps, Security Notes.",
  },
};

const toolTemplates = [
  {
    key: "nmap",
    label: "Nmap Service Sweep",
    command: "nmap -sV target.com -oN scan.txt",
    description: "Basic service detection with a local output file.",
  },
  {
    key: "ffuf",
    label: "ffuf Directory Fuzz",
    command: "ffuf -u https://target/FUZZ -w wordlist.txt -mc all",
    description: "Quick web content fuzzing template.",
  },
  {
    key: "httpx",
    label: "httpx Probe",
    command: "httpx -l hosts.txt -title -tech-detect -status-code",
    description: "Probe targets and collect web metadata.",
  },
  {
    key: "subfinder",
    label: "subfinder Recon",
    command: "subfinder -d target.com -silent",
    description: "Passive subdomain discovery template.",
  },
  {
    key: "nikto",
    label: "Nikto Web Sweep",
    command: "nikto -h https://target.com",
    description: "Local web server checks for common weaknesses.",
  },
  {
    key: "whois",
    label: "WHOIS Lookup",
    command: "whois target.com",
    description: "Ownership and registration details.",
  },
  {
    key: "dig",
    label: "DNS Dig",
    command: "dig target.com any",
    description: "DNS records and resolution review.",
  },
];

const allowedToolExecutables = new Set(toolTemplates.map((item) => item.key));

const scanSectionLabels = {
  detected_services: "Detected Services",
  possible_vulnerabilities: "Possible Vulnerabilities",
  suggested_next_steps: "Suggested Next Steps",
  security_notes: "Security Notes",
};

const commandDeck = [
  {
    title: "Setup local AI",
    description: "Install Ollama and the default fast model profile.",
    command: "./setup-local-ai.sh --profile fast",
  },
  {
    title: "Open dashboard",
    description: "Start the local web server and desktop-compatible dashboard backend.",
    command: "./start-webui.sh",
  },
  {
    title: "Terminal chat",
    description: "Open the branded terminal assistant.",
    command: "./start-ai.sh",
  },
  {
    title: "Check runtime",
    description: "Print local paths, PIDs, and model state.",
    command: "./status.sh",
  },
  {
    title: "Desktop dev mode",
    description: "Launch the Tauri desktop shell in development mode.",
    command: "npm run tauri:dev",
  },
  {
    title: "Build desktop app",
    description: "Produce the Linux desktop app packages.",
    command: "npm run tauri:build",
  },
];

const ctfCategories = {
  crypto: {
    label: "Crypto",
    prompts: [
      {
        title: "Cipher triage",
        text: "Help me triage this crypto challenge. Identify the likely cipher or encoding family, list indicators, and suggest concrete manual steps to validate the hypothesis.",
      },
      {
        title: "Known-plaintext ideas",
        text: "Suggest practical known-plaintext or crib-dragging ideas for this crypto challenge, with simple local tools or scripts I can use offline.",
      },
    ],
  },
  web: {
    label: "Web",
    prompts: [
      {
        title: "Web foothold checklist",
        text: "Help me analyze this web CTF target. Outline likely entry points, quick checks, and manual validation ideas for common web challenge patterns.",
      },
      {
        title: "Parameter abuse",
        text: "Review this web challenge context and propose parameter tampering, content discovery, auth bypass, or template injection angles worth checking manually.",
      },
    ],
  },
  reversing: {
    label: "Reversing",
    prompts: [
      {
        title: "Binary triage",
        text: "Help me triage this reversing challenge. Suggest quick local checks, strings usage, symbol review, entry point analysis, and likely packed or obfuscated indicators.",
      },
      {
        title: "Function map",
        text: "Given this reversing context, help me map likely important functions, user input paths, and data transformations worth tracing next.",
      },
    ],
  },
  forensics: {
    label: "Forensics",
    prompts: [
      {
        title: "Artifact triage",
        text: "Help me triage this forensics challenge. Suggest an order of operations for metadata, files, timestamps, and suspicious artifacts using offline tooling.",
      },
      {
        title: "Timeline thinking",
        text: "Given these forensics notes, help me build a likely timeline and identify which artifacts should be inspected next.",
      },
    ],
  },
};

const codeActionPrompts = {
  explain: "Explain this code. Focus on purpose, flow, important functions, and risky parts.",
  improve: "Improve this code while preserving behavior. Return a better version and concise notes.",
  debug: "Debug this code. Identify likely bugs, edge cases, and fixes.",
  refactor: "Refactor this code for clarity and maintainability. Return the refactored code and brief rationale.",
  generate: "Generate a local script from this specification or stub. Return the script first, then short notes.",
  convert: "Convert this code into the requested language while preserving behavior. Return the converted code first, then concise notes.",
};

const fallbackAgentCatalog = {
  coding: {
    id: "coding",
    label: "Coding Agent",
    description: "Explains code, improves scripts, debugs issues, and helps with local development workflows.",
    purpose: "Code explanation, refactoring, debugging, and script generation.",
    system_prompt: "You are the Hackloi Coding Agent. Focus on code explanation, debugging, refactoring, script generation, and practical local development guidance. Keep outputs concise, precise, and grounded in the current local context. Do not suggest hidden execution.",
    default_model: "hackloi-coder",
    recommended_models: ["hackloi-coder", "qwen2.5-coder:7b", "deepseek-coder:6.7b"],
    context_scopes: ["chat context", "current file", "current project"],
  },
  analysis: {
    id: "analysis",
    label: "Analysis Agent",
    description: "Analyzes logs, scan outputs, terminal results, and organizes findings for review.",
    purpose: "Scan interpretation, log triage, findings summary, and next-step organization.",
    system_prompt: "You are the Hackloi Analysis Agent. Analyze local terminal output, scans, logs, and evidence. Organize observations clearly, call out uncertainty, and suggest safe next validation steps. Do not execute or imply hidden actions.",
    default_model: "hackloi-assistant",
    recommended_models: ["hackloi-assistant", "llama3:8b", "mistral"],
    context_scopes: ["chat context", "current scan", "tool output"],
  },
  documentation: {
    id: "documentation",
    label: "Documentation Agent",
    description: "Turns notes, findings, and raw context into structured markdown summaries and reports.",
    purpose: "Structured notes, markdown summaries, concise reports, and clarity improvements.",
    system_prompt: "You are the Hackloi Documentation Agent. Turn local notes, findings, code, and analysis into clear markdown summaries, reports, and organized writeups. Prioritize clarity, structure, and explicit context. Keep everything local-first.",
    default_model: "phi4-mini",
    recommended_models: ["phi4-mini", "mistral", "hackloi-assistant"],
    context_scopes: ["chat context", "current file", "current scan", "notes"],
  },
  coordinator: {
    id: "coordinator",
    label: "Coordinator Agent",
    description: "Recommends the best agent, suggests steps, and can combine multiple agent outputs with user-visible routing.",
    purpose: "Visible routing, step planning, agent recommendation, and multi-agent synthesis.",
    system_prompt: "You are the Hackloi Coordinator Agent. Inspect the user's local request, recommend the best specialized agent, optionally propose a short plan, and combine multiple agent outputs when requested. Never perform hidden actions or imply autonomous execution. Return explicit, user-controlled routing.",
    default_model: "hackloi-assistant",
    recommended_models: ["hackloi-assistant", "llama3:8b", "mistral"],
    context_scopes: ["chat context", "current file", "current scan", "session overview"],
  },
};

const agentWorkflowTemplates = [
  {
    key: "analyze-terminal-output",
    title: "Analyze Terminal Output",
    description: "Send logs or command output through the Analysis Agent.",
    targetView: "chat",
    targetSurface: "chat",
    agent: "analysis",
  },
  {
    key: "explain-current-file",
    title: "Explain Current File",
    description: "Route the active editor file to the Coding Agent for explanation.",
    targetView: "workspace",
    targetSurface: "workspace",
    agent: "coding",
  },
  {
    key: "improve-current-code",
    title: "Improve Current Code",
    description: "Use the Coding Agent to review and improve the current editor content.",
    targetView: "workspace",
    targetSurface: "workspace",
    agent: "coding",
  },
  {
    key: "turn-findings-into-notes",
    title: "Turn Findings Into Notes",
    description: "Use the Documentation Agent to generate markdown notes from the current context.",
    targetView: "scan",
    targetSurface: "scan",
    agent: "documentation",
  },
  {
    key: "summarize-current-scan",
    title: "Summarize Current Scan",
    description: "Review the current analyzer content with the Analysis Agent.",
    targetView: "scan",
    targetSurface: "scan",
    agent: "analysis",
  },
  {
    key: "compare-agent-opinions",
    title: "Compare Agent Opinions",
    description: "Collect specialized outputs and combine them with the Coordinator.",
    targetView: "chat",
    targetSurface: "chat",
    agent: "auto",
  },
];

const surfaceCompareDefaults = {
  chat: ["coding", "analysis", "documentation"],
  workspace: ["coding", "documentation", "analysis"],
  scan: ["analysis", "documentation", "coding"],
};

const languageMap = {
  ".py": "python",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "markdown",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".html": "html",
  ".xml": "xml",
};

const extensionByLanguage = {
  python: ".py",
  shell: ".sh",
  javascript: ".js",
  json: ".json",
  markdown: ".md",
  yaml: ".yml",
  html: ".html",
  xml: ".xml",
  plaintext: ".txt",
};

const defaultAppSettings = {
  general: {
    onboarding_completed: false,
  },
  assistant: {
    default_model: "hackloi-assistant",
    mode: "standard",
    system_prompt: DEFAULT_SYSTEM_PROMPT,
  },
  ui: {
    visual_intensity: "normal",
    dashboard_refresh_seconds: 20,
    job_refresh_seconds: 5,
  },
  chat: {
    prompt_history_limit: 12,
    prompt_history: [],
    attachment_max_count: 24,
    attachment_max_file_bytes: 1_500_000,
    attachment_max_total_bytes: 8_000_000,
  },
  workspace: {
    import_max_files: 300,
    import_max_file_bytes: 1_500_000,
    import_max_total_bytes: 15_000_000,
  },
  analyzer: {
    default_scan_preset: "nmap",
  },
  ctf: {
    default_category: "web",
    notes: {
      crypto: "",
      web: "",
      reversing: "",
      forensics: "",
    },
  },
  agents: {
    default_agent: "auto",
    compare_mode: false,
    profiles: {
      coding: {
        enabled: true,
        assigned_model: "hackloi-coder",
      },
      analysis: {
        enabled: true,
        assigned_model: "hackloi-assistant",
      },
      documentation: {
        enabled: true,
        assigned_model: "phi4-mini",
      },
      coordinator: {
        enabled: true,
        assigned_model: "hackloi-assistant",
      },
    },
  },
  safety: {
    local_only_mode: true,
    webui_host: "127.0.0.1",
    ollama_base_url: "http://127.0.0.1:11434",
    tool_allowlist: Array.from(allowedToolExecutables).sort(),
    command_confirmation_required: true,
    hidden_execution_disabled: true,
  },
};

const state = {
  promptHistoryCursor: -1,
  promptDraft: "",
  activeView: "chat",
  appInfo: null,
  agentCatalog: deepClone(fallbackAgentCatalog),
  agentStatuses: {},
  agentSurfaces: {
    chat: {
      selected: "auto",
      busy: false,
      status: "Use Auto (Coordinator) or route the next chat request to a specific local agent.",
      outputs: {},
      order: [],
      activeTab: "",
      summary: "",
      routeLabel: "Auto",
    },
    workspace: {
      selected: "coding",
      busy: false,
      status: "Use Coding Agent for file work, Documentation Agent for notes, or compare multiple perspectives.",
      outputs: {},
      order: [],
      activeTab: "",
      summary: "",
      routeLabel: "Coding Agent",
    },
    scan: {
      selected: "analysis",
      busy: false,
      status: "Run Analysis Agent or Documentation Agent on the current scan context. Tool actions remain explicit.",
      outputs: {},
      order: [],
      activeTab: "",
      summary: "",
      routeLabel: "Analysis Agent",
    },
  },
  models: [],
  runningModels: [],
  activeLoadedModel: "",
  tools: [],
  recommendations: [],
  toolJobs: [],
  selectedJobId: null,
  health: null,
  system: null,
  busy: false,
  refreshing: false,
  abortController: null,
  renderedCodeBlocks: new Map(),
  lastSubmittedContent: "",
  streamStatus: "Ready",
  chatAttachments: [],
  scanAttachments: [],
  scanAnalysis: null,
  session: loadSession(),
  settings: deepClone(defaultAppSettings),
  settingsDraft: deepClone(defaultAppSettings),
  settingsMeta: { path: "", exists: false },
  settingsWarnings: [],
  settingsFieldErrors: {},
  settingsDirty: false,
  settingsLoaded: false,
  workspace: {
    tree: [],
    projectName: "Workspace",
    fileCount: 0,
    selectedPath: "",
    selectedType: "",
    currentFilePath: "",
    currentLanguage: "markdown",
    dirty: false,
    openTabs: [],
    filterQuery: "",
    assistantOutput: "",
    assistantOutputBlocks: [],
  },
  editor: {
    monaco: null,
    instance: null,
    loadPromise: null,
    suppressDirty: false,
  },
  codeAssistantBusy: false,
  launcherBusy: false,
  toastCounter: 0,
  toasts: [],
  dialog: {
    open: false,
    mode: "confirm",
    resolve: null,
    reject: null,
  },
  onboardingVisible: false,
  intervals: {
    dashboard: null,
    jobs: null,
  },
};

const elements = {
  body: document.body,
  startupSplash: document.getElementById("startup-splash"),
  chatFeed: document.getElementById("chat-feed"),
  promptInput: document.getElementById("prompt-input"),
  sendButton: document.getElementById("send-button"),
  stopGeneration: document.getElementById("stop-generation"),
  regenerateResponse: document.getElementById("regenerate-response"),
  chatStreamStatus: document.getElementById("chat-stream-status"),
  promptHistoryList: document.getElementById("prompt-history-list"),
  clearChat: document.getElementById("clear-chat"),
  systemPrompt: document.getElementById("system-prompt"),
  modelSelect: document.getElementById("model-select"),
  defaultModelSelect: document.getElementById("default-model-select"),
  appVersionChip: document.getElementById("app-version-chip"),
  settingsDefaultModel: document.getElementById("settings-default-model"),
  settingsAssistantMode: document.getElementById("settings-assistant-mode"),
  settingsVisualIntensity: document.getElementById("settings-visual-intensity"),
  settingsDashboardRefresh: document.getElementById("settings-dashboard-refresh"),
  settingsJobRefresh: document.getElementById("settings-job-refresh"),
  settingsPromptHistoryLimit: document.getElementById("settings-prompt-history-limit"),
  settingsChatAttachmentMaxCount: document.getElementById("settings-chat-attachment-max-count"),
  settingsChatAttachmentMaxFileBytes: document.getElementById("settings-chat-attachment-max-file-bytes"),
  settingsChatAttachmentMaxTotalBytes: document.getElementById("settings-chat-attachment-max-total-bytes"),
  settingsWorkspaceImportMaxFiles: document.getElementById("settings-workspace-import-max-files"),
  settingsWorkspaceImportMaxFileBytes: document.getElementById("settings-workspace-import-max-file-bytes"),
  settingsWorkspaceImportMaxTotalBytes: document.getElementById("settings-workspace-import-max-total-bytes"),
  settingsDefaultScanPreset: document.getElementById("settings-default-scan-preset"),
  settingsDefaultCtfCategory: document.getElementById("settings-default-ctf-category"),
  settingsCtfNotesCrypto: document.getElementById("settings-ctf-notes-crypto"),
  settingsCtfNotesWeb: document.getElementById("settings-ctf-notes-web"),
  settingsCtfNotesReversing: document.getElementById("settings-ctf-notes-reversing"),
  settingsCtfNotesForensics: document.getElementById("settings-ctf-notes-forensics"),
  settingsSafetyStatus: document.getElementById("settings-safety-status"),
  settingsSafetyGrid: document.getElementById("settings-safety-grid"),
  settingsGeneralSummary: document.getElementById("settings-general-summary"),
  settingsModelsSummary: document.getElementById("settings-models-summary"),
  settingsPrivacySummary: document.getElementById("settings-privacy-summary"),
  settingsDeveloperSummary: document.getElementById("settings-developer-summary"),
  settingsOpenWelcome: document.getElementById("settings-open-welcome"),
  settingsWarning: document.getElementById("settings-warning"),
  settingsSaveStatus: document.getElementById("settings-save-status"),
  settingsSaveButton: document.getElementById("settings-save-button"),
  settingsResetButton: document.getElementById("settings-reset-button"),
  settingInputs: Array.from(document.querySelectorAll("[data-setting-field]")),
  settingsErrorFields: Array.from(document.querySelectorAll("[data-setting-error]")),
  assistantModeSelect: document.getElementById("assistant-mode-select"),
  assistantModeDescription: document.getElementById("assistant-mode-description"),
  modelGrid: document.getElementById("model-grid"),
  modelsStatus: document.getElementById("models-status"),
  modelRecommendations: document.getElementById("model-recommendations"),
  sessionMeta: document.getElementById("session-meta"),
  runtimeInfo: document.getElementById("runtime-info"),
  localStatus: document.getElementById("local-status"),
  ollamaStatus: document.getElementById("ollama-status"),
  modelCount: document.getElementById("model-count"),
  runtimeMode: document.getElementById("runtime-mode"),
  healthPill: document.getElementById("health-pill"),
  toolList: document.getElementById("tool-list"),
  messageTemplate: document.getElementById("message-template"),
  commandTemplate: document.getElementById("command-card-template"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  viewPanels: Array.from(document.querySelectorAll("[data-view-panel]")),
  apiOrigin: document.getElementById("api-origin"),
  activeModelLabel: document.getElementById("active-model-label"),
  activeModeLabel: document.getElementById("active-mode-label"),
  defaultModelLabel: document.getElementById("default-model-label"),
  chatAgentSelect: document.getElementById("chat-agent-select"),
  chatCompareAgents: document.getElementById("chat-compare-agents"),
  chatSummarizeThread: document.getElementById("chat-summarize-thread"),
  chatAgentStatus: document.getElementById("chat-agent-status"),
  chatAgentRoute: document.getElementById("chat-agent-route"),
  chatAgentTabs: document.getElementById("chat-agent-tabs"),
  chatAgentSummary: document.getElementById("chat-agent-summary"),
  chatAgentResponse: document.getElementById("chat-agent-response"),
  activeModeChip: document.getElementById("active-mode-chip"),
  heroModeChip: document.getElementById("hero-mode-chip"),
  heroDefaultModel: document.getElementById("hero-default-model"),
  dashboardRuntimeChip: document.getElementById("dashboard-runtime-chip"),
  dashboardOllamaChip: document.getElementById("dashboard-ollama-chip"),
  dashboardProjectChip: document.getElementById("dashboard-project-chip"),
  dashboardMetrics: document.getElementById("dashboard-metrics"),
  dashboardRuntimeModels: document.getElementById("dashboard-runtime-models"),
  dashboardWorkspaceSummary: document.getElementById("dashboard-workspace-summary"),
  dashboardJobList: document.getElementById("dashboard-job-list"),
  desktopModeCopy: document.getElementById("desktop-mode-copy"),
  sessionCount: document.getElementById("session-count"),
  scanInput: document.getElementById("scan-input"),
  scanPresetList: document.getElementById("scan-preset-list"),
  scanPresetNote: document.getElementById("scan-preset-note"),
  previewScan: document.getElementById("preview-scan"),
  scanAnalysisStatus: document.getElementById("scan-analysis-status"),
  scanAnalysisSummary: document.getElementById("scan-analysis-summary"),
  scanAnalysisGrid: document.getElementById("scan-analysis-grid"),
  commandDeck: document.getElementById("command-deck"),
  launcherTemplateList: document.getElementById("launcher-template-list"),
  launcherCommand: document.getElementById("launcher-command"),
  launcherCommandPreview: document.getElementById("launcher-command-preview"),
  launcherConfirm: document.getElementById("launcher-confirm"),
  launcherStatus: document.getElementById("launcher-status"),
  launcherWorkdir: document.getElementById("launcher-workdir"),
  toolJobList: document.getElementById("tool-job-list"),
  toolJobDetail: document.getElementById("tool-job-detail"),
  sidebarMonitoring: document.getElementById("sidebar-monitoring"),
  heroMonitorGrid: document.getElementById("hero-monitor-grid"),
  ctfTabList: document.getElementById("ctf-tab-list"),
  ctfCardGrid: document.getElementById("ctf-card-grid"),
  ctfNotes: document.getElementById("ctf-notes"),
  ctfNoteStatus: document.getElementById("ctf-note-status"),
  localOnlyChip: document.getElementById("local-only-chip"),
  modelsModeCopy: document.getElementById("models-mode-copy"),
  chatFileInput: document.getElementById("chat-file-input"),
  scanFileInput: document.getElementById("scan-file-input"),
  chatAttachmentList: document.getElementById("chat-attachment-list"),
  scanAttachmentList: document.getElementById("scan-attachment-list"),
  chatDropzone: document.getElementById("chat-dropzone"),
  scanDropzone: document.getElementById("scan-dropzone"),
  workspaceSummary: document.getElementById("workspace-summary"),
  workspaceImportStatus: document.getElementById("workspace-import-status"),
  workspaceSelection: document.getElementById("workspace-selection"),
  workspaceFilter: document.getElementById("workspace-filter"),
  workspaceTree: document.getElementById("workspace-tree"),
  workspaceTabBar: document.getElementById("workspace-tab-bar"),
  workspaceFileState: document.getElementById("workspace-file-state"),
  workspaceFileInput: document.getElementById("workspace-file-input"),
  workspaceFolderInput: document.getElementById("workspace-folder-input"),
  workspaceNewFile: document.getElementById("workspace-new-file"),
  workspaceNewFolder: document.getElementById("workspace-new-folder"),
  workspaceRenamePath: document.getElementById("workspace-rename-path"),
  workspaceDeletePath: document.getElementById("workspace-delete-path"),
  workspaceSaveFile: document.getElementById("workspace-save-file"),
  workspaceSaveAsFile: document.getElementById("workspace-save-as-file"),
  workspaceFormatFile: document.getElementById("workspace-format-file"),
  workspaceFind: document.getElementById("workspace-find"),
  workspaceReplace: document.getElementById("workspace-replace"),
  workspaceSendToChat: document.getElementById("workspace-send-to-chat"),
  workspaceAgentSelect: document.getElementById("workspace-agent-select"),
  workspaceCompareAgents: document.getElementById("workspace-compare-agents"),
  workspaceGenerateNotes: document.getElementById("workspace-generate-notes"),
  workspaceAgentTabs: document.getElementById("workspace-agent-tabs"),
  workspaceAgentSummary: document.getElementById("workspace-agent-summary"),
  editorCurrentFile: document.getElementById("editor-current-file"),
  editorLanguage: document.getElementById("editor-language"),
  editorSurface: document.getElementById("editor-surface"),
  editorEmptyState: document.getElementById("editor-empty-state"),
  loadedModelCopy: document.getElementById("loaded-model-copy"),
  modelSetupWizard: document.getElementById("model-setup-wizard"),
  modelSetupStatus: document.getElementById("model-setup-status"),
  modelSetupSummary: document.getElementById("model-setup-summary"),
  modelSetupGuide: document.getElementById("model-setup-guide"),
  modelRuntimeGrid: document.getElementById("model-runtime-grid"),
  agentsDefaultSelect: document.getElementById("agents-default-select"),
  agentsCompareMode: document.getElementById("agents-compare-mode"),
  agentsManagerStatus: document.getElementById("agents-manager-status"),
  agentsSummary: document.getElementById("agents-summary"),
  agentWorkflowTemplates: document.getElementById("agent-workflow-templates"),
  agentGrid: document.getElementById("agent-grid"),
  codeAssistantOutput: document.getElementById("code-assistant-output"),
  codeAssistantStatus: document.getElementById("code-assistant-status"),
  codeAssistantOpenOutput: document.getElementById("code-assistant-open-output"),
  codeAssistantApplyOutput: document.getElementById("code-assistant-apply-output"),
  runToolCommand: document.getElementById("run-tool-command"),
  clearToolCommand: document.getElementById("clear-tool-command"),
  toastStack: document.getElementById("toast-stack"),
  dialogShell: document.getElementById("app-dialog"),
  dialogBackdrop: document.getElementById("app-dialog-backdrop"),
  dialogTitle: document.getElementById("app-dialog-title"),
  dialogDescription: document.getElementById("app-dialog-description"),
  dialogForm: document.getElementById("app-dialog-form"),
  dialogField: document.getElementById("app-dialog-field"),
  dialogLabel: document.getElementById("app-dialog-label"),
  dialogInput: document.getElementById("app-dialog-input"),
  dialogError: document.getElementById("app-dialog-error"),
  dialogCancel: document.getElementById("app-dialog-cancel"),
  dialogConfirm: document.getElementById("app-dialog-confirm"),
  dialogClose: document.getElementById("app-dialog-close"),
  aboutDescription: document.getElementById("about-description"),
  aboutVersionChip: document.getElementById("about-version-chip"),
  aboutIdentity: document.getElementById("about-identity"),
  aboutLocal: document.getElementById("about-local"),
  aboutSystem: document.getElementById("about-system"),
  aboutLicense: document.getElementById("about-license"),
  scanAgentSelect: document.getElementById("scan-agent-select"),
  scanRunAgent: document.getElementById("scan-run-agent"),
  scanCompareAgents: document.getElementById("scan-compare-agents"),
  scanGenerateNotes: document.getElementById("scan-generate-notes"),
  scanAgentStatus: document.getElementById("scan-agent-status"),
  scanAgentRoute: document.getElementById("scan-agent-route"),
  scanAgentTabs: document.getElementById("scan-agent-tabs"),
  scanAgentSummary: document.getElementById("scan-agent-summary"),
  scanAgentResponse: document.getElementById("scan-agent-response"),
  onboardingOverlay: document.getElementById("onboarding-overlay"),
  onboardingVersion: document.getElementById("onboarding-version"),
  onboardingModelStatus: document.getElementById("onboarding-model-status"),
  onboardingModelList: document.getElementById("onboarding-model-list"),
  onboardingGetStarted: document.getElementById("onboarding-get-started"),
  onboardingConfigureModels: document.getElementById("onboarding-configure-models"),
  onboardingSkipSetup: document.getElementById("onboarding-skip-setup"),
};

document.body.classList.toggle("desktop-runtime", isTauriRuntime);

let chatRenderScheduled = false;
let chatRenderNeedsEnhance = false;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function extensionForName(name) {
  const lower = String(name || "").toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

function totalAttachmentBytes(items) {
  return items.reduce((sum, item) => sum + Number(item.size || item.content?.length || 0), 0);
}

function notify(title, message, options = {}) {
  const toast = {
    id: `toast-${state.toastCounter += 1}`,
    title,
    message,
    tone: options.tone || "info",
  };
  state.toasts = [...state.toasts, toast].slice(-4);
  renderToasts();
  const timeout = window.setTimeout(() => {
    dismissToast(toast.id);
  }, options.timeout ?? 3200);
  return timeout;
}

function dismissToast(toastId) {
  const next = state.toasts.filter((item) => item.id !== toastId);
  if (next.length === state.toasts.length) {
    return;
  }
  state.toasts = next;
  renderToasts();
}

function renderToasts() {
  elements.toastStack.innerHTML = state.toasts.map((toast) => `
    <article class="toast toast-${escapeHtml(toast.tone)}" role="status">
      <strong>${escapeHtml(toast.title)}</strong>
      <span>${escapeHtml(toast.message)}</span>
    </article>
  `).join("");
}

function hideStartupSplash() {
  if (!elements.startupSplash || elements.startupSplash.hidden) {
    return;
  }
  document.body.classList.add("splash-hidden");
  window.setTimeout(() => {
    if (elements.startupSplash) {
      elements.startupSplash.hidden = true;
    }
  }, 320);
}

function setDialogError(message = "") {
  elements.dialogError.hidden = !message;
  elements.dialogError.textContent = message;
}

function closeDialog(result = null) {
  if (!state.dialog.open) {
    return;
  }
  const resolver = state.dialog.resolve;
  state.dialog = {
    open: false,
    mode: "confirm",
    resolve: null,
    reject: null,
  };
  elements.dialogShell.hidden = true;
  document.body.classList.remove("dialog-open");
  setDialogError("");
  elements.dialogInput.value = "";
  resolver?.(result);
}

function openDialog(options) {
  if (state.dialog.open) {
    closeDialog(null);
  }
  state.dialog.open = true;
  state.dialog.mode = options.mode || "confirm";
  elements.dialogTitle.textContent = options.title || "Confirm Action";
  elements.dialogDescription.textContent = options.description || "Confirm the next local action.";
  elements.dialogConfirm.textContent = options.confirmLabel || "Confirm";
  elements.dialogCancel.textContent = options.cancelLabel || "Cancel";
  elements.dialogField.hidden = state.dialog.mode !== "prompt";
  elements.dialogLabel.textContent = options.label || "Value";
  elements.dialogInput.value = options.initialValue || "";
  elements.dialogInput.placeholder = options.placeholder || "";
  setDialogError("");
  elements.dialogShell.hidden = false;
  document.body.classList.add("dialog-open");
  const promise = new Promise((resolve) => {
    state.dialog.resolve = resolve;
  });
  window.requestAnimationFrame(() => {
    if (state.dialog.mode === "prompt") {
      elements.dialogInput.focus();
      elements.dialogInput.select();
    } else {
      elements.dialogConfirm.focus();
    }
  });
  return promise;
}

function confirmAction(options) {
  return openDialog({ ...options, mode: "confirm" }).then((result) => Boolean(result));
}

function promptForInput(options) {
  return openDialog({ ...options, mode: "prompt" }).then((result) => {
    if (typeof result !== "string") {
      return "";
    }
    return result;
  });
}

class ApiError extends Error {
  constructor(message, details = {}) {
    super(describeUserError(message));
    this.name = "ApiError";
    this.rawMessage = message;
    Object.assign(this, details);
  }
}

function describeUserError(message) {
  const text = String(message || "Unexpected local error.");
  if (/Failed to fetch/i.test(text)) {
    return "The local Hackloi service did not respond. Keep the desktop app or local web UI running on 127.0.0.1 and retry.";
  }
  if (/Ollama could not be reached/i.test(text) || /Ollama timed out/i.test(text) || /Ollama returned HTTP/i.test(text)) {
    return `${text} Start Ollama locally, then retry the request.`;
  }
  if (/Command '.*' is not installed/i.test(text)) {
    return `${text} Install the tool locally or choose another allowlisted command.`;
  }
  if (/Invalid workspace path/i.test(text)) {
    return "That target is outside the local workspace root. Choose a relative path inside the workspace.";
  }
  if (/Workspace import exceeds/i.test(text) || /Too many files/i.test(text)) {
    return `${text} Reduce the import size or raise the workspace limits in Settings.`;
  }
  return text;
}

function currentSettings() {
  return state.settings || deepClone(defaultAppSettings);
}

function currentDraftSettings() {
  return state.settingsDirty ? state.settingsDraft : state.settings;
}

function chatSettings() {
  return currentSettings().chat;
}

function workspaceSettings() {
  return currentSettings().workspace;
}

function analyzerSettings() {
  return currentSettings().analyzer;
}

function ctfSettings() {
  return currentSettings().ctf;
}

function generalSettings() {
  return currentSettings().general;
}

function appInfo() {
  return state.appInfo || {
    name: "Hackloi AI Cyber Lab",
    title: "Hackloi AI Cyber Lab",
    version: "0.1.0",
    description: "Local AI cybersecurity workstation with Ollama-backed workflows.",
    license: "Not specified in package metadata.",
    bundle_output: "src-tauri/target/release/bundle",
    runtime: { python: "Unknown", platform: "Unknown" },
  };
}

function agentSettings() {
  return currentSettings().agents || deepClone(defaultAppSettings.agents);
}

function agentCatalogEntries() {
  return Object.values(state.agentCatalog || fallbackAgentCatalog);
}

function agentEntry(agentId) {
  return (state.agentCatalog || fallbackAgentCatalog)[agentId] || null;
}

function agentProfile(agentId) {
  return agentSettings().profiles?.[agentId] || defaultAppSettings.agents.profiles[agentId];
}

function agentDisplayLabel(agentId) {
  if (agentId === "auto") {
    return "Auto (Coordinator)";
  }
  return agentEntry(agentId)?.label || agentId;
}

function surfaceAgentState(surface) {
  return state.agentSurfaces[surface];
}

function surfaceAgentElements(surface) {
  return {
    chat: {
      select: elements.chatAgentSelect,
      status: elements.chatAgentStatus,
      route: elements.chatAgentRoute,
      tabs: elements.chatAgentTabs,
      summary: elements.chatAgentSummary,
      response: elements.chatAgentResponse,
    },
    workspace: {
      select: elements.workspaceAgentSelect,
      status: elements.codeAssistantStatus,
      route: null,
      tabs: elements.workspaceAgentTabs,
      summary: elements.workspaceAgentSummary,
      response: elements.codeAssistantOutput,
    },
    scan: {
      select: elements.scanAgentSelect,
      status: elements.scanAgentStatus,
      route: elements.scanAgentRoute,
      tabs: elements.scanAgentTabs,
      summary: elements.scanAgentSummary,
      response: elements.scanAgentResponse,
    },
  }[surface];
}

function surfaceDefaultAgent(surface) {
  if (surface === "chat") {
    return agentSettings().default_agent || "auto";
  }
  if (surface === "workspace") {
    return "coding";
  }
  return "analysis";
}

function configuredAgentModel(agentId) {
  return agentProfile(agentId)?.assigned_model || agentEntry(agentId)?.default_model || "";
}

function resolvedAgentModel(agentId) {
  const configured = configuredAgentModel(agentId);
  return resolveInstalledModelName(configured) || resolveInstalledModelName(agentEntry(agentId)?.default_model || "") || "";
}

function agentSelectOptions() {
  return [
    { value: "auto", label: "Auto (Coordinator)" },
    ...agentCatalogEntries().map((agent) => ({ value: agent.id, label: agent.label })),
  ];
}

function normalizeAgentSelections() {
  ["chat", "workspace", "scan"].forEach((surface) => {
    const current = surfaceAgentState(surface);
    if (!current) {
      return;
    }
    const allowed = new Set(agentSelectOptions().map((item) => item.value));
    if (!allowed.has(current.selected)) {
      current.selected = surfaceDefaultAgent(surface);
    }
  });
}

function agentStatusSnapshot(agentId) {
  const profile = agentProfile(agentId);
  const runtime = state.agentStatuses[agentId] || {};
  if (!profile?.enabled) {
    return { state: "disabled", tone: "pill-default", message: "Disabled in Agent Manager." };
  }
  if (runtime.state === "running") {
    return { state: "running", tone: "pill-online", message: runtime.message || "Running on the local model." };
  }
  if (runtime.state === "error") {
    return { state: "error", tone: "pill-offline", message: runtime.message || "The last agent run failed." };
  }
  if (!resolvedAgentModel(agentId)) {
    return { state: "unavailable", tone: "pill-offline", message: "Assigned model is not installed locally." };
  }
  return { state: "idle", tone: "pill-default", message: "Model ready for local use." };
}

function setAgentRuntimeState(agentId, nextState, message = "") {
  state.agentStatuses[agentId] = {
    ...(state.agentStatuses[agentId] || {}),
    state: nextState,
    message,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchAgentCatalog() {
  try {
    const payload = await fetchJson("/api/agents/catalog");
    const nextCatalog = {};
    (payload.agents || []).forEach((agent) => {
      nextCatalog[agent.id] = agent;
    });
    if (Object.keys(nextCatalog).length) {
      state.agentCatalog = nextCatalog;
    }
  } catch (error) {
    notify("Agent Catalog Unavailable", error.message, { tone: "error", timeout: 4200 });
  } finally {
    normalizeAgentSelections();
  }
}

function agentSelectionOptions() {
  return agentSelectOptions().map((item) => ({ ...item }));
}

function availableAgentIds() {
  return agentCatalogEntries()
    .filter((agent) => agentProfile(agent.id)?.enabled)
    .map((agent) => agent.id);
}

function usableAgentIds() {
  return availableAgentIds().filter((agentId) => Boolean(resolvedAgentModel(agentId)));
}

function compareAgentsForSurface(surface, preferred = "") {
  const defaults = surfaceCompareDefaults[surface] || surfaceCompareDefaults.chat;
  const ordered = [];
  const push = (agentId) => {
    if (!agentId || agentId === "auto" || ordered.includes(agentId)) {
      return;
    }
    if (!agentProfile(agentId)?.enabled) {
      return;
    }
    ordered.push(agentId);
  };
  push(preferred);
  defaults.forEach(push);
  if (!ordered.length) {
    usableAgentIds().forEach(push);
  }
  return ordered.filter((agentId) => Boolean(resolvedAgentModel(agentId)));
}

function keywordMatched(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function heuristicRoute(surface, prompt) {
  const lower = `${prompt || ""}\n${surface === "scan" ? combinedScanText() : ""}`.toLowerCase();
  const docKeywords = ["report", "writeup", "markdown", "summary", "summarize", "document", "notes", "brief", "clean up"];
  const analysisKeywords = ["scan", "nmap", "ffuf", "httpx", "nikto", "whois", "dig", "service", "vulnerability", "finding", "findings", "logs", "log", "terminal output", "port", "host"];
  const codingKeywords = ["code", "script", "function", "refactor", "debug", "bug", "file", "python", "javascript", "bash", "json", "editor", "workspace"];

  if (surface === "workspace") {
    if (keywordMatched(lower, docKeywords)) {
      return {
        agentId: "documentation",
        reason: "The current request is phrased as notes or a writeup rather than a code edit.",
        steps: ["Inspect current file", "Extract important details", "Return structured notes"],
      };
    }
    if (keywordMatched(lower, analysisKeywords)) {
      return {
        agentId: "analysis",
        reason: "The current file request references findings, logs, or scan-style analysis.",
        steps: ["Review file context", "Highlight findings", "Suggest explicit follow-up checks"],
      };
    }
    return {
      agentId: "coding",
      reason: "Workspace requests default to the Coding Agent for editor and file actions.",
      steps: ["Inspect current file", "Apply coding guidance", "Return explicit local output"],
    };
  }

  if (surface === "scan") {
    if (keywordMatched(lower, docKeywords)) {
      return {
        agentId: "documentation",
        reason: "The scan request asks for a writeup or structured notes.",
        steps: ["Review current scan", "Convert findings into markdown notes", "Keep next steps explicit"],
      };
    }
    return {
      agentId: "analysis",
      reason: "Scan requests default to the Analysis Agent for logs, findings, and service interpretation.",
      steps: ["Inspect current scan context", "Organize findings", "Suggest safe next steps"],
    };
  }

  if (keywordMatched(lower, docKeywords)) {
    return {
      agentId: "documentation",
      reason: "The request is asking for a summary, report, or cleaner documentation.",
      steps: ["Collect recent context", "Generate structured markdown", "Call out open questions"],
    };
  }
  if (keywordMatched(lower, analysisKeywords)) {
    return {
      agentId: "analysis",
      reason: "The request references scans, logs, findings, or other terminal evidence.",
      steps: ["Inspect recent context", "Summarize observations", "Suggest explicit validation steps"],
    };
  }
  if (keywordMatched(lower, codingKeywords)) {
    return {
      agentId: "coding",
      reason: "The request references code, scripts, files, or debugging work.",
      steps: ["Inspect code context", "Return coding guidance", "Avoid hidden execution"],
    };
  }
  return {
    agentId: surface === "scan" ? "analysis" : "coding",
    reason: surface === "chat"
      ? "The request is ambiguous, so the Coordinator picked the fastest local chat agent for interactive replies."
      : "The request is ambiguous, so the Coordinator picked the closest specialized agent for this page.",
    steps: ["Review visible local context", "Return a focused response", "Keep all actions user-controlled"],
  };
}

function agentSystemPrompt(agentId) {
  const entry = agentEntry(agentId);
  return `${effectiveSystemPrompt()}\n\n${entry?.system_prompt || ""}`.trim();
}

function recentSessionContext(limit = 8) {
  const recent = state.session.messages.slice(-limit);
  if (!recent.length) {
    return "No previous chat context.";
  }
  return recent.map((message) => {
    const label = message.role === "assistant" && message.agentId
      ? `${message.role} (${agentDisplayLabel(message.agentId)})`
      : message.role;
    return `${label.toUpperCase()}:\n${message.content}`;
  }).join("\n\n");
}

function projectContextBlock() {
  const files = flattenWorkspaceFiles(state.workspace.tree).slice(0, 24);
  const fileList = files.length ? files.map((path) => `- ${path}`).join("\n") : "- No imported workspace files";
  return [
    `Project: ${state.workspace.projectName || "Workspace"}`,
    `Open tabs: ${state.workspace.openTabs.length ? state.workspace.openTabs.join(", ") : "none"}`,
    `Workspace files:\n${fileList}`,
  ].join("\n");
}

function workspaceContextBlock() {
  const editor = state.editor.instance;
  const content = editor ? editor.getValue() : DEFAULT_EDITOR_TEXT;
  return [
    `Current file: ${state.workspace.currentFilePath || "Untitled"}`,
    `Language: ${state.workspace.currentLanguage || "markdown"}`,
    projectContextBlock(),
    `Current file contents:\n\`\`\`${state.workspace.currentLanguage || "markdown"}\n${content}\n\`\`\``,
  ].join("\n\n");
}

function scanContextBlock() {
  const structured = buildStructuredScanContext();
  const raw = combinedScanText();
  return [
    `Selected scan preset: ${(scanPresets[currentSettings().analyzer.default_scan_preset] || scanPresets.generic).label}`,
    structured ? structured : "Structured local summary is not available yet.",
    raw ? `Current scan text:\n\`\`\`\n${raw}\n\`\`\`` : "Current scan text is empty.",
  ].join("\n\n");
}

function ctfNotesContextBlock() {
  const notes = currentSettings().ctf.notes?.[activeCtfCategory()] || "";
  if (!notes.trim()) {
    return "";
  }
  return `CTF notes (${ctfCategories[activeCtfCategory()]?.label || activeCtfCategory()}):\n${notes}`;
}

function buildSurfaceTask(surface, prompt) {
  const sections = [`Task:\n${prompt.trim()}`];
  if (surface === "chat") {
    sections.push(`Recent session context:\n${recentSessionContext()}`);
    const chatAttachments = buildAttachmentContext("Attached local files", state.chatAttachments);
    if (chatAttachments) {
      sections.push(chatAttachments.trim());
    }
  }
  if (surface === "workspace") {
    sections.push(workspaceContextBlock());
  }
  if (surface === "scan") {
    sections.push(scanContextBlock());
  }
  const noteBlock = ctfNotesContextBlock();
  if (noteBlock && surface !== "scan") {
    sections.push(noteBlock);
  }
  return sections.filter(Boolean).join("\n\n");
}

function setSurfaceBusy(surface, busy) {
  const current = surfaceAgentState(surface);
  if (current) {
    current.busy = busy;
  }
  if (surface === "chat") {
    setBusy(busy);
    elements.chatCompareAgents.disabled = busy;
    elements.chatSummarizeThread.disabled = busy;
    if (elements.chatAgentSelect) {
      elements.chatAgentSelect.disabled = busy;
    }
  } else if (surface === "workspace") {
    setCodeAssistantBusy(busy);
    elements.workspaceAgentSelect.disabled = busy;
    elements.workspaceCompareAgents.disabled = busy;
    elements.workspaceGenerateNotes.disabled = busy;
  } else if (surface === "scan") {
    elements.scanAgentSelect.disabled = busy;
    elements.scanRunAgent.disabled = busy;
    elements.scanCompareAgents.disabled = busy;
    elements.scanGenerateNotes.disabled = busy;
  }
}

function resetSurfaceOutputs(surface, summary = "") {
  const current = surfaceAgentState(surface);
  if (!current) {
    return;
  }
  current.outputs = {};
  current.order = [];
  current.activeTab = "";
  current.summary = summary;
  renderAgentSurface(surface);
}

function setSurfaceOutput(surface, agentId, payload) {
  const current = surfaceAgentState(surface);
  if (!current) {
    return;
  }
  current.outputs[agentId] = {
    agentId,
    ...payload,
  };
  if (!current.order.includes(agentId)) {
    current.order.push(agentId);
  }
  current.activeTab = current.activeTab || agentId;
  renderAgentSurface(surface, { enhanceCode: false });
}

function activeSurfaceOutput(surface) {
  const current = surfaceAgentState(surface);
  if (!current?.activeTab) {
    return null;
  }
  return current.outputs[current.activeTab] || null;
}

function agentOptionMarkup(options, selectedValue) {
  return options.map((option) => `<option value="${escapeHtml(option.value)}"${selectedValue === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
}

function renderAgentSummaryCards() {
  const enabledCount = agentCatalogEntries().filter((agent) => agentProfile(agent.id)?.enabled).length;
  const readyCount = agentCatalogEntries().filter((agent) => {
    const snapshot = agentStatusSnapshot(agent.id);
    return snapshot.state === "idle" || snapshot.state === "running";
  }).length;
  const cards = [
    { label: "Default", value: agentDisplayLabel(agentSettings().default_agent), detail: "Used by Auto on chat" },
    { label: "Compare", value: agentSettings().compare_mode ? "Enabled" : "Disabled", detail: "User-controlled multi-response mode" },
    { label: "Enabled Agents", value: String(enabledCount), detail: `${readyCount} ready right now` },
    { label: "Coordinator", value: agentStatusSnapshot("coordinator").state, detail: agentStatusSnapshot("coordinator").message },
  ];
  elements.agentsSummary.innerHTML = cards.map((item) => `
    <article class="status-card dashboard-metric-card">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.detail)}</small>
    </article>
  `).join("");
}

function renderWorkflowTemplates() {
  elements.agentWorkflowTemplates.innerHTML = agentWorkflowTemplates.map((template) => `
    <button class="template-card template-button agent-workflow-button" type="button" data-agent-workflow="${escapeHtml(template.key)}">
      <strong>${escapeHtml(template.title)}</strong>
      <span>${escapeHtml(template.description)}</span>
      <code>${escapeHtml(agentDisplayLabel(template.agent))}</code>
    </button>
  `).join("");
}

function renderAgentManager() {
  fillSelect(elements.agentsDefaultSelect, agentSelectionOptions(), agentSettings().default_agent, "No agents");
  elements.agentsCompareMode.checked = Boolean(agentSettings().compare_mode);
  renderAgentSummaryCards();
  renderWorkflowTemplates();
  const modelOptions = installedModelOptions();
  elements.agentsManagerStatus.textContent = "Agents stay local, explicit, and model-driven through Ollama. Switching roles never triggers hidden tool execution.";
  elements.agentGrid.innerHTML = agentCatalogEntries().map((agent) => {
    const profile = agentProfile(agent.id);
    const snapshot = agentStatusSnapshot(agent.id);
    const configuredModel = configuredAgentModel(agent.id);
    const options = withConfiguredModelOption(modelOptions, configuredModel);
    const selectedModel = configuredModel || options[0]?.value || "";
    const recommended = (agent.recommended_models || []).map((model) => `<span class="hero-chip">${escapeHtml(model)}</span>`).join("");
    const scopes = (agent.context_scopes || []).map((scope) => `<span class="topbar-chip">${escapeHtml(scope)}</span>`).join("");
    return `
      <article class="agent-card">
        <header>
          <div>
            <h3>${escapeHtml(agent.label)}</h3>
            <p>${escapeHtml(agent.description)}</p>
          </div>
          <span class="pill ${escapeHtml(snapshot.tone)}">${escapeHtml(snapshot.state)}</span>
        </header>
        <div class="agent-card-copy">
          <p>${escapeHtml(agent.purpose)}</p>
          <div class="runtime-info">
            <div class="meta-row"><span>Configured Model</span><strong>${escapeHtml(configuredModel || "Unavailable")}</strong></div>
            <div class="meta-row"><span>Resolved Local Model</span><strong>${escapeHtml(resolvedAgentModel(agent.id) || "Missing")}</strong></div>
            <div class="meta-row"><span>Status</span><strong>${escapeHtml(snapshot.message)}</strong></div>
          </div>
        </div>
        <label class="checkbox-row agent-toggle-row">
          <input class="agent-enable-toggle" type="checkbox" data-agent-id="${escapeHtml(agent.id)}"${profile?.enabled ? " checked" : ""}>
          <span>Enable ${escapeHtml(agent.label)} for local routing.</span>
        </label>
        <label class="field tight-field">
          <span>Assigned model</span>
          <select class="agent-model-select" data-agent-id="${escapeHtml(agent.id)}">
            ${agentOptionMarkup(options, selectedModel)}
          </select>
        </label>
        <div class="agent-chip-group">${recommended || '<span class="subtle-label">No recommended models listed.</span>'}</div>
        <div class="agent-chip-group">${scopes || '<span class="subtle-label">No local context scopes listed.</span>'}</div>
      </article>
    `;
  }).join("");
}

function syncWorkspaceOutputState(output) {
  if (!output) {
    state.workspace.assistantOutput = "";
    state.workspace.assistantOutputBlocks = [];
    elements.codeAssistantOutput.classList.add("empty-state");
    elements.codeAssistantOutput.innerHTML = "Code assistant output will appear here.";
    elements.codeAssistantOpenOutput.disabled = true;
    elements.codeAssistantApplyOutput.disabled = true;
    return;
  }
  state.workspace.assistantOutput = output.content || "";
  const sourceKey = `agent-workspace-${output.agentId}`;
  const rendered = renderRichText(output.content || "", sourceKey);
  state.workspace.assistantOutputBlocks = rendered.codeBlocks;
  elements.codeAssistantOutput.classList.toggle("empty-state", !output.content?.trim());
  elements.codeAssistantOutput.innerHTML = output.content?.trim() ? (rendered.html || "<p>No output.</p>") : "Code assistant output will appear here.";
  elements.codeAssistantOpenOutput.disabled = state.codeAssistantBusy || !output.content?.trim();
  elements.codeAssistantApplyOutput.disabled = state.codeAssistantBusy || !output.content?.trim();
}

function renderAgentSurface(surface, { enhanceCode = true } = {}) {
  const current = surfaceAgentState(surface);
  const nodes = surfaceAgentElements(surface);
  if (!current || !nodes) {
    return;
  }
  fillSelect(nodes.select, agentSelectionOptions(), current.selected, "No agents");
  if (nodes.route) {
    nodes.route.textContent = current.routeLabel ? `Route: ${current.routeLabel}` : "Route: Ready";
  }
  if (nodes.status) {
    nodes.status.textContent = current.status;
  }
  const hasOutputs = current.order.length > 0;
  if (!hasOutputs) {
    nodes.tabs.className = "agent-tab-bar empty-state";
    nodes.tabs.innerHTML = "No agent responses yet.";
    nodes.summary.textContent = current.summary || "Run a specialized agent to inspect the current local context.";
    if (surface === "workspace") {
      syncWorkspaceOutputState(null);
    } else {
      nodes.response.classList.add("empty-state");
      nodes.response.innerHTML = "No agent output yet.";
    }
    return;
  }

  nodes.tabs.className = "agent-tab-bar";
  nodes.tabs.innerHTML = current.order.map((agentId) => {
    const output = current.outputs[agentId];
    const snapshot = agentStatusSnapshot(agentId);
    return `
      <button class="agent-tab ${current.activeTab === agentId ? "is-active" : ""}" type="button" data-agent-tab="${escapeHtml(agentId)}" data-agent-surface="${escapeHtml(surface)}">
        <strong>${escapeHtml(agentDisplayLabel(agentId))}</strong>
        <small>${escapeHtml(output.model || resolvedAgentModel(agentId) || snapshot.state)}</small>
      </button>
    `;
  }).join("");

  nodes.summary.textContent = current.summary || "Agent output ready.";
  const output = activeSurfaceOutput(surface);
  if (!output) {
    return;
  }
  if (surface === "workspace") {
    syncWorkspaceOutputState(output);
    if (enhanceCode) {
      enhanceCodeBlocks(elements.codeAssistantOutput).catch((error) => console.error(error));
    }
    return;
  }
  const sourceKey = `${surface}-agent-${output.agentId}`;
  const rendered = renderRichText(output.content || "", sourceKey);
  nodes.response.classList.toggle("empty-state", !output.content?.trim());
  nodes.response.innerHTML = output.content?.trim() ? (rendered.html || "<p>No output.</p>") : "No agent output yet.";
  if (enhanceCode) {
    enhanceCodeBlocks(nodes.response).catch((error) => console.error(error));
  }
}

function renderAllAgentSurfaces() {
  renderAgentManager();
  renderAgentSurface("chat");
  renderAgentSurface("workspace");
  renderAgentSurface("scan");
}

function currentChatAgentPrompt() {
  return buildChatPrompt() || state.lastSubmittedContent || state.session.messages[latestUserMessageIndex()]?.content || "";
}

async function invokeAgentStream(agentId, messages, { surface = "chat", signalController = null, onChunk, onDone } = {}) {
  const profile = agentProfile(agentId);
  if (!profile?.enabled) {
    throw new Error(`${agentDisplayLabel(agentId)} is disabled in Agent Manager.`);
  }
  const model = resolvedAgentModel(agentId);
  if (!model) {
    throw new Error(`${agentDisplayLabel(agentId)} does not have an installed local model assigned.`);
  }
  setAgentRuntimeState(agentId, "running", `Running with ${model}.`);
  const controller = signalController || new AbortController();
  if (surface === "chat") {
    state.abortController = controller;
  }
  try {
    await streamChat(
      {
        model,
        system: agentSystemPrompt(agentId),
        messages,
      },
      {
        signal: controller.signal,
        onChunk,
        onDone(event) {
          setAgentRuntimeState(agentId, "idle", `Last used ${formatTime(new Date().toISOString())}.`);
          onDone?.(event);
        },
        onError(message) {
          setAgentRuntimeState(agentId, "error", message);
        },
      },
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setAgentRuntimeState(agentId, "idle", "Generation stopped by the user.");
    } else {
      setAgentRuntimeState(agentId, "error", error.message);
    }
    throw error;
  } finally {
    if (surface === "chat") {
      state.abortController = null;
    }
  }
  return model;
}

async function synthesizeCompareSummary(surface, prompt, results) {
  const coordinatorEnabled = agentProfile("coordinator")?.enabled && resolvedAgentModel("coordinator");
  const combinedSections = results.map((result) => `## ${agentDisplayLabel(result.agentId)}\n${result.content}`).join("\n\n");
  if (!coordinatorEnabled) {
    return [
      `Coordinator summary for ${surface}:`,
      ...results.map((result) => `- ${agentDisplayLabel(result.agentId)} completed with ${result.model}.`),
      "",
      "Detailed agent outputs remain visible in the Agent Views panel.",
    ].join("\n");
  }

  let output = "";
  await invokeAgentStream(
    "coordinator",
    [{
      role: "user",
      content: [
        `Original request:\n${prompt}`,
        `Surface: ${surface}`,
        "Combine the following agent outputs into a short user-facing summary.",
        "Call out major differences and keep next steps explicit.",
        combinedSections,
      ].join("\n\n"),
    }],
    {
      surface,
      signalController: surface === "chat" ? new AbortController() : null,
      onChunk(chunk) {
        output += chunk;
      },
    },
  );
  return output.trim() || "Coordinator summary is not available. Inspect the individual agent tabs.";
}

async function runSurfaceAgents(surface, prompt, options = {}) {
  const current = surfaceAgentState(surface);
  const selection = options.selection || current.selected || surfaceDefaultAgent(surface);
  const compareRequested = Boolean(options.compareRequested);
  const manualAgent = selection !== "auto" ? selection : "";
  const route = selection === "auto"
    ? heuristicRoute(surface, prompt)
    : {
        agentId: selection,
        reason: `Manual route to ${agentDisplayLabel(selection)}.`,
        steps: ["Use the selected local specialist", "Keep tool execution explicit", "Return visible output"],
      };
  const primaryAgent = manualAgent || route.agentId;
  const compareAgents = compareRequested
    ? compareAgentsForSurface(surface, primaryAgent)
    : [primaryAgent].filter(Boolean);
  if (!compareAgents.length) {
    throw new Error("No enabled local agents are ready for this request.");
  }

  const surfaceSummary = selection === "auto"
    ? `Coordinator routed this ${surface} request to ${agentDisplayLabel(primaryAgent)}. ${route.reason}`
    : `Manual route active: ${agentDisplayLabel(primaryAgent)} on the ${surface} surface.`;
  current.routeLabel = compareRequested
    ? `Compare: ${compareAgents.map((agentId) => agentDisplayLabel(agentId)).join(" · ")}`
    : selection === "auto"
      ? `Auto -> ${agentDisplayLabel(primaryAgent)}`
      : agentDisplayLabel(primaryAgent);
  current.status = compareRequested
    ? `Running ${compareAgents.length} local agent perspectives...`
    : `Running ${agentDisplayLabel(primaryAgent)} locally...`;
  current.summary = surfaceSummary;
  resetSurfaceOutputs(surface, surfaceSummary);
  setSurfaceBusy(surface, true);

  const userTask = buildSurfaceTask(surface, prompt);
  const results = [];

  try {
    for (const agentId of compareAgents) {
      let content = "";
      setSurfaceOutput(surface, agentId, {
        content: `Waiting for ${agentDisplayLabel(agentId)} on the local model...`,
        model: resolvedAgentModel(agentId),
        updatedAt: new Date().toISOString(),
      });
      const messages = surface === "chat" && !options.forceSingleShot
        ? state.session.messages
          .filter((message) => (message.role === "user" || message.role === "assistant") && message !== options.sessionAssistantMessage)
          .slice(-CHAT_HISTORY_MESSAGE_LIMIT)
          .map(({ role, content: messageContent }) => ({ role, content: messageContent }))
        : [{ role: "user", content: userTask }];

      if (surface === "chat" && !options.forceSingleShot && options.appendPromptMessage) {
        messages.push({ role: "user", content: prompt });
      }

      const model = await invokeAgentStream(agentId, messages, {
        surface,
        signalController: surface === "chat" ? new AbortController() : null,
        onChunk(chunk) {
          content += chunk;
          if (surface === "chat" && options.sessionAssistantMessage && !compareRequested && agentId === primaryAgent) {
            options.sessionAssistantMessage.content += chunk;
            saveSession();
            queueChatRender({ enhance: false });
          }
          setSurfaceOutput(surface, agentId, {
            content,
            model: resolvedAgentModel(agentId),
            updatedAt: new Date().toISOString(),
          });
        },
      });
      results.push({ agentId, content, model });
      setSurfaceOutput(surface, agentId, {
        content: content || "[No content returned]",
        model,
        updatedAt: new Date().toISOString(),
      });
    }

    current.activeTab = results[0]?.agentId || "";
    current.status = compareRequested
      ? `Completed ${results.length} local agent responses.`
      : `${agentDisplayLabel(primaryAgent)} completed successfully.`;

    let summaryText = surfaceSummary;
    if (compareRequested && results.length > 1) {
      summaryText = await synthesizeCompareSummary(surface, prompt, results);
      current.summary = `Compare mode complete. ${results.length} agent outputs are available below.`;
    } else {
      current.summary = surfaceSummary;
    }

    renderAgentSurface(surface);
    return {
      primaryAgent,
      compareAgents,
      routedBy: selection === "auto" ? "coordinator" : "manual",
      routeSummary: surfaceSummary,
      summaryText,
      results,
    };
  } finally {
    setSurfaceBusy(surface, false);
    renderAgentManager();
    renderAgentSurface(surface);
  }
}

async function runChatAgentFlow(prompt, options = {}) {
  if (state.busy) {
    return;
  }
  const compareRequested = options.compareRequested || (agentSettings().compare_mode && (options.selection || surfaceAgentState("chat").selected) === "auto");
  const appendUser = options.appendUser !== false;
  const rawPrompt = options.rawPrompt || "";
  const selection = options.selection || surfaceAgentState("chat").selected || agentSettings().default_agent || "auto";
  const promptAlreadyInSession = !appendUser && state.session.messages[latestUserMessageIndex()]?.content === prompt;
  const fallbackModel = selection === "auto"
    ? resolvedAgentModel(heuristicRoute("chat", prompt).agentId)
    : resolvedAgentModel(selection);
  if (!fallbackModel && !compareRequested) {
    appendMessage("assistant", "Error: no local model is currently available for the selected agent.");
    renderMessages();
    notify("No Local Agent Model", "Install or assign a local model for the selected agent before sending a prompt.", { tone: "error", timeout: 4200 });
    return;
  }

  if (appendUser) {
    appendMessage("user", prompt, { surface: "chat" });
    if (rawPrompt) {
      rememberPrompt(rawPrompt);
    }
  }
  state.lastSubmittedContent = prompt;
  const assistantMessage = appendMessage("assistant", "", { surface: "chat", agentId: compareRequested ? "coordinator" : "", multiAgent: compareRequested });
  if (!compareRequested) {
    const previewAgent = selection === "auto" ? heuristicRoute("chat", prompt).agentId : selection;
    assistantMessage.agentId = previewAgent;
    assistantMessage.routeLabel = selection === "auto" ? `Auto -> ${agentDisplayLabel(previewAgent)}` : agentDisplayLabel(previewAgent);
    saveSession();
  }
  renderMessages({ enhanceCode: false });
  setStreamStatus(compareRequested ? "Running multi-agent local review..." : "Routing to the selected local agent...");

  try {
    const plan = await runSurfaceAgents("chat", prompt, {
      selection,
      compareRequested,
      appendPromptMessage: !appendUser && !promptAlreadyInSession,
      sessionAssistantMessage: assistantMessage,
    });
    const primary = plan.primaryAgent;
    const finalContent = compareRequested ? plan.summaryText : (plan.results[0]?.content || "");
    assistantMessage.content = finalContent || "[No content returned]";
    assistantMessage.agentId = compareRequested ? "coordinator" : primary;
    assistantMessage.routeLabel = plan.routeSummary;
    assistantMessage.multiAgent = compareRequested;
    saveSession();
    renderMessages({ enhanceCode: true });
    setStreamStatus(compareRequested
      ? `Completed multi-agent review via Coordinator.`
      : `Completed with ${agentDisplayLabel(primary)}.`);
  } catch (error) {
    assistantMessage.content = error.name === "AbortError" ? "[Generation stopped]" : `Error: ${error.message}`;
    assistantMessage.agentId = compareRequested ? "coordinator" : "";
    saveSession();
    renderMessages({ enhanceCode: true });
    setStreamStatus(error.name === "AbortError" ? "Generation stopped." : `Error: ${error.message}`);
    if (error.name !== "AbortError") {
      notify("Agent Request Failed", error.message, { tone: "error", timeout: 4200 });
    }
  }
}

function mergeSettings(base, patch) {
  if (!patch || typeof patch !== "object") {
    return deepClone(base);
  }
  const next = deepClone(base);
  Object.entries(patch).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value) && next[key] && typeof next[key] === "object" && !Array.isArray(next[key])) {
      next[key] = mergeSettings(next[key], value);
      return;
    }
    next[key] = deepClone(value);
  });
  return next;
}

function legacySettingsPatch() {
  const raw = localStorage.getItem(legacySettingsKey);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      general: {
        onboarding_completed: true,
      },
      assistant: {
        default_model: parsed.defaultModel || defaultAppSettings.assistant.default_model,
        mode: parsed.assistantMode || defaultAppSettings.assistant.mode,
        system_prompt: parsed.systemPrompt || defaultAppSettings.assistant.system_prompt,
      },
      ui: {
        visual_intensity: parsed.visualIntensity || defaultAppSettings.ui.visual_intensity,
      },
      analyzer: {
        default_scan_preset: parsed.scanPreset || defaultAppSettings.analyzer.default_scan_preset,
      },
      ctf: {
        default_category: parsed.ctfCategory || defaultAppSettings.ctf.default_category,
        notes: {
          ...defaultAppSettings.ctf.notes,
          ...(parsed.ctfNotes || {}),
        },
      },
      chat: {
        prompt_history: Array.isArray(parsed.promptHistory) ? parsed.promptHistory : [],
      },
    };
  } catch (_error) {
    return null;
  }
}

function loadSession() {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_error) {
      localStorage.removeItem(storageKey);
    }
  }
  return createFreshSession();
}

function createFreshSession(sessionId = crypto.randomUUID()) {
  const createdAt = new Date().toISOString();
  return {
    id: sessionId,
    createdAt,
    updatedAt: createdAt,
    messages: [
      {
        role: "assistant",
        content: "Welcome Hackloi.\nYour AI Cyber Lab is Ready.",
        createdAt,
      },
    ],
  };
}

function saveSession() {
  state.session.updatedAt = new Date().toISOString();
  localStorage.setItem(storageKey, JSON.stringify(state.session));
  renderSessionMeta();
}

function applySettingsPayload(payload, { resetDraft = true } = {}) {
  state.settings = mergeSettings(defaultAppSettings, payload?.settings || {});
  state.settingsMeta = payload?.meta || { path: "", exists: false };
  state.settingsWarnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
  state.settingsLoaded = true;
  normalizeAgentSelections();
  if (resetDraft) {
    state.settingsDraft = deepClone(state.settings);
    state.settingsDirty = false;
    state.settingsFieldErrors = {};
  }
  renderSettingsWarning();
  renderSettingsFieldErrors();
}

async function fetchSettingsPayload() {
  let payload;
  try {
    payload = await fetchJson("/api/settings");
  } catch (error) {
    payload = {
      settings: deepClone(defaultAppSettings),
      warnings: [
        `Settings endpoint unavailable: ${error.message}. Local defaults were loaded for this session.`,
      ],
      meta: {
        path: "~/.local/share/hackloi-ai/settings.json",
        exists: false,
      },
    };
    notify("Settings Offline", error.message, { tone: "error", timeout: 4200 });
  }
  if (!payload.meta?.exists) {
    const legacyPatch = legacySettingsPatch();
    if (legacyPatch) {
      try {
        payload = await postJson("/api/settings", legacyPatch);
        localStorage.removeItem(legacySettingsKey);
        payload.warnings = [...(payload.warnings || []), "Legacy browser settings were migrated into the local desktop config file."];
      } catch (error) {
        notify("Settings Migration Failed", error.message, { tone: "error", timeout: 4200 });
      }
    }
  }
  applySettingsPayload(payload);
  applySettingsToInterface();
  restartRefreshLoops();
}

function editableSettingsPatchFromForm() {
  return {
    assistant: {
      default_model: elements.settingsDefaultModel.value || currentSettings().assistant.default_model,
      mode: elements.settingsAssistantMode.value || currentSettings().assistant.mode,
      system_prompt: elements.systemPrompt.value.trim() || DEFAULT_SYSTEM_PROMPT,
    },
    ui: {
      visual_intensity: elements.settingsVisualIntensity.value || currentSettings().ui.visual_intensity,
      dashboard_refresh_seconds: Number(elements.settingsDashboardRefresh.value || currentSettings().ui.dashboard_refresh_seconds),
      job_refresh_seconds: Number(elements.settingsJobRefresh.value || currentSettings().ui.job_refresh_seconds),
    },
    chat: {
      prompt_history_limit: Number(elements.settingsPromptHistoryLimit.value || currentSettings().chat.prompt_history_limit),
      attachment_max_count: Number(elements.settingsChatAttachmentMaxCount.value || currentSettings().chat.attachment_max_count),
      attachment_max_file_bytes: Number(elements.settingsChatAttachmentMaxFileBytes.value || currentSettings().chat.attachment_max_file_bytes),
      attachment_max_total_bytes: Number(elements.settingsChatAttachmentMaxTotalBytes.value || currentSettings().chat.attachment_max_total_bytes),
    },
    workspace: {
      import_max_files: Number(elements.settingsWorkspaceImportMaxFiles.value || currentSettings().workspace.import_max_files),
      import_max_file_bytes: Number(elements.settingsWorkspaceImportMaxFileBytes.value || currentSettings().workspace.import_max_file_bytes),
      import_max_total_bytes: Number(elements.settingsWorkspaceImportMaxTotalBytes.value || currentSettings().workspace.import_max_total_bytes),
    },
    analyzer: {
      default_scan_preset: elements.settingsDefaultScanPreset.value || currentSettings().analyzer.default_scan_preset,
    },
    ctf: {
      default_category: elements.settingsDefaultCtfCategory.value || currentSettings().ctf.default_category,
      notes: {
        crypto: elements.settingsCtfNotesCrypto.value,
        web: elements.settingsCtfNotesWeb.value,
        reversing: elements.settingsCtfNotesReversing.value,
        forensics: elements.settingsCtfNotesForensics.value,
      },
    },
  };
}

function syncSettingsDraftFromForm() {
  const nextDraft = mergeSettings(currentSettings(), editableSettingsPatchFromForm());
  state.settingsDraft = nextDraft;
  state.settingsDirty = JSON.stringify(nextDraft) !== JSON.stringify(currentSettings());
  state.settingsFieldErrors = {};
  renderSettingsFieldErrors();
  elements.settingsSaveStatus.textContent = state.settingsDirty
    ? "Unsaved settings changes are ready to apply locally."
    : "No unsaved settings changes.";
  elements.settingsSaveButton.disabled = !state.settingsDirty;
}

function handleSettingsFieldInteraction(event) {
  if (!state.settingsLoaded) {
    return;
  }
  if (event.target.tagName === "TEXTAREA") {
    autosizeTextarea(event.target, event.target === elements.systemPrompt ? 360 : 220);
  }
  syncSettingsDraftFromForm();
}

async function persistSettingsPatch(patch, { successMessage = "", silent = false } = {}) {
  const preservedDraft = state.settingsLoaded ? editableSettingsPatchFromForm() : null;
  const hadDirtyDraft = state.settingsDirty;
  const payload = await postJson("/api/settings", patch);
  applySettingsPayload(payload, { resetDraft: false });
  if (hadDirtyDraft && preservedDraft) {
    state.settingsDraft = mergeSettings(payload.settings, preservedDraft);
    state.settingsDirty = JSON.stringify(state.settingsDraft) !== JSON.stringify(state.settings);
  } else {
    state.settingsDraft = deepClone(state.settings);
    state.settingsDirty = false;
  }
  state.settingsFieldErrors = {};
  renderSettingsFieldErrors();
  applySettingsToInterface();
  restartRefreshLoops();
  if (!silent && successMessage) {
    notify("Settings Updated", successMessage, { tone: "success" });
  }
  if (!silent || state.settingsDirty) {
    elements.settingsSaveStatus.textContent = state.settingsDirty
      ? "Unsaved settings changes are ready to apply locally."
      : (successMessage || "Settings applied locally.");
  }
  return payload.settings;
}

async function saveSettingsFromForm() {
  elements.settingsSaveButton.disabled = true;
  try {
    const payload = await postJson("/api/settings", editableSettingsPatchFromForm());
    applySettingsPayload(payload);
    applySettingsToInterface();
    restartRefreshLoops();
    elements.settingsSaveStatus.textContent = "Settings applied locally.";
    notify("Settings Saved", "The updated preferences are now active across the app.", { tone: "success" });
  } catch (error) {
    if (error.field_errors) {
      state.settingsFieldErrors = error.field_errors;
      renderSettingsFieldErrors();
    }
    elements.settingsSaveStatus.textContent = `Settings save failed: ${error.message}`;
    notify("Settings Save Failed", error.message, { tone: "error", timeout: 4200 });
  } finally {
    elements.settingsSaveButton.disabled = !state.settingsDirty;
  }
}

async function resetSettingsToDefaults() {
  const confirmed = await confirmAction({
    title: "Reset Settings",
    description: "Restore all app preferences to their default local values?",
    confirmLabel: "Reset Settings",
  });
  if (!confirmed) {
    return;
  }
  try {
    elements.settingsResetButton.disabled = true;
    const payload = await postJson("/api/settings/reset", {});
    applySettingsPayload(payload);
    applySettingsToInterface();
    restartRefreshLoops();
    elements.settingsSaveStatus.textContent = "Default settings restored locally.";
    notify("Settings Reset", "Default settings are now active.", { tone: "success" });
  } catch (error) {
    elements.settingsSaveStatus.textContent = `Settings reset failed: ${error.message}`;
    notify("Settings Reset Failed", error.message, { tone: "error", timeout: 4200 });
  } finally {
    elements.settingsResetButton.disabled = !state.settingsLoaded;
  }
}

function apiUrl(path) {
  return `${apiBase}${path}`;
}

function setStreamStatus(text) {
  state.streamStatus = text;
  elements.chatStreamStatus.textContent = text;
}

function setBusy(busy) {
  state.busy = busy;
  elements.sendButton.disabled = busy;
  elements.stopGeneration.disabled = !busy;
  elements.regenerateResponse.disabled = busy || !canRegenerate();
  elements.sendButton.textContent = busy ? "Thinking..." : "Send";
}

function setLauncherBusy(busy) {
  state.launcherBusy = busy;
  elements.clearToolCommand.disabled = busy;
  elements.launcherCommand.disabled = busy;
  elements.launcherConfirm.disabled = busy;
  renderLauncherPreview();
}

function setCodeAssistantBusy(busy) {
  state.codeAssistantBusy = busy;
  document.querySelectorAll(".code-action-button").forEach((button) => {
    button.disabled = busy;
  });
  const hasOutput = Boolean(state.workspace.assistantOutput.trim());
  elements.codeAssistantOpenOutput.disabled = busy || !hasOutput;
  elements.codeAssistantApplyOutput.disabled = busy || !hasOutput;
}

function autosizeTextarea(element, maxHeight = 320) {
  if (!element) {
    return;
  }
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
}

function resetPromptHistoryCursor() {
  state.promptHistoryCursor = -1;
  state.promptDraft = "";
}

function cyclePromptHistory(direction) {
  const promptHistory = chatSettings().prompt_history || [];
  if (!promptHistory.length) {
    return;
  }

  if (state.promptHistoryCursor === -1) {
    state.promptDraft = elements.promptInput.value;
  }

  const nextIndex = Math.min(
    promptHistory.length - 1,
    Math.max(-1, state.promptHistoryCursor + direction),
  );

  state.promptHistoryCursor = nextIndex;
  elements.promptInput.value = nextIndex === -1
    ? state.promptDraft
    : promptHistory[nextIndex];
  autosizeTextarea(elements.promptInput);
}

function queueChatRender({ enhance = false } = {}) {
  chatRenderNeedsEnhance = chatRenderNeedsEnhance || enhance;
  if (chatRenderScheduled) {
    return;
  }
  chatRenderScheduled = true;
  window.requestAnimationFrame(() => {
    chatRenderScheduled = false;
    const shouldEnhance = chatRenderNeedsEnhance || !state.busy;
    chatRenderNeedsEnhance = false;
    renderMessages({ enhanceCode: shouldEnhance });
  });
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(isoString) {
  if (!isoString) {
    return "Unknown";
  }
  return new Date(isoString).toLocaleString();
}

function chatShouldStickToBottom() {
  const distance = elements.chatFeed.scrollHeight - elements.chatFeed.scrollTop - elements.chatFeed.clientHeight;
  return distance < 48;
}

function formatBytes(value) {
  if (!value && value !== 0) {
    return "Unknown";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function renderSettingsFieldErrors() {
  elements.settingsErrorFields.forEach((node) => {
    const message = state.settingsFieldErrors[node.dataset.settingError] || "";
    node.textContent = message;
    node.classList.toggle("is-visible", Boolean(message));
  });
  elements.settingInputs.forEach((input) => {
    input.classList.toggle("input-invalid", Boolean(state.settingsFieldErrors[input.dataset.settingField]));
  });
}

function renderSettingsWarning() {
  const pathCopy = state.settingsMeta.path || "~/.local/share/hackloi-ai/settings.json";
  if (state.settingsWarnings.length) {
    elements.settingsWarning.textContent = state.settingsWarnings.join(" ");
    return;
  }
  elements.settingsWarning.textContent = `Settings load from ${pathCopy} and apply without any cloud dependency.`;
}

function renderAppVersionMeta() {
  const info = appInfo();
  elements.appVersionChip.textContent = `Version: ${info.version}`;
  elements.aboutVersionChip.textContent = `Version ${info.version}`;
  elements.onboardingVersion.textContent = `Version ${info.version}`;
  elements.aboutDescription.textContent = info.description;
}

function renderSettingsSummaryPanels() {
  const info = appInfo();
  const runtime = currentRuntime();
  const health = state.health?.ollama || { reachable: false, model_count: 0 };
  const refreshSeconds = currentSettings().ui.dashboard_refresh_seconds;
  const jobRefreshSeconds = currentSettings().ui.job_refresh_seconds;
  const onboardingCopy = generalSettings().onboarding_completed ? "Completed" : "Pending";
  const defaultAgent = agentDisplayLabel(agentSettings().default_agent);
  elements.settingsGeneralSummary.innerHTML = `
    <div class="meta-row"><span>Application</span><strong>${escapeHtml(info.name)}</strong></div>
    <div class="meta-row"><span>Version</span><strong>${escapeHtml(info.version)}</strong></div>
    <div class="meta-row"><span>Welcome Guide</span><strong>${escapeHtml(onboardingCopy)}</strong></div>
    <div class="meta-row"><span>Config Path</span><strong>${escapeHtml(state.settingsMeta.path || "~/.local/share/hackloi-ai/settings.json")}</strong></div>
  `;
  elements.settingsModelsSummary.innerHTML = `
    <div class="meta-row"><span>Active Model</span><strong>${escapeHtml(selectedModelName() || "Unavailable")}</strong></div>
    <div class="meta-row"><span>Loaded Model</span><strong>${escapeHtml(state.activeLoadedModel || "None")}</strong></div>
    <div class="meta-row"><span>Configured Default</span><strong>${escapeHtml(currentSettings().assistant.default_model || "Unavailable")}</strong></div>
    <div class="meta-row"><span>Ollama Status</span><strong>${health.reachable ? "Reachable" : "Unavailable"}</strong></div>
  `;
  elements.settingsPrivacySummary.innerHTML = `
    <div class="meta-row"><span>Local Only</span><strong>${runtime.local_only ? "Enabled" : "Disabled"}</strong></div>
    <div class="meta-row"><span>Web UI Host</span><strong>${escapeHtml((runtime.webui?.host || "127.0.0.1"))}:${runtime.webui?.port || 3000}</strong></div>
    <div class="meta-row"><span>Ollama Endpoint</span><strong>${escapeHtml(runtime.ollama?.base_url || "http://127.0.0.1:11434")}</strong></div>
    <div class="meta-row"><span>Workspace Root</span><strong>${escapeHtml(runtime.workspace_root || "Unavailable")}</strong></div>
  `;
  elements.settingsDeveloperSummary.innerHTML = `
    <div class="meta-row"><span>Visual Intensity</span><strong>${escapeHtml(currentSettings().ui.visual_intensity)}</strong></div>
    <div class="meta-row"><span>Dashboard Refresh</span><strong>${refreshSeconds}s</strong></div>
    <div class="meta-row"><span>Job Refresh</span><strong>${jobRefreshSeconds}s</strong></div>
    <div class="meta-row"><span>Default Agent</span><strong>${escapeHtml(defaultAgent)}</strong></div>
    <div class="meta-row"><span>Runtime</span><strong>${isTauriRuntime ? "Tauri desktop" : "Browser dashboard"}</strong></div>
  `;
}

function renderAbout() {
  const info = appInfo();
  const runtime = currentRuntime();
  const health = state.health?.ollama || { reachable: false, model_count: 0 };
  elements.aboutIdentity.innerHTML = `
    <div class="meta-row"><span>Name</span><strong>${escapeHtml(info.name)}</strong></div>
    <div class="meta-row"><span>Version</span><strong>${escapeHtml(info.version)}</strong></div>
    <div class="meta-row"><span>Identifier</span><strong>${escapeHtml(info.identifier || "com.hackloi.cyberlab")}</strong></div>
    <div class="meta-row"><span>Desktop Title</span><strong>${escapeHtml(info.title || info.name)}</strong></div>
  `;
  elements.aboutLocal.innerHTML = `
    <div class="meta-row"><span>AI Runtime</span><strong>Ollama on loopback</strong></div>
    <div class="meta-row"><span>Cloud Routing</span><strong>Disabled</strong></div>
    <div class="meta-row"><span>Tool Execution</span><strong>Explicit local confirmation required</strong></div>
    <div class="meta-row"><span>Workspace Root</span><strong>${escapeHtml(runtime.workspace_root || "Unavailable")}</strong></div>
  `;
  elements.aboutSystem.innerHTML = `
    <div class="meta-row"><span>Platform</span><strong>${escapeHtml(info.runtime?.platform || "Unknown")}</strong></div>
    <div class="meta-row"><span>Python</span><strong>${escapeHtml(info.runtime?.python || "Unknown")}</strong></div>
    <div class="meta-row"><span>Ollama Status</span><strong>${health.reachable ? "Reachable" : "Unavailable"}</strong></div>
    <div class="meta-row"><span>Installed Models</span><strong>${state.models.length}</strong></div>
  `;
  elements.aboutLicense.innerHTML = `
    <div class="meta-row"><span>License</span><strong>${escapeHtml(info.license || "Not specified in package metadata.")}</strong></div>
    <div class="meta-row"><span>Bundle Output</span><strong>${escapeHtml(info.bundle_output || "src-tauri/target/release/bundle")}</strong></div>
    <div class="meta-row"><span>Build Type</span><strong>${isTauriRuntime ? "Desktop runtime" : "Local web runtime"}</strong></div>
    <div class="meta-row"><span>Support Model</span><strong>Local-only workflow, no hidden network dependency</strong></div>
  `;
}

function renderModelSetupGuide() {
  const configuredDefault = currentSettings().assistant.default_model || "hackloi-assistant";
  const activeModel = selectedModelName();
  const loadedModel = state.activeLoadedModel || "None";
  const noModels = !state.models.length;
  elements.modelSetupStatus.textContent = noModels
    ? "No local models were detected yet. Pull a recommended Ollama model, then return here to choose your default assistant."
    : "Select a local model profile, copy pull commands for missing models, and keep the active assistant visible at a glance.";
  const summaryCards = [
    { label: "Installed", value: String(state.models.length), detail: noModels ? "No Ollama tags detected" : "Local models ready" },
    { label: "Configured Default", value: configuredDefault, detail: "Used for new chat and code requests" },
    { label: "Selected", value: activeModel || "Unavailable", detail: "The next request uses this model" },
    { label: "Loaded", value: loadedModel, detail: "Current model in Ollama memory" },
  ];
  elements.modelSetupSummary.innerHTML = summaryCards.map((item) => `
    <article class="status-card dashboard-metric-card">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.detail)}</small>
    </article>
  `).join("");
  if (!state.recommendations.length) {
    elements.modelSetupGuide.innerHTML = `<div class="empty-state">Model recommendations are not available right now.</div>`;
    return;
  }
  elements.modelSetupGuide.innerHTML = state.recommendations.map((item) => {
    const actionButton = item.installed
      ? `<button class="ghost-button wizard-set-default" data-model="${escapeHtml(item.name)}" type="button">Use As Default</button>`
      : `<button class="ghost-button wizard-copy-pull" data-command="${escapeHtml(item.pull_command)}" type="button">Copy Pull Command</button>`;
    return `
      <article class="recommendation-card">
        <header>
          <div>
            <h3>${escapeHtml(item.label)}</h3>
            <p>${escapeHtml(item.description)}</p>
          </div>
          <span class="pill ${item.installed ? "pill-online" : "pill-offline"}">${item.installed ? "Installed" : "Missing"}</span>
        </header>
        <div class="recommendation-meta">
          <div class="meta-row"><span>Model</span><strong>${escapeHtml(item.name)}</strong></div>
          <div class="meta-row"><span>RAM Estimate</span><strong>${escapeHtml(item.ram_hint || item.size_hint || "Local sizing varies")}</strong></div>
          <div class="meta-row"><span>Pull</span><strong>${escapeHtml(item.pull_command)}</strong></div>
        </div>
        <div class="tool-footer">
          ${actionButton}
        </div>
      </article>
    `;
  }).join("");
}

function setOnboardingVisibility(visible) {
  state.onboardingVisible = visible;
  elements.onboardingOverlay.hidden = !visible;
  document.body.classList.toggle("onboarding-open", visible);
}

function renderOnboarding() {
  const info = appInfo();
  const noModels = !state.models.length;
  elements.onboardingVersion.textContent = `Version ${info.version}`;
  elements.onboardingModelStatus.textContent = noModels
    ? "No local models are installed yet. Start with one of these Ollama pull commands."
    : `Detected ${state.models.length} local model${state.models.length === 1 ? "" : "s"}. You can still configure a preferred default before starting.`;
  const items = (state.recommendations.length ? state.recommendations : [{
    name: "qwen2.5-coder:7b",
    label: "Qwen 2.5 Coder 7B",
    description: "Recommended first coding model.",
    ram_hint: "8-12 GB RAM",
    pull_command: "ollama pull qwen2.5-coder:7b",
    installed: false,
  }]).slice(0, 3);
  elements.onboardingModelList.innerHTML = items.map((item) => `
    <article class="recommendation-card">
      <header>
        <div>
          <h3>${escapeHtml(item.label)}</h3>
          <p>${escapeHtml(item.description)}</p>
        </div>
        <span class="pill ${item.installed ? "pill-online" : "pill-offline"}">${item.installed ? "Installed" : "Missing"}</span>
      </header>
      <div class="recommendation-meta">
        <div class="meta-row"><span>Model</span><strong>${escapeHtml(item.name)}</strong></div>
        <div class="meta-row"><span>RAM Estimate</span><strong>${escapeHtml(item.ram_hint || item.size_hint || "Local sizing varies")}</strong></div>
      </div>
      <div class="tool-footer">
        ${item.installed
          ? `<button class="ghost-button wizard-set-default" data-model="${escapeHtml(item.name)}" type="button">Use As Default</button>`
          : `<button class="ghost-button wizard-copy-pull" data-command="${escapeHtml(item.pull_command)}" type="button">Copy Pull Command</button>`}
      </div>
    </article>
  `).join("");
}

async function completeOnboarding({ openModels = false } = {}) {
  try {
    await persistSettingsPatch(
      { general: { onboarding_completed: true } },
      { silent: true },
    );
  } catch (error) {
    elements.onboardingModelStatus.textContent = `Could not store onboarding state: ${error.message}`;
    return;
  }
  setOnboardingVisibility(false);
  if (openModels) {
    setActiveView("models");
    window.requestAnimationFrame(() => {
      elements.modelSetupWizard?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function maybeShowOnboarding() {
  if (!state.settingsLoaded || generalSettings().onboarding_completed) {
    setOnboardingVisibility(false);
    return;
  }
  renderOnboarding();
  setOnboardingVisibility(true);
}

function renderSafetySettings() {
  const safety = currentSettings().safety || defaultAppSettings.safety;
  const toolAllowlist = Array.isArray(safety.tool_allowlist) ? safety.tool_allowlist.join(", ") : "Unavailable";
  elements.settingsSafetyStatus.textContent = "These protections are enforced locally and remain read-only in the UI.";
  elements.settingsSafetyGrid.innerHTML = `
    <div class="meta-row"><span>Local only mode</span><strong>${safety.local_only_mode ? "Enabled" : "Disabled"}</strong></div>
    <div class="meta-row"><span>Web UI host</span><strong>${escapeHtml(safety.webui_host || "127.0.0.1")}</strong></div>
    <div class="meta-row"><span>Ollama base URL</span><strong>${escapeHtml(safety.ollama_base_url || "http://127.0.0.1:11434")}</strong></div>
    <div class="meta-row"><span>Command confirmation</span><strong>${safety.command_confirmation_required ? "Required" : "Disabled"}</strong></div>
    <div class="meta-row"><span>Hidden execution</span><strong>${safety.hidden_execution_disabled ? "Disabled" : "Enabled"}</strong></div>
    <div class="meta-row"><span>Tool allowlist</span><strong>${escapeHtml(toolAllowlist)}</strong></div>
  `;
}

function renderSettingsForm() {
  const settings = currentDraftSettings();
  elements.systemPrompt.value = settings.assistant.system_prompt;
  elements.settingsDefaultModel.value = settings.assistant.default_model;
  elements.settingsAssistantMode.value = settings.assistant.mode;
  elements.settingsVisualIntensity.value = settings.ui.visual_intensity;
  elements.settingsDashboardRefresh.value = String(settings.ui.dashboard_refresh_seconds);
  elements.settingsJobRefresh.value = String(settings.ui.job_refresh_seconds);
  elements.settingsPromptHistoryLimit.value = String(settings.chat.prompt_history_limit);
  elements.settingsChatAttachmentMaxCount.value = String(settings.chat.attachment_max_count);
  elements.settingsChatAttachmentMaxFileBytes.value = String(settings.chat.attachment_max_file_bytes);
  elements.settingsChatAttachmentMaxTotalBytes.value = String(settings.chat.attachment_max_total_bytes);
  elements.settingsWorkspaceImportMaxFiles.value = String(settings.workspace.import_max_files);
  elements.settingsWorkspaceImportMaxFileBytes.value = String(settings.workspace.import_max_file_bytes);
  elements.settingsWorkspaceImportMaxTotalBytes.value = String(settings.workspace.import_max_total_bytes);
  elements.settingsDefaultScanPreset.value = settings.analyzer.default_scan_preset;
  elements.settingsDefaultCtfCategory.value = settings.ctf.default_category;
  elements.settingsCtfNotesCrypto.value = settings.ctf.notes.crypto;
  elements.settingsCtfNotesWeb.value = settings.ctf.notes.web;
  elements.settingsCtfNotesReversing.value = settings.ctf.notes.reversing;
  elements.settingsCtfNotesForensics.value = settings.ctf.notes.forensics;
  elements.settingsSaveStatus.textContent = state.settingsDirty ? "Unsaved settings changes are ready to apply locally." : "No unsaved settings changes.";
  autosizeTextarea(elements.systemPrompt, 360);
  autosizeTextarea(elements.settingsCtfNotesCrypto, 220);
  autosizeTextarea(elements.settingsCtfNotesWeb, 220);
  autosizeTextarea(elements.settingsCtfNotesReversing, 220);
  autosizeTextarea(elements.settingsCtfNotesForensics, 220);
  elements.settingsSaveButton.disabled = !state.settingsDirty;
  elements.settingsResetButton.disabled = !state.settingsLoaded;
}

function applySettingsToInterface() {
  syncAssistantModeSelects();
  renderAppVersionMeta();
  renderSettingsForm();
  renderSettingsSummaryPanels();
  renderSettingsWarning();
  renderSafetySettings();
  applyVisualIntensity();
  renderPromptHistory();
  renderScanPresets();
  renderCtfHelper();
  renderModels();
  renderModelSetupGuide();
  renderMonitoring();
  renderDashboard();
  renderAbout();
  renderAllAgentSurfaces();
}

function restartRefreshLoops() {
  if (state.intervals.dashboard) {
    window.clearInterval(state.intervals.dashboard);
  }
  if (state.intervals.jobs) {
    window.clearInterval(state.intervals.jobs);
  }
  state.intervals.dashboard = window.setInterval(refreshDashboardData, currentSettings().ui.dashboard_refresh_seconds * 1000);
  state.intervals.jobs = window.setInterval(() => {
    if (state.toolJobs.some((job) => job.status === "running")) {
      refreshDashboardData();
    }
  }, currentSettings().ui.job_refresh_seconds * 1000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeLanguage(language) {
  const lower = String(language || "").toLowerCase();
  if (lower === "bash" || lower === "zsh") {
    return "shell";
  }
  if (lower === "plaintext" || lower === "text") {
    return "plaintext";
  }
  return lower || "plaintext";
}

function inferLanguage(path) {
  const lower = (path || "").toLowerCase();
  const match = Object.entries(languageMap).find(([ext]) => lower.endsWith(ext));
  return match ? match[1] : "markdown";
}

function extensionForLanguage(language) {
  return extensionByLanguage[normalizeLanguage(language)] || ".txt";
}

function basename(path) {
  if (!path) {
    return "";
  }
  return path.split("/").pop() || path;
}

function dirname(path) {
  if (!path || !path.includes("/")) {
    return "";
  }
  return path.split("/").slice(0, -1).join("/");
}

function clipboardWrite(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
  return Promise.resolve();
}

async function copyToClipboard(text, successTitle, successMessage) {
  await clipboardWrite(text);
  notify(successTitle, successMessage, { tone: "success" });
}

function renderInlineMarkdown(text) {
  const codeTokens = [];
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/`([^`]+)`/g, (_match, code) => {
    const token = `__CODE_${codeTokens.length}__`;
    codeTokens.push(code);
    return token;
  });
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    return `<span class="inline-link">${label} <small>${escapeHtml(url)}</small></span>`;
  });
  codeTokens.forEach((code, index) => {
    escaped = escaped.replace(`__CODE_${index}__`, `<code>${escapeHtml(code)}</code>`);
  });
  return escaped;
}

function renderMarkdownTextBlock(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const html = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }
    html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) {
      return;
    }
    html.push(`<ul>${list.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(headingMatch[1].length, 4);
      html.push(`<h${level + 2}>${renderInlineMarkdown(headingMatch[2])}</h${level + 2}>`);
      return;
    }
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      list.push(bulletMatch[1]);
      return;
    }
    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${renderInlineMarkdown(trimmed.slice(1).trim())}</blockquote>`);
      return;
    }
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  return html.join("");
}

function renderRichText(text, sourceKey) {
  const codeBlocks = [];
  const parts = [];
  const pattern = /```([a-zA-Z0-9.+_-]*)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const plain = text.slice(lastIndex, match.index);
    if (plain.trim()) {
      parts.push(renderMarkdownTextBlock(plain));
    }
    const language = normalizeLanguage(match[1] || "plaintext");
    const code = match[2].replace(/\n$/, "");
    const blockIndex = codeBlocks.length;
    codeBlocks.push({ language, code });
    parts.push(`
      <div class="code-block" data-source-key="${escapeHtml(sourceKey)}" data-block-index="${blockIndex}">
        <div class="code-block-toolbar">
          <span class="code-block-language">${escapeHtml(language)}</span>
          <div class="code-block-actions">
            <button class="ghost-button code-copy-button" type="button" data-source-key="${escapeHtml(sourceKey)}" data-block-index="${blockIndex}">Copy code</button>
            <button class="ghost-button code-open-button" type="button" data-source-key="${escapeHtml(sourceKey)}" data-block-index="${blockIndex}">Open in editor</button>
          </div>
        </div>
        <pre class="chat-code" data-source-key="${escapeHtml(sourceKey)}" data-block-index="${blockIndex}" data-language="${escapeHtml(language)}">${escapeHtml(code)}</pre>
      </div>
    `);
    lastIndex = pattern.lastIndex;
  }

  const trailing = text.slice(lastIndex);
  if (trailing.trim()) {
    parts.push(renderMarkdownTextBlock(trailing));
  }
  if (!parts.length && text) {
    parts.push(`<p>${renderInlineMarkdown(text)}</p>`);
  }

  state.renderedCodeBlocks.set(sourceKey, codeBlocks);
  return {
    html: parts.join(""),
    codeBlocks,
  };
}

async function enhanceCodeBlocks(root = document) {
  const nodes = Array.from(root.querySelectorAll(".chat-code:not([data-enhanced])"));
  if (!nodes.length) {
    return;
  }
  let monaco = null;
  try {
    monaco = await loadMonaco();
  } catch (_error) {
    monaco = null;
  }
  for (const node of nodes) {
    const sourceKey = node.dataset.sourceKey || "";
    const blockIndex = Number(node.dataset.blockIndex);
    const block = state.renderedCodeBlocks.get(sourceKey)?.[blockIndex];
    if (!block) {
      node.dataset.enhanced = "true";
      continue;
    }
    if (monaco?.editor?.colorize) {
      try {
        const html = await monaco.editor.colorize(block.code, normalizeLanguage(block.language), { theme: "hackloi-cyber" });
        node.innerHTML = html;
      } catch (_error) {
        node.textContent = block.code;
      }
    } else {
      node.textContent = block.code;
    }
    node.dataset.enhanced = "true";
  }
}

function modeMeta() {
  return assistantModes[currentSettings().assistant.mode] || assistantModes.standard;
}

function updateModePresentation() {
  const meta = modeMeta();
  elements.assistantModeDescription.textContent = meta.description;
  elements.activeModeLabel.textContent = `Mode: ${meta.label}`;
  elements.activeModeChip.textContent = `Mode: ${meta.label}`;
  elements.heroModeChip.textContent = `${meta.label} Mode`;
  elements.modelsModeCopy.textContent = meta.label;
  elements.assistantModeSelect.value = currentSettings().assistant.mode;
  elements.settingsAssistantMode.value = currentDraftSettings().assistant.mode;
}

function updateDefaultModelPresentation() {
  const defaultModel = currentSettings().assistant.default_model || "pending";
  const resolvedModel = resolveInstalledModelName(defaultModel);
  const label = resolvedModel && resolvedModel !== defaultModel
    ? `${defaultModel} -> ${resolvedModel}`
    : defaultModel;
  elements.defaultModelLabel.textContent = `Default: ${label}`;
  elements.heroDefaultModel.textContent = `Default: ${label}`;
}

function currentRuntime() {
  return state.system?.runtime || {
    local_only: true,
    workdir: "",
    active_model: "",
    running_models: [],
    workspace: {},
    ollama: {},
    webui: {},
    workspace_root: "",
  };
}

function renderRuntimeInfo() {
  const health = state.health || { ollama: { reachable: false, model_count: 0 } };
  const runtime = currentRuntime();
  elements.runtimeInfo.innerHTML = `
    <div class="meta-row"><span>Runtime</span><strong>${isTauriRuntime ? "Tauri desktop" : "Browser dashboard"}</strong></div>
    <div class="meta-row"><span>API base</span><strong>${escapeHtml(apiBase || "relative")}</strong></div>
    <div class="meta-row"><span>Ollama</span><strong>${health.ollama.reachable ? "Reachable" : "Unavailable"}</strong></div>
    <div class="meta-row"><span>Model count</span><strong>${health.ollama.model_count || 0}</strong></div>
    <div class="meta-row"><span>Loaded model</span><strong>${escapeHtml(state.activeLoadedModel || "None")}</strong></div>
    <div class="meta-row"><span>Workspace root</span><strong>${escapeHtml(runtime.workspace_root || "Unavailable")}</strong></div>
  `;
}

function renderLocalStatus() {
  const runtime = currentRuntime();
  const webui = runtime.webui || {};
  const ollama = runtime.ollama || {};
  elements.localStatus.innerHTML = `
    <div class="meta-row"><span>Endpoint</span><strong>${escapeHtml(webui.host || "127.0.0.1")}:${webui.port || 3000}</strong></div>
    <div class="meta-row"><span>Local-only</span><strong>${runtime.local_only ? "Yes" : "No"}</strong></div>
    <div class="meta-row"><span>Ollama URL</span><strong>${escapeHtml(ollama.base_url || "local")}</strong></div>
    <div class="meta-row"><span>Loaded model</span><strong>${escapeHtml(state.activeLoadedModel || "None")}</strong></div>
    <div class="meta-row"><span>AI Home</span><strong>${escapeHtml(runtime.ai_home || "Unavailable")}</strong></div>
  `;
  elements.localOnlyChip.textContent = runtime.local_only ? "Local Only" : "Non-local";
}

function renderHealth(health) {
  state.health = health;
  const reachable = Boolean(health?.ollama?.reachable);
  elements.ollamaStatus.textContent = reachable ? "Reachable" : "Unavailable";
  elements.modelCount.textContent = String(health?.ollama?.model_count || 0);
  elements.healthPill.textContent = reachable ? "Online" : "Offline";
  elements.healthPill.className = `pill ${reachable ? "pill-online" : "pill-offline"}`;
  elements.runtimeMode.textContent = isTauriRuntime ? "Desktop" : "Browser";
  elements.desktopModeCopy.textContent = isTauriRuntime ? "Tauri" : "Browser";
  elements.apiOrigin.textContent = `API: ${apiBase || "same origin"}`;
  renderRuntimeInfo();
}

function fillSelect(select, options, selectedValue, emptyLabel = "No models found") {
  select.innerHTML = "";
  if (!options.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyLabel;
    select.appendChild(option);
    return;
  }
  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.appendChild(option);
  });
  select.value = selectedValue || options[0].value;
}

function installedModelOptions() {
  return state.models.map((model) => ({
    value: model.name,
    label: model.name,
  }));
}

function modelBaseName(name) {
  return String(name || "").split(":")[0];
}

function resolveInstalledModelName(preference) {
  if (!preference) {
    return "";
  }
  const exact = state.models.find((model) => model.name === preference);
  if (exact) {
    return exact.name;
  }
  const baseName = modelBaseName(preference);
  const baseMatch = state.models.find((model) => modelBaseName(model.name) === baseName);
  return baseMatch?.name || "";
}

function withConfiguredModelOption(options, configuredValue) {
  if (!configuredValue || options.some((option) => option.value === configuredValue)) {
    return options;
  }
  const resolvedModel = resolveInstalledModelName(configuredValue);
  return [
    {
      value: configuredValue,
      label: resolvedModel
        ? `${configuredValue} (resolves to ${resolvedModel})`
        : `${configuredValue} (configured, unavailable)`,
    },
    ...options,
  ];
}

function selectedModelName() {
  const available = state.models.map((model) => model.name);
  const active = elements.modelSelect.value;
  if (available.includes(active)) {
    return active;
  }
  const preferred = [currentSettings().assistant.default_model, "hackloi-assistant", "phi4-mini", available[0]].filter(Boolean);
  for (const name of preferred) {
    const resolved = resolveInstalledModelName(name);
    if (resolved) {
      return resolved;
    }
  }
  return "";
}

function syncModelSelectors() {
  const options = installedModelOptions();
  const active = selectedModelName();
  const currentDefault = currentSettings().assistant.default_model;
  const draftDefault = currentDraftSettings().assistant.default_model;
  const settingsModelOptions = withConfiguredModelOption(options, draftDefault);
  const quickDefaultOptions = withConfiguredModelOption(options, currentDefault);
  fillSelect(elements.modelSelect, options, active);
  fillSelect(elements.defaultModelSelect, quickDefaultOptions, currentDefault);
  fillSelect(elements.settingsDefaultModel, settingsModelOptions, draftDefault);
  elements.activeModelLabel.textContent = `Model: ${selectedModelName() || "unavailable"}`;
  updateDefaultModelPresentation();
}

function renderModels() {
  syncModelSelectors();
  const configuredDefault = currentSettings().assistant.default_model || "Unavailable";
  const resolvedDefault = resolveInstalledModelName(configuredDefault);
  const resolvedCopy = resolvedDefault && resolvedDefault !== configuredDefault
    ? ` Resolved locally as ${resolvedDefault}.`
    : "";
  elements.modelsStatus.textContent = `Selected for upcoming local requests: ${selectedModelName() || "Unavailable"}. Configured default: ${configuredDefault}.${resolvedCopy}`;
  elements.modelGrid.innerHTML = "";
  if (!state.models.length) {
    elements.modelGrid.innerHTML = `<div class="empty-state">No local models detected yet. Run setup to download phi4-mini and qwen2.5-coder.</div>`;
    return;
  }
  const active = selectedModelName();
  const defaultModel = resolveInstalledModelName(currentSettings().assistant.default_model);
  state.models.forEach((model) => {
    const card = document.createElement("article");
    const activeBadge = model.name === active ? '<span class="pill pill-online">Active</span>' : "";
    const defaultBadge = model.name === defaultModel ? '<span class="pill pill-default">Default</span>' : "";
    const loadedBadge = state.runningModels.some((item) => item.name === model.name) ? '<span class="pill pill-online">Loaded</span>' : "";
    card.className = "model-card";
    card.innerHTML = `
      <header>
        <div>
          <h3>${escapeHtml(model.name)}</h3>
          <p>${model.modified_at ? `Updated ${formatDateTime(model.modified_at)}` : "Local model available."}</p>
        </div>
        <div class="card-badges">${activeBadge}${defaultBadge}${loadedBadge}</div>
      </header>
      <div class="model-meta-grid">
        <div class="model-meta"><span>Size</span><strong>${formatBytes(model.size)}</strong></div>
        <div class="model-meta"><span>Est. RAM</span><strong>${formatBytes(model.estimated_ram)}</strong></div>
        <div class="model-meta"><span>Family</span><strong>${escapeHtml(model.family || "Unknown")}</strong></div>
        <div class="model-meta"><span>Params</span><strong>${escapeHtml(model.parameter_size || model.quantization || "Unknown")}</strong></div>
      </div>
      <div class="tool-footer">
        <button class="ghost-button model-activate" data-model="${escapeHtml(model.name)}" type="button">Use model</button>
      </div>
    `;
    elements.modelGrid.appendChild(card);
  });
  renderAgentManager();
}

function renderRecommendations() {
  elements.modelRecommendations.innerHTML = "";
  if (!state.recommendations.length) {
    elements.modelRecommendations.innerHTML = `<div class="empty-state">No recommendations available right now.</div>`;
    return;
  }
  state.recommendations.forEach((item) => {
    const card = document.createElement("article");
    card.className = "recommendation-card";
    card.innerHTML = `
      <header>
        <div>
          <h3>${escapeHtml(item.label)}</h3>
          <p>${escapeHtml(item.description)}</p>
        </div>
        <span class="pill ${item.installed ? "pill-online" : "pill-offline"}">${item.installed ? "Installed" : "Missing"}</span>
      </header>
      <div class="recommendation-meta">
        <div class="meta-row"><span>Model</span><strong>${escapeHtml(item.name)}</strong></div>
        <div class="meta-row"><span>Size</span><strong>${escapeHtml(item.size_hint)}</strong></div>
        <div class="meta-row"><span>RAM Estimate</span><strong>${escapeHtml(item.ram_hint || "Local sizing varies")}</strong></div>
      </div>
      <div class="tool-footer">
        <code>${escapeHtml(item.pull_command)}</code>
        <button class="ghost-button copy-pull-command" data-command="${escapeHtml(item.pull_command)}" type="button">Copy pull</button>
        ${item.installed ? `<button class="ghost-button recommendation-set-default" data-model="${escapeHtml(item.name)}" type="button">Use as default</button>` : ""}
      </div>
    `;
    elements.modelRecommendations.appendChild(card);
  });
}

function renderTools() {
  elements.toolList.innerHTML = "";
  state.tools.forEach((tool) => {
    const canLaunch = allowedToolExecutables.has(tool.command);
    const card = document.createElement("article");
    card.className = "tool-card";
    card.innerHTML = `
      <div class="tool-head">
        <strong>${escapeHtml(tool.label)}</strong>
        <span class="pill ${tool.installed ? "pill-online" : "pill-offline"}">${tool.installed ? "Installed" : "Missing"}</span>
      </div>
      <p>${escapeHtml(tool.description)}</p>
      <div class="tool-footer">
        <code>${escapeHtml(tool.snippet)}</code>
        <button class="ghost-button copy-tool" type="button" data-command="${escapeHtml(tool.snippet)}">Copy</button>
        ${canLaunch
          ? `<button class="ghost-button use-tool-template" type="button" data-command="${escapeHtml(tool.snippet)}">Use in launcher</button>`
          : `<span class="subtle-label">Copy-only tool</span>`}
      </div>
    `;
    elements.toolList.appendChild(card);
  });
}

function renderMonitoring() {
  const system = state.system;
  if (!system) {
    elements.sidebarMonitoring.innerHTML = "";
    elements.heroMonitorGrid.innerHTML = "";
    renderSettingsSummaryPanels();
    renderAbout();
    return;
  }
  const primaryModelLabel = state.activeLoadedModel ? "Loaded Model" : "Selected Model";
  const cards = [
    { label: "CPU", value: `${system.cpu.usage_percent}%` },
    { label: "RAM", value: `${system.memory.usage_percent}%` },
    { label: "Disk", value: `${system.disk.usage_percent}%` },
    { label: "Ollama", value: system.runtime.ollama.reachable ? "Ready" : "Offline" },
    { label: primaryModelLabel, value: state.activeLoadedModel || selectedModelName() || "Unavailable" },
  ];
  const markup = cards.map((item) => `
    <article class="status-card monitor-card">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </article>
  `).join("");
  elements.sidebarMonitoring.innerHTML = markup;
  elements.heroMonitorGrid.innerHTML = markup;
  elements.launcherWorkdir.textContent = system.runtime.workdir || "~/.local/share/hackloi-ai";
  renderRuntimeInfo();
  renderLocalStatus();
  renderSettingsSummaryPanels();
  renderAbout();
}

function renderModelRuntime() {
  elements.loadedModelCopy.textContent = state.activeLoadedModel || "Idle";
  elements.modelRuntimeGrid.innerHTML = "";

  if (!state.runningModels.length) {
    const emptyMarkup = `<div class="empty-state">Ollama does not currently have a model loaded in memory.</div>`;
    elements.modelRuntimeGrid.innerHTML = emptyMarkup;
    elements.dashboardRuntimeModels.innerHTML = emptyMarkup;
    return;
  }

  const cards = state.runningModels.map((model) => `
    <article class="recommendation-card">
      <header>
        <div>
          <h3>${escapeHtml(model.name)}</h3>
          <p>${escapeHtml(model.parameter_size || model.family || "Loaded model")}</p>
        </div>
        <span class="pill pill-online">Loaded</span>
      </header>
      <div class="recommendation-meta">
        <div class="meta-row"><span>VRAM / RAM</span><strong>${formatBytes(model.size_vram || model.size)}</strong></div>
        <div class="meta-row"><span>Format</span><strong>${escapeHtml(model.format || "Unknown")}</strong></div>
        <div class="meta-row"><span>Quant</span><strong>${escapeHtml(model.quantization || "Unknown")}</strong></div>
      </div>
    </article>
  `).join("");

  elements.modelRuntimeGrid.innerHTML = cards;
  elements.dashboardRuntimeModels.innerHTML = cards;
}

function renderDashboard() {
  const system = state.system;
  const runtime = currentRuntime();
  const reachable = Boolean(state.health?.ollama?.reachable);

  elements.dashboardRuntimeChip.textContent = `Runtime: ${isTauriRuntime ? "tauri" : "browser"}`;
  elements.dashboardOllamaChip.textContent = reachable
    ? `Ollama: ${state.activeLoadedModel || "ready"}`
    : "Ollama: offline";
  elements.dashboardProjectChip.textContent = `Project: ${state.workspace.projectName || "Workspace"}`;

  if (!system) {
    elements.dashboardMetrics.innerHTML = `<div class="empty-state">System telemetry will appear here once the backend responds.</div>`;
    elements.dashboardWorkspaceSummary.innerHTML = `<div class="empty-state">Workspace metadata is not available yet.</div>`;
    elements.dashboardJobList.innerHTML = `<div class="empty-state">No recent jobs yet.</div>`;
    return;
  }

  const metrics = [
    { label: "CPU Usage", value: `${system.cpu.usage_percent}%`, detail: `${system.cpu.count || 0} cores · load ${system.cpu.load_1}` },
    { label: "RAM", value: `${system.memory.usage_percent}%`, detail: `${formatBytes(system.memory.used)} / ${formatBytes(system.memory.total)}` },
    { label: "Disk", value: `${system.disk.usage_percent}%`, detail: `${formatBytes(system.disk.used)} / ${formatBytes(system.disk.total)}` },
    { label: "Ollama", value: reachable ? "Online" : "Offline", detail: `${state.models.length} installed · ${state.runningModels.length} loaded` },
    { label: "Selected Model", value: selectedModelName() || "Unavailable", detail: `Loaded: ${state.activeLoadedModel || "none"}` },
    { label: "Workspace", value: `${state.workspace.fileCount} files`, detail: state.workspace.projectName || "Workspace" },
  ];

  elements.dashboardMetrics.innerHTML = metrics.map((item) => `
    <article class="status-card dashboard-metric-card">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.detail)}</small>
    </article>
  `).join("");

  elements.dashboardWorkspaceSummary.innerHTML = `
    <div class="meta-row"><span>Project</span><strong>${escapeHtml(state.workspace.projectName || "Workspace")}</strong></div>
    <div class="meta-row"><span>Current file</span><strong>${escapeHtml(state.workspace.currentFilePath || "No file open")}</strong></div>
    <div class="meta-row"><span>Open tabs</span><strong>${state.workspace.openTabs.length}</strong></div>
    <div class="meta-row"><span>Workspace root</span><strong>${escapeHtml(runtime.workspace_root || "Unavailable")}</strong></div>
    <div class="meta-row"><span>AI Home</span><strong>${escapeHtml(runtime.ai_home || "Unavailable")}</strong></div>
  `;

  if (!state.toolJobs.length) {
    elements.dashboardJobList.innerHTML = `<div class="empty-state">No recent tool jobs yet.</div>`;
  } else {
    elements.dashboardJobList.innerHTML = state.toolJobs.slice(0, 4).map((job) => `
      <button class="job-card dashboard-job-card" type="button" data-dashboard-job-id="${escapeHtml(job.id)}">
        <div class="job-card-head">
          <strong>${escapeHtml(job.executable)}</strong>
          <span class="pill ${job.status === "completed" ? "pill-online" : job.status === "failed" ? "pill-offline" : "pill-default"}">${escapeHtml(job.status)}</span>
        </div>
        <code>${escapeHtml(job.command)}</code>
        <span class="job-timestamp">${escapeHtml(formatDateTime(job.started_at))}</span>
      </button>
    `).join("");
  }
}

function renderSessionMeta() {
  const session = state.session;
  elements.sessionMeta.innerHTML = `
    <div class="meta-row"><span>Session ID</span><strong>${session.id.slice(0, 8)}</strong></div>
    <div class="meta-row"><span>Messages</span><strong>${session.messages.length}</strong></div>
    <div class="meta-row"><span>Updated</span><strong>${formatDateTime(session.updatedAt)}</strong></div>
  `;
}

function latestAssistantMessageIndex() {
  for (let index = state.session.messages.length - 1; index >= 0; index -= 1) {
    if (state.session.messages[index].role === "assistant") {
      return index;
    }
  }
  return -1;
}

function latestUserMessageIndex(beforeIndex = state.session.messages.length) {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    if (state.session.messages[index].role === "user") {
      return index;
    }
  }
  return -1;
}

function canRegenerate() {
  const assistantIndex = latestAssistantMessageIndex();
  if (assistantIndex < 0) {
    return false;
  }
  return latestUserMessageIndex(assistantIndex) >= 0;
}

function appendMessage(role, content = "", meta = {}) {
  const message = {
    role,
    content,
    createdAt: new Date().toISOString(),
    ...(meta.agentId ? { agentId: meta.agentId } : {}),
    ...(meta.routeLabel ? { routeLabel: meta.routeLabel } : {}),
    ...(meta.surface ? { surface: meta.surface } : {}),
    ...(meta.multiAgent ? { multiAgent: true } : {}),
  };
  state.session.messages.push(message);
  saveSession();
  return message;
}

function renderMessages({ enhanceCode = true } = {}) {
  const stickToBottom = chatShouldStickToBottom() || state.busy;
  elements.chatFeed.innerHTML = "";
  const latestAssistantIndexValue = latestAssistantMessageIndex();
  state.session.messages.forEach((message, index) => {
    const node = elements.messageTemplate.content.firstElementChild.cloneNode(true);
    node.classList.add(`message-${message.role}`);
    node.dataset.messageIndex = String(index);
    node.querySelector(".role-badge").textContent = message.role === "assistant" && message.agentId
      ? agentDisplayLabel(message.agentId)
      : message.role;
    node.querySelector(".message-time").textContent = [
      formatTime(message.createdAt),
      message.routeLabel || "",
    ].filter(Boolean).join(" · ");
    const copyButton = node.querySelector(".message-copy");
    copyButton.dataset.messageIndex = String(index);
    const regenerateButton = node.querySelector(".message-regenerate");
    regenerateButton.dataset.messageIndex = String(index);
    regenerateButton.hidden = !(message.role === "assistant" && index === latestAssistantIndexValue);
    const body = node.querySelector(".message-body");
    const sourceKey = `message-${index}`;
    const rendered = renderRichText(message.content, sourceKey);
    body.innerHTML = rendered.html || "<p></p>";
    elements.chatFeed.appendChild(node);
  });
  if (stickToBottom) {
    elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
  }
  elements.sessionCount.textContent = String(state.session.messages.length);
  if (enhanceCode) {
    enhanceCodeBlocks(elements.chatFeed).catch((error) => console.error(error));
  }
  setBusy(state.busy);
}

function rememberPrompt(prompt) {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return;
  }
  const currentHistory = chatSettings().prompt_history || [];
  const limit = chatSettings().prompt_history_limit || defaultAppSettings.chat.prompt_history_limit;
  const next = [trimmed, ...currentHistory.filter((item) => item !== trimmed)].slice(0, limit);
  state.settings = mergeSettings(state.settings, { chat: { prompt_history: next } });
  state.settingsDraft = mergeSettings(state.settingsDraft, { chat: { prompt_history: next } });
  persistSettingsPatch({ chat: { prompt_history: next } }, { silent: true }).catch((error) => {
    notify("Prompt History Save Failed", error.message, { tone: "error", timeout: 4200 });
  });
  renderPromptHistory();
}

function renderPromptHistory() {
  elements.promptHistoryList.innerHTML = "";
  const promptHistory = chatSettings().prompt_history || [];
  if (!promptHistory.length) {
    elements.promptHistoryList.innerHTML = `<div class="empty-state">Typed prompts will appear here for quick reuse.</div>`;
    return;
  }
  promptHistory.forEach((prompt, index) => {
    const button = document.createElement("button");
    button.className = "template-card template-button prompt-history-button";
    button.type = "button";
    button.dataset.promptIndex = String(index);
    button.innerHTML = `
      <strong>Prompt ${index + 1}</strong>
      <span>${escapeHtml(prompt)}</span>
    `;
    elements.promptHistoryList.appendChild(button);
  });
}

function resetSession(newSession = true) {
  const nextId = newSession ? crypto.randomUUID() : state.session.id;
  state.session = createFreshSession(nextId);
  state.chatAttachments = [];
  saveSession();
  renderMessages();
  renderAttachmentList(elements.chatAttachmentList, state.chatAttachments, "chat");
  setStreamStatus("Ready · Ctrl/Cmd + Enter to send");
}

function effectiveSystemPrompt() {
  const basePrompt = currentSettings().assistant.system_prompt || DEFAULT_SYSTEM_PROMPT;
  return `${basePrompt}\n\n${modeMeta().overlay}`;
}

function buildAttachmentContext(label, attachments) {
  if (!attachments.length) {
    return "";
  }
  const chunks = attachments.map((item) => {
    const title = item.relativePath || item.name;
    return `--- ${title} ---\n${item.content}`;
  });
  return `\n\n${label}:\n${chunks.join("\n\n")}`;
}

async function streamChat(payload, { onChunk, onError, onDone, signal } = {}) {
  const response = await fetch(apiUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Chat failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {});
      throw new DOMException("Generation stopped.", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach((line) => {
      if (!line.trim()) {
        return;
      }
      const event = JSON.parse(line);
      if (event.type === "chunk") {
        onChunk?.(event.content);
      }
      if (event.type === "error") {
        onError?.(event.message);
      }
      if (event.type === "done") {
        onDone?.(event);
      }
    });
  }
}

async function submitPrompt(content, { appendUser = true, rawPrompt = "" } = {}) {
  await runChatAgentFlow(content, {
    appendUser,
    rawPrompt,
  });
}

function buildChatPrompt() {
  const base = elements.promptInput.value.trim();
  if (!base && !state.chatAttachments.length) {
    return "";
  }
  return `${base || "Review the attached local files."}${buildAttachmentContext("Attached local files", state.chatAttachments)}`;
}

function clearChatComposer() {
  elements.promptInput.value = "";
  resetPromptHistoryCursor();
  autosizeTextarea(elements.promptInput);
  state.chatAttachments = [];
  renderAttachmentList(elements.chatAttachmentList, state.chatAttachments, "chat");
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.busy) {
    return;
  }
  const rawPrompt = elements.promptInput.value.trim();
  const content = buildChatPrompt();
  if (!content) {
    setStreamStatus("Enter a prompt or attach local files before sending.");
    return;
  }
  clearChatComposer();
  await submitPrompt(content, { appendUser: true, rawPrompt });
}

function stopGeneration() {
  if (!state.abortController) {
    return;
  }
  state.abortController.abort();
}

async function regenerateLastResponse() {
  if (state.busy) {
    return;
  }
  const assistantIndex = latestAssistantMessageIndex();
  const userIndex = latestUserMessageIndex(assistantIndex);
  if (assistantIndex < 0 || userIndex < 0) {
    setStreamStatus("No response is available to regenerate.");
    return;
  }
  const assistantMessage = state.session.messages[assistantIndex];
  const userContent = state.session.messages[userIndex].content;
  state.session.messages.splice(assistantIndex, 1);
  saveSession();
  renderMessages();
  await runChatAgentFlow(userContent, {
    appendUser: false,
    selection: assistantMessage.multiAgent ? "auto" : (assistantMessage.agentId || surfaceAgentState("chat").selected),
    compareRequested: Boolean(assistantMessage.multiAgent),
  });
}

function exportSession() {
  const blob = new Blob([JSON.stringify(state.session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hackloi-session-${state.session.id.slice(0, 8)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  notify("Session Exported", `${link.download} was generated locally.`, { tone: "success" });
}

function importSession(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  if (file.size > MAX_SESSION_IMPORT_BYTES) {
    notify("Session Import Rejected", `The selected file is larger than ${formatBytes(MAX_SESSION_IMPORT_BYTES)}.`, { tone: "error", timeout: 4200 });
    setStreamStatus("Session import failed: file too large.");
    event.target.value = "";
    return;
  }
  file.text()
    .then((text) => {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.messages)) {
        throw new Error("Invalid session format.");
      }
      state.session = {
        ...createFreshSession(parsed.id || crypto.randomUUID()),
        ...parsed,
        messages: parsed.messages
          .filter((item) => item?.role && typeof item?.content === "string")
          .map((item) => ({
            role: item.role,
            content: item.content,
            createdAt: item.createdAt || new Date().toISOString(),
            ...(item.agentId ? { agentId: item.agentId } : {}),
            ...(item.routeLabel ? { routeLabel: item.routeLabel } : {}),
            ...(item.surface ? { surface: item.surface } : {}),
            ...(item.multiAgent ? { multiAgent: true } : {}),
          })),
      };
      saveSession();
      renderMessages();
      setStreamStatus("Imported session.");
      notify("Session Imported", `${basename(file.name)} was loaded locally.`, { tone: "success" });
    })
    .catch((error) => {
      appendMessage("assistant", `Error importing session: ${error.message}`);
      renderMessages();
      notify("Session Import Failed", error.message, { tone: "error", timeout: 4200 });
    });
  event.target.value = "";
}

function renderCommandDeck() {
  elements.commandDeck.innerHTML = "";
  commandDeck.forEach((item) => {
    const node = elements.commandTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = item.title;
    node.querySelector("p").textContent = item.description;
    node.querySelector("code").textContent = item.command;
    node.querySelector(".copy-command").dataset.command = item.command;
    elements.commandDeck.appendChild(node);
  });
}

function renderLauncherTemplates() {
  elements.launcherTemplateList.innerHTML = "";
  toolTemplates.forEach((item) => {
    const button = document.createElement("button");
    button.className = "template-card template-button";
    button.type = "button";
    button.dataset.command = item.command;
    button.innerHTML = `
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.description)}</span>
      <code>${escapeHtml(item.command)}</code>
    `;
    elements.launcherTemplateList.appendChild(button);
  });
}

function renderScanPresets() {
  elements.scanPresetList.innerHTML = "";
  Object.entries(scanPresets).forEach(([key, preset]) => {
    const button = document.createElement("button");
    button.className = `template-card template-button ${currentSettings().analyzer.default_scan_preset === key ? "is-selected" : ""}`;
    button.type = "button";
    button.dataset.scanPreset = key;
    button.innerHTML = `
      <strong>${escapeHtml(preset.label)}</strong>
      <span>${escapeHtml(preset.description)}</span>
    `;
    elements.scanPresetList.appendChild(button);
  });
  const activePreset = scanPresets[currentSettings().analyzer.default_scan_preset] || scanPresets.generic;
  elements.scanPresetNote.innerHTML = `
    <strong>${escapeHtml(activePreset.label)}</strong>
    <p>${escapeHtml(activePreset.description)}</p>
    <code>${escapeHtml(activePreset.prompt)}</code>
  `;
}

function activeCtfCategory() {
  const category = currentSettings().ctf.default_category;
  return ctfCategories[category] ? category : "web";
}

function renderCtfHelper() {
  elements.ctfTabList.innerHTML = "";
  Object.entries(ctfCategories).forEach(([key, category]) => {
    const button = document.createElement("button");
    button.className = `nav-item ctf-tab ${activeCtfCategory() === key ? "is-active" : ""}`;
    button.type = "button";
    button.dataset.ctfCategory = key;
    button.textContent = category.label;
    elements.ctfTabList.appendChild(button);
  });

  const category = ctfCategories[activeCtfCategory()];
  elements.ctfCardGrid.innerHTML = "";
  category.prompts.forEach((prompt, index) => {
    const button = document.createElement("button");
    button.className = "template-card template-button";
    button.type = "button";
    button.dataset.ctfPromptIndex = String(index);
    button.innerHTML = `
      <strong>${escapeHtml(prompt.title)}</strong>
      <span>${escapeHtml(prompt.text)}</span>
    `;
    elements.ctfCardGrid.appendChild(button);
  });
  elements.ctfNotes.value = currentSettings().ctf.notes[activeCtfCategory()] || "";
  elements.ctfNoteStatus.textContent = `Active category: ${category.label}. Notes are stored locally.`;
}

async function saveCtfNotes() {
  const category = activeCtfCategory();
  const nextNotes = {
    ...currentSettings().ctf.notes,
    [category]: elements.ctfNotes.value,
  };
  await persistSettingsPatch({ ctf: { notes: nextNotes } }, { silent: true });
  elements.ctfNoteStatus.textContent = `Saved ${ctfCategories[activeCtfCategory()].label} notes locally.`;
  renderSettingsForm();
}

function sendActiveCtfPrompt() {
  const firstPrompt = ctfCategories[activeCtfCategory()].prompts[0];
  setActiveView("chat");
  elements.promptInput.value = firstPrompt.text;
  elements.promptInput.focus();
}

function validateAttachmentSelection(files, existingAttachments) {
  const limits = chatSettings();
  const maxAttachmentBytes = limits.attachment_max_file_bytes || defaultAppSettings.chat.attachment_max_file_bytes;
  const maxAttachmentCount = limits.attachment_max_count || defaultAppSettings.chat.attachment_max_count;
  const maxTotalAttachmentBytes = limits.attachment_max_total_bytes || defaultAppSettings.chat.attachment_max_total_bytes;
  const accepted = [];
  const rejected = [];
  let combinedBytes = totalAttachmentBytes(existingAttachments);

  for (const file of Array.from(files || [])) {
    const extension = extensionForName(file.name);
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
      rejected.push(`${file.name}: unsupported file type`);
      continue;
    }
    if (file.size > maxAttachmentBytes) {
      rejected.push(`${file.name}: exceeds ${formatBytes(maxAttachmentBytes)}`);
      continue;
    }
    if (existingAttachments.length + accepted.length >= maxAttachmentCount) {
      rejected.push(`${file.name}: attachment limit reached`);
      continue;
    }
    if (combinedBytes + file.size > maxTotalAttachmentBytes) {
      rejected.push(`${file.name}: total attachment limit exceeded`);
      continue;
    }
    combinedBytes += file.size;
    accepted.push(file);
  }

  return { accepted, rejected };
}

function validateWorkspaceImportSelection(fileList) {
  const limits = workspaceSettings();
  const maxImportCount = limits.import_max_files || defaultAppSettings.workspace.import_max_files;
  const maxFileBytes = limits.import_max_file_bytes || defaultAppSettings.workspace.import_max_file_bytes;
  const maxImportBytes = limits.import_max_total_bytes || defaultAppSettings.workspace.import_max_total_bytes;
  const files = Array.from(fileList || []);
  if (files.length > maxImportCount) {
    throw new Error(`Too many files. Limit is ${maxImportCount}.`);
  }
  let totalBytes = 0;
  files.forEach((file) => {
    if (file.size > maxFileBytes) {
      throw new Error(`${file.name} exceeds ${formatBytes(maxFileBytes)}.`);
    }
    totalBytes += file.size;
  });
  if (totalBytes > maxImportBytes) {
    throw new Error(`Workspace import exceeds ${formatBytes(maxImportBytes)}.`);
  }
}

async function readAttachmentFiles(fileList) {
  const files = Array.from(fileList || []);
  const result = [];
  for (const file of files) {
    const content = await file.text();
    result.push({
      name: file.name,
      relativePath: file.webkitRelativePath || file.name,
      size: file.size,
      content,
    });
  }
  return result;
}

function renderAttachmentList(container, attachments, scope) {
  container.innerHTML = "";
  if (!attachments.length) {
    container.innerHTML = `<div class="attachment-empty subtle-label">No attachments.</div>`;
    return;
  }
  attachments.forEach((item, index) => {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";
    chip.innerHTML = `
      <span>${escapeHtml(item.relativePath || item.name)} <small>${escapeHtml(formatBytes(item.size || item.content?.length || 0))}</small></span>
      <button class="ghost-button attachment-remove" data-scope="${scope}" data-index="${index}" type="button">Remove</button>
    `;
    container.appendChild(chip);
  });
}

async function attachFiles(targetScope, fileList) {
  const existing = targetScope === "chat" ? state.chatAttachments : state.scanAttachments;
  const { accepted, rejected } = validateAttachmentSelection(fileList, existing);
  if (rejected.length) {
    notify(
      "Attachment Skipped",
      rejected.slice(0, 3).join(" • "),
      { tone: "error", timeout: 4600 },
    );
  }
  if (!accepted.length) {
    return;
  }
  const files = await readAttachmentFiles(accepted);
  if (targetScope === "chat") {
    state.chatAttachments = [...state.chatAttachments, ...files];
    renderAttachmentList(elements.chatAttachmentList, state.chatAttachments, "chat");
    setStreamStatus(`${state.chatAttachments.length} attachment(s) ready · ${formatBytes(totalAttachmentBytes(state.chatAttachments))}`);
    notify("Chat Attachments Ready", `${files.length} file(s) attached to the next prompt.`, { tone: "success" });
  }
  if (targetScope === "scan") {
    state.scanAttachments = [...state.scanAttachments, ...files];
    renderAttachmentList(elements.scanAttachmentList, state.scanAttachments, "scan");
    elements.scanAnalysisStatus.textContent = `${state.scanAttachments.length} scan attachment(s) ready · ${formatBytes(totalAttachmentBytes(state.scanAttachments))}`;
    await previewScanAnalysis();
  }
}

function removeAttachment(scope, index) {
  if (scope === "chat") {
    state.chatAttachments.splice(index, 1);
    renderAttachmentList(elements.chatAttachmentList, state.chatAttachments, "chat");
    setStreamStatus(state.chatAttachments.length
      ? `${state.chatAttachments.length} attachment(s) ready · ${formatBytes(totalAttachmentBytes(state.chatAttachments))}`
      : "Ready · Ctrl/Cmd + Enter to send");
  }
  if (scope === "scan") {
    state.scanAttachments.splice(index, 1);
    renderAttachmentList(elements.scanAttachmentList, state.scanAttachments, "scan");
    previewScanAnalysis().catch((error) => {
      elements.scanAnalysisStatus.textContent = `Local analysis failed: ${error.message}`;
      notify("Scan Refresh Failed", error.message, { tone: "error", timeout: 4200 });
    });
  }
}

function wireDropzone(element, scope) {
  ["dragenter", "dragover"].forEach((type) => {
    element.addEventListener(type, (event) => {
      event.preventDefault();
      element.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    element.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === "drop") {
        attachFiles(scope, event.dataTransfer.files).catch((error) => {
          const title = scope === "scan" ? "Scan Attachment Failed" : "Attachment Failed";
          notify(title, error.message, { tone: "error", timeout: 4200 });
        });
      }
      element.classList.remove("is-dragging");
    });
  });
}

function combinedScanText() {
  const scanText = elements.scanInput.value.trim();
  const attachmentContext = buildAttachmentContext("Attached scan files", state.scanAttachments);
  return `${scanText}${attachmentContext}`.trim();
}

function buildStructuredScanContext() {
  if (!state.scanAnalysis?.sections) {
    return "";
  }
  const lines = [`Structured local summary (${state.scanAnalysis.detected_type}):`];
  Object.entries(scanSectionLabels).forEach(([key, label]) => {
    const items = state.scanAnalysis.sections[key] || [];
    if (!items.length) {
      return;
    }
    lines.push(`${label}:`);
    items.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  });
  return lines.join("\n").trim();
}

function buildScanPrompt() {
  const preset = scanPresets[currentSettings().analyzer.default_scan_preset] || scanPresets.generic;
  const scanText = combinedScanText();
  if (!scanText) {
    return "";
  }
  const structuredContext = buildStructuredScanContext();
  return `${preset.prompt}\n\n${structuredContext ? `${structuredContext}\n\n` : ""}Input:\n${scanText}`;
}

async function handleScanAnalyzer() {
  if (!state.scanAnalysis && combinedScanText()) {
    await previewScanAnalysis();
  }
  const prompt = buildScanPrompt();
  if (!prompt) {
    return;
  }
  setActiveView("chat");
  elements.promptInput.value = prompt;
  elements.promptInput.focus();
  setStreamStatus("Scan analysis prompt prepared.");
}

async function runScanAgent(options = {}) {
  if (!state.scanAnalysis && combinedScanText()) {
    await previewScanAnalysis();
  }
  const prompt = options.prompt || buildScanPrompt();
  if (!prompt) {
    elements.scanAgentStatus.textContent = "Paste scan text or attach files before running a scan agent.";
    return;
  }
  try {
    const plan = await runSurfaceAgents("scan", prompt, {
      selection: options.selection || surfaceAgentState("scan").selected,
      compareRequested: Boolean(options.compareRequested),
      forceSingleShot: true,
    });
    elements.scanAgentStatus.textContent = options.compareRequested
      ? `Completed ${plan.results.length} agent reviews for the current scan.`
      : `${agentDisplayLabel(plan.primaryAgent)} reviewed the current scan context.`;
  } catch (error) {
    elements.scanAgentStatus.textContent = `Agent review failed: ${error.message}`;
    notify("Scan Agent Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

function renderScanAnalysis() {
  const analysis = state.scanAnalysis;
  if (!analysis) {
    elements.scanAnalysisSummary.innerHTML = "No structured analysis yet.";
    elements.scanAnalysisGrid.innerHTML = "";
    return;
  }

  elements.scanAnalysisSummary.innerHTML = `
    <strong>${escapeHtml((scanPresets[analysis.detected_type] || scanPresets.generic).label)}</strong>
    <p>${escapeHtml(analysis.summary || "Structured local analysis complete.")}</p>
    <code>${escapeHtml(`Detected type: ${analysis.detected_type} · Non-empty lines: ${analysis.line_count}`)}</code>
  `;

  elements.scanAnalysisGrid.innerHTML = Object.entries(scanSectionLabels).map(([key, label]) => {
    const items = analysis.sections?.[key] || [];
    const listMarkup = items.length
      ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<p class="subtle-label">No items extracted.</p>`;
    return `
      <article class="status-card scan-analysis-card">
        <span>${escapeHtml(label)}</span>
        ${listMarkup}
      </article>
    `;
  }).join("");
}

async function previewScanAnalysis() {
  const text = combinedScanText();
  if (!text) {
    state.scanAnalysis = null;
    renderScanAnalysis();
    elements.scanAnalysisStatus.textContent = "Paste scan text or attach files to run a local structured parse.";
    return;
  }
  elements.scanAnalysisStatus.textContent = "Parsing scan output locally...";
  try {
    const response = await postJson("/api/scan/preview", {
      preset: currentSettings().analyzer.default_scan_preset,
      text,
    });
    state.scanAnalysis = response.analysis || null;
    renderScanAnalysis();
    elements.scanAnalysisStatus.textContent = `Local analysis ready for ${state.scanAnalysis?.detected_type || "generic"} output.`;
  } catch (error) {
    state.scanAnalysis = null;
    renderScanAnalysis();
    elements.scanAnalysisStatus.textContent = `Local analysis failed: ${error.message}`;
  }
}

async function fetchJson(path) {
  const response = await fetch(apiUrl(path), {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `Request failed: ${response.status}` }));
    throw new ApiError(payload.error || `Request failed: ${response.status}`, payload);
  }
  return response.json();
}

async function postJson(path, payload) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error || `Request failed: ${response.status}`, body);
  }
  return body;
}

async function refreshDashboardData() {
  if (state.refreshing) {
    return;
  }
  state.refreshing = true;
  try {
    const [health, models, tools, system, recommendations, jobs, workspace] = await Promise.allSettled([
      fetchJson("/api/health"),
      fetchJson("/api/models"),
      fetchJson("/api/tools/status"),
      fetchJson("/api/system/status"),
      fetchJson("/api/model-recommendations"),
      fetchJson("/api/tools/jobs"),
      fetchJson("/api/workspace/tree"),
    ]);

    if (health.status === "fulfilled") {
      renderHealth(health.value);
    }
    if (models.status === "fulfilled") {
      state.models = models.value.models || [];
      state.runningModels = models.value.running_models || [];
      state.activeLoadedModel = models.value.active_model || "";
    }
    if (tools.status === "fulfilled") {
      state.tools = tools.value.tools || [];
    }
    if (system.status === "fulfilled") {
      state.system = system.value.system || null;
      state.appInfo = state.system?.app || state.appInfo;
    }
    if (recommendations.status === "fulfilled") {
      state.recommendations = recommendations.value.recommendations || [];
    }
    if (jobs.status === "fulfilled") {
      state.toolJobs = jobs.value.jobs || [];
    }
    if (workspace.status === "fulfilled") {
      applyWorkspacePayload(workspace.value.workspace);
    }

    renderModels();
    renderRecommendations();
    renderModelSetupGuide();
    renderTools();
    renderMonitoring();
    renderModelRuntime();
    renderToolJobs();
    renderDashboard();
    renderRuntimeInfo();
    renderLocalStatus();
    renderAllAgentSurfaces();
    if (state.onboardingVisible) {
      renderOnboarding();
    }
  } catch (error) {
    console.error(error);
    renderHealth({ ollama: { reachable: false, model_count: 0 } });
  } finally {
    state.refreshing = false;
  }
}

async function fetchJobDetail(jobId) {
  if (!jobId) {
    return;
  }
  try {
    const payload = await fetchJson(`/api/tools/jobs/${jobId}`);
    state.selectedJobId = jobId;
    renderJobDetail(payload.job);
  } catch (error) {
    elements.toolJobDetail.innerHTML = `<div class="empty-state">Error loading job detail: ${escapeHtml(error.message)}</div>`;
  }
}

function renderToolJobs() {
  elements.toolJobList.innerHTML = "";
  if (!state.toolJobs.length) {
    elements.toolJobList.innerHTML = `<div class="empty-state">No tool jobs yet.</div>`;
    elements.toolJobDetail.innerHTML = `<div class="empty-state">No job selected yet.</div>`;
    return;
  }

  state.toolJobs.forEach((job) => {
    const button = document.createElement("button");
    button.className = `job-card ${state.selectedJobId === job.id ? "is-selected" : ""}`;
    button.type = "button";
    button.dataset.jobId = job.id;
    button.innerHTML = `
      <div class="job-card-head">
        <strong>${escapeHtml(job.executable)}</strong>
        <span class="pill ${job.status === "completed" ? "pill-online" : job.status === "failed" ? "pill-offline" : "pill-default"}">${escapeHtml(job.status)}</span>
      </div>
      <code>${escapeHtml(job.command)}</code>
      <span class="job-timestamp">${escapeHtml(formatDateTime(job.started_at))}</span>
    `;
    elements.toolJobList.appendChild(button);
  });

  if (!state.selectedJobId && state.toolJobs[0]) {
    state.selectedJobId = state.toolJobs[0].id;
  }
  const selected = state.toolJobs.find((job) => job.id === state.selectedJobId) || state.toolJobs[0];
  if (selected) {
    renderJobDetail(selected);
    if (!selected.output_tail || selected.status === "running") {
      fetchJobDetail(selected.id);
    }
  }
}

function renderJobDetail(job) {
  if (!job) {
    elements.toolJobDetail.innerHTML = `<div class="empty-state">No job selected yet.</div>`;
    return;
  }
  const running = job.status === "running" || job.status === "stopping";
  elements.toolJobDetail.innerHTML = `
    <div class="job-detail-meta">
      <div class="meta-row"><span>Command</span><strong>${escapeHtml(job.command)}</strong></div>
      <div class="meta-row"><span>Status</span><strong>${escapeHtml(job.status)}</strong></div>
      <div class="meta-row"><span>Started</span><strong>${escapeHtml(formatDateTime(job.started_at))}</strong></div>
      <div class="meta-row"><span>Log</span><strong>${escapeHtml(job.log_path || "Unknown")}</strong></div>
    </div>
    <div class="tool-footer">
      <button class="ghost-button send-job-to-scan" data-job-id="${escapeHtml(job.id)}" data-executable="${escapeHtml(job.executable)}" type="button">Send Output To Analyzer</button>
      ${running ? `<button class="ghost-button stop-job" data-job-id="${escapeHtml(job.id)}" type="button">Stop Job</button>` : ""}
    </div>
    <pre>${escapeHtml(job.output_tail || "No output yet.")}</pre>
  `;
}

function presetForExecutable(executable) {
  if (scanPresets[executable]) {
    return executable;
  }
  return "generic";
}

async function sendJobOutputToScan(jobId, executable) {
  const source = state.toolJobs.find((job) => job.id === jobId);
  let detail = source;
  if (!detail?.output_tail) {
    const payload = await fetchJson(`/api/tools/jobs/${jobId}`);
    detail = payload.job;
  }
  state.settings = mergeSettings(state.settings, { analyzer: { default_scan_preset: presetForExecutable(executable) } });
  state.settingsDraft = mergeSettings(state.settingsDraft, { analyzer: { default_scan_preset: presetForExecutable(executable) } });
  renderScanPresets();
  renderSettingsForm();
  elements.scanInput.value = detail.output_tail || "";
  setActiveView("scan");
  await previewScanAnalysis();
}

function tokenizeCommand(command) {
  const matches = command.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((item) => item.replace(/^["']|["']$/g, ""));
}

function renderLauncherPreview() {
  const command = elements.launcherCommand.value.trim();
  if (!command) {
    elements.launcherCommandPreview.innerHTML = "Command preview will appear here.";
    elements.runToolCommand.disabled = true;
    return;
  }

  const tokens = tokenizeCommand(command);
  const executable = tokens[0] || "";
  const allowed = allowedToolExecutables.has(basename(executable));
  const args = tokens.slice(1);
  elements.runToolCommand.disabled = !allowed || !elements.launcherConfirm.checked || state.launcherBusy;
  elements.launcherCommandPreview.innerHTML = `
    <strong>${escapeHtml(executable || "Unknown command")}</strong>
    <p>${allowed ? "Executable is on the local allowlist." : "Executable is not on the local allowlist and will be rejected."}</p>
    <code>${escapeHtml(command)}</code>
    <div class="launcher-preview-tokens">
      ${args.length ? args.map((item) => `<span class="topbar-chip">${escapeHtml(item)}</span>`).join("") : '<span class="subtle-label">No additional arguments.</span>'}
    </div>
  `;
}

async function stopToolJob(jobId) {
  if (!jobId) {
    return;
  }
  const job = state.toolJobs.find((item) => item.id === jobId);
  if (!job) {
    return;
  }
  const confirmed = await confirmAction({
    title: "Stop Local Command",
    description: `Stop the running local job?\n\n${job.command}`,
    confirmLabel: "Stop Job",
  });
  if (!confirmed) {
    return;
  }
  setLauncherBusy(true);
  try {
    await postJson(`/api/tools/jobs/${jobId}/stop`, { confirmed: true });
    elements.launcherStatus.textContent = `Stop requested for job ${jobId}.`;
    notify("Stop Requested", `Sent SIGTERM to ${job.executable}.`, { tone: "success" });
    await refreshDashboardData();
    await fetchJobDetail(jobId);
  } catch (error) {
    elements.launcherStatus.textContent = `Stop failed: ${error.message}`;
    notify("Stop Failed", error.message, { tone: "error", timeout: 4200 });
  } finally {
    setLauncherBusy(false);
  }
}

async function runToolCommand() {
  const command = elements.launcherCommand.value.trim();
  if (!command) {
    elements.launcherStatus.textContent = "Enter a command first.";
    return;
  }
  if (!elements.launcherConfirm.checked) {
    elements.launcherStatus.textContent = "Check the confirmation box before launching.";
    return;
  }
  const confirmed = await confirmAction({
    title: "Run Local Command",
    description: `Launch this exact allowlisted command locally?\n\n${command}`,
    confirmLabel: "Run Command",
  });
  if (!confirmed) {
    elements.launcherStatus.textContent = "Launch cancelled.";
    return;
  }
  elements.launcherStatus.textContent = "Launching local command...";
  setLauncherBusy(true);
  try {
    const payload = await postJson("/api/tools/run", { command, confirmed: true });
    elements.launcherStatus.textContent = `Started ${payload.job.executable} with job ${payload.job.id}.`;
    state.selectedJobId = payload.job.id;
    elements.launcherConfirm.checked = false;
    notify("Command Started", `${payload.job.executable} is now running locally.`, { tone: "success" });
    await refreshDashboardData();
    await fetchJobDetail(payload.job.id);
  } catch (error) {
    elements.launcherStatus.textContent = `Launch failed: ${error.message}`;
    notify("Command Failed", error.message, { tone: "error", timeout: 4200 });
  } finally {
    setLauncherBusy(false);
  }
}

function syncAssistantModeSelects() {
  const options = Object.entries(assistantModes).map(([value, item]) => ({ value, label: item.label }));
  fillSelect(elements.assistantModeSelect, options, currentSettings().assistant.mode, "No modes");
  fillSelect(elements.settingsAssistantMode, options, currentDraftSettings().assistant.mode, "No modes");
  updateModePresentation();
}

async function handleAssistantModeChange(value) {
  await persistSettingsPatch({ assistant: { mode: value } }, { successMessage: `${assistantModes[value]?.label || "Standard"} mode is active for upcoming prompts.` });
  syncAssistantModeSelects();
  notify("Assistant Mode Updated", `${assistantModes[value]?.label || "Standard"} is active for upcoming prompts.`, { tone: "success" });
}

async function handleDefaultModelChange(value) {
  await persistSettingsPatch({ assistant: { default_model: value } }, { successMessage: `${value || "No model"} will be used by default for new local requests.` });
  syncModelSelectors();
  renderModels();
  renderMonitoring();
  renderDashboard();
}

function setActiveView(view) {
  state.activeView = view;
  elements.navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === view);
  });
  elements.viewPanels.forEach((panel) => {
    panel.classList.toggle("is-visible", panel.dataset.viewPanel === view);
  });
  if (view === "workspace") {
    ensureEditor().catch((error) => {
      elements.workspaceImportStatus.textContent = `Editor failed to load: ${error.message}`;
    });
    refreshWorkspace();
  }
}

function applyVisualIntensity() {
  document.body.classList.remove("intensity-soft", "intensity-high");
  if (currentSettings().ui.visual_intensity === "soft") {
    document.body.classList.add("intensity-soft");
  }
  if (currentSettings().ui.visual_intensity === "high") {
    document.body.classList.add("intensity-high");
  }
}

function renderWorkspaceSelection() {
  if (!state.workspace.selectedPath) {
    elements.workspaceSelection.textContent = "Selection: none";
    updateWorkspaceActionState();
    return;
  }
  elements.workspaceSelection.textContent = `Selection: ${state.workspace.selectedPath} (${state.workspace.selectedType || "item"})`;
  updateWorkspaceActionState();
}

function updateWorkspaceActionState() {
  const hasSelection = Boolean(state.workspace.selectedPath);
  elements.workspaceRenamePath.disabled = !hasSelection;
  elements.workspaceDeletePath.disabled = !hasSelection;
}

function flattenWorkspaceFiles(nodes, results = []) {
  nodes.forEach((node) => {
    if (node.type === "file") {
      results.push(node.path);
      return;
    }
    flattenWorkspaceFiles(node.children || [], results);
  });
  return results;
}

function findTreeNodeByPath(nodes, path) {
  for (const node of nodes || []) {
    if (node.path === path) {
      return node;
    }
    if (node.type === "dir") {
      const nested = findTreeNodeByPath(node.children || [], path);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function filterWorkspaceNodes(nodes, query) {
  const lower = query.trim().toLowerCase();
  if (!lower) {
    return nodes;
  }

  return (nodes || []).reduce((results, node) => {
    const matchesSelf = node.name.toLowerCase().includes(lower) || node.path.toLowerCase().includes(lower);
    if (node.type === "dir") {
      const children = filterWorkspaceNodes(node.children || [], query);
      if (matchesSelf || children.length) {
        results.push({ ...node, children });
      }
      return results;
    }
    if (matchesSelf) {
      results.push(node);
    }
    return results;
  }, []);
}

function renderTreeNodes(nodes) {
  return nodes.map((node) => {
    const isSelected = state.workspace.selectedPath === node.path;
    if (node.type === "dir") {
      return `
        <div class="tree-dir">
          <button class="tree-entry tree-dir-entry ${isSelected ? "is-active" : ""}" data-path="${escapeHtml(node.path)}" data-node-type="dir" type="button">
            <span class="tree-entry-icon">DIR</span>
            <span>${escapeHtml(node.name)}</span>
          </button>
          <div class="tree-children">${renderTreeNodes(node.children || [])}</div>
        </div>
      `;
    }
    return `
      <button class="tree-entry tree-file ${state.workspace.currentFilePath === node.path ? "is-current" : ""} ${isSelected ? "is-active" : ""}" data-path="${escapeHtml(node.path)}" data-node-type="file" type="button">
        <span class="tree-entry-icon">FILE</span>
        <span>${escapeHtml(node.name)}</span>
      </button>
    `;
  }).join("");
}

function renderWorkspaceTree() {
  elements.workspaceSummary.textContent = `${state.workspace.projectName} · ${state.workspace.fileCount} file${state.workspace.fileCount === 1 ? "" : "s"}`;
  renderWorkspaceSelection();
  const visibleTree = filterWorkspaceNodes(state.workspace.tree, state.workspace.filterQuery);
  if (!state.workspace.tree.length) {
    elements.workspaceTree.innerHTML = `<div class="empty-state">No files in the workspace yet.</div>`;
    return;
  }
  if (!visibleTree.length) {
    elements.workspaceTree.innerHTML = `<div class="empty-state">No files match "${escapeHtml(state.workspace.filterQuery)}".</div>`;
    return;
  }
  elements.workspaceTree.innerHTML = renderTreeNodes(visibleTree);
}

function renderWorkspaceTabs() {
  elements.workspaceTabBar.innerHTML = "";
  if (!state.workspace.openTabs.length) {
    elements.workspaceTabBar.innerHTML = `<div class="empty-state">Open files will appear here as tabs.</div>`;
    return;
  }
  state.workspace.openTabs.forEach((path) => {
    const tab = document.createElement("div");
    tab.className = `workspace-tab ${state.workspace.currentFilePath === path ? "is-active" : ""}`;
    tab.innerHTML = `
      <button class="workspace-tab-button" data-open-tab="${escapeHtml(path)}" type="button">${escapeHtml(basename(path))}</button>
      <button class="workspace-tab-close" data-close-tab="${escapeHtml(path)}" type="button" aria-label="Close tab">x</button>
    `;
    elements.workspaceTabBar.appendChild(tab);
  });
}

function updateEditorHeader() {
  const dirty = state.workspace.dirty ? "*" : "";
  elements.editorCurrentFile.textContent = `${state.workspace.currentFilePath || "Untitled"}${dirty}`;
  elements.editorLanguage.textContent = state.workspace.currentLanguage;
  if (!state.workspace.currentFilePath) {
    elements.workspaceFileState.textContent = "No file open. Import or create a file to start editing.";
  } else if (state.workspace.dirty) {
    elements.workspaceFileState.textContent = `Unsaved local changes in ${state.workspace.currentFilePath}. Use Ctrl/Cmd + S to save.`;
  } else {
    elements.workspaceFileState.textContent = `Saved locally: ${state.workspace.currentFilePath}.`;
  }
  updateWorkspaceActionState();
  renderWorkspaceTabs();
  renderDashboard();
}

function applyWorkspacePayload(payload) {
  if (!payload) {
    return;
  }
  state.workspace.tree = payload.tree || [];
  state.workspace.projectName = payload.project_name || "Workspace";
  state.workspace.fileCount = payload.file_count || 0;
  const filePaths = flattenWorkspaceFiles(state.workspace.tree);
  state.workspace.openTabs = state.workspace.openTabs.filter((path) => filePaths.includes(path));
  if (state.workspace.currentFilePath && !filePaths.includes(state.workspace.currentFilePath)) {
    state.workspace.currentFilePath = "";
    state.workspace.currentLanguage = "markdown";
    state.workspace.dirty = false;
  }
  if (state.workspace.selectedPath) {
    const node = findTreeNodeByPath(state.workspace.tree, state.workspace.selectedPath);
    if (!node) {
      state.workspace.selectedPath = "";
      state.workspace.selectedType = "";
    }
  }
  renderWorkspaceTree();
  renderWorkspaceTabs();
  updateEditorHeader();
  renderDashboard();
}

function preferredWorkspaceParent() {
  if (state.workspace.selectedType === "dir") {
    return state.workspace.selectedPath;
  }
  if (state.workspace.selectedType === "file") {
    return dirname(state.workspace.selectedPath);
  }
  if (state.workspace.currentFilePath) {
    return dirname(state.workspace.currentFilePath);
  }
  return "";
}

function normalizeWorkspaceTarget(input) {
  return String(input || "").trim().replace(/^\/+/, "");
}

async function loadMonaco() {
  if (state.editor.monaco) {
    return state.editor.monaco;
  }
  if (state.editor.loadPromise) {
    return state.editor.loadPromise;
  }
  state.editor.loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = apiUrl("/vendor/monaco/vs/loader.js");
    script.onload = () => {
      window.require.config({ paths: { vs: apiUrl("/vendor/monaco/vs") } });
      window.require(["vs/editor/editor.main"], () => {
        state.editor.monaco = window.monaco;
        window.monaco.editor.defineTheme("hackloi-cyber", {
          base: "vs-dark",
          inherit: true,
          rules: [
            { token: "", foreground: "edf8ff" },
            { token: "comment", foreground: "92a8b7" },
            { token: "keyword", foreground: "58e9ff" },
            { token: "string", foreground: "ffb65a" },
          ],
          colors: {
            "editor.background": "#071018",
            "editorLineNumber.foreground": "#5e6f7b",
            "editorCursor.foreground": "#4affcf",
            "editor.selectionBackground": "#12303d",
            "editor.inactiveSelectionBackground": "#0d2029",
          },
        });
        resolve(window.monaco);
      }, reject);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return state.editor.loadPromise;
}

async function ensureEditor() {
  if (state.editor.instance) {
    return state.editor.instance;
  }
  const monaco = await loadMonaco();
  state.editor.instance = monaco.editor.create(elements.editorSurface, {
    value: DEFAULT_EDITOR_TEXT,
    language: "markdown",
    theme: "hackloi-cyber",
    automaticLayout: true,
    minimap: { enabled: false },
    fontFamily: '"JetBrains Mono", "IBM Plex Mono", monospace',
    fontSize: 14,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
  });
  state.editor.instance.onDidChangeModelContent(() => {
    if (state.editor.suppressDirty) {
      return;
    }
    state.workspace.dirty = true;
    updateEditorHeader();
  });
  elements.editorEmptyState.style.display = "none";
  return state.editor.instance;
}

async function maybeConfirmDiscard(path) {
  if (!state.workspace.dirty || state.workspace.currentFilePath === path) {
    return true;
  }
  return confirmAction({
    title: "Discard Unsaved Changes",
    description: "The current file has unsaved local edits. Discard them and continue?",
    confirmLabel: "Discard Changes",
  });
}

async function openWorkspaceFile(path, options = {}) {
  if (!(await maybeConfirmDiscard(path)) && !options.force) {
    return;
  }
  try {
    const payload = await fetchJson(`/api/workspace/file?path=${encodeURIComponent(path)}`);
    const editor = await ensureEditor();
    state.editor.suppressDirty = true;
    editor.setValue(payload.file.content || "");
    state.workspace.currentFilePath = payload.file.path;
    state.workspace.currentLanguage = inferLanguage(payload.file.path);
    state.workspace.selectedPath = payload.file.path;
    state.workspace.selectedType = "file";
    state.workspace.dirty = false;
    if (!state.workspace.openTabs.includes(payload.file.path)) {
      state.workspace.openTabs.push(payload.file.path);
    }
    state.editor.monaco.editor.setModelLanguage(editor.getModel(), state.workspace.currentLanguage);
    updateEditorHeader();
    renderWorkspaceTree();
    elements.codeAssistantStatus.textContent = `Opened ${payload.file.path}.`;
  } catch (error) {
    elements.workspaceImportStatus.textContent = `Open failed: ${error.message}`;
    notify("Open Failed", error.message, { tone: "error", timeout: 4200 });
  } finally {
    state.editor.suppressDirty = false;
  }
}

async function refreshWorkspace() {
  try {
    const payload = await fetchJson("/api/workspace/tree");
    applyWorkspacePayload(payload.workspace);
  } catch (error) {
    elements.workspaceImportStatus.textContent = `Workspace refresh failed: ${error.message}`;
  }
}

function deriveProjectName(files) {
  const first = files[0]?.relativePath || files[0]?.name || "Workspace";
  return first.includes("/") ? first.split("/")[0] : "Workspace";
}

async function importIntoWorkspace(fileList, replace) {
  validateWorkspaceImportSelection(fileList);
  const files = await readAttachmentFiles(fileList);
  if (!files.length) {
    return;
  }
  const payload = {
    replace,
    project_name: deriveProjectName(files),
    files: files.map((item) => ({
      name: item.name,
      relative_path: item.relativePath || item.name,
      content: item.content,
    })),
  };
  elements.workspaceImportStatus.textContent = "Importing local files into the workspace...";
  try {
    const response = await postJson("/api/workspace/import", payload);
    applyWorkspacePayload(response.workspace);
    elements.workspaceImportStatus.textContent = `Imported ${response.workspace.file_count} files into ${response.workspace.project_name}.`;
    notify(
      replace ? "Project Folder Loaded" : "Workspace Files Imported",
      `${response.workspace.file_count} local file(s) are ready in ${response.workspace.project_name}.`,
      { tone: "success" },
    );
    const firstFile = flattenWorkspaceFiles(response.workspace.tree)[0];
    if (firstFile) {
      await openWorkspaceFile(firstFile, { force: true });
    }
  } catch (error) {
    elements.workspaceImportStatus.textContent = `Import failed: ${error.message}`;
    notify("Workspace Import Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

async function saveCurrentFile(saveAs = false) {
  const editor = await ensureEditor();
  let targetPath = state.workspace.currentFilePath;
  if (saveAs || !targetPath) {
    const suggestion = targetPath || `${preferredWorkspaceParent() ? `${preferredWorkspaceParent()}/` : ""}scripts/new-script.py`;
    targetPath = normalizeWorkspaceTarget(await promptForInput({
      title: saveAs ? "Save File As" : "Save New File",
      description: "Choose a relative path inside the local workspace.",
      label: "Workspace path",
      initialValue: suggestion,
      placeholder: "scripts/new-script.py",
      confirmLabel: "Save File",
    }));
  }
  if (!targetPath) {
    return;
  }
  try {
    const response = await postJson("/api/workspace/save", {
      path: targetPath,
      content: editor.getValue(),
    });
    const previousPath = state.workspace.currentFilePath;
    state.workspace.currentFilePath = response.file.path;
    state.workspace.currentLanguage = inferLanguage(response.file.path);
    state.workspace.selectedPath = response.file.path;
    state.workspace.selectedType = "file";
    state.workspace.dirty = false;
    if (previousPath && previousPath !== response.file.path) {
      state.workspace.openTabs = state.workspace.openTabs.map((item) => (item === previousPath ? response.file.path : item));
    } else if (!state.workspace.openTabs.includes(response.file.path)) {
      state.workspace.openTabs.push(response.file.path);
    }
    updateEditorHeader();
    elements.workspaceImportStatus.textContent = `Saved ${response.file.path}.`;
    notify("File Saved", `${response.file.path} was written to the local workspace.`, { tone: "success" });
    await refreshWorkspace();
    await openWorkspaceFile(response.file.path, { force: true });
  } catch (error) {
    elements.workspaceImportStatus.textContent = `Save failed: ${error.message}`;
    notify("Save Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

async function createNewWorkspaceFile() {
  const parent = preferredWorkspaceParent();
  const suggestion = `${parent ? `${parent}/` : ""}scripts/new-script.py`;
  const path = normalizeWorkspaceTarget(await promptForInput({
    title: "Create New File",
    description: "Create a new file inside the local workspace.",
    label: "New file path",
    initialValue: suggestion,
    placeholder: "scripts/new-script.py",
    confirmLabel: "Create File",
  }));
  if (!path) {
    return;
  }
  try {
    await postJson("/api/workspace/save", { path, content: "" });
    await refreshWorkspace();
    await openWorkspaceFile(path, { force: true });
    notify("File Created", `${path} is ready to edit locally.`, { tone: "success" });
  } catch (error) {
    elements.workspaceImportStatus.textContent = `New file failed: ${error.message}`;
    notify("Create File Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

async function createNewWorkspaceFolder() {
  const parent = preferredWorkspaceParent();
  const suggestion = `${parent ? `${parent}/` : ""}notes`;
  const path = normalizeWorkspaceTarget(await promptForInput({
    title: "Create New Folder",
    description: "Create a new folder inside the local workspace.",
    label: "New folder path",
    initialValue: suggestion,
    placeholder: "notes",
    confirmLabel: "Create Folder",
  }));
  if (!path) {
    return;
  }
  try {
    await postJson("/api/workspace/mkdir", { path });
    elements.workspaceImportStatus.textContent = `Created folder ${path}.`;
    state.workspace.selectedPath = path;
    state.workspace.selectedType = "dir";
    await refreshWorkspace();
    notify("Folder Created", `${path} was created in the local workspace.`, { tone: "success" });
  } catch (error) {
    elements.workspaceImportStatus.textContent = `New folder failed: ${error.message}`;
    notify("Create Folder Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

async function renameSelectedWorkspacePath() {
  if (!state.workspace.selectedPath) {
    elements.workspaceImportStatus.textContent = "Select a file or folder to rename.";
    return;
  }
  const nextPath = normalizeWorkspaceTarget(await promptForInput({
    title: "Rename Workspace Path",
    description: "Rename the selected local file or folder.",
    label: "New relative path",
    initialValue: state.workspace.selectedPath,
    confirmLabel: "Rename",
  }));
  if (!nextPath || nextPath === state.workspace.selectedPath) {
    return;
  }
  try {
    await postJson("/api/workspace/rename", {
      from_path: state.workspace.selectedPath,
      to_path: nextPath,
    });
    const wasCurrent = state.workspace.currentFilePath === state.workspace.selectedPath;
    state.workspace.openTabs = state.workspace.openTabs.map((item) => (item === state.workspace.selectedPath ? nextPath : item));
    state.workspace.selectedPath = nextPath;
    await refreshWorkspace();
    elements.workspaceImportStatus.textContent = `Renamed to ${nextPath}.`;
    if (wasCurrent) {
      await openWorkspaceFile(nextPath, { force: true });
    }
    notify("Path Renamed", `${nextPath} is now the active workspace path.`, { tone: "success" });
  } catch (error) {
    elements.workspaceImportStatus.textContent = `Rename failed: ${error.message}`;
    notify("Rename Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

async function deleteSelectedWorkspacePath() {
  if (!state.workspace.selectedPath) {
    elements.workspaceImportStatus.textContent = "Select a file or folder to delete.";
    return;
  }
  const confirmed = await confirmAction({
    title: "Delete Workspace Path",
    description: `Delete ${state.workspace.selectedPath} from the local workspace copy?`,
    confirmLabel: "Delete",
  });
  if (!confirmed) {
    return;
  }
  const deletingCurrent = state.workspace.currentFilePath === state.workspace.selectedPath;
  const target = state.workspace.selectedPath;
  try {
    await postJson("/api/workspace/delete", { path: target });
    state.workspace.openTabs = state.workspace.openTabs.filter((item) => item !== target);
    state.workspace.selectedPath = "";
    state.workspace.selectedType = "";
    if (deletingCurrent) {
      state.workspace.currentFilePath = "";
      state.workspace.currentLanguage = "markdown";
      state.workspace.dirty = false;
      const editor = await ensureEditor();
      state.editor.suppressDirty = true;
      editor.setValue(DEFAULT_EDITOR_TEXT);
      state.editor.monaco.editor.setModelLanguage(editor.getModel(), "markdown");
      state.editor.suppressDirty = false;
    }
    await refreshWorkspace();
    const nextTab = state.workspace.openTabs[state.workspace.openTabs.length - 1];
    if (nextTab) {
      await openWorkspaceFile(nextTab, { force: true });
    } else {
      updateEditorHeader();
    }
    elements.workspaceImportStatus.textContent = `Deleted ${target}.`;
    notify("Path Deleted", `${target} was removed from the local workspace copy.`, { tone: "success" });
  } catch (error) {
    elements.workspaceImportStatus.textContent = `Delete failed: ${error.message}`;
    notify("Delete Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

async function closeWorkspaceTab(path) {
  if (!path) {
    return;
  }
  const isCurrent = state.workspace.currentFilePath === path;
  if (isCurrent && state.workspace.dirty && !(await confirmAction({
    title: "Close Unsaved Tab",
    description: "This tab has unsaved local changes. Close it and discard those edits?",
    confirmLabel: "Close Tab",
  }))) {
    return;
  }
  state.workspace.openTabs = state.workspace.openTabs.filter((item) => item !== path);
  if (!isCurrent) {
    renderWorkspaceTabs();
    return;
  }
  state.workspace.currentFilePath = "";
  state.workspace.currentLanguage = "markdown";
  state.workspace.dirty = false;
  const nextTab = state.workspace.openTabs[state.workspace.openTabs.length - 1];
  if (nextTab) {
    await openWorkspaceFile(nextTab, { force: true });
    return;
  }
  const editor = await ensureEditor();
  state.editor.suppressDirty = true;
  editor.setValue(DEFAULT_EDITOR_TEXT);
  state.editor.monaco.editor.setModelLanguage(editor.getModel(), "markdown");
  state.editor.suppressDirty = false;
  updateEditorHeader();
}

async function createScratchFile(content, language, titlePrefix = "scratch") {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const extension = extensionForLanguage(language);
  const path = `scratch/${titlePrefix}-${timestamp}${extension}`;
  await postJson("/api/workspace/save", { path, content });
  await refreshWorkspace();
  await openWorkspaceFile(path, { force: true });
  setActiveView("workspace");
}

async function openCodeBlockInEditor(sourceKey, blockIndex) {
  const block = state.renderedCodeBlocks.get(sourceKey)?.[Number(blockIndex)];
  if (!block) {
    return;
  }
  await createScratchFile(block.code, block.language, "chat-snippet");
}

async function formatCurrentEditor() {
  const editor = await ensureEditor();
  await editor.getAction("editor.action.formatDocument")?.run();
}

async function findInEditor() {
  const editor = await ensureEditor();
  await editor.getAction("actions.find")?.run();
}

async function replaceInEditor() {
  const editor = await ensureEditor();
  await editor.getAction("editor.action.startFindReplaceAction")?.run();
}

function renderAssistantOutput(text, { enhanceCode = true } = {}) {
  state.workspace.assistantOutput = text;
  const sourceKey = "code-assistant-output";
  const rendered = renderRichText(text, sourceKey);
  state.workspace.assistantOutputBlocks = rendered.codeBlocks;
  const hasContent = Boolean(text.trim());
  elements.codeAssistantOutput.classList.toggle("empty-state", !hasContent);
  elements.codeAssistantOutput.innerHTML = hasContent ? (rendered.html || "<p>No output.</p>") : "Code assistant output will appear here.";
  setCodeAssistantBusy(state.codeAssistantBusy);
  if (enhanceCode) {
    enhanceCodeBlocks(elements.codeAssistantOutput).catch((error) => console.error(error));
  }
}

async function openAssistantOutputInEditor() {
  const block = state.workspace.assistantOutputBlocks[0];
  if (block) {
    await createScratchFile(block.code, block.language, "assistant-output");
    notify("Output Opened", "Assistant output was opened in a new workspace file.", { tone: "success" });
    return;
  }
  if (state.workspace.assistantOutput.trim()) {
    await createScratchFile(state.workspace.assistantOutput, "markdown", "assistant-output");
    notify("Output Opened", "Assistant output was opened in a new workspace file.", { tone: "success" });
  }
}

async function applyAssistantOutputToEditor() {
  const editor = await ensureEditor();
  const block = state.workspace.assistantOutputBlocks[0];
  const nextValue = block?.code || state.workspace.assistantOutput;
  if (!nextValue.trim()) {
    elements.codeAssistantStatus.textContent = "There is no assistant output to apply.";
    return;
  }
  if (editor.getValue().trim() && !(await confirmAction({
    title: "Replace Editor Contents",
    description: "Replace the current editor contents with the latest assistant output?",
    confirmLabel: "Apply Output",
  }))) {
    return;
  }
  state.editor.suppressDirty = true;
  editor.setValue(nextValue);
  state.editor.suppressDirty = false;
  if (block?.language) {
    state.workspace.currentLanguage = normalizeLanguage(block.language);
    state.editor.monaco.editor.setModelLanguage(editor.getModel(), state.workspace.currentLanguage);
  }
  state.workspace.dirty = true;
  updateEditorHeader();
  elements.codeAssistantStatus.textContent = "Applied assistant output to the editor. Save when ready.";
  notify("Editor Updated", "Assistant output has been applied to the current editor surface.", { tone: "success" });
}

async function sendCurrentFileToChat() {
  const editor = await ensureEditor();
  const content = editor.getValue();
  if (!content.trim()) {
    elements.workspaceImportStatus.textContent = "Current editor contents are empty.";
    return;
  }
  state.chatAttachments = [
    ...state.chatAttachments,
    {
      name: basename(state.workspace.currentFilePath || `untitled${extensionForLanguage(state.workspace.currentLanguage)}`),
      relativePath: state.workspace.currentFilePath || `scratch/untitled${extensionForLanguage(state.workspace.currentLanguage)}`,
      size: new Blob([content]).size,
      content,
    },
  ];
  renderAttachmentList(elements.chatAttachmentList, state.chatAttachments, "chat");
  setActiveView("chat");
  elements.promptInput.focus();
  setStreamStatus("Current editor file attached to chat.");
  notify("Attached To Chat", "The current editor contents are ready for the next prompt.", { tone: "success" });
}

async function runCodeAction(action) {
  const editor = await ensureEditor();
  let input = editor.getValue();
  let actionPrompt = codeActionPrompts[action];

  if (action === "generate") {
    const description = await promptForInput({
      title: "Generate Script",
      description: "Describe the code or script you want the local model to generate.",
      label: "Generation prompt",
      initialValue: input || "Write a Python script that...",
      confirmLabel: "Generate",
    });
    if (!description) {
      return;
    }
    input = description;
  }

  if (action === "convert") {
    const targetLanguage = await promptForInput({
      title: "Convert Language",
      description: "Choose the target language for the current editor content.",
      label: "Target language",
      initialValue: "python",
      confirmLabel: "Convert",
    });
    if (!targetLanguage) {
      return;
    }
    actionPrompt = `${codeActionPrompts.convert} Target language: ${targetLanguage}.`;
  }

  if (!input.trim()) {
    elements.codeAssistantStatus.textContent = "Open a file or enter a script description first.";
    return;
  }

  try {
    const selection = surfaceAgentState("workspace").selected;
    const plan = await runSurfaceAgents("workspace", `${actionPrompt}\n\nPath: ${state.workspace.currentFilePath || "Untitled"}\nLanguage: ${state.workspace.currentLanguage}\n\nContent:\n\`\`\`${state.workspace.currentLanguage}\n${input}\n\`\`\``, {
      selection,
      compareRequested: false,
      forceSingleShot: true,
    });
    elements.codeAssistantStatus.textContent = `Finished ${action} with ${agentDisplayLabel(plan.primaryAgent)}.`;
  } catch (error) {
    elements.codeAssistantStatus.textContent = `Code action failed: ${error.message}`;
    renderAssistantOutput(`Error: ${error.message}`, { enhanceCode: true });
    notify("Code Action Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

async function runWorkspaceCompare() {
  const editor = await ensureEditor();
  const content = editor.getValue();
  if (!content.trim()) {
    elements.codeAssistantStatus.textContent = "Open a file before running a multi-agent comparison.";
    return;
  }
  try {
    const selection = surfaceAgentState("workspace").selected;
    const plan = await runSurfaceAgents("workspace", "Review the current file from your specialized perspective. Highlight the most important improvements, risks, and next local edits.", {
      selection,
      compareRequested: true,
      forceSingleShot: true,
    });
    elements.codeAssistantStatus.textContent = `Compared ${plan.results.length} agents on the current file.`;
  } catch (error) {
    elements.codeAssistantStatus.textContent = `Compare failed: ${error.message}`;
    notify("Workspace Compare Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

async function generateWorkspaceNotes() {
  const editor = await ensureEditor();
  const content = editor.getValue();
  if (!content.trim()) {
    elements.codeAssistantStatus.textContent = "Open a file before generating notes.";
    return;
  }
  try {
    const plan = await runSurfaceAgents("workspace", "Create concise markdown notes for the current file. Use sections: Overview, Important Logic, Risks, Suggested Next Steps.", {
      selection: "documentation",
      compareRequested: false,
      forceSingleShot: true,
    });
    elements.codeAssistantStatus.textContent = `${agentDisplayLabel(plan.primaryAgent)} generated markdown notes for the current file.`;
  } catch (error) {
    elements.codeAssistantStatus.textContent = `Notes generation failed: ${error.message}`;
    notify("Workspace Notes Failed", error.message, { tone: "error", timeout: 4200 });
  }
}

async function summarizeChatThread() {
  const prompt = "Summarize the current chat thread into concise markdown notes with sections: Goal, Important Findings, Open Questions, Suggested Next Steps.";
  await runChatAgentFlow(prompt, {
    appendUser: false,
    selection: "documentation",
    rawPrompt: "",
  });
}

function handleSurfaceAgentSelect(surface, value) {
  const current = surfaceAgentState(surface);
  if (!current) {
    return;
  }
  current.selected = value || surfaceDefaultAgent(surface);
  current.routeLabel = value === "auto" ? "Auto (Coordinator)" : agentDisplayLabel(current.selected);
  current.status = value === "auto"
    ? "Coordinator routing is enabled for the next request."
    : `${agentDisplayLabel(current.selected)} is selected for the next request.`;
  renderAgentSurface(surface);
}

async function updateAgentDefault(value) {
  await persistSettingsPatch(
    { agents: { default_agent: value || "auto" } },
    { successMessage: `${agentDisplayLabel(value || "auto")} is now the default routed chat agent.` },
  );
  const chatSurface = surfaceAgentState("chat");
  chatSurface.selected = value || "auto";
  chatSurface.routeLabel = agentDisplayLabel(chatSurface.selected);
  renderAllAgentSurfaces();
}

async function updateAgentCompareMode(enabled) {
  await persistSettingsPatch(
    { agents: { compare_mode: Boolean(enabled) } },
    { successMessage: `Default compare mode is now ${enabled ? "enabled" : "disabled"} for supported flows.` },
  );
  renderAllAgentSurfaces();
}

async function updateAgentProfile(agentId, patch) {
  await persistSettingsPatch(
    { agents: { profiles: { [agentId]: patch } } },
    { successMessage: `${agentDisplayLabel(agentId)} was updated locally.` },
  );
  renderAllAgentSurfaces();
}

async function triggerAgentWorkflow(key) {
  const template = agentWorkflowTemplates.find((item) => item.key === key);
  if (!template) {
    return;
  }
  setActiveView(template.targetView);
  if (template.targetSurface === "chat") {
    handleSurfaceAgentSelect("chat", template.agent);
    if (key === "compare-agent-opinions") {
      const prompt = currentChatAgentPrompt();
      if (!prompt) {
        setStreamStatus("Enter a prompt or attach files before comparing agents.");
        elements.promptInput.focus();
        return;
      }
      await runChatAgentFlow(prompt, {
        appendUser: false,
        selection: "auto",
        compareRequested: true,
      });
      return;
    }
    elements.promptInput.focus();
    return;
  }
  if (template.targetSurface === "workspace") {
    handleSurfaceAgentSelect("workspace", template.agent);
    if (key === "explain-current-file") {
      await runCodeAction("explain");
      return;
    }
    if (key === "improve-current-code") {
      await runCodeAction("improve");
    }
    return;
  }
  if (template.targetSurface === "scan") {
    handleSurfaceAgentSelect("scan", template.agent);
    if (key === "turn-findings-into-notes") {
      await runScanAgent({
        selection: "documentation",
        prompt: "Turn the current analyzer context into concise markdown notes with sections: Findings, Services, Risks, Suggested Next Steps.",
      });
      return;
    }
    if (key === "summarize-current-scan") {
      await runScanAgent({
        selection: "analysis",
      });
    }
  }
}

document.getElementById("composer").addEventListener("submit", handleSubmit);
document.getElementById("refresh-models").addEventListener("click", refreshDashboardData);
document.getElementById("refresh-all").addEventListener("click", refreshDashboardData);
document.getElementById("new-session").addEventListener("click", () => resetSession(true));
document.getElementById("export-session").addEventListener("click", exportSession);
document.getElementById("import-session").addEventListener("change", importSession);
document.getElementById("analyze-scan").addEventListener("click", handleScanAnalyzer);
elements.previewScan.addEventListener("click", () => {
  previewScanAnalysis().catch((error) => {
    elements.scanAnalysisStatus.textContent = `Local analysis failed: ${error.message}`;
  });
});
document.getElementById("clear-scan").addEventListener("click", () => {
  elements.scanInput.value = "";
  state.scanAttachments = [];
  state.scanAnalysis = null;
  renderAttachmentList(elements.scanAttachmentList, state.scanAttachments, "scan");
  renderScanAnalysis();
  elements.scanAnalysisStatus.textContent = "Run a local structured parse to extract services, likely issues, and next steps.";
});
elements.runToolCommand.addEventListener("click", runToolCommand);
elements.clearToolCommand.addEventListener("click", () => {
  elements.launcherCommand.value = "";
  elements.launcherConfirm.checked = false;
  elements.launcherStatus.textContent = "Command execution stays local. Hidden execution is disabled.";
  renderLauncherPreview();
});
document.getElementById("save-ctf-notes").addEventListener("click", saveCtfNotes);
document.getElementById("send-ctf-prompt").addEventListener("click", sendActiveCtfPrompt);
elements.clearChat.addEventListener("click", () => resetSession(false));
elements.stopGeneration.addEventListener("click", stopGeneration);
elements.regenerateResponse.addEventListener("click", regenerateLastResponse);
elements.chatFileInput.addEventListener("change", (event) => {
  attachFiles("chat", event.target.files).catch((error) => {
    notify("Attachment Failed", error.message, { tone: "error", timeout: 4200 });
  });
  event.target.value = "";
});
elements.scanFileInput.addEventListener("change", (event) => {
  attachFiles("scan", event.target.files).catch((error) => {
    elements.scanAnalysisStatus.textContent = `Attachment failed: ${error.message}`;
    notify("Scan Attachment Failed", error.message, { tone: "error", timeout: 4200 });
  });
  event.target.value = "";
});
elements.workspaceFileInput.addEventListener("change", (event) => {
  importIntoWorkspace(event.target.files, false).catch((error) => {
    elements.workspaceImportStatus.textContent = `Import failed: ${error.message}`;
    notify("Workspace Import Failed", error.message, { tone: "error", timeout: 4200 });
  });
  event.target.value = "";
});
elements.workspaceFolderInput.addEventListener("change", (event) => {
  importIntoWorkspace(event.target.files, true).catch((error) => {
    elements.workspaceImportStatus.textContent = `Project import failed: ${error.message}`;
    notify("Project Import Failed", error.message, { tone: "error", timeout: 4200 });
  });
  event.target.value = "";
});
elements.workspaceNewFile.addEventListener("click", () => {
  createNewWorkspaceFile().catch((error) => {
    elements.workspaceImportStatus.textContent = `New file failed: ${error.message}`;
  });
});
elements.workspaceNewFolder.addEventListener("click", () => {
  createNewWorkspaceFolder().catch((error) => {
    elements.workspaceImportStatus.textContent = `New folder failed: ${error.message}`;
  });
});
elements.workspaceRenamePath.addEventListener("click", () => {
  renameSelectedWorkspacePath().catch((error) => {
    elements.workspaceImportStatus.textContent = `Rename failed: ${error.message}`;
  });
});
elements.workspaceDeletePath.addEventListener("click", () => {
  deleteSelectedWorkspacePath().catch((error) => {
    elements.workspaceImportStatus.textContent = `Delete failed: ${error.message}`;
  });
});
elements.workspaceSaveFile.addEventListener("click", () => {
  saveCurrentFile(false).catch((error) => {
    elements.workspaceImportStatus.textContent = `Save failed: ${error.message}`;
  });
});
elements.workspaceSaveAsFile.addEventListener("click", () => {
  saveCurrentFile(true).catch((error) => {
    elements.workspaceImportStatus.textContent = `Save As failed: ${error.message}`;
  });
});
elements.workspaceFormatFile.addEventListener("click", () => {
  formatCurrentEditor().catch((error) => {
    elements.workspaceImportStatus.textContent = `Format failed: ${error.message}`;
  });
});
elements.workspaceFind.addEventListener("click", () => {
  findInEditor().catch((error) => {
    elements.workspaceImportStatus.textContent = `Search failed: ${error.message}`;
  });
});
elements.workspaceReplace.addEventListener("click", () => {
  replaceInEditor().catch((error) => {
    elements.workspaceImportStatus.textContent = `Replace failed: ${error.message}`;
  });
});
elements.workspaceSendToChat.addEventListener("click", () => {
  sendCurrentFileToChat().catch((error) => {
    elements.workspaceImportStatus.textContent = `Send to chat failed: ${error.message}`;
  });
});
elements.codeAssistantOpenOutput.addEventListener("click", openAssistantOutputInEditor);
elements.codeAssistantApplyOutput.addEventListener("click", () => {
  applyAssistantOutputToEditor().catch((error) => {
    elements.codeAssistantStatus.textContent = `Apply failed: ${error.message}`;
  });
});

elements.promptInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    document.getElementById("composer").requestSubmit();
    return;
  }
  if (event.altKey && event.key === "ArrowUp") {
    event.preventDefault();
    cyclePromptHistory(1);
    return;
  }
  if (event.altKey && event.key === "ArrowDown") {
    event.preventDefault();
    cyclePromptHistory(-1);
  }
});
elements.promptInput.addEventListener("input", () => {
  resetPromptHistoryCursor();
  autosizeTextarea(elements.promptInput);
});
elements.scanInput.addEventListener("input", () => {
  elements.scanAnalysisStatus.textContent = "Scan input changed. Run Analyze locally to refresh the structured summary.";
});
elements.workspaceFilter.addEventListener("input", () => {
  state.workspace.filterQuery = elements.workspaceFilter.value;
  renderWorkspaceTree();
});
elements.launcherCommand.addEventListener("input", renderLauncherPreview);
elements.launcherConfirm.addEventListener("change", renderLauncherPreview);

wireDropzone(elements.chatDropzone, "chat");
wireDropzone(elements.scanDropzone, "scan");

elements.navItems.forEach((item) => {
  item.addEventListener("click", () => setActiveView(item.dataset.view));
});

elements.commandDeck.addEventListener("click", (event) => {
  const target = event.target.closest(".copy-command");
  if (target) {
    copyToClipboard(target.dataset.command || "", "Command Copied", "The terminal command is ready to paste.")
      .catch((error) => notify("Copy Failed", error.message, { tone: "error", timeout: 4200 }));
  }
});

elements.promptHistoryList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-prompt-index]");
  if (!target) {
    return;
  }
  const prompt = chatSettings().prompt_history[Number(target.dataset.promptIndex)];
  if (!prompt) {
    return;
  }
  setActiveView("chat");
  elements.promptInput.value = prompt;
  resetPromptHistoryCursor();
  autosizeTextarea(elements.promptInput);
  elements.promptInput.focus();
});

elements.chatAttachmentList.addEventListener("click", (event) => {
  const target = event.target.closest(".attachment-remove");
  if (target) {
    removeAttachment(target.dataset.scope, Number(target.dataset.index));
  }
});

elements.scanAttachmentList.addEventListener("click", (event) => {
  const target = event.target.closest(".attachment-remove");
  if (target) {
    removeAttachment(target.dataset.scope, Number(target.dataset.index));
  }
});

elements.chatFeed.addEventListener("click", (event) => {
  const copyButton = event.target.closest(".message-copy");
  if (copyButton) {
    const message = state.session.messages[Number(copyButton.dataset.messageIndex)];
    copyToClipboard(message?.content || "", "Message Copied", "The full chat message is on your clipboard.")
      .catch((error) => notify("Copy Failed", error.message, { tone: "error", timeout: 4200 }));
    return;
  }
  const regenerateButton = event.target.closest(".message-regenerate");
  if (regenerateButton) {
    regenerateLastResponse();
    return;
  }
  const codeCopy = event.target.closest(".code-copy-button");
  if (codeCopy) {
    const block = state.renderedCodeBlocks.get(codeCopy.dataset.sourceKey || "")?.[Number(codeCopy.dataset.blockIndex)];
    copyToClipboard(block?.code || "", "Code Copied", "The code block is on your clipboard.")
      .catch((error) => notify("Copy Failed", error.message, { tone: "error", timeout: 4200 }));
    return;
  }
  const codeOpen = event.target.closest(".code-open-button");
  if (codeOpen) {
    openCodeBlockInEditor(codeOpen.dataset.sourceKey, codeOpen.dataset.blockIndex).catch((error) => {
      elements.codeAssistantStatus.textContent = `Open in editor failed: ${error.message}`;
    });
  }
});

elements.codeAssistantOutput.addEventListener("click", (event) => {
  const codeCopy = event.target.closest(".code-copy-button");
  if (codeCopy) {
    const block = state.renderedCodeBlocks.get(codeCopy.dataset.sourceKey || "")?.[Number(codeCopy.dataset.blockIndex)];
    copyToClipboard(block?.code || "", "Code Copied", "The assistant code block is on your clipboard.")
      .catch((error) => notify("Copy Failed", error.message, { tone: "error", timeout: 4200 }));
    return;
  }
  const codeOpen = event.target.closest(".code-open-button");
  if (codeOpen) {
    openCodeBlockInEditor(codeOpen.dataset.sourceKey, codeOpen.dataset.blockIndex).catch((error) => {
      elements.codeAssistantStatus.textContent = `Open in editor failed: ${error.message}`;
    });
  }
});

elements.toolList.addEventListener("click", (event) => {
  const copyTarget = event.target.closest(".copy-tool");
  if (copyTarget) {
    copyToClipboard(copyTarget.dataset.command || "", "Command Copied", "The tool template was copied locally.")
      .catch((error) => notify("Copy Failed", error.message, { tone: "error", timeout: 4200 }));
    return;
  }
  const templateTarget = event.target.closest(".use-tool-template");
  if (templateTarget) {
    elements.launcherCommand.value = templateTarget.dataset.command || "";
    renderLauncherPreview();
    setActiveView("tools");
  }
});

elements.modelGrid.addEventListener("click", (event) => {
  const target = event.target.closest(".model-activate");
  if (!target) {
    return;
  }
  elements.modelSelect.value = target.dataset.model || "";
  elements.activeModelLabel.textContent = `Model: ${elements.modelSelect.value || "unavailable"}`;
  renderModels();
  renderMonitoring();
  renderDashboard();
  notify("Model Selected", `${elements.modelSelect.value || "No model"} is selected for upcoming local requests.`, { tone: "success" });
});

elements.modelRecommendations.addEventListener("click", (event) => {
  const target = event.target.closest(".copy-pull-command");
  if (target) {
    copyToClipboard(target.dataset.command || "", "Pull Command Copied", "The model pull command is on your clipboard.")
      .catch((error) => notify("Copy Failed", error.message, { tone: "error", timeout: 4200 }));
    return;
  }
  const setDefaultTarget = event.target.closest(".recommendation-set-default");
  if (setDefaultTarget) {
    handleDefaultModelChange(setDefaultTarget.dataset.model || "").catch((error) => {
      elements.modelsStatus.textContent = `Model update failed: ${error.message}`;
    });
  }
});

elements.modelSetupGuide.addEventListener("click", (event) => {
  const copyTarget = event.target.closest(".wizard-copy-pull");
  if (copyTarget) {
    copyToClipboard(copyTarget.dataset.command || "", "Pull Command Copied", "The model pull command is on your clipboard.")
      .catch((error) => notify("Copy Failed", error.message, { tone: "error", timeout: 4200 }));
    return;
  }
  const defaultTarget = event.target.closest(".wizard-set-default");
  if (defaultTarget) {
    handleDefaultModelChange(defaultTarget.dataset.model || "").catch((error) => {
      elements.modelsStatus.textContent = `Model update failed: ${error.message}`;
    });
  }
});

elements.onboardingModelList.addEventListener("click", (event) => {
  const copyTarget = event.target.closest(".wizard-copy-pull");
  if (copyTarget) {
    copyToClipboard(copyTarget.dataset.command || "", "Pull Command Copied", "The model pull command is on your clipboard.")
      .catch((error) => notify("Copy Failed", error.message, { tone: "error", timeout: 4200 }));
    return;
  }
  const defaultTarget = event.target.closest(".wizard-set-default");
  if (defaultTarget) {
    handleDefaultModelChange(defaultTarget.dataset.model || "").catch((error) => {
      elements.onboardingModelStatus.textContent = `Model update failed: ${error.message}`;
    });
  }
});

elements.launcherTemplateList.addEventListener("click", (event) => {
  const target = event.target.closest(".template-button");
  if (target) {
    elements.launcherCommand.value = target.dataset.command || "";
    renderLauncherPreview();
  }
});

elements.scanPresetList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-scan-preset]");
  if (target) {
    persistSettingsPatch(
      { analyzer: { default_scan_preset: target.dataset.scanPreset } },
      { successMessage: `${scanPresets[target.dataset.scanPreset]?.label || "Analyzer"} is now the default scan preset.` },
    )
      .then(() => previewScanAnalysis())
      .catch((error) => {
        elements.scanAnalysisStatus.textContent = `Local analysis failed: ${error.message}`;
      });
  }
});

elements.toolJobList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-job-id]");
  if (target) {
    state.selectedJobId = target.dataset.jobId;
    renderToolJobs();
    fetchJobDetail(target.dataset.jobId);
  }
});

elements.toolJobDetail.addEventListener("click", (event) => {
  const target = event.target.closest(".send-job-to-scan");
  if (target) {
    sendJobOutputToScan(target.dataset.jobId, target.dataset.executable).catch((error) => {
      elements.launcherStatus.textContent = `Analyzer handoff failed: ${error.message}`;
    });
    return;
  }
  const stopTarget = event.target.closest(".stop-job");
  if (stopTarget) {
    stopToolJob(stopTarget.dataset.jobId).catch((error) => {
      elements.launcherStatus.textContent = `Stop failed: ${error.message}`;
    });
  }
});

elements.ctfTabList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-ctf-category]");
  if (target) {
    persistSettingsPatch(
      { ctf: { default_category: target.dataset.ctfCategory } },
      { successMessage: `${ctfCategories[target.dataset.ctfCategory]?.label || "CTF"} is now the default helper category.` },
    ).catch((error) => {
      elements.ctfNoteStatus.textContent = `Category update failed: ${error.message}`;
    });
  }
});

elements.ctfCardGrid.addEventListener("click", (event) => {
  const target = event.target.closest("[data-ctf-prompt-index]");
  if (!target) {
    return;
  }
  const index = Number(target.dataset.ctfPromptIndex);
  const prompt = ctfCategories[activeCtfCategory()].prompts[index];
  if (!prompt) {
    return;
  }
  setActiveView("chat");
  elements.promptInput.value = prompt.text;
  elements.promptInput.focus();
});

elements.modelSelect.addEventListener("change", () => {
  elements.activeModelLabel.textContent = `Model: ${elements.modelSelect.value || "unavailable"}`;
  renderModels();
  renderMonitoring();
  renderDashboard();
  notify("Model Selected", `${elements.modelSelect.value || "No model"} is selected for upcoming local requests.`, { tone: "success" });
});

elements.defaultModelSelect.addEventListener("change", () => {
  handleDefaultModelChange(elements.defaultModelSelect.value).catch((error) => {
    elements.modelsStatus.textContent = `Model update failed: ${error.message}`;
  });
});

elements.chatAgentSelect.addEventListener("change", () => handleSurfaceAgentSelect("chat", elements.chatAgentSelect.value));
elements.workspaceAgentSelect.addEventListener("change", () => handleSurfaceAgentSelect("workspace", elements.workspaceAgentSelect.value));
elements.scanAgentSelect.addEventListener("change", () => handleSurfaceAgentSelect("scan", elements.scanAgentSelect.value));
elements.agentsDefaultSelect.addEventListener("change", () => {
  updateAgentDefault(elements.agentsDefaultSelect.value).catch((error) => {
    elements.agentsManagerStatus.textContent = `Default agent update failed: ${error.message}`;
  });
});
elements.agentsCompareMode.addEventListener("change", () => {
  updateAgentCompareMode(elements.agentsCompareMode.checked).catch((error) => {
    elements.agentsManagerStatus.textContent = `Compare mode update failed: ${error.message}`;
  });
});
elements.chatCompareAgents.addEventListener("click", () => {
  const prompt = currentChatAgentPrompt();
  if (!prompt) {
    setStreamStatus("Enter a prompt or attach files before comparing agents.");
    elements.promptInput.focus();
    return;
  }
  const appendUser = Boolean(elements.promptInput.value.trim() || state.chatAttachments.length);
  if (appendUser) {
    clearChatComposer();
  }
  runChatAgentFlow(prompt, {
    appendUser,
    selection: "auto",
    compareRequested: true,
  }).catch((error) => {
    setStreamStatus(`Compare failed: ${error.message}`);
  });
});
elements.chatSummarizeThread.addEventListener("click", () => {
  summarizeChatThread().catch((error) => {
    setStreamStatus(`Summary failed: ${error.message}`);
  });
});
elements.workspaceCompareAgents.addEventListener("click", () => {
  runWorkspaceCompare().catch((error) => {
    elements.codeAssistantStatus.textContent = `Compare failed: ${error.message}`;
  });
});
elements.workspaceGenerateNotes.addEventListener("click", () => {
  generateWorkspaceNotes().catch((error) => {
    elements.codeAssistantStatus.textContent = `Notes failed: ${error.message}`;
  });
});
elements.scanRunAgent.addEventListener("click", () => {
  runScanAgent().catch((error) => {
    elements.scanAgentStatus.textContent = `Agent review failed: ${error.message}`;
  });
});
elements.scanCompareAgents.addEventListener("click", () => {
  runScanAgent({ compareRequested: true }).catch((error) => {
    elements.scanAgentStatus.textContent = `Compare failed: ${error.message}`;
  });
});
elements.scanGenerateNotes.addEventListener("click", () => {
  runScanAgent({
    selection: "documentation",
    prompt: "Create concise markdown notes from the current analyzer context. Use sections: Findings, Services, Risks, Suggested Next Steps.",
  }).catch((error) => {
    elements.scanAgentStatus.textContent = `Notes failed: ${error.message}`;
  });
});

elements.assistantModeSelect.addEventListener("change", () => {
  handleAssistantModeChange(elements.assistantModeSelect.value).catch((error) => {
    setStreamStatus(`Mode update failed: ${error.message}`);
  });
});

elements.settingInputs.forEach((input) => {
  const eventName = input.tagName === "SELECT" ? "change" : "input";
  input.addEventListener(eventName, handleSettingsFieldInteraction);
});

elements.settingsSaveButton.addEventListener("click", () => {
  saveSettingsFromForm().catch((error) => {
    elements.settingsSaveStatus.textContent = `Settings save failed: ${error.message}`;
  });
});

elements.settingsResetButton.addEventListener("click", () => {
  resetSettingsToDefaults().catch((error) => {
    elements.settingsSaveStatus.textContent = `Settings reset failed: ${error.message}`;
  });
});
elements.settingsOpenWelcome.addEventListener("click", () => {
  renderOnboarding();
  setOnboardingVisibility(true);
});

elements.onboardingGetStarted.addEventListener("click", () => {
  completeOnboarding().catch((error) => {
    elements.onboardingModelStatus.textContent = `Setup completion failed: ${error.message}`;
  });
});
elements.onboardingConfigureModels.addEventListener("click", () => {
  completeOnboarding({ openModels: true }).catch((error) => {
    elements.onboardingModelStatus.textContent = `Setup completion failed: ${error.message}`;
  });
});
elements.onboardingSkipSetup.addEventListener("click", () => {
  completeOnboarding().catch((error) => {
    elements.onboardingModelStatus.textContent = `Setup completion failed: ${error.message}`;
  });
});

document.querySelectorAll(".preset-button").forEach((button) => {
  button.addEventListener("click", () => {
    elements.systemPrompt.value = button.dataset.preset || "";
    autosizeTextarea(elements.systemPrompt, 360);
    syncSettingsDraftFromForm();
    setActiveView("settings");
  });
});

elements.workspaceTree.addEventListener("click", (event) => {
  const target = event.target.closest("[data-path]");
  if (!target) {
    return;
  }
  state.workspace.selectedPath = target.dataset.path;
  state.workspace.selectedType = target.dataset.nodeType || "file";
  renderWorkspaceTree();
  if (state.workspace.selectedType === "file") {
    openWorkspaceFile(target.dataset.path).catch((error) => {
      elements.workspaceImportStatus.textContent = `Open failed: ${error.message}`;
    });
  }
});

elements.workspaceTabBar.addEventListener("click", (event) => {
  const closeTarget = event.target.closest("[data-close-tab]");
  if (closeTarget) {
    closeWorkspaceTab(closeTarget.dataset.closeTab).catch((error) => {
      elements.workspaceImportStatus.textContent = `Close tab failed: ${error.message}`;
    });
    return;
  }
  const openTarget = event.target.closest("[data-open-tab]");
  if (openTarget) {
    openWorkspaceFile(openTarget.dataset.openTab).catch((error) => {
      elements.workspaceImportStatus.textContent = `Open tab failed: ${error.message}`;
    });
  }
});

elements.dashboardJobList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-dashboard-job-id]");
  if (!target) {
    return;
  }
  state.selectedJobId = target.dataset.dashboardJobId;
  setActiveView("tools");
  renderToolJobs();
  fetchJobDetail(target.dataset.dashboardJobId);
});

document.querySelectorAll(".dashboard-link-button").forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.dashboardView));
});

document.querySelectorAll(".code-action-button").forEach((button) => {
  button.addEventListener("click", () => {
    runCodeAction(button.dataset.codeAction).catch((error) => {
      elements.codeAssistantStatus.textContent = `Code action failed: ${error.message}`;
    });
  });
});

elements.agentWorkflowTemplates.addEventListener("click", (event) => {
  const target = event.target.closest("[data-agent-workflow]");
  if (!target) {
    return;
  }
  triggerAgentWorkflow(target.dataset.agentWorkflow).catch((error) => {
    elements.agentsManagerStatus.textContent = `Workflow failed: ${error.message}`;
    notify("Agent Workflow Failed", error.message, { tone: "error", timeout: 4200 });
  });
});

elements.agentGrid.addEventListener("change", (event) => {
  const enableToggle = event.target.closest(".agent-enable-toggle");
  if (enableToggle) {
    updateAgentProfile(enableToggle.dataset.agentId, { enabled: enableToggle.checked }).catch((error) => {
      elements.agentsManagerStatus.textContent = `Agent update failed: ${error.message}`;
      notify("Agent Update Failed", error.message, { tone: "error", timeout: 4200 });
    });
    return;
  }
  const modelSelect = event.target.closest(".agent-model-select");
  if (modelSelect) {
    updateAgentProfile(modelSelect.dataset.agentId, { assigned_model: modelSelect.value }).catch((error) => {
      elements.agentsManagerStatus.textContent = `Model assignment failed: ${error.message}`;
      notify("Agent Model Failed", error.message, { tone: "error", timeout: 4200 });
    });
  }
});

[elements.chatAgentTabs, elements.workspaceAgentTabs, elements.scanAgentTabs].forEach((container) => {
  container.addEventListener("click", (event) => {
    const target = event.target.closest("[data-agent-tab][data-agent-surface]");
    if (!target) {
      return;
    }
    const surface = target.dataset.agentSurface;
    const current = surfaceAgentState(surface);
    if (!current) {
      return;
    }
    current.activeTab = target.dataset.agentTab;
    renderAgentSurface(surface);
  });
});

document.addEventListener("keydown", (event) => {
  if (state.dialog.open && event.key === "Escape") {
    closeDialog(null);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && state.activeView === "workspace") {
    const lowerKey = event.key.toLowerCase();
    if (lowerKey === "s") {
      event.preventDefault();
      saveCurrentFile(event.shiftKey).catch((error) => {
        elements.workspaceImportStatus.textContent = `Save failed: ${error.message}`;
      });
      return;
    }
    if (lowerKey === "f") {
      event.preventDefault();
      findInEditor().catch((error) => {
        elements.workspaceImportStatus.textContent = `Search failed: ${error.message}`;
      });
      return;
    }
    if (lowerKey === "h") {
      event.preventDefault();
      replaceInEditor().catch((error) => {
        elements.workspaceImportStatus.textContent = `Replace failed: ${error.message}`;
      });
      return;
    }
  }
  if (event.key === "Escape" && state.busy && state.activeView === "chat") {
    stopGeneration();
  }
});

elements.dialogBackdrop.addEventListener("click", () => closeDialog(null));
elements.dialogCancel.addEventListener("click", () => closeDialog(null));
elements.dialogClose.addEventListener("click", () => closeDialog(null));
elements.dialogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.dialog.mode === "prompt") {
    const value = elements.dialogInput.value.trim();
    if (!value) {
      setDialogError("A value is required for this action.");
      elements.dialogInput.focus();
      return;
    }
    closeDialog(value);
    return;
  }
  closeDialog(true);
});

window.addEventListener("beforeunload", (event) => {
  if (!state.workspace.dirty && !state.busy && !state.codeAssistantBusy && !state.settingsDirty) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
});

async function initApp() {
  setActiveView(state.activeView);
  renderCommandDeck();
  renderLauncherTemplates();
  renderAttachmentList(elements.chatAttachmentList, state.chatAttachments, "chat");
  renderAttachmentList(elements.scanAttachmentList, state.scanAttachments, "scan");
  renderScanAnalysis();
  renderAssistantOutput("");
  renderLauncherPreview();
  renderSessionMeta();
  renderMessages();
  autosizeTextarea(elements.promptInput);
  elements.settingsSaveButton.disabled = true;
  elements.settingsResetButton.disabled = true;
  setBusy(false);
  setLauncherBusy(false);
  setCodeAssistantBusy(false);

  await fetchSettingsPayload();
  await fetchAgentCatalog();
  renderRuntimeInfo();
  renderLocalStatus();
  renderModelRuntime();
  renderDashboard();
  renderAllAgentSurfaces();
  await refreshDashboardData();
  maybeShowOnboarding();
  hideStartupSplash();
}

initApp().catch((error) => {
  console.error(error);
  hideStartupSplash();
  notify("App Startup Failed", error.message, { tone: "error", timeout: 5200 });
  elements.settingsSaveStatus.textContent = `Startup warning: ${error.message}`;
});
