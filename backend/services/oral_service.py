"""
Simulacro de examen oral: transcripción de la respuesta hablada del estudiante.
Usa Whisper de Groq (turbo) — ~$0.04 por hora de audio.
La corrección la hace exam_service.evaluate_answer (se reutiliza tal cual).
"""
import logging

from groq import Groq
from settings.config import settings

logger = logging.getLogger(__name__)
client = Groq(api_key=settings.GROQ_API_KEY)

# Límite defensivo: 25 MB alcanza para varios minutos de audio comprimido.
MAX_AUDIO_BYTES = 25 * 1024 * 1024


def transcribe_audio(audio_bytes: bytes, filename: str = "answer.webm") -> str:
    """
    Transcribe audio a texto con Whisper. Devuelve el texto plano.
    `filename` solo se usa para que Groq infiera el formato por la extensión.
    """
    response = client.audio.transcriptions.create(
        file=(filename, audio_bytes),
        model=settings.WHISPER_MODEL,
        language="es",
        # Ayuda a Whisper con vocabulario académico y a no "inventar" en silencios
        prompt="Respuesta de un estudiante en un examen oral universitario.",
        temperature=0.0,
    )
    return (response.text or "").strip()
