from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.study_plan_service import generate_study_plan, StudyPlan
from core.auth import get_current_user

router = APIRouter(prefix="/study-plan", tags=["study-plan"])


class GeneratePlanRequest(BaseModel):
    exam_date: str        # YYYY-MM-DD
    daily_minutes: int    # minutos disponibles por día


@router.post("/generate", response_model=StudyPlan)
async def generate_plan(body: GeneratePlanRequest, current_user=Depends(get_current_user)):
    """Genera un plan de estudio personalizado hasta la fecha del examen."""
    if body.daily_minutes < 10 or body.daily_minutes > 480:
        raise HTTPException(status_code=400, detail="El tiempo diario debe estar entre 10 y 480 minutos.")

    try:
        plan = generate_study_plan(
            user_id=current_user.id,
            exam_date_str=body.exam_date,
            daily_minutes=body.daily_minutes,
        )
        return plan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando el plan: {str(e)}")
