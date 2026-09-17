import datetime as dt

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    """One requested site and one future round hour."""

    site_id: str = Field(min_length=1, examples=["SITE001"])
    date: dt.date = Field(examples=["2024-12-31"])
    hour: int = Field(ge=0, le=23, examples=[1])

    def timestamp(self) -> dt.datetime:
        # Receiving an integer hour makes minutes and seconds impossible in the
        # public contract: every request necessarily targets a round hour.
        return dt.datetime.combine(self.date, dt.time(hour=self.hour))


class PredictionResponse(BaseModel):
    site_id: str
    timestamp: dt.datetime
    consumption_kwh: float


class TrainingResponse(BaseModel):
    model_path: str
    training_rows: int
    sites: int
    training_start: dt.datetime
    training_end: dt.datetime
