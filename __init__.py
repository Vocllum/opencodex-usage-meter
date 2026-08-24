"""OpenCodex usage meter plugin package.

The plugin contributes a read-only dashboard API; it does not register agent
tools or hooks.
"""


def register(ctx) -> None:
    """Satisfy the native plugin contract; dashboard routes load separately."""
    return None
