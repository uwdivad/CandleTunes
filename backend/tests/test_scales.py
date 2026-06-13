import pytest

from app.sonify.scales import SCALES, build_scale_pitches


@pytest.mark.parametrize("scale_name", list(SCALES.keys()))
@pytest.mark.parametrize("root_note", [0, 5, 11])
def test_build_scale_pitches_within_range(scale_name, root_note):
    base_midi = 60
    range_semitones = 24
    pitches = build_scale_pitches(root_note, scale_name, base_midi, range_semitones)

    assert len(pitches) > 0
    assert pitches == sorted(pitches)
    for p in pitches:
        assert base_midi <= p <= base_midi + range_semitones + 11


def test_build_scale_pitches_chromatic_is_dense():
    pitches = build_scale_pitches(0, "chromatic", 60, 24)
    # chromatic scale should produce roughly one pitch per semitone
    assert len(pitches) >= 24


def test_build_scale_pitches_never_empty_for_small_range():
    pitches = build_scale_pitches(0, "major", 60, 1)
    assert len(pitches) >= 1
