from pydantic import BaseModel


class RecordPayload(BaseModel):
    locationQuery: str
    startDate: str
    endDate: str
    notes: str = ""
