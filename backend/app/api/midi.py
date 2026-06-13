from fastapi import APIRouter
from fastapi.responses import Response

from app.models.sonify import MidiExportRequest
from app.sonify.midi_export import notes_to_midi_bytes

router = APIRouter()


@router.post("/midi")
def export_midi(request: MidiExportRequest) -> Response:
    midi_bytes = notes_to_midi_bytes(request.notes, request.tracks)
    return Response(
        content=midi_bytes,
        media_type="audio/midi",
        headers={"Content-Disposition": 'attachment; filename="candlemusic.mid"'},
    )
