import logging
import jwt as pyjwt
from jwt import PyJWKClient, PyJWKClientError
from fastapi import Header, HTTPException
from database.supabase_client import supabase
from settings.config import settings

logger = logging.getLogger(__name__)

# Algoritmos asimétricos aceptados (Supabase ECC/RSA)
ASYMMETRIC_ALGS = ["ES256", "ES384", "ES512", "RS256", "RS384", "RS512", "EdDSA"]

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
    return _jwks_client


def _decode_token(token: str) -> dict:
    # Leer el header sin verificar para saber el algoritmo exacto
    try:
        header = pyjwt.get_unverified_header(token)
    except Exception as e:
        raise pyjwt.InvalidTokenError(f"Header inválido: {e}")

    alg = header.get("alg", "")
    logger.debug(f"JWT header: alg={alg}, kid={header.get('kid')}")

    # ── HS256 legacy (shared secret) ─────────────────────────────────────────
    if alg == "HS256":
        if not settings.SUPABASE_JWT_SECRET:
            raise pyjwt.InvalidTokenError("Token HS256 sin secret configurado.")
        return pyjwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )

    # ── Asimétrico via JWKS (ECC P-256, RSA, EdDSA, …) ───────────────────────
    if alg in ASYMMETRIC_ALGS:
        try:
            client = _get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            return pyjwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                options={"verify_aud": False},
            )
        except PyJWKClientError as e:
            raise pyjwt.InvalidTokenError(f"Clave no encontrada en JWKS: {e}")

    raise pyjwt.InvalidTokenError(f"Algoritmo no soportado: {alg}")


async def get_current_user(authorization: str = Header(None)):
    """
    Verifica el JWT de Supabase y devuelve el User autenticado.
    Soporta ECC P-256 (ES256), RSA, EdDSA y HS256 legacy.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Se requiere autenticación.")

    token = authorization.split(" ", 1)[1]

    try:
        payload = _decode_token(token)

        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido: falta sub.")

        response = supabase.auth.admin.get_user_by_id(user_id)
        if not response.user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado.")

        return response.user

    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="La sesión expiró. Iniciá sesión nuevamente.")
    except pyjwt.InvalidTokenError as e:
        logger.warning(f"JWT inválido: {e}")
        raise HTTPException(status_code=401, detail=f"Token inválido: {e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error inesperado en auth: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail="Error de autenticación.")
