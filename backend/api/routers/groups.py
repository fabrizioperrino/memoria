import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database.supabase_client import supabase
from core.auth import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])

MAX_GROUPS_PER_USER = 10
MAX_MEMBERS_PER_GROUP = 50

# Alfabeto sin caracteres ambiguos (0/O, 1/I/L)
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class CreateGroupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    display_name: str = Field(default="", max_length=80)


class JoinGroupRequest(BaseModel):
    code: str = Field(min_length=4, max_length=12)
    display_name: str = Field(default="", max_length=80)


def _display_name(current_user, provided: str) -> str:
    """Nombre a mostrar en rankings: el provisto, o metadata del usuario, o el email."""
    if provided.strip():
        return provided.strip()
    meta = getattr(current_user, "user_metadata", None) or {}
    name = meta.get("full_name") or meta.get("name")
    if name:
        return str(name)
    email = getattr(current_user, "email", "") or ""
    return email.split("@")[0] or "Estudiante"


def _generate_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


def _get_membership(group_id: str, user_id: str):
    resp = (
        supabase.table("group_members")
        .select("group_id, user_id")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .execute()
    )
    return (resp.data or [None])[0]


@router.post("")
async def create_group(body: CreateGroupRequest, current_user=Depends(get_current_user)):
    """Crea un grupo de estudio y suma al creador como primer miembro."""
    mine = (
        supabase.table("group_members")
        .select("group_id")
        .eq("user_id", current_user.id)
        .execute()
    )
    if len(mine.data or []) >= MAX_GROUPS_PER_USER:
        raise HTTPException(status_code=400, detail=f"Podés estar en hasta {MAX_GROUPS_PER_USER} grupos.")

    # Generar código único (reintenta ante colisión)
    group = None
    for _ in range(5):
        code = _generate_code()
        try:
            resp = supabase.table("groups").insert({
                "name": body.name.strip(),
                "code": code,
                "created_by": current_user.id,
            }).execute()
            group = (resp.data or [None])[0]
            if group:
                break
        except Exception:
            continue
    if not group:
        raise HTTPException(status_code=500, detail="No se pudo crear el grupo.")

    supabase.table("group_members").insert({
        "group_id": group["id"],
        "user_id": current_user.id,
        "display_name": _display_name(current_user, body.display_name),
    }).execute()

    return group


@router.post("/join")
async def join_group(body: JoinGroupRequest, current_user=Depends(get_current_user)):
    """Unirse a un grupo con el código de invitación."""
    resp = (
        supabase.table("groups")
        .select("id, name, code")
        .eq("code", body.code.strip().upper())
        .execute()
    )
    group = (resp.data or [None])[0]
    if not group:
        raise HTTPException(status_code=404, detail="Código inválido. Revisá que esté bien escrito.")

    if _get_membership(group["id"], current_user.id):
        return {**group, "already_member": True}

    members = (
        supabase.table("group_members")
        .select("user_id")
        .eq("group_id", group["id"])
        .execute()
    )
    if len(members.data or []) >= MAX_MEMBERS_PER_GROUP:
        raise HTTPException(status_code=400, detail="El grupo está lleno.")

    supabase.table("group_members").insert({
        "group_id": group["id"],
        "user_id": current_user.id,
        "display_name": _display_name(current_user, body.display_name),
    }).execute()

    return {**group, "already_member": False}


@router.get("")
async def list_my_groups(current_user=Depends(get_current_user)):
    """Grupos del usuario con cantidad de miembros."""
    mine = (
        supabase.table("group_members")
        .select("group_id, joined_at")
        .eq("user_id", current_user.id)
        .execute()
    )
    memberships = mine.data or []
    if not memberships:
        return []

    group_ids = [m["group_id"] for m in memberships]
    groups_resp = (
        supabase.table("groups")
        .select("id, name, code, created_by, created_at")
        .in_("id", group_ids)
        .execute()
    )
    groups = groups_resp.data or []

    counts_resp = (
        supabase.table("group_members")
        .select("group_id")
        .in_("group_id", group_ids)
        .execute()
    )
    counts: dict[str, int] = {}
    for row in counts_resp.data or []:
        counts[row["group_id"]] = counts.get(row["group_id"], 0) + 1

    return [
        {**g, "member_count": counts.get(g["id"], 1), "is_owner": g["created_by"] == current_user.id}
        for g in groups
    ]


@router.get("/{group_id}")
async def get_group(group_id: str, current_user=Depends(get_current_user)):
    """Detalle del grupo con ranking por XP (semanal y total)."""
    if not _get_membership(group_id, current_user.id):
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    group_resp = (
        supabase.table("groups")
        .select("id, name, code, created_by, created_at")
        .eq("id", group_id)
        .single()
        .execute()
    )
    group = group_resp.data
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    members_resp = (
        supabase.table("group_members")
        .select("user_id, display_name, joined_at")
        .eq("group_id", group_id)
        .execute()
    )
    members = members_resp.data or []
    member_ids = [m["user_id"] for m in members]

    # XP de todos los miembros (total y últimos 7 días)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    events_resp = (
        supabase.table("xp_events")
        .select("user_id, amount, created_at")
        .in_("user_id", member_ids)
        .execute()
    )
    totals: dict[str, int] = {}
    weekly: dict[str, int] = {}
    for e in events_resp.data or []:
        uid = e["user_id"]
        totals[uid] = totals.get(uid, 0) + e["amount"]
        if (e.get("created_at") or "") >= week_ago:
            weekly[uid] = weekly.get(uid, 0) + e["amount"]

    ranking = sorted(
        (
            {
                "user_id": m["user_id"],
                "display_name": m.get("display_name") or "Estudiante",
                "xp_week": weekly.get(m["user_id"], 0),
                "xp_total": totals.get(m["user_id"], 0),
                "is_you": m["user_id"] == current_user.id,
            }
            for m in members
        ),
        key=lambda x: (x["xp_week"], x["xp_total"]),
        reverse=True,
    )

    return {
        **group,
        "is_owner": group["created_by"] == current_user.id,
        "member_count": len(members),
        "ranking": ranking,
    }


@router.post("/{group_id}/leave")
async def leave_group(group_id: str, current_user=Depends(get_current_user)):
    """Salir de un grupo. Si queda vacío, se elimina."""
    if not _get_membership(group_id, current_user.id):
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    supabase.table("group_members").delete().eq("group_id", group_id).eq("user_id", current_user.id).execute()

    remaining = (
        supabase.table("group_members")
        .select("user_id")
        .eq("group_id", group_id)
        .execute()
    )
    if not (remaining.data or []):
        supabase.table("groups").delete().eq("id", group_id).execute()

    return {"message": "Saliste del grupo."}
