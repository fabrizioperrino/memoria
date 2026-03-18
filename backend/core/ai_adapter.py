import json
from groq import Groq
from pydantic import BaseModel
from settings.config import settings


class AIAdapter:
    """
    Adapter para Groq (Llama 3.3 70b) — rápido, gratis y sin quota issues.
    Soporta generación de texto y structured output con Pydantic schemas.
    """

    def __init__(self):
        self.model = settings.GROQ_MODEL
        self.client = Groq(api_key=settings.GROQ_API_KEY)

    def generate_content(self, user_prompt: str, system_prompt: str) -> str:
        """Genera texto libre."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content

    def generate_structured(self, user_prompt: str, system_prompt: str, response_schema: type) -> BaseModel:
        """
        Genera structured output usando JSON mode de Groq.
        Devuelve una instancia del schema Pydantic.
        """
        schema_json = json.dumps(response_schema.model_json_schema(), indent=2)

        enhanced_system = (
            f"{system_prompt}\n\n"
            f"IMPORTANTE: Respondé ÚNICAMENTE con un JSON válido que siga este schema exacto:\n"
            f"{schema_json}\n"
            f"No agregues explicaciones ni texto fuera del JSON."
        )

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": enhanced_system},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        raw = response.choices[0].message.content
        return response_schema.model_validate_json(raw)

    def generate_from_image(self, image_bytes: bytes, mime_type: str, prompt: str, response_schema: type) -> BaseModel:
        """
        Procesa una imagen con Groq Vision (llama-4-scout).
        """
        import base64
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        schema_json = json.dumps(response_schema.model_json_schema(), indent=2)

        system_prompt = (
            "Analizá el contenido de la imagen y generá material de estudio.\n"
            f"Respondé ÚNICAMENTE con un JSON válido que siga este schema:\n{schema_json}"
        )

        response = self.client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",  # modelo con visión
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{image_b64}"},
                        },
                        {"type": "text", "text": prompt},
                    ],
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        raw = response.choices[0].message.content
        return response_schema.model_validate_json(raw)


# Instancia global
ai = AIAdapter()
