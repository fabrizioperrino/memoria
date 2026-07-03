from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import documents, review, chat, quiz, stats, import_url, exam, study_plan, progress, groups, duels
from settings.config import settings

app = FastAPI(
    title="memorIA API",
    description="Tu compañero de estudio inteligente",
    version="0.2.0",
)

# CORS — orígenes configurables vía variable de entorno ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(import_url.router)
app.include_router(review.router)
app.include_router(chat.router)
app.include_router(quiz.router)
app.include_router(exam.router)
app.include_router(study_plan.router)
app.include_router(stats.router)
app.include_router(progress.router)
app.include_router(groups.router)
app.include_router(duels.router)


@app.get("/")
def root():
    return {"message": "memorIA API", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}
