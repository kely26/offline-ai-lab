#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
import os
import platform
import re
import shlex
import shutil
import signal
import subprocess
import sys
import threading
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT_DIR.parent
PACKAGE_JSON_FILE = PROJECT_ROOT / "package.json"
TAURI_CONFIG_FILE = PROJECT_ROOT / "src-tauri" / "tauri.conf.json"
BUNDLE_OUTPUT_HINT = PROJECT_ROOT / "src-tauri" / "target" / "release" / "bundle"
MONACO_DIR = PROJECT_ROOT / "node_modules" / "monaco-editor" / "min"
AI_HOME = Path(os.environ.get("HACKLOI_AI_HOME", Path.home() / ".local/share/hackloi-ai"))
OLLAMA_API_BASE = os.environ.get("OLLAMA_API_BASE", "http://127.0.0.1:11434").rstrip("/")
HOST = os.environ.get("WEBUI_HOST", "127.0.0.1")
PORT = int(os.environ.get("WEBUI_PORT", "3000"))
CHAT_NUM_CTX = int(os.environ.get("HACKLOI_CHAT_NUM_CTX", "2048"))
CHAT_TEMPERATURE = float(os.environ.get("HACKLOI_CHAT_TEMPERATURE", "0.2"))
RUN_DIR = AI_HOME / "run"
LOG_DIR = AI_HOME / "logs"
JOBS_DIR = AI_HOME / "tool-jobs"
WORKDIR = AI_HOME
WORKSPACE_DIR = AI_HOME / "code-workspace"
WORKSPACE_META = WORKSPACE_DIR / ".workspace.json"
SETTINGS_FILE = AI_HOME / "settings.json"
OLLAMA_PID_FILE = RUN_DIR / "ollama.pid"
WEBUI_PID_FILE = RUN_DIR / "webui.pid"
JOB_LOCK = threading.Lock()
CPU_LOCK = threading.Lock()
CPU_SAMPLE: dict[str, int] | None = None
APP_NAME = "Hackloi AI Cyber Lab"
APP_DESCRIPTION = "Local AI cybersecurity workstation with Ollama-backed chat, code workspace, tooling, and scan analysis."
DEFAULT_APP_VERSION = "0.1.0"
DEFAULT_SYSTEM_PROMPT = 'You are Hackloi AI, a cybersecurity assistant running inside a Kali Linux lab. Welcome the user with "Welcome Hackloi". Help with Linux, cybersecurity learning, programming tasks, and offline workflows.'

TOOLS = {
    "nmap": {
        "label": "Nmap",
        "description": "Network mapper for host and service discovery.",
        "snippet": "nmap -sV target.com -oN scan.txt",
    },
    "burpsuite": {
        "label": "Burp Suite",
        "description": "Web testing proxy and inspection suite.",
        "snippet": "burpsuite",
    },
    "msfconsole": {
        "label": "Metasploit",
        "description": "Framework console for lab-oriented exploit research.",
        "snippet": "msfconsole",
    },
    "code": {
        "label": "VS Code",
        "description": "Editor for scripts, notes, and local project work.",
        "snippet": "code .",
    },
    "ffuf": {
        "label": "ffuf",
        "description": "Fast web content fuzzing for local web testing workflows.",
        "snippet": "ffuf -u https://target/FUZZ -w wordlist.txt",
    },
    "httpx": {
        "label": "httpx",
        "description": "Probe targets and capture web metadata.",
        "snippet": "httpx -l hosts.txt -title -tech-detect",
    },
    "subfinder": {
        "label": "subfinder",
        "description": "Passive subdomain discovery for recon workflows.",
        "snippet": "subfinder -d target.com -silent",
    },
    "nikto": {
        "label": "Nikto",
        "description": "Web server scanner for common security misconfigurations.",
        "snippet": "nikto -h https://target.com",
    },
    "whois": {
        "label": "whois",
        "description": "WHOIS lookup for ownership and registration metadata.",
        "snippet": "whois target.com",
    },
    "dig": {
        "label": "dig",
        "description": "DNS query utility for records and resolution paths.",
        "snippet": "dig target.com any",
    },
}

RECOMMENDED_MODELS = [
    {
        "name": "phi4-mini",
        "label": "Phi 4 Mini",
        "description": "Fast local assistant option for lightweight offline workflows.",
        "size_hint": "Mini",
        "ram_hint": "4-6 GB RAM",
    },
    {
        "name": "qwen2.5-coder:7b",
        "label": "Qwen 2.5 Coder 7B",
        "description": "Stronger local coding model when you can spare more RAM.",
        "size_hint": "7B",
        "ram_hint": "8-12 GB RAM",
    },
    {
        "name": "deepseek-coder:6.7b",
        "label": "DeepSeek Coder 6.7B",
        "description": "Balanced code-generation option for script-heavy workflows.",
        "size_hint": "6.7B",
        "ram_hint": "8-10 GB RAM",
    },
    {
        "name": "llama3:8b",
        "label": "Llama 3 8B",
        "description": "General-purpose assistant with stronger reasoning than the fast profile.",
        "size_hint": "8B",
        "ram_hint": "10-14 GB RAM",
    },
    {
        "name": "mistral",
        "label": "Mistral",
        "description": "Compact general model for quick offline experimentation.",
        "size_hint": "7B",
        "ram_hint": "8-12 GB RAM",
    },
]

ALLOWED_EXECUTABLES = {"nmap", "ffuf", "httpx", "subfinder", "nikto", "whois", "dig"}
AGENT_DEFINITIONS = {
    "coding": {
        "label": "Coding Agent",
        "description": "Explains code, improves scripts, debugs issues, and helps with local development workflows.",
        "purpose": "Code explanation, refactoring, debugging, and script generation.",
        "system_prompt": (
            "You are the Hackloi Coding Agent. Focus on code explanation, debugging, refactoring, "
            "script generation, and practical local development guidance. Keep outputs concise, precise, "
            "and grounded in the current local context. Do not suggest hidden execution."
        ),
        "default_model": "hackloi-coder",
        "recommended_models": ["hackloi-coder", "qwen2.5-coder:7b", "deepseek-coder:6.7b"],
        "context_scopes": ["chat context", "current file", "current project"],
    },
    "analysis": {
        "label": "Analysis Agent",
        "description": "Analyzes logs, scan outputs, terminal results, and organizes findings for review.",
        "purpose": "Scan interpretation, log triage, findings summary, and next-step organization.",
        "system_prompt": (
            "You are the Hackloi Analysis Agent. Analyze local terminal output, scans, logs, and evidence. "
            "Organize observations clearly, call out uncertainty, and suggest safe next validation steps. "
            "Do not execute or imply hidden actions."
        ),
        "default_model": "hackloi-assistant",
        "recommended_models": ["hackloi-assistant", "llama3:8b", "mistral"],
        "context_scopes": ["chat context", "current scan", "tool output"],
    },
    "documentation": {
        "label": "Documentation Agent",
        "description": "Turns notes, findings, and raw context into structured markdown summaries and reports.",
        "purpose": "Structured notes, markdown summaries, concise reports, and clarity improvements.",
        "system_prompt": (
            "You are the Hackloi Documentation Agent. Turn local notes, findings, code, and analysis into "
            "clear markdown summaries, reports, and organized writeups. Prioritize clarity, structure, and "
            "explicit context. Keep everything local-first."
        ),
        "default_model": "phi4-mini",
        "recommended_models": ["phi4-mini", "mistral", "hackloi-assistant"],
        "context_scopes": ["chat context", "current file", "current scan", "notes"],
    },
    "coordinator": {
        "label": "Coordinator Agent",
        "description": "Recommends the best agent, suggests steps, and can combine multiple agent outputs with user-visible routing.",
        "purpose": "Visible routing, step planning, agent recommendation, and multi-agent synthesis.",
        "system_prompt": (
            "You are the Hackloi Coordinator Agent. Inspect the user's local request, recommend the best "
            "specialized agent, optionally propose a short plan, and combine multiple agent outputs when "
            "requested. Never perform hidden actions or imply autonomous execution. Return explicit, user-controlled routing."
        ),
        "default_model": "hackloi-assistant",
        "recommended_models": ["hackloi-assistant", "llama3:8b", "mistral"],
        "context_scopes": ["chat context", "current file", "current scan", "session overview"],
    },
}
AGENT_IDS = tuple(AGENT_DEFINITIONS)

DEFAULT_SETTINGS = {
    "general": {
        "onboarding_completed": False,
    },
    "assistant": {
        "default_model": "hackloi-assistant",
        "mode": "standard",
        "system_prompt": DEFAULT_SYSTEM_PROMPT,
    },
    "ui": {
        "visual_intensity": "normal",
        "dashboard_refresh_seconds": 20,
        "job_refresh_seconds": 5,
    },
    "chat": {
        "prompt_history_limit": 12,
        "prompt_history": [],
        "attachment_max_count": 24,
        "attachment_max_file_bytes": 1_500_000,
        "attachment_max_total_bytes": 8_000_000,
    },
    "workspace": {
        "import_max_files": 300,
        "import_max_file_bytes": 1_500_000,
        "import_max_total_bytes": 15_000_000,
    },
    "analyzer": {
        "default_scan_preset": "nmap",
    },
    "ctf": {
        "default_category": "web",
        "notes": {
            "crypto": "",
            "web": "",
            "reversing": "",
            "forensics": "",
        },
    },
    "agents": {
        "default_agent": "auto",
        "compare_mode": False,
        "profiles": {
            agent_id: {
                "enabled": True,
                "assigned_model": meta["default_model"],
            }
            for agent_id, meta in AGENT_DEFINITIONS.items()
        },
    },
    "safety": {
        "local_only_mode": True,
        "webui_host": "127.0.0.1",
        "ollama_base_url": "http://127.0.0.1:11434",
        "tool_allowlist": sorted(ALLOWED_EXECUTABLES),
        "command_confirmation_required": True,
        "hidden_execution_disabled": True,
    },
}


class SettingsValidationError(ValueError):
    def __init__(self, message: str, field_errors: dict[str, str] | None = None):
        super().__init__(message)
        self.field_errors = field_errors or {}


def ensure_runtime_dirs() -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    WORKDIR.mkdir(parents=True, exist_ok=True)
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def json_response(handler: BaseHTTPRequestHandler, payload: object, status: int = 200) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler._send_common_headers("application/json; charset=utf-8", len(body))
    handler.end_headers()
    handler.wfile.write(body)


def format_ollama_error(exc: Exception, *, action: str) -> str:
    if isinstance(exc, HTTPError):
        return (
            f"Ollama returned HTTP {exc.code} while {action}. "
            f"Verify the local service at {OLLAMA_API_BASE} and retry."
        )
    if isinstance(exc, URLError):
        reason = getattr(exc, "reason", exc)
        return (
            f"Ollama could not be reached at {OLLAMA_API_BASE} while {action}. "
            f"Start Ollama locally and verify the endpoint in Settings. ({reason})"
        )
    if isinstance(exc, TimeoutError):
        return (
            f"Ollama timed out while {action}. "
            "Wait for the model to finish loading locally and retry."
        )
    if isinstance(exc, json.JSONDecodeError):
        return (
            f"Ollama returned an unreadable response while {action}. "
            "Restart the local service and retry."
        )
    detail = str(exc).strip() or exc.__class__.__name__
    return f"Ollama failed while {action}. {detail}"


def fetch_ollama_json(path: str, method: str = "GET", payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(f"{OLLAMA_API_BASE}{path}", method=method, data=data)
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urlopen(request, timeout=120) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise RuntimeError(format_ollama_error(exc, action=f"requesting {path}")) from exc


def read_json(path: Path, default: object | None = None) -> object:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: object) -> None:
    with JOB_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def deep_merge(base: dict, patch: dict) -> dict:
    merged = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = deepcopy(value)
    return merged


def derived_safety_settings() -> dict:
    return {
        "local_only_mode": HOST == "127.0.0.1" and OLLAMA_API_BASE.startswith("http://127.0.0.1"),
        "webui_host": HOST,
        "ollama_base_url": OLLAMA_API_BASE,
        "tool_allowlist": sorted(ALLOWED_EXECUTABLES),
        "command_confirmation_required": True,
        "hidden_execution_disabled": True,
    }


def default_settings_payload() -> dict:
    payload = deepcopy(DEFAULT_SETTINGS)
    payload["safety"] = derived_safety_settings()
    return payload


def settings_file_exists() -> bool:
    return SETTINGS_FILE.exists()


def app_metadata() -> dict:
    package_raw = read_json(PACKAGE_JSON_FILE, default={})
    tauri_raw = read_json(TAURI_CONFIG_FILE, default={})
    package = package_raw if isinstance(package_raw, dict) else {}
    tauri = tauri_raw if isinstance(tauri_raw, dict) else {}
    app_window = ((tauri.get("app") or {}).get("windows") or [{}])[0] if isinstance((tauri.get("app") or {}).get("windows"), list) else {}
    description = str(package.get("description") or APP_DESCRIPTION).strip()
    version = str(tauri.get("version") or package.get("version") or DEFAULT_APP_VERSION).strip() or DEFAULT_APP_VERSION
    license_copy = str(package.get("license") or "Not specified in package metadata.").strip()
    bundle_dir = str(BUNDLE_OUTPUT_HINT if BUNDLE_OUTPUT_HINT.exists() else PROJECT_ROOT / "src-tauri/target/release/bundle")
    return {
        "name": str(tauri.get("productName") or APP_NAME),
        "title": str(app_window.get("title") or tauri.get("productName") or APP_NAME),
        "version": version,
        "identifier": str(tauri.get("identifier") or "com.hackloi.cyberlab"),
        "description": description,
        "license": license_copy,
        "bundle_output": bundle_dir,
        "runtime": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
        },
    }


def agent_catalog_payload() -> list[dict]:
    return [
        {
            "id": agent_id,
            "label": meta["label"],
            "description": meta["description"],
            "purpose": meta["purpose"],
            "system_prompt": meta["system_prompt"],
            "default_model": meta["default_model"],
            "recommended_models": meta["recommended_models"],
            "context_scopes": meta["context_scopes"],
        }
        for agent_id, meta in AGENT_DEFINITIONS.items()
    ]


def load_settings_file() -> tuple[dict, list[str], bool]:
    if not SETTINGS_FILE.exists():
        return {}, [], False
    try:
        payload = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {}, [f"Settings file could not be read cleanly: {exc}. Defaults were used where needed."], True
    if not isinstance(payload, dict):
        return {}, ["Settings file root must be a JSON object. Defaults were used where needed."], True
    return payload, [], True


def normalize_string(
    value: object,
    *,
    path: str,
    default: str,
    strict: bool,
    warnings: list[str],
    field_errors: dict[str, str],
    allowed: set[str] | None = None,
    allow_empty: bool = False,
) -> str:
    if not isinstance(value, str):
        message = "Must be a string."
        if strict:
            field_errors[path] = message
        else:
            warnings.append(f"{path} must be a string. Default was used.")
        return default
    trimmed = value.strip()
    if not trimmed and not allow_empty:
        message = "Value cannot be empty."
        if strict:
            field_errors[path] = message
        else:
            warnings.append(f"{path} was empty. Default was used.")
        return default
    if allowed and trimmed not in allowed:
        message = f"Value must be one of: {', '.join(sorted(allowed))}."
        if strict:
            field_errors[path] = message
        else:
            warnings.append(f"{path} had an unsupported value. Default was used.")
        return default
    return trimmed


def normalize_bool(
    value: object,
    *,
    path: str,
    default: bool,
    strict: bool,
    warnings: list[str],
    field_errors: dict[str, str],
) -> bool:
    if isinstance(value, bool):
        return value
    message = "Must be true or false."
    if strict:
        field_errors[path] = message
    else:
        warnings.append(f"{path} must be true or false. Default was used.")
    return default


def normalize_int(
    value: object,
    *,
    path: str,
    default: int,
    strict: bool,
    warnings: list[str],
    field_errors: dict[str, str],
    minimum: int,
    maximum: int,
) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        message = f"Must be an integer between {minimum} and {maximum}."
        if strict:
            field_errors[path] = message
        else:
            warnings.append(f"{path} must be an integer. Default was used.")
        return default
    if not minimum <= value <= maximum:
        message = f"Must be between {minimum} and {maximum}."
        if strict:
            field_errors[path] = message
        else:
            warnings.append(f"{path} was outside the allowed range. Default was used.")
        return default
    return value


def normalize_prompt_history(
    value: object,
    *,
    limit: int,
    path: str,
    strict: bool,
    warnings: list[str],
    field_errors: dict[str, str],
) -> list[str]:
    if not isinstance(value, list):
        if strict:
            field_errors[path] = "Must be an array of prompt strings."
        else:
            warnings.append(f"{path} must be an array of strings. Default was used.")
        return []

    prompts: list[str] = []
    for item in value:
        if not isinstance(item, str):
            if strict:
                field_errors[path] = "Every prompt history entry must be a string."
                return []
            warnings.append(f"{path} contained a non-string entry. It was ignored.")
            continue
        trimmed = item.strip()
        if trimmed:
            prompts.append(trimmed)
    return prompts[:limit]


def normalize_ctf_notes(
    value: object,
    *,
    strict: bool,
    warnings: list[str],
    field_errors: dict[str, str],
) -> dict[str, str]:
    defaults = deepcopy(DEFAULT_SETTINGS["ctf"]["notes"])
    if not isinstance(value, dict):
        if strict:
            field_errors["ctf.notes"] = "Must be an object keyed by category."
        else:
            warnings.append("ctf.notes must be an object keyed by category. Defaults were used.")
        return defaults

    notes = deepcopy(defaults)
    for key in defaults:
        raw = value.get(key, defaults[key])
        notes[key] = normalize_string(
            raw,
            path=f"ctf.notes.{key}",
            default=defaults[key],
            strict=strict,
            warnings=warnings,
            field_errors=field_errors,
            allow_empty=True,
        )
    return notes


def normalize_settings_payload(raw: object, *, strict: bool) -> tuple[dict, list[str]]:
    warnings: list[str] = []
    field_errors: dict[str, str] = {}
    defaults = default_settings_payload()
    allowed_top = set(defaults)

    if not isinstance(raw, dict):
        if strict:
            raise SettingsValidationError("Settings payload must be a JSON object.")
        warnings.append("Settings payload must be a JSON object. Defaults were used.")
        return defaults, warnings

    for key in raw:
        if key not in allowed_top:
            message = "Unknown settings section."
            if strict:
                field_errors[key] = message
            else:
                warnings.append(f"Unknown settings section '{key}' was ignored.")

    general_raw = raw.get("general", {})
    if general_raw and not isinstance(general_raw, dict):
        if strict:
            field_errors["general"] = "Must be an object."
            general_raw = {}
        else:
            warnings.append("general must be an object. Defaults were used.")
            general_raw = {}

    assistant_raw = raw.get("assistant", {})
    if assistant_raw and not isinstance(assistant_raw, dict):
        if strict:
            field_errors["assistant"] = "Must be an object."
            assistant_raw = {}
        else:
            warnings.append("assistant must be an object. Defaults were used.")
            assistant_raw = {}

    ui_raw = raw.get("ui", {})
    if ui_raw and not isinstance(ui_raw, dict):
        if strict:
            field_errors["ui"] = "Must be an object."
            ui_raw = {}
        else:
            warnings.append("ui must be an object. Defaults were used.")
            ui_raw = {}

    chat_raw = raw.get("chat", {})
    if chat_raw and not isinstance(chat_raw, dict):
        if strict:
            field_errors["chat"] = "Must be an object."
            chat_raw = {}
        else:
            warnings.append("chat must be an object. Defaults were used.")
            chat_raw = {}

    workspace_raw = raw.get("workspace", {})
    if workspace_raw and not isinstance(workspace_raw, dict):
        if strict:
            field_errors["workspace"] = "Must be an object."
            workspace_raw = {}
        else:
            warnings.append("workspace must be an object. Defaults were used.")
            workspace_raw = {}

    analyzer_raw = raw.get("analyzer", {})
    if analyzer_raw and not isinstance(analyzer_raw, dict):
        if strict:
            field_errors["analyzer"] = "Must be an object."
            analyzer_raw = {}
        else:
            warnings.append("analyzer must be an object. Defaults were used.")
            analyzer_raw = {}

    ctf_raw = raw.get("ctf", {})
    if ctf_raw and not isinstance(ctf_raw, dict):
        if strict:
            field_errors["ctf"] = "Must be an object."
            ctf_raw = {}
        else:
            warnings.append("ctf must be an object. Defaults were used.")
            ctf_raw = {}

    agents_raw = raw.get("agents", {})
    if agents_raw and not isinstance(agents_raw, dict):
        if strict:
            field_errors["agents"] = "Must be an object."
            agents_raw = {}
        else:
            warnings.append("agents must be an object. Defaults were used.")
            agents_raw = {}

    safety_raw = raw.get("safety", {})
    if safety_raw and not isinstance(safety_raw, dict):
        if strict:
            field_errors["safety"] = "Must be an object."
        else:
            warnings.append("safety must be an object. Derived values were used.")
        safety_raw = {}

    prompt_history_limit = normalize_int(
        chat_raw.get("prompt_history_limit", defaults["chat"]["prompt_history_limit"]),
        path="chat.prompt_history_limit",
        default=defaults["chat"]["prompt_history_limit"],
        strict=strict,
        warnings=warnings,
        field_errors=field_errors,
        minimum=5,
        maximum=50,
    )

    agent_profiles_raw = agents_raw.get("profiles", {})
    if agent_profiles_raw and not isinstance(agent_profiles_raw, dict):
        if strict:
            field_errors["agents.profiles"] = "Must be an object keyed by agent id."
            agent_profiles_raw = {}
        else:
            warnings.append("agents.profiles must be an object keyed by agent id. Defaults were used.")
            agent_profiles_raw = {}

    agent_profiles: dict[str, dict[str, object]] = {}
    for agent_id, meta in AGENT_DEFINITIONS.items():
        profile_raw = agent_profiles_raw.get(agent_id, {})
        if profile_raw and not isinstance(profile_raw, dict):
            if strict:
                field_errors[f"agents.profiles.{agent_id}"] = "Must be an object."
                profile_raw = {}
            else:
                warnings.append(f"agents.profiles.{agent_id} must be an object. Defaults were used.")
                profile_raw = {}
        agent_profiles[agent_id] = {
            "enabled": normalize_bool(
                profile_raw.get("enabled", defaults["agents"]["profiles"][agent_id]["enabled"]),
                path=f"agents.profiles.{agent_id}.enabled",
                default=bool(defaults["agents"]["profiles"][agent_id]["enabled"]),
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
            ),
            "assigned_model": normalize_string(
                profile_raw.get("assigned_model", meta["default_model"]),
                path=f"agents.profiles.{agent_id}.assigned_model",
                default=meta["default_model"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
            ),
        }

    settings = {
        "general": {
            "onboarding_completed": normalize_bool(
                general_raw.get("onboarding_completed", defaults["general"]["onboarding_completed"]),
                path="general.onboarding_completed",
                default=defaults["general"]["onboarding_completed"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
            ),
        },
        "assistant": {
            "default_model": normalize_string(
                assistant_raw.get("default_model", defaults["assistant"]["default_model"]),
                path="assistant.default_model",
                default=defaults["assistant"]["default_model"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
            ),
            "mode": normalize_string(
                assistant_raw.get("mode", defaults["assistant"]["mode"]),
                path="assistant.mode",
                default=defaults["assistant"]["mode"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                allowed={"standard", "pentest"},
            ),
            "system_prompt": normalize_string(
                assistant_raw.get("system_prompt", defaults["assistant"]["system_prompt"]),
                path="assistant.system_prompt",
                default=defaults["assistant"]["system_prompt"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
            ),
        },
        "ui": {
            "visual_intensity": normalize_string(
                ui_raw.get("visual_intensity", defaults["ui"]["visual_intensity"]),
                path="ui.visual_intensity",
                default=defaults["ui"]["visual_intensity"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                allowed={"normal", "soft", "high"},
            ),
            "dashboard_refresh_seconds": normalize_int(
                ui_raw.get("dashboard_refresh_seconds", defaults["ui"]["dashboard_refresh_seconds"]),
                path="ui.dashboard_refresh_seconds",
                default=defaults["ui"]["dashboard_refresh_seconds"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                minimum=5,
                maximum=300,
            ),
            "job_refresh_seconds": normalize_int(
                ui_raw.get("job_refresh_seconds", defaults["ui"]["job_refresh_seconds"]),
                path="ui.job_refresh_seconds",
                default=defaults["ui"]["job_refresh_seconds"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                minimum=2,
                maximum=60,
            ),
        },
        "chat": {
            "prompt_history_limit": prompt_history_limit,
            "prompt_history": normalize_prompt_history(
                chat_raw.get("prompt_history", defaults["chat"]["prompt_history"]),
                limit=prompt_history_limit,
                path="chat.prompt_history",
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
            ),
            "attachment_max_count": normalize_int(
                chat_raw.get("attachment_max_count", defaults["chat"]["attachment_max_count"]),
                path="chat.attachment_max_count",
                default=defaults["chat"]["attachment_max_count"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                minimum=1,
                maximum=50,
            ),
            "attachment_max_file_bytes": normalize_int(
                chat_raw.get("attachment_max_file_bytes", defaults["chat"]["attachment_max_file_bytes"]),
                path="chat.attachment_max_file_bytes",
                default=defaults["chat"]["attachment_max_file_bytes"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                minimum=262_144,
                maximum=10_485_760,
            ),
            "attachment_max_total_bytes": normalize_int(
                chat_raw.get("attachment_max_total_bytes", defaults["chat"]["attachment_max_total_bytes"]),
                path="chat.attachment_max_total_bytes",
                default=defaults["chat"]["attachment_max_total_bytes"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                minimum=1_048_576,
                maximum=52_428_800,
            ),
        },
        "workspace": {
            "import_max_files": normalize_int(
                workspace_raw.get("import_max_files", defaults["workspace"]["import_max_files"]),
                path="workspace.import_max_files",
                default=defaults["workspace"]["import_max_files"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                minimum=1,
                maximum=1000,
            ),
            "import_max_file_bytes": normalize_int(
                workspace_raw.get("import_max_file_bytes", defaults["workspace"]["import_max_file_bytes"]),
                path="workspace.import_max_file_bytes",
                default=defaults["workspace"]["import_max_file_bytes"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                minimum=262_144,
                maximum=10_485_760,
            ),
            "import_max_total_bytes": normalize_int(
                workspace_raw.get("import_max_total_bytes", defaults["workspace"]["import_max_total_bytes"]),
                path="workspace.import_max_total_bytes",
                default=defaults["workspace"]["import_max_total_bytes"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                minimum=1_048_576,
                maximum=104_857_600,
            ),
        },
        "analyzer": {
            "default_scan_preset": normalize_string(
                analyzer_raw.get("default_scan_preset", defaults["analyzer"]["default_scan_preset"]),
                path="analyzer.default_scan_preset",
                default=defaults["analyzer"]["default_scan_preset"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                allowed={"nmap", "ffuf", "httpx", "nikto", "generic"},
            ),
        },
        "ctf": {
            "default_category": normalize_string(
                ctf_raw.get("default_category", defaults["ctf"]["default_category"]),
                path="ctf.default_category",
                default=defaults["ctf"]["default_category"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                allowed={"crypto", "web", "reversing", "forensics"},
            ),
            "notes": normalize_ctf_notes(
                ctf_raw.get("notes", defaults["ctf"]["notes"]),
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
            ),
        },
        "agents": {
            "default_agent": normalize_string(
                agents_raw.get("default_agent", defaults["agents"]["default_agent"]),
                path="agents.default_agent",
                default=defaults["agents"]["default_agent"],
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
                allowed={"auto", *AGENT_IDS},
            ),
            "compare_mode": normalize_bool(
                agents_raw.get("compare_mode", defaults["agents"]["compare_mode"]),
                path="agents.compare_mode",
                default=bool(defaults["agents"]["compare_mode"]),
                strict=strict,
                warnings=warnings,
                field_errors=field_errors,
            ),
            "profiles": agent_profiles,
        },
        "safety": derived_safety_settings(),
    }

    for key, expected in settings["safety"].items():
        if key in safety_raw and safety_raw.get(key) != expected:
            message = "This safety setting is read-only and cannot be changed."
            if strict:
                field_errors[f"safety.{key}"] = message
            else:
                warnings.append(f"safety.{key} is read-only and was restored to its enforced local value.")

    if field_errors:
        raise SettingsValidationError("Settings validation failed.", field_errors)
    return settings, warnings


def current_settings_payload() -> tuple[dict, list[str], dict]:
    ensure_runtime_dirs()
    raw, warnings, exists = load_settings_file()
    normalized, normalized_warnings = normalize_settings_payload(raw, strict=False)
    if exists and isinstance(raw, dict) and "general" not in raw:
        normalized["general"]["onboarding_completed"] = True
        normalized_warnings.append("Existing local settings were detected, so the welcome guide is skipped unless you reopen it from inside the app.")
    meta = {"path": str(SETTINGS_FILE), "exists": exists}
    return normalized, [*warnings, *normalized_warnings], meta


def save_settings_payload(payload: dict) -> tuple[dict, list[str], dict]:
    ensure_runtime_dirs()
    normalized, warnings = normalize_settings_payload(payload, strict=True)
    write_json(SETTINGS_FILE, normalized)
    return normalized, warnings, {"path": str(SETTINGS_FILE), "exists": True}


def update_settings_payload(patch: dict) -> tuple[dict, list[str], dict]:
    current, warnings, _meta = current_settings_payload()
    if not isinstance(patch, dict):
        raise SettingsValidationError("Settings update must be a JSON object.")
    merged = deep_merge(current, patch)
    normalized, normalized_warnings, meta = save_settings_payload(merged)
    return normalized, [*warnings, *normalized_warnings], meta


def reset_settings_payload() -> tuple[dict, list[str], dict]:
    return save_settings_payload(default_settings_payload())


def pid_from_file(path: Path) -> int | None:
    if not path.exists():
        return None
    try:
        return int(path.read_text(encoding="utf-8").strip())
    except (TypeError, ValueError):
        return None


def pid_running(pid: int | None) -> bool:
    if not pid or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def parse_meminfo() -> dict:
    values: dict[str, int] = {}
    try:
        for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
            key, value = line.split(":", 1)
            values[key] = int(value.strip().split()[0]) * 1024
    except OSError:
        return {"total": 0, "available": 0, "used": 0, "usage_percent": 0}

    total = values.get("MemTotal", 0)
    available = values.get("MemAvailable", 0)
    used = max(total - available, 0)
    usage_percent = round((used / total) * 100, 1) if total else 0
    return {
        "total": total,
        "available": available,
        "used": used,
        "usage_percent": usage_percent,
    }


def parse_cpu_snapshot() -> dict[str, int]:
    try:
        first_line = Path("/proc/stat").read_text(encoding="utf-8").splitlines()[0]
    except (IndexError, OSError):
        return {"idle": 0, "total": 0}

    parts = first_line.split()
    values = [int(item) for item in parts[1:9]]
    idle = values[3] + values[4]
    total = sum(values)
    return {"idle": idle, "total": total}


def cpu_usage_percent() -> float:
    global CPU_SAMPLE

    snapshot = parse_cpu_snapshot()
    with CPU_LOCK:
        previous = CPU_SAMPLE
        CPU_SAMPLE = snapshot

    if not previous or not previous["total"]:
        return 0.0

    idle_delta = snapshot["idle"] - previous["idle"]
    total_delta = snapshot["total"] - previous["total"]
    if total_delta <= 0:
        return 0.0
    busy = max(total_delta - idle_delta, 0)
    return round((busy / total_delta) * 100, 1)


def tail_file(path: Path, max_lines: int = 80, max_chars: int = 16000) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    tail = "\n".join(lines[-max_lines:])
    return tail[-max_chars:]


def list_installed_model_names() -> set[str]:
    try:
        tags = fetch_ollama_json("/api/tags")
    except Exception:  # noqa: BLE001
        return set()
    return {
        item.get("name", "")
        for item in tags.get("models", [])
        if item.get("name")
    }


def tool_status() -> list[dict]:
    items = []
    for command, meta in TOOLS.items():
        path = shutil.which(command)
        items.append(
            {
                "command": command,
                "label": meta["label"],
                "description": meta["description"],
                "snippet": meta["snippet"],
                "installed": bool(path),
                "path": path or "",
            }
        )
    return items


def ollama_health() -> dict:
    try:
        tags = fetch_ollama_json("/api/tags")
        models = tags.get("models", [])
        return {"reachable": True, "model_count": len(models), "models": models}
    except Exception as exc:  # noqa: BLE001
        return {"reachable": False, "error": str(exc), "model_count": 0, "models": []}


def ollama_running_models() -> list[dict]:
    try:
        payload = fetch_ollama_json("/api/ps")
    except Exception:  # noqa: BLE001
        return []

    items = []
    for item in payload.get("models", []):
        details = item.get("details") or {}
        items.append(
            {
                "name": item.get("name", ""),
                "size": item.get("size", 0),
                "size_vram": item.get("size_vram", 0),
                "expires_at": item.get("expires_at", ""),
                "family": details.get("family", ""),
                "format": details.get("format", ""),
                "parameter_size": details.get("parameter_size", ""),
                "quantization": details.get("quantization_level", ""),
            }
        )
    return items


def model_recommendations() -> list[dict]:
    installed = list_installed_model_names()
    return [
        {
            **item,
            "installed": item["name"] in installed,
            "pull_command": f"ollama pull {item['name']}",
        }
        for item in RECOMMENDED_MODELS
    ]


def unique_items(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        clean = item.strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        result.append(clean)
    return result


def first_items(items: list[str], *, limit: int = 8) -> list[str]:
    trimmed = unique_items(items)
    return trimmed[:limit]


def detect_scan_type(text: str, requested: str | None = None) -> str:
    if requested and requested in {"nmap", "ffuf", "httpx", "nikto"}:
        return requested

    lower = text.lower()
    if "nmap scan report" in lower or re.search(r"^\d+/(tcp|udp)\s+open", text, re.MULTILINE):
        return "nmap"
    if "ffuf" in lower or ("[status:" in lower and "words:" in lower):
        return "ffuf"
    if "nikto" in lower or "+ target ip:" in lower or "+ server:" in lower:
        return "nikto"
    if re.search(r"^https?://\S+\s+\[[^\]]+\]", text, re.MULTILINE):
        return "httpx"
    return "generic"


def parse_nmap_output(text: str) -> dict:
    hosts: list[str] = []
    services: list[str] = []
    vulnerabilities: list[str] = []
    next_steps: list[str] = []
    notes: list[str] = []
    open_ports = 0
    current_host = "unknown-host"

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        host_match = re.match(r"^Nmap scan report for (.+)$", line)
        if host_match:
            current_host = host_match.group(1)
            hosts.append(current_host)
            continue

        port_match = re.match(r"^(\d{1,5})/(tcp|udp)\s+(\S+)\s+(\S+)(?:\s+(.*))?$", line)
        if not port_match:
            continue

        port, proto, state, service, version = port_match.groups()
        if "open" not in state:
            continue

        open_ports += 1
        version = (version or "").strip()
        service_line = f"{current_host}: {port}/{proto} {service}"
        if version:
            service_line = f"{service_line} ({version})"
        services.append(service_line)

        service_key = service.lower()
        combined = f"{service} {version}".lower()
        if service_key in {"ftp"}:
            vulnerabilities.append(f"{current_host}: FTP exposed on {port}/{proto}; check anonymous access and writable paths if permitted.")
            next_steps.append(f"{current_host}: Validate FTP authentication and enumerate accessible files on {port}/{proto}.")
        if "ssh" in service_key:
            next_steps.append(f"{current_host}: Review SSH auth surface, banners, and accepted key algorithms on {port}/{proto}.")
        if "http" in service_key or "ssl/http" in service_key:
            vulnerabilities.append(f"{current_host}: Web service exposed on {port}/{proto}; inspect headers, auth flows, and content discovery results.")
            next_steps.append(f"{current_host}: Follow up with httpx, nikto, and ffuf against the web service on {port}/{proto}.")
        if service_key in {"microsoft-ds", "netbios-ssn", "smb"} or "smb" in combined:
            vulnerabilities.append(f"{current_host}: SMB-related service exposed on {port}/{proto}; verify signing, guest access, and share enumeration.")
            next_steps.append(f"{current_host}: Run share and auth checks against the SMB service on {port}/{proto}.")
        if service_key in {"mysql", "postgresql", "mongodb", "redis"} or service_key.endswith("db"):
            vulnerabilities.append(f"{current_host}: Database service {service} exposed on {port}/{proto}; confirm binding scope and authentication.")
            next_steps.append(f"{current_host}: Verify whether the {service} service on {port}/{proto} is reachable beyond localhost and requires auth.")
        if "apache" in combined or "nginx" in combined or "iis" in combined:
            notes.append(f"{current_host}: Service fingerprint includes {version or service}; version strings should be manually validated before mapping to CVEs.")

    summary_hosts = len(unique_items(hosts))
    if not services:
        notes.append("No open services were parsed from the supplied Nmap text.")

    notes.append("Nmap banners and version detection are point-in-time hints; confirm with direct protocol checks before treating them as findings.")
    return {
        "detected_type": "nmap",
        "summary": f"Detected {open_ports} open service{'s' if open_ports != 1 else ''} across {summary_hosts or 1} host{'s' if (summary_hosts or 1) != 1 else ''}.",
        "sections": {
            "detected_services": first_items(services, limit=10),
            "possible_vulnerabilities": first_items(vulnerabilities, limit=8),
            "suggested_next_steps": first_items(next_steps, limit=8),
            "security_notes": first_items(notes, limit=6),
        },
    }


def parse_ffuf_output(text: str) -> dict:
    findings: list[str] = []
    vulnerabilities: list[str] = []
    next_steps: list[str] = []
    notes: list[str] = []
    hits = 0

    pattern = re.compile(
        r"^(?P<path>\S.*?)\s+\[Status:\s*(?P<status>\d{3})(?:,\s*Size:\s*(?P<size>\d+))?(?:,\s*Words:\s*(?P<words>\d+))?(?:,\s*Lines:\s*(?P<lines>\d+))?.*$"
    )

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("::"):
            continue
        match = pattern.match(line)
        if not match:
            continue

        hits += 1
        path = match.group("path")
        status = match.group("status")
        findings.append(f"{path} returned HTTP {status}.")
        lower = path.lower()
        if any(token in lower for token in [".git", ".svn", ".env", "backup", "bak", "old", "zip", "tar"]):
            vulnerabilities.append(f"{path} looks like a sensitive or backup artifact and should be manually reviewed.")
        if any(token in lower for token in ["admin", "login", "portal", "dashboard", "manage"]):
            vulnerabilities.append(f"{path} looks like an administrative or auth-related path; verify access control and default content.")
        if status in {"200", "204"}:
            next_steps.append(f"Review the live response for {path} and compare against baseline noise or wildcard behavior.")
        if status in {"301", "302", "307", "308"}:
            next_steps.append(f"Follow the redirect chain for {path} and note whether it exposes hidden locations or auth transitions.")
        if status in {"401", "403"}:
            next_steps.append(f"Probe {path} manually; denied responses can still confirm high-value endpoints.")

    if not hits:
        notes.append("No ffuf-style result rows were parsed from the provided text.")
    notes.append("Compare interesting responses against known wildcard behavior before treating them as real content discoveries.")
    return {
        "detected_type": "ffuf",
        "summary": f"Parsed {hits} ffuf hit{'s' if hits != 1 else ''} from the supplied output.",
        "sections": {
            "detected_services": first_items(findings, limit=10),
            "possible_vulnerabilities": first_items(vulnerabilities, limit=8),
            "suggested_next_steps": first_items(next_steps, limit=8),
            "security_notes": first_items(notes, limit=6),
        },
    }


def parse_httpx_output(text: str) -> dict:
    findings: list[str] = []
    vulnerabilities: list[str] = []
    next_steps: list[str] = []
    notes: list[str] = []
    live_hosts = 0

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or not re.match(r"^https?://", line):
            continue

        live_hosts += 1
        url = line.split()[0]
        groups = re.findall(r"\[([^\]]+)\]", line)
        status = next((item for item in groups if item.isdigit()), "")
        technologies = [item for item in groups if any(ch.isalpha() for ch in item) and item != status]
        finding = url
        if status:
            finding = f"{finding} responded with HTTP {status}"
        if technologies:
            finding = f"{finding}; observed {' | '.join(technologies[:3])}"
        findings.append(finding + ".")

        lower_line = line.lower()
        if url.startswith("http://"):
            vulnerabilities.append(f"{url} is reachable over plain HTTP; confirm whether TLS is intentionally absent.")
        if any(token in lower_line for token in ["admin", "login", "dashboard", "jenkins", "grafana"]):
            vulnerabilities.append(f"{url} appears to expose an auth or admin surface; verify access controls and default credentials policy.")
        if technologies:
            next_steps.append(f"Capture headers and content details for {url} to confirm the observed technology fingerprint.")
        next_steps.append(f"Use ffuf or manual browsing against {url} for deeper path and auth validation.")

    if not live_hosts:
        notes.append("No httpx-style URLs were parsed from the supplied text.")
    notes.append("Technology fingerprints can be incomplete or influenced by reverse proxies; validate manually before concluding stack ownership.")
    return {
        "detected_type": "httpx",
        "summary": f"Parsed {live_hosts} live httpx endpoint{'s' if live_hosts != 1 else ''}.",
        "sections": {
            "detected_services": first_items(findings, limit=10),
            "possible_vulnerabilities": first_items(vulnerabilities, limit=8),
            "suggested_next_steps": first_items(next_steps, limit=8),
            "security_notes": first_items(notes, limit=6),
        },
    }


def parse_nikto_output(text: str) -> dict:
    findings: list[str] = []
    vulnerabilities: list[str] = []
    next_steps: list[str] = []
    notes: list[str] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("+ "):
            continue

        finding = line[2:]
        if finding:
            findings.append(finding)

        lower = finding.lower()
        if any(token in lower for token in ["header", "outdated", "cve", "osvdb", "allowed methods", "directory indexing", "default file"]):
            vulnerabilities.append(finding)
        if "server:" in lower or "x-powered-by" in lower:
            notes.append(finding)
        if any(token in lower for token in ["cookie", "header", "ssl", "cgi", "admin"]):
            next_steps.append(f"Validate the Nikto finding manually: {finding}")

    if not findings:
        notes.append("No Nikto findings were parsed from the supplied text.")
    notes.append("Nikto findings should be manually replayed because informational checks can over-report exposure.")
    return {
        "detected_type": "nikto",
        "summary": f"Parsed {len(findings)} Nikto finding{'s' if len(findings) != 1 else ''}.",
        "sections": {
            "detected_services": first_items(findings, limit=10),
            "possible_vulnerabilities": first_items(vulnerabilities, limit=8),
            "suggested_next_steps": first_items(next_steps, limit=8),
            "security_notes": first_items(notes, limit=6),
        },
    }


def parse_generic_output(text: str) -> dict:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return {
        "detected_type": "generic",
        "summary": f"Captured {len(lines)} non-empty line{'s' if len(lines) != 1 else ''} of local output.",
        "sections": {
            "detected_services": first_items(lines, limit=6),
            "possible_vulnerabilities": [
                "No parser-specific vulnerability hints were inferred. Use the chat analyzer for deeper local model reasoning."
            ],
            "suggested_next_steps": [
                "Review the raw output manually for versions, banners, and exposed interfaces.",
                "Send the structured summary and raw output to chat for a model-assisted explanation.",
            ],
            "security_notes": [
                "Generic parsing is intentionally conservative and does not replace manual validation.",
            ],
        },
    }


def analyze_scan_text(text: str, requested: str | None = None) -> dict:
    scan_type = detect_scan_type(text, requested=requested)
    parsers = {
        "nmap": parse_nmap_output,
        "ffuf": parse_ffuf_output,
        "httpx": parse_httpx_output,
        "nikto": parse_nikto_output,
        "generic": parse_generic_output,
    }
    analysis = parsers.get(scan_type, parse_generic_output)(text)
    analysis["requested_type"] = requested or "auto"
    analysis["line_count"] = len([line for line in text.splitlines() if line.strip()])
    return analysis


def workspace_meta() -> dict:
    payload = read_json(WORKSPACE_META, default={})
    if not isinstance(payload, dict):
        payload = {}
    return {
        "project_name": payload.get("project_name") or "Workspace",
        "updated_at": payload.get("updated_at") or None,
    }


def write_workspace_meta(project_name: str) -> None:
    WORKSPACE_META.write_text(
        json.dumps({"project_name": project_name, "updated_at": now_iso()}, indent=2),
        encoding="utf-8",
    )


def sanitize_workspace_path(raw_path: str) -> Path:
    clean = (raw_path or "").strip().replace("\\", "/")
    if not clean:
        raise ValueError("Path is required.")
    path = Path(clean)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("Invalid workspace path.")
    return path


def workspace_file_count() -> int:
    return sum(
        1
        for item in WORKSPACE_DIR.rglob("*")
        if item.is_file() and item.name != WORKSPACE_META.name
    )


def build_tree(path: Path, prefix: Path = Path(".")) -> list[dict]:
    items = []
    for child in sorted(path.iterdir(), key=lambda item: (item.is_file(), item.name.lower())):
        if child.name == WORKSPACE_META.name:
            continue
        relative = prefix / child.name if prefix != Path(".") else Path(child.name)
        if child.is_dir():
            items.append(
                {
                    "type": "dir",
                    "name": child.name,
                    "path": relative.as_posix(),
                    "children": build_tree(child, relative),
                }
            )
        else:
            items.append(
                {
                    "type": "file",
                    "name": child.name,
                    "path": relative.as_posix(),
                    "size": child.stat().st_size,
                }
            )
    return items


def workspace_tree() -> dict:
    ensure_runtime_dirs()
    meta = workspace_meta()
    return {
        "root": str(WORKSPACE_DIR),
        "project_name": meta["project_name"],
        "updated_at": meta["updated_at"],
        "file_count": workspace_file_count(),
        "tree": build_tree(WORKSPACE_DIR),
    }


def read_workspace_file(raw_path: str) -> dict:
    relative = sanitize_workspace_path(raw_path)
    target = (WORKSPACE_DIR / relative).resolve()
    if WORKSPACE_DIR.resolve() not in target.parents and target != WORKSPACE_DIR.resolve():
        raise ValueError("Invalid workspace path.")
    if not target.exists() or not target.is_file():
        raise FileNotFoundError("File not found.")
    return {
        "path": relative.as_posix(),
        "content": target.read_text(encoding="utf-8", errors="replace"),
        "size": target.stat().st_size,
    }


def save_workspace_file(raw_path: str, content: str) -> dict:
    relative = sanitize_workspace_path(raw_path)
    target = (WORKSPACE_DIR / relative).resolve()
    if WORKSPACE_DIR.resolve() not in target.parents:
        raise ValueError("Invalid workspace path.")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    if not WORKSPACE_META.exists():
        write_workspace_meta("Workspace")
    return {
        "path": relative.as_posix(),
        "size": target.stat().st_size,
        "saved_at": now_iso(),
    }


def create_workspace_folder(raw_path: str) -> dict:
    relative = sanitize_workspace_path(raw_path)
    target = (WORKSPACE_DIR / relative).resolve()
    if WORKSPACE_DIR.resolve() not in target.parents:
        raise ValueError("Invalid workspace path.")
    target.mkdir(parents=True, exist_ok=True)
    return {"path": relative.as_posix(), "created_at": now_iso()}


def rename_workspace_path(from_path: str, to_path: str) -> dict:
    source_relative = sanitize_workspace_path(from_path)
    target_relative = sanitize_workspace_path(to_path)
    source = (WORKSPACE_DIR / source_relative).resolve()
    target = (WORKSPACE_DIR / target_relative).resolve()
    if WORKSPACE_DIR.resolve() not in source.parents or WORKSPACE_DIR.resolve() not in target.parents:
        raise ValueError("Invalid workspace path.")
    if not source.exists():
        raise FileNotFoundError("Path not found.")
    target.parent.mkdir(parents=True, exist_ok=True)
    source.rename(target)
    return {
        "from_path": source_relative.as_posix(),
        "to_path": target_relative.as_posix(),
        "renamed_at": now_iso(),
    }


def delete_workspace_path(raw_path: str) -> dict:
    relative = sanitize_workspace_path(raw_path)
    target = (WORKSPACE_DIR / relative).resolve()
    if WORKSPACE_DIR.resolve() not in target.parents:
        raise ValueError("Invalid workspace path.")
    if not target.exists():
        raise FileNotFoundError("Path not found.")
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    return {"path": relative.as_posix(), "deleted_at": now_iso()}


def clear_workspace() -> None:
    if WORKSPACE_DIR.exists():
        shutil.rmtree(WORKSPACE_DIR)
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)


def import_workspace_files(files: list[dict], *, replace: bool, project_name: str) -> dict:
    ensure_runtime_dirs()
    settings, _warnings, _meta = current_settings_payload()
    workspace_settings = settings["workspace"]
    max_files = workspace_settings["import_max_files"]
    max_file_bytes = workspace_settings["import_max_file_bytes"]
    max_total_bytes = workspace_settings["import_max_total_bytes"]
    if len(files) > max_files:
        raise ValueError(f"Too many files. Limit is {max_files}.")

    total_bytes = 0
    if replace:
        clear_workspace()

    for item in files:
        relative_raw = item.get("relative_path") or item.get("name") or ""
        content = item.get("content")
        if not isinstance(content, str):
            raise ValueError(f"Unsupported file payload for {relative_raw or 'unknown file'}.")
        encoded = content.encode("utf-8")
        if len(encoded) > max_file_bytes:
            raise ValueError(f"File too large: {relative_raw}")
        total_bytes += len(encoded)
        if total_bytes > max_total_bytes:
            raise ValueError("Total import size exceeded.")

        relative = sanitize_workspace_path(relative_raw)
        target = (WORKSPACE_DIR / relative).resolve()
        if WORKSPACE_DIR.resolve() not in target.parents:
            raise ValueError("Invalid workspace path.")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    write_workspace_meta(project_name or "Workspace")
    return workspace_tree()


def system_status() -> dict:
    ensure_runtime_dirs()
    memory = parse_meminfo()
    running_models = ollama_running_models()
    try:
        load_1, load_5, load_15 = os.getloadavg()
    except (AttributeError, OSError):
        load_1 = load_5 = load_15 = 0.0
    disk_target = AI_HOME if AI_HOME.exists() else Path.home()
    disk = shutil.disk_usage(disk_target)
    ollama_pid = pid_from_file(OLLAMA_PID_FILE)
    webui_pid = pid_from_file(WEBUI_PID_FILE)
    health = ollama_health()
    return {
        "app": app_metadata(),
        "cpu": {
            "count": os.cpu_count() or 0,
            "usage_percent": cpu_usage_percent(),
            "load_1": round(load_1, 2),
            "load_5": round(load_5, 2),
            "load_15": round(load_15, 2),
        },
        "memory": memory,
        "disk": {
            "path": str(disk_target),
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "usage_percent": round((disk.used / disk.total) * 100, 1) if disk.total else 0,
        },
        "runtime": {
            "ai_home": str(AI_HOME),
            "workdir": str(WORKDIR),
            "workspace_root": str(WORKSPACE_DIR),
            "webui": {"host": HOST, "port": PORT, "pid": webui_pid, "running": pid_running(webui_pid)},
            "ollama": {
                "base_url": OLLAMA_API_BASE,
                "pid": ollama_pid,
                "running": pid_running(ollama_pid),
                "reachable": health["reachable"],
                "model_count": health["model_count"],
            },
            "running_models": running_models,
            "active_model": running_models[0]["name"] if running_models else "",
            "workspace": workspace_meta(),
            "local_only": HOST == "127.0.0.1" and OLLAMA_API_BASE.startswith("http://127.0.0.1"),
        },
    }


def read_body(handler: BaseHTTPRequestHandler) -> bytes:
    length = int(handler.headers.get("Content-Length", "0"))
    return handler.rfile.read(length)


def read_json_body(handler: BaseHTTPRequestHandler) -> dict:
    raw = read_body(handler).decode("utf-8") or "{}"
    return json.loads(raw)


def job_meta_path(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def job_log_path(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.log"


def refresh_job_state(job: dict) -> dict:
    if job.get("status") in {"running", "stopping"} and not pid_running(job.get("pid")):
        status = "stopped" if job.get("stop_requested_at") else "finished"
        job = {
            **job,
            "status": status,
            "completed_at": job.get("completed_at") or now_iso(),
            "returncode": job.get("returncode") if job.get("returncode") is not None else (-15 if status == "stopped" else None),
        }
        write_json(job_meta_path(job["id"]), job)
    return job


def job_detail(job_id: str) -> dict | None:
    meta = read_json(job_meta_path(job_id))
    if not isinstance(meta, dict):
        return None
    meta = refresh_job_state(meta)
    return {
        **meta,
        "output_tail": tail_file(job_log_path(job_id)),
    }


def list_jobs() -> list[dict]:
    ensure_runtime_dirs()
    items = []
    for meta_path in sorted(JOBS_DIR.glob("*.json")):
        meta = read_json(meta_path)
        if not isinstance(meta, dict):
            continue
        meta = refresh_job_state(meta)
        items.append(
            {
                **meta,
                "output_tail": tail_file(job_log_path(meta["id"]), max_lines=20, max_chars=5000),
            }
        )
    items.sort(key=lambda item: item.get("started_at", ""), reverse=True)
    return items[:12]


def watch_tool_job(job_id: str, process: subprocess.Popen[str]) -> None:
    returncode = process.wait()
    meta = read_json(job_meta_path(job_id), default={})
    if not isinstance(meta, dict):
        return
    stop_requested = bool(meta.get("stop_requested_at"))
    if stop_requested or returncode in {-15, 143}:
        meta["status"] = "stopped"
    else:
        meta["status"] = "completed" if returncode == 0 else "failed"
    meta["returncode"] = returncode
    meta["completed_at"] = now_iso()
    write_json(job_meta_path(job_id), meta)


def start_tool_job(command: str) -> dict:
    ensure_runtime_dirs()
    args = shlex.split(command)
    if not args:
        raise ValueError("Command is empty.")

    executable_name = Path(args[0]).name
    if executable_name not in ALLOWED_EXECUTABLES:
        raise PermissionError(f"Command '{executable_name}' is not allowed.")

    resolved = shutil.which(args[0]) or shutil.which(executable_name)
    if not resolved:
        raise FileNotFoundError(f"Command '{executable_name}' is not installed.")

    job_id = uuid.uuid4().hex[:12]
    log_path = job_log_path(job_id)
    meta = {
        "id": job_id,
        "command": command,
        "args": args,
        "executable": executable_name,
        "status": "running",
        "started_at": now_iso(),
        "stop_requested_at": None,
        "completed_at": None,
        "returncode": None,
        "log_path": str(log_path),
        "workdir": str(WORKDIR),
        "pid": None,
    }

    with log_path.open("w", encoding="utf-8") as handle:
        handle.write(f"# Hackloi AI Cyber Lab job {job_id}\n")
        handle.write(f"# Started: {meta['started_at']}\n")
        handle.write(f"# Workdir: {WORKDIR}\n")
        handle.write(f"# Command: {command}\n\n")
        handle.flush()
        process = subprocess.Popen(
            [resolved, *args[1:]],
            cwd=WORKDIR,
            stdout=handle,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )

    meta["pid"] = process.pid
    write_json(job_meta_path(job_id), meta)
    thread = threading.Thread(target=watch_tool_job, args=(job_id, process), daemon=True)
    thread.start()
    return meta


def stop_tool_job(job_id: str) -> dict:
    meta = read_json(job_meta_path(job_id))
    if not isinstance(meta, dict):
        raise FileNotFoundError("Job not found.")

    meta = refresh_job_state(meta)
    pid = meta.get("pid")
    if meta.get("status") not in {"running", "stopping"} or not pid_running(pid):
        return meta

    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
    except ProcessLookupError:
        pass

    meta["status"] = "stopping"
    meta["stop_requested_at"] = now_iso()
    write_json(job_meta_path(job_id), meta)
    return meta


class AppHandler(BaseHTTPRequestHandler):
    server_version = "HackloiAI/3.0"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A003
        return

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path in {"/", "/index.html"}:
            self._serve_path(ROOT_DIR / "index.html")
            return
        if path == "/app.js":
            self._serve_path(ROOT_DIR / "app.js")
            return
        if path == "/styles.css":
            self._serve_path(ROOT_DIR / "styles.css")
            return
        if path.startswith("/vendor/monaco/"):
            relative = Path(path.removeprefix("/vendor/monaco/"))
            self._serve_path(MONACO_DIR / relative)
            return
        if path == "/api/health":
            health = ollama_health()
            json_response(
                self,
                {
                    "ok": True,
                    "ollama": health,
                    "webui": {"host": HOST, "port": PORT, "ai_home": str(AI_HOME)},
                },
            )
            return
        if path == "/api/settings":
            settings, warnings, meta = current_settings_payload()
            json_response(self, {"settings": settings, "warnings": warnings, "meta": meta})
            return
        if path == "/api/models":
            try:
                tags = fetch_ollama_json("/api/tags")
                running_models = ollama_running_models()
                models = [
                    {
                        "name": item.get("name", ""),
                        "size": item.get("size", 0),
                        "estimated_ram": int(item.get("size", 0) * 1.15),
                        "family": (item.get("details") or {}).get("family", ""),
                        "parameter_size": (item.get("details") or {}).get("parameter_size", ""),
                        "quantization": (item.get("details") or {}).get("quantization_level", ""),
                        "modified_at": item.get("modified_at", ""),
                    }
                    for item in tags.get("models", [])
                ]
                json_response(
                    self,
                    {
                        "models": models,
                        "running_models": running_models,
                        "active_model": running_models[0]["name"] if running_models else "",
                    },
                )
            except Exception as exc:  # noqa: BLE001
                json_response(self, {"error": str(exc), "models": [], "running_models": [], "active_model": ""}, status=502)
            return
        if path == "/api/agents/catalog":
            json_response(self, {"agents": agent_catalog_payload()})
            return
        if path == "/api/model-recommendations":
            json_response(self, {"recommendations": model_recommendations()})
            return
        if path == "/api/system/status":
            json_response(self, {"system": system_status()})
            return
        if path == "/api/tools/status":
            json_response(self, {"tools": tool_status()})
            return
        if path == "/api/tools/jobs":
            json_response(self, {"jobs": list_jobs()})
            return
        if path.startswith("/api/tools/jobs/"):
            job_id = path.rsplit("/", 1)[-1]
            detail = job_detail(job_id)
            if not detail:
                json_response(self, {"error": "Job not found."}, status=404)
                return
            json_response(self, {"job": detail})
            return
        if path == "/api/workspace/tree":
            json_response(self, {"workspace": workspace_tree()})
            return
        if path == "/api/workspace/file":
            query = parse_qs(parsed.query)
            try:
                payload = read_workspace_file(query.get("path", [""])[0])
            except ValueError as exc:
                json_response(self, {"error": str(exc)}, status=400)
                return
            except FileNotFoundError as exc:
                json_response(self, {"error": str(exc)}, status=404)
                return
            json_response(self, {"file": payload})
            return

        json_response(self, {"error": "Not found"}, status=404)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_common_headers("text/plain; charset=utf-8", 0)
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/chat":
            self._stream_chat()
            return
        if path == "/api/tools/run":
            self._run_tool_command()
            return
        if path == "/api/settings":
            self._save_settings()
            return
        if path == "/api/settings/reset":
            self._reset_settings()
            return
        if path.startswith("/api/tools/jobs/") and path.endswith("/stop"):
            self._stop_tool_job(path.rsplit("/", 2)[-2])
            return
        if path == "/api/scan/preview":
            self._preview_scan()
            return
        if path == "/api/workspace/import":
            self._import_workspace()
            return
        if path == "/api/workspace/save":
            self._save_workspace_file()
            return
        if path == "/api/workspace/mkdir":
            self._create_workspace_folder()
            return
        if path == "/api/workspace/rename":
            self._rename_workspace_path()
            return
        if path == "/api/workspace/delete":
            self._delete_workspace_path()
            return
        json_response(self, {"error": "Not found"}, status=404)

    def _send_common_headers(self, content_type: str, content_length: int | None = None) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if content_length is not None:
            self.send_header("Content-Length", str(content_length))

    def _serve_path(self, path: Path) -> None:
        if not path.exists():
            json_response(self, {"error": f"Missing asset: {path.name}"}, status=500)
            return
        body = path.read_bytes()
        content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        if path.suffix == ".js":
            content_type = "application/javascript; charset=utf-8"
        elif path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif path.suffix == ".html":
            content_type = "text/html; charset=utf-8"
        self.send_response(HTTPStatus.OK)
        self._send_common_headers(content_type, len(body))
        self.end_headers()
        self.wfile.write(body)

    def _stream_line(self, payload: dict) -> None:
        line = (json.dumps(payload) + "\n").encode("utf-8")
        self.wfile.write(line)
        self.wfile.flush()

    def _run_tool_command(self) -> None:
        try:
            body = read_json_body(self)
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return

        command = str(body.get("command", "")).strip()
        confirmed = bool(body.get("confirmed"))
        if not confirmed:
            json_response(self, {"error": "Command launch requires confirmation."}, status=400)
            return

        try:
            job = start_tool_job(command)
        except PermissionError as exc:
            json_response(self, {"error": str(exc)}, status=403)
            return
        except (ValueError, FileNotFoundError) as exc:
            json_response(self, {"error": str(exc)}, status=400)
            return
        except OSError as exc:
            json_response(self, {"error": str(exc)}, status=500)
            return

        json_response(self, {"job": job}, status=HTTPStatus.CREATED)

    def _save_settings(self) -> None:
        try:
            body = read_json_body(self)
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return

        try:
            settings, warnings, meta = update_settings_payload(body)
        except SettingsValidationError as exc:
            json_response(self, {"error": str(exc), "field_errors": exc.field_errors}, status=400)
            return

        json_response(self, {"settings": settings, "warnings": warnings, "meta": meta})

    def _reset_settings(self) -> None:
        settings, warnings, meta = reset_settings_payload()
        json_response(self, {"settings": settings, "warnings": warnings, "meta": meta})

    def _stop_tool_job(self, job_id: str) -> None:
        try:
            body = read_json_body(self)
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return

        if not body.get("confirmed"):
            json_response(self, {"error": "Stopping a job requires explicit confirmation."}, status=400)
            return

        try:
            job = stop_tool_job(job_id)
        except FileNotFoundError as exc:
            json_response(self, {"error": str(exc)}, status=404)
            return

        json_response(self, {"job": job})

    def _preview_scan(self) -> None:
        try:
            body = read_json_body(self)
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return

        text = str(body.get("text") or "")
        if not text.strip():
            json_response(self, {"error": "Scan text is required."}, status=400)
            return

        requested = str(body.get("preset") or "auto")
        analysis = analyze_scan_text(text, requested=requested)
        json_response(self, {"analysis": analysis})

    def _import_workspace(self) -> None:
        try:
            body = read_json_body(self)
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return

        files = body.get("files") or []
        replace = bool(body.get("replace"))
        project_name = str(body.get("project_name") or "Workspace")
        if not isinstance(files, list) or not files:
            json_response(self, {"error": "No files provided."}, status=400)
            return

        try:
            workspace = import_workspace_files(files, replace=replace, project_name=project_name)
        except ValueError as exc:
            json_response(self, {"error": str(exc)}, status=400)
            return

        json_response(self, {"workspace": workspace}, status=HTTPStatus.CREATED)

    def _save_workspace_file(self) -> None:
        try:
            body = read_json_body(self)
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return

        try:
            saved = save_workspace_file(str(body.get("path", "")), str(body.get("content", "")))
        except ValueError as exc:
            json_response(self, {"error": str(exc)}, status=400)
            return

        json_response(self, {"file": saved})

    def _create_workspace_folder(self) -> None:
        try:
            body = read_json_body(self)
            folder = create_workspace_folder(str(body.get("path", "")))
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return
        except ValueError as exc:
            json_response(self, {"error": str(exc)}, status=400)
            return
        json_response(self, {"folder": folder}, status=HTTPStatus.CREATED)

    def _rename_workspace_path(self) -> None:
        try:
            body = read_json_body(self)
            payload = rename_workspace_path(str(body.get("from_path", "")), str(body.get("to_path", "")))
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return
        except ValueError as exc:
            json_response(self, {"error": str(exc)}, status=400)
            return
        except FileNotFoundError as exc:
            json_response(self, {"error": str(exc)}, status=404)
            return
        json_response(self, {"rename": payload})

    def _delete_workspace_path(self) -> None:
        try:
            body = read_json_body(self)
            payload = delete_workspace_path(str(body.get("path", "")))
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return
        except ValueError as exc:
            json_response(self, {"error": str(exc)}, status=400)
            return
        except FileNotFoundError as exc:
            json_response(self, {"error": str(exc)}, status=404)
            return
        json_response(self, {"delete": payload})

    def _stream_chat(self) -> None:
        try:
            body = read_json_body(self)
        except json.JSONDecodeError:
            json_response(self, {"error": "Invalid JSON body."}, status=400)
            return

        model = body.get("model") or "hackloi-assistant"
        messages = body.get("messages") or []
        system_prompt = (body.get("system") or "").strip()
        chat_messages = []
        if system_prompt:
            chat_messages.append({"role": "system", "content": system_prompt})
        chat_messages.extend(messages)

        payload = {
            "model": model,
            "stream": True,
            "messages": chat_messages,
            "keep_alive": "30m",
            "options": {"num_ctx": CHAT_NUM_CTX, "temperature": CHAT_TEMPERATURE},
        }

        request = Request(
            f"{OLLAMA_API_BASE}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        self.send_response(HTTPStatus.OK)
        self._send_common_headers("application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        self._stream_line({"type": "start", "model": model})
        try:
            with urlopen(request, timeout=600) as response:
                for raw_line in response:
                    line = raw_line.decode("utf-8").strip()
                    if not line:
                        continue
                    item = json.loads(line)
                    message = item.get("message", {})
                    content = message.get("content") or ""
                    if content:
                        self._stream_line({"type": "chunk", "content": content})
                    if item.get("done"):
                        self._stream_line(
                            {
                                "type": "done",
                                "prompt_eval_count": item.get("prompt_eval_count"),
                                "eval_count": item.get("eval_count"),
                            }
                        )
                        return
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            self._stream_line({"type": "error", "message": format_ollama_error(exc, action="running chat")})
        except BrokenPipeError:
            return


def main() -> int:
    ensure_runtime_dirs()
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"Hackloi AI dashboard serving on http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.", file=sys.stderr)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
