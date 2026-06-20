from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.engine import Base
from app.db.repository import save_feedback, save_run
from app.evals.assistant import (
    AssistantEvalCase,
    evaluate_assistant_result,
    export_feedback_eval_cases,
    load_eval_cases,
)
from app.models.assistant import (
    AssistantRequest,
    AssistantResult,
    AssistantSettings,
    ChatMessage,
    TrackSettings,
)


def _case(checks=("message", "non_empty_patch", "known_track_keys", "hex_colors")):
    return AssistantEvalCase(
        name="unit",
        request=AssistantRequest(
            tickers=["AAPL", "MSFT"],
            start="2024-01-01",
            end="2024-06-01",
            messages=[ChatMessage(role="user", content="make them calm and separate")],
        ),
        summaries={},
        checks=checks,
    )


def test_evaluate_assistant_result_accepts_good_patch():
    result = AssistantResult(
        message="I softened the arrangement and separated the tracks.",
        settings=AssistantSettings(
            bpm=80,
            legato=0.85,
            tracks={
                "AAPL": TrackSettings(instrument="piano", register_base_midi=60, color="#7dd3fc"),
                "MSFT": TrackSettings(
                    instrument="synth_triangle",
                    register_base_midi=48,
                    color="#f472b6",
                ),
            },
        ),
    )

    evaluated = evaluate_assistant_result(
        _case(checks=("message", "non_empty_patch", "known_track_keys", "hex_colors", "calm_intent", "multi_track_separation")),
        result,
    )

    assert evaluated.passed is True
    assert evaluated.violations == ()


def test_evaluate_assistant_result_flags_candletunes_specific_failures():
    result = AssistantResult(
        message="",
        settings=AssistantSettings(
            bpm=140,
            tracks={"GOOG": TrackSettings(color="blue")},
        ),
    )

    evaluated = evaluate_assistant_result(
        _case(checks=("message", "known_track_keys", "hex_colors", "calm_intent")),
        result,
    )

    assert evaluated.passed is False
    assert {violation.check for violation in evaluated.violations} == {
        "message",
        "known_track_keys",
        "hex_colors",
        "calm_intent",
    }


def test_load_eval_cases_reads_seed_jsonl():
    cases = load_eval_cases(Path("evals/assistant_cases.jsonl"))

    assert [case.name for case in cases] == [
        "calm-lofi-single-ticker",
        "aggressive-crypto",
        "separate-two-equities",
    ]
    assert cases[0].request.tickers == ["AAPL"]
    assert "calm_intent" in cases[0].checks


def test_export_feedback_eval_cases_redacts_user_identity(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'evals.db'}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with SessionLocal() as db:
        run = save_run(
            db,
            conversation_id="conversation",
            user_sub="secret-sub",
            user_email="person@example.com",
            provider="openai",
            model="gpt-test",
            tickers=["AAPL"],
            start="2024-01-01",
            end="2024-06-01",
            data_summary={"AAPL": {"trend": "flat"}},
            request_messages=[{"role": "user", "content": "too chaotic"}],
            result_message="I made it brighter.",
            result_settings={"bpm": 160},
            latency_ms=123,
            refusal=False,
        )
        save_feedback(db, run_id=run.id, user_sub="secret-sub", rating="down", note="missed calm intent")

        output = tmp_path / "feedback_cases.jsonl"
        count = export_feedback_eval_cases(db, output)

    exported = output.read_text(encoding="utf-8")
    assert count == 1
    assert "secret-sub" not in exported
    assert "person@example.com" not in exported
    assert "missed calm intent" in exported
    assert "too chaotic" in exported
