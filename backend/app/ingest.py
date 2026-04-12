"""Utilities for extracting numeric fields from arbitrary payloads."""


def _flatten(obj: object, prefix: str = "") -> dict[str, float]:
    """Recursively walk a JSON object and collect all numeric leaf values."""
    result: dict[str, float] = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            result.update(_flatten(v, key))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            key = f"{prefix}[{i}]"
            result.update(_flatten(v, key))
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        result[prefix] = float(obj)
    return result


def extract_numeric_fields(payload: dict) -> dict[str, float]:
    return _flatten(payload)
