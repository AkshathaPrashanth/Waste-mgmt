from __future__ import annotations

from collections import defaultdict
from math import cos, radians
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="EcoTrack risk and hotspot service", version="1.0.0")


class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class Complaint(BaseModel):
    id: str
    location: Location
    description: str = ""
    votes: int = 1
    hasImage: bool = False


class ComplaintList(BaseModel):
    complaints: list[Complaint] = Field(default_factory=list)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ecotrack-ml"}


@app.post("/predict-risk")
def predict_risk(report: Complaint) -> dict[str, Any]:
    description = report.description.lower()
    score = 25 + (12 if report.hasImage else 0)
    if report.votes >= 3:
        score += min(25, report.votes * 4)
    if any(word in description for word in ("overflow", "blocked", "hazard", "medical", "construction")):
        score += 35
    elif any(word in description for word in ("pile", "dump", "large", "market")):
        score += 22
    elif any(word in description for word in ("plastic", "litter", "waste", "garbage")):
        score += 12
    score = min(100, score)
    risk = "High" if score >= 65 else "Medium" if score >= 40 else "Low"
    trigger = "Immediate Action Required" if risk == "High" else "Schedule Cleanup" if risk == "Medium" else "Routine Cleanup"
    return {"risk_level": risk, "priority_score": score, "alert_trigger": trigger, "confidence": 0.78}


@app.post("/detect-blackspots")
def detect_blackspots(request: ComplaintList) -> dict[str, list[dict[str, Any]]]:
    groups: dict[tuple[int, int], list[Complaint]] = defaultdict(list)
    for complaint in request.complaints:
        lat_cell = round(complaint.location.lat * 100)
        lng_cell = round(complaint.location.lng * 100 * cos(radians(complaint.location.lat)))
        groups[(lat_cell, lng_cell)].append(complaint)

    clusters = []
    for (lat_cell, lng_cell), members in groups.items():
        if len(members) < 2:
            continue
        clusters.append(
            {
                "id": f"spot-{lat_cell}-{lng_cell}",
                "location": {
                    "lat": sum(item.location.lat for item in members) / len(members),
                    "lng": sum(item.location.lng for item in members) / len(members),
                },
                "complaints_count": len(members),
                "complaint_ids": [item.id for item in members],
                "risk_level": "High" if len(members) >= 3 else "Medium",
            }
        )
    clusters.sort(key=lambda item: item["complaints_count"], reverse=True)
    return {"clusters": clusters}


@app.post("/get-recommendations")
def recommendations(request: ComplaintList) -> dict[str, list[dict[str, Any]]]:
    prioritized = sorted(request.complaints, key=lambda item: (item.votes, item.id), reverse=True)
    return {
        "recommendations": [
            {
                "id": item.id,
                "location": item.location.model_dump(),
                "description": item.description,
                "votes": item.votes,
                "action": "Prioritize cleanup" if item.votes >= 3 else "Monitor and schedule",
            }
            for item in prioritized[:5]
        ]
    }
