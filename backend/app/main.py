from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.routers import datasets, domains, chatbot, auth, feedback
from app.services.dataset_catalog import start_summary_refresh

app = FastAPI(title="Intelligent Data Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(domains.router)
app.include_router(chatbot.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(feedback.router, prefix="/feedback")


@app.get("/")
def root():
    return {"message": "Intelligent Data Hub API running"}


@app.on_event("startup")
def startup_tasks():
    start_summary_refresh()
