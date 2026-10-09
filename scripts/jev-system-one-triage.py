#!/usr/bin/env python3
"""Optional NLP triage via https://github.com/sgoedecke/system-one (not OpenJev).

Install once:
  pip install system-one typesafe-sdk torch transformers

Set JEV_SYSTEM_ONE=1 and optionally JEV_SYSTEM_ONE_MODEL=Qwen/Qwen2.5-0.5B-Instruct.
First run downloads weights; keep this off the hot path in the 3D view.
"""
from __future__ import annotations

import json
import os
import sys


def main() -> int:
    try:
        from system_one import SystemOne
        from typesafe_sdk import Choice
    except ImportError:
        return 2

    payload = json.load(sys.stdin)
    state = "\n".join(
        part
        for part in [
            f"status: {payload.get('status', 'unknown')}",
            f"task: {payload.get('task') or ''}",
            f"activity: {payload.get('activityLabel') or ''}",
        ]
        if part
    )
    model = os.environ.get("JEV_SYSTEM_ONE_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
    engine = SystemOne.from_pretrained(model)
    result = engine.system_one(
        state=state,
        questions={
            "route": Choice(
                instructions="How should the floor supervisor treat this desk?",
                criteria={
                    "ok": "Healthy run, no action",
                    "watch": "Uncertain or retrying",
                    "stuck": "Working but stale",
                    "failed": "Error or disconnected",
                    "needs_human": "Blocked or needs a person",
                },
            ),
        },
    )
    choice = result.choices["route"].choice
    subtitles = {
        "ok": "Desk looks fine",
        "watch": "Keeping an eye on this run",
        "stuck": "No movement — nudge the agent",
        "failed": "Run failed or disconnected",
        "needs_human": "Needs a person at this desk",
    }
    probs = result.choices["route"].probabilities or {}
    confidence = float(max(probs.values()) if probs else 0.7)
    print(
        json.dumps(
            {
                "choice": choice,
                "confidence": confidence,
                "subtitle": subtitles.get(choice, subtitles["ok"]),
                "probabilities": probs,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
