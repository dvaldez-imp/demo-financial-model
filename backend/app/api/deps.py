from fastapi import Request

from app.repositories.base import FinancialRepository


def get_repository(request: Request) -> FinancialRepository:
    return request.app.state.repository
