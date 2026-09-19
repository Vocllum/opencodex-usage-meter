from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

MODULE_PATH = Path(__file__).parents[1] / "dashboard" / "plugin_api.py"


def load_module():
    spec = importlib.util.spec_from_file_location("opencodex_usage_plugin_api_test", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def minimal_payload():
    return {
        "summary": {
            "requests": 3,
            "totalTokens": 30,
            "inputTokens": 20,
            "outputTokens": 10,
            "cachedInputTokens": 0,
            "reasoningOutputTokens": 0,
            "coverageRatio": 1,
            "estimatedCostUsd": 0.5,
        },
        "models": [],
        "providers": [],
    }


def minimal_reports():
    return [{"provider": "openai", "label": "OpenAI", "quota": {"weeklyPercent": 25}}]


def test_normalize_preserves_requested_range():
    module = load_module()
    result = module._normalize(minimal_payload(), minimal_reports(), [], "30d")
    assert result["range"] == "30d"


def test_normalize_preserves_account_five_hour_and_weekly_windows():
    module = load_module()
    accounts = [
        {
            "id": "account-a",
            "email": "masked@example.com",
            "quota": {
                "shortPercent": 86,
                "shortResetAt": 111,
                "weeklyPercent": 79,
                "weeklyResetAt": 222,
            },
        }
    ]
    reports = [
        {
            "provider": "openai",
            "label": "OpenAI",
            "quota": {"fiveHourPercent": 10, "weeklyPercent": 62},
        }
    ]
    result = module._normalize(minimal_payload(), reports, accounts)
    account = result["quotas"][0]["accounts"][0]
    assert account["fiveHourPercent"] == 86
    assert account["fiveHourResetAt"] == 111
    assert account["weeklyPercent"] == 79
    assert account["weeklyResetAt"] == 222


def test_current_usage_caches_each_range_independently(monkeypatch: pytest.MonkeyPatch):
    module = load_module()
    calls: list[str] = []
    monkeypatch.setattr(module, "_read_usage", lambda range_key: calls.append(range_key) or minimal_payload())
    quota_calls: list[int] = []

    def counted_reports():
        quota_calls.append(1)
        return minimal_reports()

    monkeypatch.setattr(module, "_read_quota", counted_reports)
    monkeypatch.setattr(module, "_read_accounts", lambda provider: [])
    monkeypatch.setattr(module, "_write_disk_cache", lambda result, range_key: None)
    monkeypatch.setattr(module, "_read_disk_cache", lambda range_key: None)

    assert module._current_usage("7d")["range"] == "7d"
    assert module._current_usage("30d")["range"] == "30d"
    assert module._current_usage("all")["range"] == "all"
    assert module._current_usage("7d")["range"] == "7d"
    # usage re-read per range, but the slow quota snapshot is shared
    assert calls == ["7d", "30d", "all"]
    assert len(quota_calls) == 1


def test_current_usage_force_bypasses_cache(monkeypatch: pytest.MonkeyPatch):
    module = load_module()
    calls: list[str] = []
    monkeypatch.setattr(module, "_read_usage", lambda range_key: calls.append(range_key) or minimal_payload())
    monkeypatch.setattr(module, "_read_quota", minimal_reports)
    monkeypatch.setattr(module, "_read_accounts", lambda provider: [])
    monkeypatch.setattr(module, "_write_disk_cache", lambda result, range_key: None)
    monkeypatch.setattr(module, "_read_disk_cache", lambda range_key: None)

    first = module._current_usage("7d")
    again = module._current_usage("7d")
    forced = module._current_usage("7d", force=True)
    assert first["fetchedAt"] == again["fetchedAt"]
    assert forced["fetchedAt"] >= first["fetchedAt"]
    assert calls == ["7d", "7d"]


def test_usage_rejects_unsupported_range():
    module = load_module()
    with pytest.raises(module.HTTPException) as exc:
        module.usage("1d")
    assert exc.value.status_code == 400


def test_normalize_preserves_google_antigravity_accounts_custom_windows():
    module = load_module()
    accounts = [
        {
            "id": "acc-gemini-1",
            "provider": "google-antigravity",
            "email": "user1@gmail.com",
            "active": False,
            "quota": {
                "customWindows": [
                    {"label": "Gem", "percent": 100, "resetAt": 11111},
                    {"label": "Gem (Weekly)", "percent": 95.0, "resetAt": 22222},
                    {"label": "Cla", "percent": 0, "resetAt": 33333},
                    {"label": "Cla (Weekly)", "percent": 33.5, "resetAt": 44444},
                ]
            },
        },
        {
            "id": "acc-gemini-2",
            "provider": "google-antigravity",
            "email": "user2@gmail.com",
            "active": True,
            "quota": {
                "customWindows": [
                    {"label": "Gem", "percent": 50.0, "resetAt": 55555},
                    {"label": "Gem (Weekly)", "percent": 70.0, "resetAt": 66666},
                ]
            },
        },
    ]
    reports = [
        {
            "provider": "google-antigravity",
            "label": "Google Antigravity",
            "quota": {
                "customWindows": [
                    {"label": "Gem", "percent": 50, "resetAt": 55555},
                    {"label": "Gem (Weekly)", "percent": 70, "resetAt": 66666},
                ]
            },
        }
    ]
    result = module._normalize(minimal_payload(), reports, accounts)
    prov = result["quotas"][0]
    assert prov["provider"] == "google-antigravity"
    assert len(prov["accounts"]) == 2
    acc1 = prov["accounts"][0]
    assert acc1["id"] == "acc-gemini-1"
    assert acc1["email"] == "user1@gmail.com"
    assert acc1["fiveHourPercent"] == 100
    assert acc1["weeklyPercent"] == 95.0
    assert len(acc1["customWindows"]) == 4
    assert any(cw["key"] == "claude-rolling" and cw["remainingPercent"] == 100.0 for cw in acc1["customWindows"])
    # Verify aggregated windows across accounts (100% + 50%) / 2 = 75% used -> 25% remaining
    five_hour_win = next(w for w in prov["windows"] if w["key"] == "fiveHour")
    assert five_hour_win["usedPercent"] == 75.0
    assert five_hour_win["remainingPercent"] == 25.0
    # (95% + 70%) / 2 = 82.5% used -> 17.5% remaining
    weekly_win = next(w for w in prov["windows"] if w["key"] == "weekly")
    assert weekly_win["usedPercent"] == 82.5
    assert weekly_win["remainingPercent"] == 17.5


def test_normalize_pool_aggregates_all_accounts():
    module = load_module()
    accounts = [
        {
            "id": "acc-1",
            "provider": "google-antigravity",
            "email": "a1@example.com",
            "quota": {
                "customWindows": [
                    {"label": "Gem", "percent": 0, "resetAt": 1000},
                    {"label": "Gem (Weekly)", "percent": 0, "resetAt": 2000},
                ]
            },
        },
        {
            "id": "acc-2",
            "provider": "google-antigravity",
            "email": "a2@example.com",
            "quota": {
                "customWindows": [
                    {"label": "Gem", "percent": 96, "resetAt": 1000},
                    {"label": "Gem (Weekly)", "percent": 24, "resetAt": 2000},
                ]
            },
        },
        {
            "id": "acc-3",
            "provider": "google-antigravity",
            "email": "a3@example.com",
            "quota": {
                "customWindows": [
                    {"label": "Gem", "percent": 0, "resetAt": 1000},
                    {"label": "Gem (Weekly)", "percent": 0, "resetAt": 2000},
                ]
            },
        },
    ]
    reports = [
        {
            "provider": "google-antigravity",
            "label": "Google Antigravity",
            "quota": {
                "customWindows": [
                    {"label": "Gem", "percent": 96, "resetAt": 1000},
                    {"label": "Gem (Weekly)", "percent": 24, "resetAt": 2000},
                ]
            },
        }
    ]
    result = module._normalize(minimal_payload(), reports, accounts)
    prov = result["quotas"][0]
    assert prov["includedAccounts"] == 3
    # Pool average remaining: (100% + 4% + 100%) / 3 = 68.0%
    five_hour_win = next(w for w in prov["windows"] if w["key"] == "fiveHour")
    assert round(five_hour_win["remainingPercent"]) == 68


def test_normalize_cascading_exhaustion_weekly_to_five_hour():
    module = load_module()
    # When weekly quota is 100% exhausted, 5h rolling quota must be clamped to 0% remaining
    accounts = [
        {
            "id": "acc-openai-exhausted",
            "provider": "openai",
            "email": "user@openai.com",
            "quota": {
                "shortPercent": 0,
                "shortResetAt": 1000,
                "weeklyPercent": 100,
                "weeklyResetAt": 5000,
            },
        }
    ]
    reports = [
        {
            "provider": "openai",
            "label": "OpenAI",
            "quota": {
                "fiveHourPercent": 0,
                "fiveHourResetAt": 1000,
                "weeklyPercent": 100,
                "weeklyResetAt": 5000,
            },
        }
    ]
    result = module._normalize(minimal_payload(), reports, accounts)
    prov = result["quotas"][0]
    five_hour_win = next(w for w in prov["windows"] if w["key"] == "fiveHour")
    weekly_win = next(w for w in prov["windows"] if w["key"] == "weekly")
    assert weekly_win["remainingPercent"] == 0.0
    # Provider total quota must not add exhausted accounts: 0.0% available
    assert five_hour_win["remainingPercent"] == 0.0
    assert five_hour_win["usedPercent"] == 100.0
    assert five_hour_win["blockedBy"] == "weekly"
    assert five_hour_win["effectiveRemainingPercent"] == 0.0
    assert five_hour_win["resetsAt"] == 5000
    # But the individual account preserves its actual 5-hour measured usage
    acc = prov["accounts"][0]
    assert acc["fiveHourPercent"] == 0.0
    assert acc["fiveHourBlockedBy"] == "weekly"
    assert acc["fiveHourResetAt"] == 5000
