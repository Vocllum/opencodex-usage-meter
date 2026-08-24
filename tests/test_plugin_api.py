from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

MODULE_PATH = Path(__file__).parents[1] / "dashboard" / "plugin_api.py"


def load_module():
    spec = importlib.util.spec_from_file_location("opencodex_usage_plugin_api_test", MODULE_PATH)
    assert spec is not None
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


def test_read_snapshot_backfills_missing_provider_when_refresh_is_partial(monkeypatch: pytest.MonkeyPatch):
    module = load_module()
    previous_report = {"provider": "xai", "label": "Grok", "quota": {"weeklyPercent": 30}}
    setattr(module, "_SNAPSHOT", (0.0, [*minimal_reports(), previous_report], []))
    monkeypatch.setattr(module, "_read_quota", minimal_reports)
    monkeypatch.setattr(module, "_read_accounts", lambda provider: [])

    reports, accounts = module._read_snapshot(force=True)

    assert [row["provider"] for row in reports] == ["openai", "xai"]
    assert accounts == []


def test_read_snapshot_keeps_accounts_only_when_account_refresh_failed(monkeypatch: pytest.MonkeyPatch):
    module = load_module()
    previous_account = {"id": "secondary", "quota": {"weeklyPercent": 20}}
    setattr(module, "_SNAPSHOT", (0.0, minimal_reports(), [previous_account]))
    monkeypatch.setattr(module, "_read_quota", minimal_reports)
    monkeypatch.setattr(module, "_read_accounts", lambda provider: None)

    _, accounts = module._read_snapshot(force=True)

    assert accounts == [previous_account]


def test_read_snapshot_accepts_successful_empty_account_refresh(monkeypatch: pytest.MonkeyPatch):
    module = load_module()
    previous_account = {"id": "secondary", "quota": {"weeklyPercent": 20}}
    setattr(module, "_SNAPSHOT", (0.0, minimal_reports(), [previous_account]))
    monkeypatch.setattr(module, "_read_quota", minimal_reports)
    monkeypatch.setattr(module, "_read_accounts", lambda provider: [])

    _, accounts = module._read_snapshot(force=True)

    assert accounts == []


def test_first_failed_account_refresh_recovers_accounts_from_disk_cache(monkeypatch: pytest.MonkeyPatch):
    module = load_module()
    previous_account = {"id": "secondary", "quota": {"weeklyPercent": 20}}
    disk_payload = module._normalize(minimal_payload(), minimal_reports(), [previous_account], "7d")
    monkeypatch.setattr(module, "_read_quota", minimal_reports)
    monkeypatch.setattr(module, "_read_accounts", lambda provider: None)
    monkeypatch.setattr(module, "_read_disk_cache", lambda range_key="7d": disk_payload)

    _, accounts = module._read_snapshot(force=True)

    assert [account["id"] for account in accounts] == ["secondary"]


def test_disk_cache_is_private(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    module = load_module()
    monkeypatch.setattr(module, "_CACHE_FILE", tmp_path / "usage.json")
    result = {"status": "ok", "range": "7d", "quotas": [{"accounts": [{"email": "private@example.com"}]}]}

    module._write_disk_cache(result, "7d")

    assert module._cache_file("7d").stat().st_mode & 0o777 == 0o600


def test_normalize_maps_account_quota_to_remaining_percent_source_fields():
    module = load_module()
    accounts = [{
        "id": "primary",
        "email": "tester@example.com",
        "active": True,
        "quota": {"weeklyPercent": 6, "weeklyResetAt": 123},
    }]
    result = module._normalize(minimal_payload(), minimal_reports(), accounts, "7d")
    account = result["quotas"][0]["accounts"][0]
    assert account["weeklyPercent"] == 6
    assert account["weeklyResetAt"] == 123
    assert account["active"] is True


def test_usage_rejects_unsupported_range():
    module = load_module()
    with pytest.raises(module.HTTPException) as exc:
        module.usage("1d")
    assert exc.value.status_code == 400
