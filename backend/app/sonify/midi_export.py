import io

import pretty_midi

from app.logging_config import log_call
from app.models.sonify import NoteEvent, TrackInfo

GM_PROGRAM_MAP: dict[str, int] = {
    "piano": 0,  # Acoustic Grand Piano
    "synth_triangle": 80,  # Lead 1 (square)
    "synth_sine": 89,  # Pad 2 (warm)
    "synth_sawtooth": 82,  # Lead 3 (calliope)
}


@log_call
def notes_to_midi_bytes(notes: list[NoteEvent], tracks: list[TrackInfo]) -> bytes:
    pm = pretty_midi.PrettyMIDI(initial_tempo=120)

    instruments: dict[int, pretty_midi.Instrument] = {}
    for t in tracks:
        program = GM_PROGRAM_MAP.get(t.instrument, 0)
        instruments[t.track] = pretty_midi.Instrument(program=program, name=t.ticker)

    for n in notes:
        instrument = instruments.get(n.track)
        if instrument is None:
            instrument = pretty_midi.Instrument(program=0, name=n.ticker)
            instruments[n.track] = instrument
        instrument.notes.append(
            pretty_midi.Note(
                velocity=n.velocity,
                pitch=n.pitch_midi,
                start=n.time_sec,
                end=n.time_sec + n.duration_sec,
            )
        )

    for instrument in instruments.values():
        pm.instruments.append(instrument)

    buf = io.BytesIO()
    pm.write(buf)
    return buf.getvalue()
