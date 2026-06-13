from app.logging_config import log_call

SCALES: dict[str, list[int]] = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "pentatonic_major": [0, 2, 4, 7, 9],
    "pentatonic_minor": [0, 3, 5, 7, 10],
    "chromatic": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}


@log_call
def build_scale_pitches(
    root_note: int, scale_name: str, base_midi: int, range_semitones: int
) -> list[int]:
    """Build a sorted list of MIDI pitches for `scale_name`/`root_note`, spanning
    [base_midi, base_midi + range_semitones]. Always returns at least one pitch."""
    intervals = SCALES[scale_name]
    pitches: list[int] = []
    octave_offset = 0
    ceiling = base_midi + range_semitones

    while True:
        added = False
        for interval in intervals:
            pitch = base_midi + root_note + interval + octave_offset
            if pitch > ceiling:
                if pitches:
                    return pitches
                return [base_midi + root_note]
            pitches.append(pitch)
            added = True
        if not added:
            return [base_midi + root_note]
        octave_offset += 12
