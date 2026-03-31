from fastapi import APIRouter
from app.services.dataset_explainer import dataset_explanation

router = APIRouter()


@router.post("/dataset/explain")
async def explain_dataset_api(data: dict):

    url = data.get("url")
    title = data.get("title")
    description = data.get("description")

    result = await dataset_explanation(url, title, description)

    return result