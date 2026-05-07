"""
telemetry_generator.py
-----------------------
Generates physiologically realistic, temporally continuous telemetry readings
for each simulated patient based on their current state machine state.

Vital signs evolve smoothly over time using a bounded random-walk with
state-dependent drift vectors — not independent random samples.
"""

import random
import math
from datetime import datetime, timezone
from typing import Dict, Any

from patient_profiles import (
    PatientProfile,
    STATE_NORMAL,
    STATE_ELEVATED,
    STATE_DETERIORATE,
    STATE_RECOVERY,
    next_state,
)


# ─── State-Dependent Drift Configuration ─────────────────────────────────────
# Each state defines (drift, noise_std) for each vital.
# drift: directional push per tick toward a target
# noise_std: Gaussian noise standard deviation

STATE_PARAMS = {
    STATE_NORMAL: {
        "hr_drift":    0.0,   "hr_noise":   1.5,
        "spo2_drift":  0.0,   "spo2_noise": 0.3,
        "temp_drift":  0.0,   "temp_noise": 0.05,
        "resp_drift":  0.0,   "resp_noise": 0.5,
        "activity": "resting",
    },
    STATE_ELEVATED: {
        "hr_drift":    0.8,   "hr_noise":   2.0,
        "spo2_drift": -0.05,  "spo2_noise": 0.3,
        "temp_drift":  0.02,  "temp_noise": 0.05,
        "resp_drift":  0.3,   "resp_noise": 0.7,
        "activity": "active",
    },
    STATE_DETERIORATE: {
        "hr_drift":    1.5,   "hr_noise":   2.5,
        "spo2_drift": -0.4,   "spo2_noise": 0.5,
        "temp_drift":  0.05,  "temp_noise": 0.08,
        "resp_drift":  0.6,   "resp_noise": 1.0,
        "activity": "distress",
    },
    STATE_RECOVERY: {
        "hr_drift":   -0.6,   "hr_noise":   1.8,
        "spo2_drift":  0.2,   "spo2_noise": 0.3,
        "temp_drift": -0.03,  "temp_noise": 0.06,
        "resp_drift": -0.2,   "resp_noise": 0.6,
        "activity": "recovering",
    },
}

# Absolute physiological bounds
HR_BOUNDS    = (30,  200)
SPO2_BOUNDS  = (70,  100)
TEMP_BOUNDS  = (34.0, 42.0)
RESP_BOUNDS  = (6,   40)


# ─── Per-Patient Running Values ───────────────────────────────────────────────
class PatientVitals:
    """Maintains the current continuous vital-sign state for one patient."""

    def __init__(self, profile: PatientProfile):
        self.profile = profile
        # start at baseline with small noise
        self.hr    = profile.base_hr   + random.gauss(0, 2)
        self.spo2  = profile.base_spo2 + random.gauss(0, 0.5)
        self.temp  = profile.base_temp + random.gauss(0, 0.1)
        self.resp  = profile.base_resp + random.gauss(0, 1)

    def tick(self) -> Dict[str, Any]:
        """
        Advance the patient's state machine by one tick, update vitals
        with drift + noise, and return the telemetry event dict.
        """
        profile = self.profile

        # ── State transition ──────────────────────────────────────────────
        new_state = next_state(profile)
        if new_state != profile.state:
            profile.state = new_state
            profile.state_ticks = 0
        else:
            profile.state_ticks += 1

        params = STATE_PARAMS[profile.state]

        # ── Vital evolution (bounded random walk) ─────────────────────────
        self.hr   = _evolve(self.hr,   params["hr_drift"],   params["hr_noise"],   HR_BOUNDS)
        self.spo2 = _evolve(self.spo2, params["spo2_drift"], params["spo2_noise"], SPO2_BOUNDS)
        self.temp = _evolve(self.temp, params["temp_drift"], params["temp_noise"], TEMP_BOUNDS)
        self.resp = _evolve(self.resp, params["resp_drift"], params["resp_noise"], RESP_BOUNDS)

        # ── Clamp SpO2 against falling below physiologically survivable
        # floor by accelerating recovery when too low
        if self.spo2 < 88 and profile.state != STATE_RECOVERY:
            profile.state = STATE_RECOVERY
            profile.state_ticks = 0

        return {
            "patient_id":       profile.patient_id,
            "timestamp":        datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "heart_rate":       int(round(self.hr)),
            "spo2":             int(round(self.spo2)),
            "temperature":      round(self.temp, 1),
            "respiratory_rate": int(round(self.resp)),
            "activity_level":   params["activity"],
            "patient_state":    profile.state,
        }


def _evolve(value: float, drift: float, noise_std: float, bounds: tuple) -> float:
    """Apply one tick of bounded random walk to a vital sign value."""
    new_val = value + drift + random.gauss(0, noise_std)
    # Soft clamp: reflect off bounds to avoid hard walls
    lo, hi = bounds
    if new_val < lo:
        new_val = lo + abs(new_val - lo) * 0.5
    elif new_val > hi:
        new_val = hi - abs(new_val - hi) * 0.5
    return new_val


# ─── Generator Factory ────────────────────────────────────────────────────────
def create_vitals_tracker(profiles: Dict[str, PatientProfile]) -> Dict[str, PatientVitals]:
    """Create one PatientVitals tracker per profile."""
    return {pid: PatientVitals(p) for pid, p in profiles.items()}
