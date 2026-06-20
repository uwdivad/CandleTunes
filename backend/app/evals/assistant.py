import json
import re
import sys
from argparse import ArgumentParser
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AssistantFeedback, AssistantRun
from app.db.engine import SessionLocal
from app.llm import get_provider
from app.llm.base import build_system_prompt
from app.models.assistant import (
    AssistantRequest,
    AssistantResult,
    AssistantSettings,
    ChatMessage,
)

EvalCheck = Literal[
    "message",
    "non_empty_patch",
    "known_track_keys",
    "hex_colors",
    "calm_intent",
    "aggressive_intent",
    "multi_track_separation",
]

DEFAULT_CHECKS: tuple[EvalCheck, ...] = (
    "message",
    "non_empty_patch",
    "known_track_keys",
    "hex_colors",
)

_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


@dataclass(frozen=True)
class AssistantEvalCase:
    name: str
    request: AssistantRequest
    summaries: dict[str, dict]
    checks: tuple[EvalCheck, ...] = DEFAULT_CHECKS
    note: str | None = None


@dataclass(frozen=True)
class AssistantEvalViolation:
    check: EvalCheck
    detail: str


@dataclass(frozen=True)
class AssistantEvalResult:
    case_name: str
    passed: bool
    violations: tuple[AssistantEvalViolation, ...] = field(default_factory=tuple)
    result: AssistantResult | None = None


def evaluate_assistant_result(
    case: AssistantEvalCase, result: AssistantResult
) -> AssistantEvalResult:
    violations: list[AssistantEvalViolation] = []
    settings_dict = result.settings.model_dump(exclude_none=True)
    prompt = " ".join(message.content.lower() for message in case.request.messages)

    if "message" in case.checks:
        message = result.message.strip()
        if not message:
            violations.append(
                AssistantEvalViolation("message", "assistant message is empty")
            )
        elif len(message) > 320:
            violations.append(
                AssistantEvalViolation(
                    "message", f"assistant message is too long ({len(message)} chars)"
                )
            )

    if "non_empty_patch" in case.checks and not settings_dict:
        violations.append(
            AssistantEvalViolation(
                "non_empty_patch", "settings patch did not change any fields"
            )
        )

    if "known_track_keys" in case.checks and result.settings.tracks:
        unknown = sorted(set(result.settings.tracks) - set(case.request.tickers))
        if unknown:
            violations.append(
                AssistantEvalViolation(
                    "known_track_keys",
                    "settings.tracks contains unknown ticker keys: "
                    + ", ".join(unknown),
                )
            )

    if "hex_colors" in case.checks and result.settings.tracks:
        for ticker, track in result.settings.tracks.items():
            if track.color is not None and _HEX_COLOR.fullmatch(track.color) is None:
                violations.append(
                    AssistantEvalViolation(
                        "hex_colors", f"{ticker} color is not #RRGGBB: {track.color}"
                    )
                )

    if "calm_intent" in case.checks and _mentions(prompt, "calm", "soft", "lo-fi", "lofi", "mellow"):
        _check_calm_intent(result.settings, violations)

    if "aggressive_intent" in case.checks and _mentions(
        prompt, "aggressive", "intense", "energetic", "fast", "driving"
    ):
        _check_aggressive_intent(result.settings, violations)

    if "multi_track_separation" in case.checks and len(case.request.tickers) > 1:
        _check_multi_track_separation(result.settings, violations)

    return AssistantEvalResult(
        case_name=case.name,
        passed=not violations,
        violations=tuple(violations),
        result=result,
    )


def run_assistant_eval_case(case: AssistantEvalCase, provider) -> AssistantEvalResult:
    system = build_system_prompt(case.summaries, case.request.current_settings)
    result = provider.complete(system, _recent_messages(case.request.messages))
    return evaluate_assistant_result(case, result)


def load_eval_cases(path: Path) -> list[AssistantEvalCase]:
    cases: list[AssistantEvalCase] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            data = json.loads(stripped)
            cases.append(_case_from_dict(data, line_number))
    return cases


def export_feedback_eval_cases(
    db: Session,
    path: Path,
    rating: Literal["down", "up"] | None = "down",
    limit: int | None = None,
) -> int:
    """Export feedback-linked assistant runs as JSONL eval candidates.

    The export intentionally omits user identifiers and email. It keeps the request
    messages, ticker summary, model output, and feedback note so bad real runs can
    be promoted into curated eval cases.
    """
    query = (
        select(AssistantRun, AssistantFeedback)
        .join(AssistantFeedback, AssistantFeedback.run_id == AssistantRun.id)
        .order_by(AssistantFeedback.created_at.desc())
    )
    if rating is not None:
        query = query.where(AssistantFeedback.rating == rating)
    if limit is not None:
        query = query.limit(limit)

    rows = db.execute(query).all()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for run, feedback in rows:
            handle.write(json.dumps(_run_to_eval_record(run, feedback), sort_keys=True) + "\n")
    return len(rows)


def _mentions(text: str, *needles: str) -> bool:
    return any(needle in text for needle in needles)


def _check_calm_intent(
    settings: AssistantSettings, violations: list[AssistantEvalViolation]
) -> None:
    if settings.bpm is not None and settings.bpm > 95:
        violations.append(
            AssistantEvalViolation("calm_intent", f"calm request returned bpm={settings.bpm}")
        )
    if settings.legato is not None and settings.legato < 0.7:
        violations.append(
            AssistantEvalViolation(
                "calm_intent", f"calm request returned short legato={settings.legato}"
            )
        )
    bright = {"synth_sawtooth", "synth_square"}
    if settings.global_instrument in bright:
        violations.append(
            AssistantEvalViolation(
                "calm_intent",
                f"calm request returned bright global instrument={settings.global_instrument}",
            )
        )


def _check_aggressive_intent(
    settings: AssistantSettings, violations: list[AssistantEvalViolation]
) -> None:
    energetic_fields = [
        settings.bpm is not None and settings.bpm >= 100,
        settings.notes_per_bar == 2,
        settings.chord_mode in {"triad", "power"},
        settings.swing is not None and settings.swing >= 0.1,
    ]
    if not any(energetic_fields):
        violations.append(
            AssistantEvalViolation(
                "aggressive_intent",
                "aggressive request did not adjust tempo, density, harmony, or swing",
            )
        )


def _check_multi_track_separation(
    settings: AssistantSettings, violations: list[AssistantEvalViolation]
) -> None:
    if not settings.tracks or len(settings.tracks) < 2:
        violations.append(
            AssistantEvalViolation(
                "multi_track_separation",
                "multi-ticker request did not include at least two track overrides",
            )
        )
        return

    instruments = {track.instrument for track in settings.tracks.values() if track.instrument}
    registers = {
        track.register_base_midi
        for track in settings.tracks.values()
        if track.register_base_midi is not None
    }
    if len(instruments) < 2 and len(registers) < 2:
        violations.append(
            AssistantEvalViolation(
                "multi_track_separation",
                "track overrides do not create distinct instruments or registers",
            )
        )


def _case_from_dict(data: dict, line_number: int) -> AssistantEvalCase:
    request = AssistantRequest(
        tickers=data["tickers"],
        start=data["start"],
        end=data["end"],
        messages=[ChatMessage(**message) for message in data["messages"]],
        current_settings=(
            AssistantSettings(**data["current_settings"])
            if data.get("current_settings")
            else None
        ),
    )
    return AssistantEvalCase(
        name=data.get("name", f"case-{line_number}"),
        request=request,
        summaries=data.get("summaries", {}),
        checks=tuple(data.get("checks", DEFAULT_CHECKS)),
        note=data.get("note"),
    )


def _run_to_eval_record(run: AssistantRun, feedback: AssistantFeedback) -> dict:
    return {
        "name": f"feedback-{feedback.rating}-{run.id}",
        "source_run_id": run.id,
        "conversation_id": run.conversation_id,
        "provider": run.provider,
        "model": run.model,
        "tickers": run.tickers,
        "start": run.start,
        "end": run.end,
        "messages": run.request_messages,
        "summaries": run.data_summary,
        "actual_result": {
            "message": run.result_message,
            "settings": run.result_settings or {},
            "refusal": run.refusal,
            "error": run.error,
        },
        "feedback": {
            "rating": feedback.rating,
            "note": feedback.note,
            "created_at": feedback.created_at.isoformat(),
        },
        "checks": list(DEFAULT_CHECKS),
    }


def _recent_messages(messages: list[ChatMessage]) -> list[ChatMessage]:
    recent = messages[-8:]
    while recent and recent[0].role != "user":
        recent = recent[1:]
    return recent


def main(argv: list[str] | None = None) -> int:
    parser = ArgumentParser(description="Run or export CandleTunes assistant evals.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="Run live assistant eval cases.")
    run_parser.add_argument(
        "--cases",
        type=Path,
        default=Path("evals/assistant_cases.jsonl"),
        help="JSONL eval case file, relative to backend/ by default.",
    )
    run_parser.add_argument("--provider", default=None, help="LLM provider override.")

    export_parser = subparsers.add_parser(
        "export-feedback", help="Export feedback-linked runs as JSONL eval candidates."
    )
    export_parser.add_argument(
        "--output",
        type=Path,
        default=Path("evals/feedback_cases.jsonl"),
        help="Output JSONL path, relative to backend/ by default.",
    )
    export_parser.add_argument(
        "--rating",
        choices=("down", "up", "all"),
        default="down",
        help="Feedback rating to export.",
    )
    export_parser.add_argument("--limit", type=int, default=None)

    args = parser.parse_args(argv)

    if args.command == "run":
        return _run_cli(args.cases, args.provider)
    if args.command == "export-feedback":
        rating = None if args.rating == "all" else args.rating
        with SessionLocal() as db:
            count = export_feedback_eval_cases(db, args.output, rating=rating, limit=args.limit)
        print(f"Exported {count} feedback eval case(s) to {args.output}")
        return 0

    parser.error(f"Unknown command: {args.command}")
    return 2


def _run_cli(cases_path: Path, provider_name: str | None) -> int:
    cases = load_eval_cases(cases_path)
    provider = get_provider(provider_name)
    failures = 0

    for case in cases:
        result = run_assistant_eval_case(case, provider)
        status = "PASS" if result.passed else "FAIL"
        print(f"{status} {case.name}")
        for violation in result.violations:
            print(f"  - {violation.check}: {violation.detail}")
        if not result.passed:
            failures += 1

    print(f"Ran {len(cases)} eval case(s), {failures} failure(s).")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
