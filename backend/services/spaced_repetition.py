"""
Algoritmo SM-2 para repaso espaciado.
El mismo que usa Anki internamente.

Rating:  forgot(0) | hard(1) | medium(2) | easy(3)
"""
from datetime import datetime, timedelta
from models.study_models import Flashcard, DifficultyRating

# Mapeo de rating a valor numérico SM-2
RATING_MAP = {
    DifficultyRating.FORGOT: 0,
    DifficultyRating.HARD: 1,
    DifficultyRating.MEDIUM: 3,
    DifficultyRating.EASY: 5,
}


def update_flashcard(card: Flashcard, rating: DifficultyRating) -> Flashcard:
    """
    Aplica el algoritmo SM-2 a una flashcard y devuelve la versión actualizada.
    
    SM-2:
    - Si el rating es < 3 (forgot/hard): reset, volver a repasar mañana
    - Si el rating >= 3: aumentar intervalo según ease_factor
    """
    q = RATING_MAP[rating]

    if q < 3:
        # Respuesta incorrecta: resetear
        card.repetitions = 0
        card.interval = 1
    else:
        # Respuesta correcta
        if card.repetitions == 0:
            card.interval = 1
        elif card.repetitions == 1:
            card.interval = 6
        else:
            card.interval = round(card.interval * card.ease_factor)

        card.repetitions += 1

    # Actualizar ease factor (mínimo 1.3 para no bajar demasiado)
    card.ease_factor = max(1.3, card.ease_factor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

    # Próximo repaso
    card.next_review = datetime.utcnow() + timedelta(days=card.interval)

    return card


def get_cards_due(flashcards: list[Flashcard]) -> list[Flashcard]:
    """Devuelve las flashcards que hay que repasar hoy."""
    now = datetime.utcnow()
    return [
        card for card in flashcards
        if card.next_review is None or card.next_review <= now
    ]
