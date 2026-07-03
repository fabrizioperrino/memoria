from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    # Whisper para el simulacro oral — turbo: ~$0.04/hora de audio
    WHISPER_MODEL: str = "whisper-large-v3-turbo"
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str = ""   # opcional — solo para tokens legacy HS256

    # OpenAI — solo para embeddings RAG (text-embedding-3-small)
    # Si no está configurado, el chat usa el documento completo como contexto
    OPENAI_API_KEY: str = ""

    # CORS: lista de orígenes separados por coma.
    # Ej: "http://localhost:3000,https://memoria-app.vercel.app"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
