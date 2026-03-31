from fastapi import APIRouter

from app.services.dataset_catalog import domain_stats, start_summary_refresh

router = APIRouter(prefix="/domains")


@router.get("/")
def get_domains():
    start_summary_refresh()
    return domain_stats()
