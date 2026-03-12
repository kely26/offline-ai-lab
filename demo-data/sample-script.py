#!/usr/bin/env python3

import json
from pathlib import Path


def load_targets(config_path: str) -> list[str]:
    config_file = Path(config_path)
    if not config_file.exists():
        return []
    with config_file.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload.get("targets", [])


def summarize_targets(targets: list[str]) -> str:
    if not targets:
        return "No targets configured."
    return f"Loaded {len(targets)} targets: {', '.join(targets)}"


if __name__ == "__main__":
    print(summarize_targets(load_targets("sample-config.json")))
