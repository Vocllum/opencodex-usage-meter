"""Read-only OpenCodex usage bridge for Hermes Desktop."""
from __future__ import annotations

import hmac
import json
import os
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

_CACHE_SECONDS = 15
_HERMES_HOME = Path(os.environ.get("HERMES_HOME") or (Path.home() / ".hermes"))
_CACHE_FILE = _HERMES_HOME / "cache" / "opencodex-usage-meter.json"
_CACHE_LOCK = threading.RLock()
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_ALLOWED_RANGES = ("7d", "30d", "all")
_IS_WINDOWS = os.name == "nt"
_OCX_CANDIDATES = (
    (
        Path.home() / "AppData" / "Local" / "hermes" / "node" / "ocx.cmd",
        Path.home() / "AppData" / "Local" / "hermes" / "node" / "ocx.ps1",
    )
    if _IS_WINDOWS
    else (
        Path.home() / ".local" / "bin" / "ocx",
        Path("/opt/homebrew/bin/ocx"),
        Path("/usr/local/bin/ocx"),
    )
)


def _host_session_token() -> str:
    host_module = sys.modules.get("hermes_cli.web_server")
    token = getattr(host_module, "_SESSION_TOKEN", None) if host_module else None
    return str(token or os.environ.get("HERMES_DASHBOARD_SESSION_TOKEN") or "")


def _request_bearer(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    scheme, separator, token = authorization.partition(" ")
    return token.strip() if separator and scheme.lower() == "bearer" else ""


def _require_plugin_auth(request: Request) -> None:
    app_state = getattr(getattr(request, "app", None), "state", None)
    if getattr(app_state, "auth_required", False):
        state = getattr(request, "state", None)
        if getattr(state, "session", None) is not None or getattr(state, "token_authenticated", False):
            return
        raise HTTPException(status_code=401, detail="Unauthorized")
    expected = _host_session_token()
    supplied = (request.headers.get("x-hermes-session-token", ""), _request_bearer(request))
    if expected and any(
        token and hmac.compare_digest(token.encode(), expected.encode()) for token in supplied
    ):
        return
    raise HTTPException(status_code=401, detail="Unauthorized")


# Hermes Desktop's plugin API mount already authenticates and scopes this router.
# Do not add a second request-level guard here: desktop ctx.rest requests do not
# necessarily expose the dashboard cookie/session on the plugin subrequest.
router = APIRouter()


def _ocx_executable() -> str:
    configured = (os.environ.get("OPENCODEX_EXECUTABLE") or "").strip()
    if configured and Path(configured).is_file():
        return configured
    discovered = shutil.which("ocx")
    if discovered:
        return discovered
    for candidate in _OCX_CANDIDATES:
        if candidate.is_file():
            return str(candidate)
    raise RuntimeError("OpenCodex CLI executable was not found")


def _ocx_command(arguments: list[str]) -> list[str]:
    executable = _ocx_executable()
    suffix = Path(executable).suffix.lower()
    if _IS_WINDOWS and suffix in {".cmd", ".bat", ".ps1"}:
        # Python cannot reliably execute a Windows npm shim with shell=False.
        # Call the bundled Node runtime and ocx.mjs directly instead.
        node = Path(executable).with_name("node.exe")
        module = Path(executable).parent / "node_modules" / "@bitkyc08" / "opencodex" / "bin" / "ocx.mjs"
        if node.is_file() and module.is_file():
            return [str(node), str(module), *arguments]
    return [executable, *arguments]


def _ocx_child_env() -> dict[str, str]:
    """Child env that lets ocx's `#!/usr/bin/env node` shebang resolve.

    Hermes serve runs with a minimal PATH (no ~/.local/bin), so `env` cannot
    find node. Prepend the directories of the resolved ocx and its sibling
    node to the child PATH instead of relying on the host environment.
    """
    env = {**os.environ, "NO_COLOR": "1"}
    executable = _ocx_executable()
    additions: list[str] = []
    for candidate in (Path(executable).parent, Path(executable).with_name("node")):
        if candidate.is_dir():
            additions.append(str(candidate))
    if additions:
        existing = env.get("PATH", os.defpath)
        missing = [item for item in additions if item not in existing.split(os.pathsep)]
        if missing:
            env["PATH"] = os.pathsep.join([*missing, existing])
    return env


def _run_ocx_process(arguments: list[str], timeout: float = 20) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        _ocx_command(arguments),
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=_ocx_child_env(),
    )


def _run_ocx_json(arguments: list[str], label: str, timeout: float = 20) -> dict[str, Any]:
    try:
        completed = _run_ocx_process(arguments, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"OpenCodex {label} request timed out") from exc
    if completed.returncode != 0:
        raise RuntimeError(f"OpenCodex {label} is temporarily unavailable")
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"OpenCodex returned invalid {label} data") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"OpenCodex returned no {label} data")
    return payload


def _read_usage(range_key: str = "7d") -> dict[str, Any]:
    payload = _run_ocx_json(["usage", "--range", range_key, "--json"], "usage")
    if not isinstance(payload.get("summary"), dict):
        raise RuntimeError("OpenCodex returned no usage summary")
    return payload


_QUOTA_TIMEOUT_SECONDS = 90


def _read_quota(force: bool = False) -> list[dict[str, Any]]:
    # When force is False, try reading fast cached quota snapshot first.
    # If that returns valid reports, avoid slow live provider round-trips.
    if not force:
        try:
            payload = _run_ocx_json(["provider", "quota", "--json"], "quota", timeout=10)
            reports = payload.get("reports")
            if isinstance(reports, list):
                valid = [item for item in reports if isinstance(item, dict) and isinstance(item.get("quota"), dict)]
                if valid:
                    return valid
        except RuntimeError:
            pass
    # Live refresh when explicitly requested or if snapshot read failed
    payload = _run_ocx_json(["provider", "quota", "--refresh", "--json"], "quota", timeout=_QUOTA_TIMEOUT_SECONDS)
    reports = payload.get("reports")
    if not isinstance(reports, list):
        raise RuntimeError("OpenCodex returned no quota data")
    valid = [item for item in reports if isinstance(item, dict) and isinstance(item.get("quota"), dict)]
    if not valid:
        raise RuntimeError("OpenCodex returned no provider quota")
    return valid


def _read_accounts(provider: str | None = None, force: bool = False) -> list[dict[str, Any]] | None:
    """Read account rows; ``None`` means refresh failed, ``[]`` means empty pool.
    When provider is specified, filters by provider. If None, returns all accounts.
    """
    args = ["account", "list", "--quota", "--json"]
    if force:
        args.insert(3, "--refresh")
    try:
        timeout = 45 if force else 15
        payload = _run_ocx_json(args, "account", timeout=timeout)
    except RuntimeError:
        return None
    accounts = payload.get("accounts")
    if not isinstance(accounts, list):
        return None
    if provider:
        return [acc for acc in accounts if isinstance(acc, dict) and acc.get("provider") == provider]
    return [acc for acc in accounts if isinstance(acc, dict)]


def _number(value: Any) -> float:
    return float(value) if isinstance(value, (int, float)) else 0.0


def _parse_account_quota(
    account: dict[str, Any],
) -> tuple[float | None, int | None, float | None, int | None, list[dict[str, Any]]]:
    quota_data = account.get("quota")
    if not isinstance(quota_data, dict):
        return None, None, None, None, []

    five_hour_pct: float | None = None
    five_hour_reset: int | None = None
    weekly_pct: float | None = None
    weekly_reset: int | None = None
    custom_windows: list[dict[str, Any]] = []

    # Standard short/weekly fields (e.g. OpenAI, Command Code)
    if isinstance(quota_data.get("weeklyPercent"), (int, float)):
        weekly_pct = float(quota_data["weeklyPercent"])
        weekly_reset = int(_number(quota_data.get("weeklyResetAt"))) or None

    short_val = quota_data.get("shortPercent")
    if short_val is None:
        short_val = quota_data.get("fiveHourPercent")
    if isinstance(short_val, (int, float)):
        five_hour_pct = float(short_val)
        five_hour_reset = int(_number(quota_data.get("shortResetAt") or quota_data.get("fiveHourResetAt"))) or None

    # Custom windows (e.g. Google Antigravity / Gemini / Claude)
    raw_cw = quota_data.get("customWindows")
    if isinstance(raw_cw, list):
        for item in raw_cw:
            if not isinstance(item, dict):
                continue
            cw_label = str(item.get("label") or "").strip()
            used = item.get("percent")
            if not isinstance(used, (int, float)):
                continue
            used_pct = round(max(0.0, min(100.0, float(used))), 1)
            reset_val = int(_number(item.get("resetAt"))) or None
            lower = cw_label.lower()

            if "gem (weekly)" in lower:
                key = "weekly"
                label = "Gemini 每周"
                if weekly_pct is None:
                    weekly_pct = used_pct
                    weekly_reset = reset_val
            elif lower == "gem":
                key = "fiveHour"
                label = "Gemini"
                if five_hour_pct is None:
                    five_hour_pct = used_pct
                    five_hour_reset = reset_val
            elif "cla (weekly)" in lower:
                key = "claude-weekly"
                label = "Claude 每周"
            elif lower == "cla":
                key = "claude-rolling"
                label = "Claude"
            else:
                key = lower.replace(" ", "-")
                label = cw_label

            custom_windows.append(
                {
                    "key": key,
                    "label": label,
                    "usedPercent": used_pct,
                    "remainingPercent": round(100.0 - used_pct, 1),
                    "resetAt": reset_val,
                }
            )

    five_hour_blocked_by: str | None = None

    # Cascading Exhaustion: When weekly quota is exhausted (>= 100%), mark short windows as blocked
    # while preserving actual five-hour usage numbers
    if weekly_pct is not None and weekly_pct >= 100.0:
        if five_hour_pct is not None:
            five_hour_blocked_by = "weekly"
            if weekly_reset and (five_hour_reset is None or weekly_reset > five_hour_reset):
                five_hour_reset = weekly_reset
        for cw in custom_windows:
            if cw["key"] in ("fiveHour", "gemini-rolling", "gem"):
                cw["blockedBy"] = "weekly"
                cw["effectiveRemainingPercent"] = 0.0
                if weekly_reset and (cw.get("resetAt") is None or weekly_reset > cw["resetAt"]):
                    cw["resetAt"] = weekly_reset

    # Also handle Claude rolling window exhaustion
    cla_weekly = next((cw for cw in custom_windows if cw["key"] == "claude-weekly"), None)
    if cla_weekly and cla_weekly.get("usedPercent", 0) >= 100.0:
        for cw in custom_windows:
            if cw["key"] == "claude-rolling":
                cw["blockedBy"] = "weekly"
                cw["effectiveRemainingPercent"] = 0.0
                if cla_weekly.get("resetAt") and (cw.get("resetAt") is None or cla_weekly["resetAt"] > cw["resetAt"]):
                    cw["resetAt"] = cla_weekly["resetAt"]

    return five_hour_pct, five_hour_reset, weekly_pct, weekly_reset, custom_windows, five_hour_blocked_by


def _normalize(
    payload: dict[str, Any],
    quota_reports: list[dict[str, Any]],
    account_rows: list[dict[str, Any]] | None = None,
    range_key: str = "7d",
) -> dict[str, Any]:
    summary = payload["summary"]
    raw_models = payload.get("models")
    raw_providers = payload.get("providers")
    models: list[Any] = raw_models if isinstance(raw_models, list) else []
    providers: list[Any] = raw_providers if isinstance(raw_providers, list) else []

    def model_row(row: Any) -> dict[str, Any] | None:
        if not isinstance(row, dict):
            return None
        return {
            "provider": str(row.get("provider") or "unknown"),
            "model": str(row.get("model") or "unknown"),
            "requests": int(_number(row.get("requests"))),
            "totalTokens": int(_number(row.get("totalTokens"))),
            "sharePercent": round(_number(row.get("shareRatio")) * 100, 1),
            "estimatedCostUsd": round(_number(row.get("estimatedCostUsd")), 4),
        }

    def provider_row(row: Any) -> dict[str, Any] | None:
        if not isinstance(row, dict):
            return None
        return {
            "provider": str(row.get("provider") or "unknown"),
            "requests": int(_number(row.get("requests"))),
            "totalTokens": int(_number(row.get("totalTokens"))),
            "sharePercent": round(_number(row.get("shareRatio")) * 100, 1),
        }

    top_models = [normalized for row in models if (normalized := model_row(row)) is not None][:4]
    top_providers = [normalized for row in providers if (normalized := provider_row(row)) is not None][:3]
    normalized_quotas: list[dict[str, Any]] = []
    for quota_report in quota_reports:
        quota = quota_report["quota"]
        quota_windows: list[dict[str, Any]] = []
        for key, label, percent_key, reset_key in (
            ("fiveHour", "5 小时", "fiveHourPercent", "fiveHourResetAt"),
            ("weekly", "每周", "weeklyPercent", "weeklyResetAt"),
            ("monthly", "每月", "monthlyPercent", "monthlyResetAt"),
        ):
            used = quota.get(percent_key)
            if isinstance(used, (int, float)):
                used = max(0.0, min(100.0, float(used)))
                quota_windows.append(
                    {
                        "key": key,
                        "label": label,
                        "usedPercent": round(used, 1),
                        "remainingPercent": round(100.0 - used, 1),
                        "resetsAt": int(_number(quota.get(reset_key))) or None,
                    }
                )
        custom_windows = quota.get("customWindows")
        if isinstance(custom_windows, list):
            for cw in custom_windows:
                if not isinstance(cw, dict):
                    continue
                cw_label = str(cw.get("label") or "").strip()
                used = cw.get("percent")
                if not isinstance(used, (int, float)):
                    continue
                used = max(0.0, min(100.0, float(used)))
                lower = cw_label.lower()
                if "gem (weekly)" in lower:
                    key = "weekly" if not any(item["key"] == "weekly" for item in quota_windows) else "gemini-weekly"
                    label = "Gemini 每周"
                elif lower == "gem":
                    key = "fiveHour" if not any(item["key"] == "fiveHour" for item in quota_windows) else "gemini-rolling"
                    label = "Gemini"
                elif "cla (weekly)" in lower:
                    key = "claude-weekly"
                    label = "Claude 每周"
                elif lower == "cla":
                    key = "claude-rolling"
                    label = "Claude"
                elif "weekly" in lower:
                    key = "weekly" if not any(item["key"] == "weekly" for item in quota_windows) else f"weekly-{len(quota_windows)}"
                    label = cw_label
                elif "monthly" in lower:
                    key = "monthly" if not any(item["key"] == "monthly" for item in quota_windows) else f"monthly-{len(quota_windows)}"
                    label = cw_label
                else:
                    key = f"custom-{len(quota_windows)}"
                    label = cw_label
                quota_windows.append(
                    {
                        "key": key,
                        "label": label,
                        "usedPercent": round(used, 1),
                        "remainingPercent": round(100.0 - used, 1),
                        "resetsAt": int(_number(cw.get("resetAt"))) or None,
                    }
                )
        if not quota_windows:
            continue

        # Cascading Exhaustion for provider-level quota_windows:
        weekly_win = next((w for w in quota_windows if w["key"] in ("weekly", "gemini-weekly")), None)
        if weekly_win and weekly_win.get("usedPercent", 0) >= 100.0:
            for w in quota_windows:
                if w["key"] in ("fiveHour", "gemini-rolling"):
                    w["usedPercent"] = 100.0
                    w["remainingPercent"] = 0.0
                    w["blockedBy"] = "weekly"
                    w["effectiveRemainingPercent"] = 0.0
                    if weekly_win.get("resetsAt") and (w.get("resetsAt") is None or weekly_win["resetsAt"] > w["resetsAt"]):
                        w["resetsAt"] = weekly_win["resetsAt"]

        cla_win = next((w for w in quota_windows if w["key"] == "claude-weekly"), None)
        if cla_win and cla_win.get("usedPercent", 0) >= 100.0:
            for w in quota_windows:
                if w["key"] == "claude-rolling":
                    w["usedPercent"] = 100.0
                    w["remainingPercent"] = 0.0
                    w["blockedBy"] = "weekly"
                    w["effectiveRemainingPercent"] = 0.0
                    if cla_win.get("resetsAt") and (w.get("resetsAt") is None or cla_win["resetsAt"] > w["resetsAt"]):
                        w["resetsAt"] = cla_win["resetsAt"]

        raw_aggregation = quota_report.get("aggregation")
        aggregation: dict[str, Any] = raw_aggregation if isinstance(raw_aggregation, dict) else {}
        # Aggregated ChatGPT reports put recovery timestamps under aggregation
        # rather than quota; preserve them so the primary 5-hour row explains
        # when the shared pool becomes available again.
        for item in quota_windows:
            if item["resetsAt"] is not None:
                continue
            aggregate_window = aggregation.get(item["key"])
            if isinstance(aggregate_window, dict):
                item["resetsAt"] = int(_number(aggregate_window.get("nextRecoveryAt"))) or None
        prov_name = str(quota_report.get("provider") or "")
        prov_accounts: list[dict[str, Any]] = []
        for account in (account_rows or []):
            if not isinstance(account, dict) or not account.get("id"):
                continue
            acc_prov = str(account.get("provider") or "")
            # Match provider directly, or allow fallback if account has no provider tag (e.g. test fixtures)
            if acc_prov and acc_prov != prov_name:
                continue
            if not acc_prov and prov_name != "openai":
                continue
            f_pct, f_reset, w_pct, w_reset, cw_list, f_blocked = _parse_account_quota(account)
            acc_dict: dict[str, Any] = {
                "id": str(account.get("id") or ""),
                "provider": prov_name,
                "label": str(account.get("label") or account.get("plan") or "账户"),
                "email": str(account.get("email") or ""),
                "plan": str(account.get("plan") or ""),
                "active": bool(account.get("active")),
                "needsReauth": bool(account.get("needsReauth")),
                "weeklyPercent": w_pct,
                "weeklyResetAt": w_reset,
                "fiveHourPercent": f_pct,
                "fiveHourResetAt": f_reset,
                "fiveHourBlockedBy": f_blocked,
            }
            if cw_list:
                acc_dict["customWindows"] = cw_list
            prov_accounts.append(acc_dict)

        # Multi-account pool aggregation across all accounts in the pool:
        # e.g. (100% + 4% + 100%) / 3 = 68% remaining
        included_acc_count = int(_number(aggregation.get("includedAccounts"))) or len(prov_accounts) or None
        if prov_accounts:
            calc_accs = prov_accounts
            included_acc_count = len(calc_accs)

            recalculated_windows: list[dict[str, Any]] = []
            for win in quota_windows:
                wkey = win["key"]
                vals: list[float] = []
                resets: list[int] = []
                for acc in calc_accs:
                    u_val: float | None = None
                    r_val: int | None = None

                    # If an account's weekly quota is exhausted, it contributes 0% available quota to the pool
                    acc_blocked = False
                    if wkey in ("fiveHour", "gemini-rolling", "gem"):
                        if acc.get("fiveHourBlockedBy") == "weekly" or (acc.get("weeklyPercent") is not None and acc.get("weeklyPercent") >= 100.0):
                            acc_blocked = True
                    elif wkey == "claude-rolling":
                        if isinstance(acc.get("customWindows"), list):
                            cw_cla = next((cw for cw in acc["customWindows"] if cw.get("key") == "claude-weekly"), None)
                            if cw_cla and cw_cla.get("usedPercent", 0) >= 100.0:
                                acc_blocked = True

                    if acc_blocked:
                        u_val = 100.0
                        r_val = int(_number(acc.get("weeklyResetAt") or acc.get("fiveHourResetAt"))) or None
                    else:
                        if isinstance(acc.get("customWindows"), list):
                            m = next((cw for cw in acc["customWindows"] if cw.get("key") == wkey), None)
                            if m and m.get("usedPercent") is not None:
                                u_val = float(m["usedPercent"])
                                r_val = int(_number(m.get("resetAt"))) or None
                        if u_val is None:
                            if wkey in ("fiveHour", "claude-rolling"):
                                if acc.get("fiveHourPercent") is not None:
                                    u_val = float(acc["fiveHourPercent"])
                                    r_val = int(_number(acc.get("fiveHourResetAt"))) or None
                            elif wkey in ("weekly", "claude-weekly"):
                                if acc.get("weeklyPercent") is not None:
                                    u_val = float(acc["weeklyPercent"])
                                    r_val = int(_number(acc.get("weeklyResetAt"))) or None
                    if u_val is not None:
                        vals.append(u_val)
                    if r_val:
                        resets.append(r_val)

                if vals:
                    avg_used = round(sum(vals) / len(vals), 1)
                    next_reset = min(resets) if resets else win.get("resetsAt")
                    recalculated_windows.append(
                        {
                            "key": wkey,
                            "label": win["label"],
                            "usedPercent": avg_used,
                            "remainingPercent": round(100.0 - avg_used, 1),
                            "resetsAt": next_reset,
                        }
                    )
                else:
                    recalculated_windows.append(win)

            # Multi-account pool cascading exhaustion check:
            re_weekly = next((w for w in recalculated_windows if w["key"] in ("weekly", "gemini-weekly")), None)
            if re_weekly and re_weekly.get("remainingPercent", 100) <= 0.0:
                for w in recalculated_windows:
                    if w["key"] in ("fiveHour", "gemini-rolling"):
                        w["usedPercent"] = 100.0
                        w["remainingPercent"] = 0.0
                        w["blockedBy"] = "weekly"
                        w["effectiveRemainingPercent"] = 0.0
                        if re_weekly.get("resetsAt"):
                            w["resetsAt"] = re_weekly["resetsAt"]

            re_cla = next((w for w in recalculated_windows if w["key"] == "claude-weekly"), None)
            if re_cla and re_cla.get("remainingPercent", 100) <= 0.0:
                for w in recalculated_windows:
                    if w["key"] == "claude-rolling":
                        w["usedPercent"] = 100.0
                        w["remainingPercent"] = 0.0
                        w["blockedBy"] = "weekly"
                        w["effectiveRemainingPercent"] = 0.0
                        if re_cla.get("resetsAt"):
                            w["resetsAt"] = re_cla["resetsAt"]

            quota_windows = recalculated_windows

        normalized_quotas.append(
            {
                "provider": prov_name or "unknown",
                "label": str(quota_report.get("label") or quota_report.get("provider") or "Unknown"),
                "windows": quota_windows,
                "minimumRemainingPercent": min(item["remainingPercent"] for item in quota_windows),
                "includedAccounts": included_acc_count,
                "aggregationKind": str(aggregation.get("kind") or "pool-active-average"),
                "aggregationIncomplete": bool(aggregation.get("incomplete")),
                "accounts": prov_accounts,
            }
        )
    if not normalized_quotas:
        raise RuntimeError("OpenCodex returned no provider quota")
    weekly_remaining = [
        window["remainingPercent"]
        for provider_quota in normalized_quotas
        for window in provider_quota["windows"]
        if window["key"] == "weekly"
    ]
    return {
        "status": "ok",
        "range": range_key,
        "fetchedAt": int(time.time() * 1000),
        "summary": {
            "requests": int(_number(summary.get("requests"))),
            "totalTokens": int(_number(summary.get("totalTokens"))),
            "inputTokens": int(_number(summary.get("inputTokens"))),
            "outputTokens": int(_number(summary.get("outputTokens"))),
            "cachedInputTokens": int(_number(summary.get("cachedInputTokens"))),
            "reasoningOutputTokens": int(_number(summary.get("reasoningOutputTokens"))),
            "coveragePercent": round(_number(summary.get("coverageRatio")) * 100, 1),
            "estimatedCostUsd": round(_number(summary.get("estimatedCostUsd")), 2),
        },
        "quotas": normalized_quotas,
        "minimumWeeklyRemainingPercent": min(weekly_remaining) if weekly_remaining else None,
        "models": top_models,
        "providers": top_providers,
        "historyTruncated": bool(payload.get("historyTruncated")),
    }


def _cache_file(range_key: str) -> Path:
    if range_key == "7d":
        return _CACHE_FILE
    return _CACHE_FILE.with_name(f"{_CACHE_FILE.stem}-{range_key}{_CACHE_FILE.suffix}")


def _read_disk_cache(range_key: str = "7d") -> dict[str, Any] | None:
    try:
        cached = json.loads(_cache_file(range_key).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return cached if isinstance(cached, dict) and cached.get("status") == "ok" and cached.get("range") == range_key else None


def _write_disk_cache(result: dict[str, Any], range_key: str = "7d") -> None:
    try:
        cache_file = _cache_file(range_key)
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        temporary = cache_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        temporary.chmod(0o600)
        temporary.replace(cache_file)
    except OSError:
        pass


_SNAPSHOT: tuple[float, list[dict[str, Any]], list[dict[str, Any]]] | None = None


def _cached_account_rows() -> list[dict[str, Any]]:
    """Recover normalized account rows from the last successful disk snapshot."""
    cached = _read_disk_cache("7d")
    if not cached:
        return []
    rows: list[dict[str, Any]] = []
    for quota in cached.get("quotas", []):
        if not isinstance(quota, dict):
            continue
        accounts = quota.get("accounts")
        if isinstance(accounts, list):
            rows.extend(account for account in accounts if isinstance(account, dict))
    return rows


def _read_snapshot(force: bool = False) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Provider quota + account rows shared by every range.

    `ocx provider quota --refresh` is the slowest and most intrusive upstream
    call, so it runs at most once per _CACHE_SECONDS no matter which range the
    dashboard asks for; switching 7d/30d/all only re-reads the cheap usage
    report.

    Resilience: when the refreshed run yields FEWER providers than the last
    good snapshot (flaky proxy, one provider timing out), the missing ones are
    back-filled from the previous snapshot so the dashboard never silently
    drops a provider row."""
    global _SNAPSHOT
    now = time.monotonic()
    if not force and _SNAPSHOT is not None and now - _SNAPSHOT[0] < _CACHE_SECONDS:
        return _SNAPSHOT[1], _SNAPSHOT[2]
    # Support callers/mocks that do not accept a `force` keyword argument
    try:
        reports = _read_quota(force=force)
    except TypeError:
        reports = _read_quota()
    try:
        refreshed_accounts = _read_accounts(force=force)
    except TypeError:
        try:
            refreshed_accounts = _read_accounts("openai")
        except Exception:
            refreshed_accounts = None
    if _SNAPSHOT is not None:
        previous = {str(item.get("provider")): item for item in _SNAPSHOT[1] if isinstance(item, dict)}
        current_providers = {str(item.get("provider")) for item in reports if isinstance(item, dict)}
        for provider, item in previous.items():
            if provider not in current_providers:
                reports.append(item)
    # A failed account refresh must not make rows disappear. On a fresh process,
    # recover the normalized rows from disk; a successful empty result remains
    # authoritative and removes accounts that no longer exist.
    if refreshed_accounts is None:
        accounts = list(_SNAPSHOT[2]) if _SNAPSHOT is not None else _cached_account_rows()
    else:
        accounts = list(refreshed_accounts)
    _SNAPSHOT = (now, reports, accounts)
    return reports, accounts


def _current_usage(range_key: str = "7d", force: bool = False) -> dict[str, Any]:
    with _CACHE_LOCK:
        now = time.monotonic()
        cached_entry = _CACHE.get(range_key)
        if not force and cached_entry is not None and now - cached_entry[0] < _CACHE_SECONDS:
            return cached_entry[1]
        try:
            payload = _read_usage(range_key)
            reports, account_rows = _read_snapshot(force=force)
            result = _normalize(payload, reports, account_rows, range_key)
        except RuntimeError:
            cached = cached_entry[1] if cached_entry is not None else _read_disk_cache(range_key)
            if cached is not None:
                stale = dict(cached)
                stale["stale"] = True
                return stale
            raise
        _CACHE[range_key] = (now, result)
        _write_disk_cache(result, range_key)
        return result


@router.get("/usage")
def usage(range_key: str = Query("7d", alias="range"), refresh: bool = Query(False)) -> dict[str, Any]:
    if range_key not in _ALLOWED_RANGES:
        raise HTTPException(status_code=400, detail="Unsupported usage range")
    try:
        return _current_usage(range_key, force=refresh)
    except RuntimeError as exc:
        safe = str(exc)
        allowed = (
            "OpenCodex CLI executable was not found",
            "OpenCodex usage request timed out",
            "OpenCodex usage is temporarily unavailable",
            "OpenCodex returned invalid usage data",
            "OpenCodex returned no usage summary",
            "OpenCodex quota request timed out",
            "OpenCodex quota is temporarily unavailable",
            "OpenCodex returned invalid quota data",
            "OpenCodex returned no quota data",
            "OpenCodex returned no provider quota",
            "OpenCodex account request timed out",
            "OpenCodex account is temporarily unavailable",
            "OpenCodex returned invalid account data",
        )
        detail = safe if safe in allowed else "OpenCodex usage is temporarily unavailable"
        raise HTTPException(status_code=503, detail=detail) from None
