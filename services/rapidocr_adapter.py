#!/usr/bin/env python3
"""Local-only RapidOCR adapter. JSON is emitted on stdout; OCR text is never logged."""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import importlib.metadata
import io
import json
import sys
import time
from pathlib import Path


def package_version(name: str) -> str:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return "unknown"


def build_engine():
    # RapidOCR prints initialization details. They are intentionally discarded so
    # the Node boundary receives one parseable JSON document and no model paths.
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        from rapidocr import RapidOCR
        return RapidOCR()


def execution_providers(engine) -> dict[str, list[str]]:
    providers = {}
    for key in ("text_det", "text_cls", "text_rec"):
        component = getattr(engine, key, None)
        session_wrapper = getattr(component, "session", None)
        session = getattr(session_wrapper, "session", None)
        getter = getattr(session, "get_providers", None)
        providers[key] = list(getter()) if callable(getter) else []
    return providers


def preflight() -> dict:
    engine = build_engine()
    providers = execution_providers(engine)
    ready = all("CPUExecutionProvider" in values for values in providers.values())
    return {
        "status": "READY" if ready else "DEGRADED",
        "engine": "RapidOCR",
        "engineVersion": package_version("rapidocr"),
        "runtime": "Python",
        "runtimeVersion": sys.version.split()[0],
        "onnxRuntimeVersion": package_version("onnxruntime"),
        "executionProvider": "CPUExecutionProvider" if ready else "UNKNOWN",
        "componentProviders": providers,
        "modelInitialization": "PASS",
    }


def as_list(value):
    if value is None:
        return []
    if hasattr(value, "tolist"):
        return value.tolist()
    return list(value)


def recognize(image_path: Path) -> dict:
    started = time.perf_counter()
    engine = build_engine()
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        output = engine(str(image_path))

    texts = [str(value) for value in as_list(getattr(output, "txts", []))]
    scores = as_list(getattr(output, "scores", []))
    boxes = as_list(getattr(output, "boxes", []))
    regions = []
    for index, text in enumerate(texts):
        regions.append({
            "text": text,
            "confidence": float(scores[index]) if index < len(scores) else None,
            "polygon": boxes[index] if index < len(boxes) else None,
        })

    text = "\n".join(texts)
    input_hash = hashlib.sha256(image_path.read_bytes()).hexdigest()
    result_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    providers = execution_providers(engine)
    ready = all("CPUExecutionProvider" in values for values in providers.values())
    return {
        "status": "SUCCESS" if text else "FAILED",
        "text": text,
        "regions": regions,
        "provider": "rapidocr-local",
        "engine": "RapidOCR",
        "engineVersion": package_version("rapidocr"),
        "runtime": "Python",
        "runtimeVersion": sys.version.split()[0],
        "onnxRuntimeVersion": package_version("onnxruntime"),
        "executionProvider": "CPUExecutionProvider" if ready else "UNKNOWN",
        "componentProviders": providers,
        "latencyMs": round((time.perf_counter() - started) * 1000),
        "regionCount": len(regions),
        "inputHash": input_hash,
        "resultProvenanceHash": result_hash,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--input")
    args = parser.parse_args()
    try:
        if args.preflight:
            payload = preflight()
        else:
            if not args.input:
                raise ValueError("input path is required")
            payload = recognize(Path(args.input))
        sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
        return 0
    except Exception as error:  # Node maps this structured failure; no input text is emitted.
        sys.stdout.write(json.dumps({
            "status": "BLOCKED" if args.preflight else "FAILED",
            "errorType": type(error).__name__,
            "failureReason": str(error)[:500],
        }, ensure_ascii=False, separators=(",", ":")))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
