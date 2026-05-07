"""
patient_profiles.py
-------------------
Defines the baseline vitals and behavioral state machine for each simulated patient.
Each patient has a unique physiological baseline and a probabilistic state transition model.
"""

import random
from dataclasses import dataclass, field
from typing import Dict

# ─── Patient State Constants ──────────────────────────────────────────────────
STATE_NORMAL       = "normal"
STATE_ELEVATED     = "elevated"
STATE_DETERIORATE  = "deteriorating"
STATE_RECOVERY     = "recovery"

# ─── Baseline Profiles ────────────────────────────────────────────────────────
@dataclass
class PatientProfile:
    patient_id: str
    name: str
    age: int
    # baseline vitals
    base_hr: float          # beats per minute
    base_spo2: float        # %
    base_temp: float        # Celsius
    base_resp: float        # breaths per minute
    # current state
    state: str = STATE_NORMAL
    state_ticks: int = 0    # how many ticks in current state

    # ── State Transition Probabilities ─────────────────────────────────────
    # Probability of transitioning *out* of current state per tick
    p_normal_to_elevated: float = 0.003
    p_elevated_to_normal: float = 0.02
    p_elevated_to_deteriorate: float = 0.005
    p_deteriorate_to_recovery: float = 0.008
    p_recovery_to_normal: float = 0.03


def build_patient_roster() -> Dict[str, PatientProfile]:
    """Return a dictionary of patient_id → PatientProfile for all simulated patients."""
    patients = [
        PatientProfile("P1001", "Alice Monroe",   67, base_hr=72,  base_spo2=98, base_temp=36.6, base_resp=16),
        PatientProfile("P1002", "Bob Chen",       54, base_hr=78,  base_spo2=97, base_temp=36.8, base_resp=17),
        PatientProfile("P1003", "Carol Rivera",   45, base_hr=65,  base_spo2=99, base_temp=36.5, base_resp=15),
        PatientProfile("P1004", "David Kim",      72, base_hr=80,  base_spo2=96, base_temp=37.0, base_resp=18),
        PatientProfile("P1005", "Emma Patel",     38, base_hr=62,  base_spo2=99, base_temp=36.4, base_resp=14),
        PatientProfile("P1006", "Frank Okafor",   61, base_hr=75,  base_spo2=97, base_temp=36.9, base_resp=17),
        PatientProfile("P1007", "Grace Tanaka",   49, base_hr=70,  base_spo2=98, base_temp=36.7, base_resp=16),
        PatientProfile("P1008", "Henry Volkov",   58, base_hr=82,  base_spo2=96, base_temp=37.1, base_resp=19),
    ]
    return {p.patient_id: p for p in patients}


def next_state(profile: PatientProfile) -> str:
    """Compute the next state for a patient based on transition probabilities."""
    r = random.random()
    current = profile.state

    if current == STATE_NORMAL:
        if r < profile.p_normal_to_elevated:
            return STATE_ELEVATED
    elif current == STATE_ELEVATED:
        if r < profile.p_elevated_to_normal:
            return STATE_NORMAL
        elif r < profile.p_elevated_to_normal + profile.p_elevated_to_deteriorate:
            return STATE_DETERIORATE
    elif current == STATE_DETERIORATE:
        if r < profile.p_deteriorate_to_recovery:
            return STATE_RECOVERY
    elif current == STATE_RECOVERY:
        if r < profile.p_recovery_to_normal:
            return STATE_NORMAL

    return current  # no transition
