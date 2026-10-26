"""
ISL Manual Alphabet Fingerspelling Keyframe Generator
Generates canonical normalized 3D landmark keyframes for letters A through Z.
Matches exact MediaPipe 21 hand landmarks format and wrist-centered normalization.
"""

import os
import json
import math
from typing import Dict, List, Any

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SIGNS_DIR = os.path.join(PROJECT_ROOT, "sign_library", "signs")
os.makedirs(SIGNS_DIR, exist_ok=True)

# Standard base finger joint vectors in neutral orientation
# 0: Wrist (0, 0, 0)
# 1-4: Thumb, 5-8: Index, 9-12: Middle, 13-16: Ring, 17-20: Pinky

JOINT_NAMES = [
    "wrist",
    "thumb_cmc", "thumb_mcp", "thumb_ip", "thumb_tip",
    "index_mcp", "index_pip", "index_dip", "index_tip",
    "middle_mcp", "middle_pip", "middle_dip", "middle_tip",
    "ring_mcp", "ring_pip", "ring_dip", "ring_tip",
    "pinky_mcp", "pinky_pip", "pinky_dip", "pinky_tip"
]

def create_alphabet_landmarks(letter: str) -> List[Dict[str, Any]]:
    letter = letter.upper()
    
    # Base MCP joint anchors
    wrist = (0.0, 0.0, 0.0)
    t_cmc = (0.16, -0.10, -0.04)
    t_mcp = (0.24, -0.18, -0.06)
    i_mcp = (0.10, -0.34, -0.02)
    m_mcp = (0.01, -0.36, 0.00)
    r_mcp = (-0.08, -0.34, 0.02)
    p_mcp = (-0.16, -0.30, 0.03)

    # Finger extensions: (thumb, index, middle, ring, pinky)
    # 1.0 = fully extended, 0.0 = fully curled
    presets: Dict[str, tuple] = {
        "A": (0.8, 0.1, 0.1, 0.1, 0.1),  # Fist with upright thumb
        "B": (0.2, 1.0, 1.0, 1.0, 1.0),  # Flat palm, thumb tucked
        "C": (0.6, 0.6, 0.6, 0.6, 0.6),  # Curved C cup
        "D": (0.3, 1.0, 0.2, 0.2, 0.2),  # Index up, rest curled
        "E": (0.2, 0.2, 0.2, 0.2, 0.2),  # Tight fist, fingers curled over thumb
        "F": (0.3, 0.2, 1.0, 1.0, 1.0),  # Index touches thumb, 3 fingers up
        "G": (0.7, 0.8, 0.1, 0.1, 0.1),  # Index pointing horizontal, thumb parallel
        "H": (0.4, 0.9, 0.9, 0.1, 0.1),  # Index & middle horizontal, rest curled
        "I": (0.2, 0.1, 0.1, 0.1, 1.0),  # Pinky upright, rest closed
        "J": (0.2, 0.1, 0.1, 0.1, 0.9),  # Pinky upright with slight curve
        "K": (0.6, 1.0, 0.9, 0.1, 0.1),  # V-sign with thumb between
        "L": (1.0, 1.0, 0.1, 0.1, 0.1),  # L-shape: thumb & index 90 deg
        "M": (0.2, 0.2, 0.2, 0.1, 0.1),  # Thumb tucked under 3 fingers
        "N": (0.2, 0.2, 0.2, 0.1, 0.1),  # Thumb tucked under 2 fingers
        "O": (0.5, 0.5, 0.5, 0.5, 0.5),  # O-ring shape
        "P": (0.6, 0.9, 0.8, 0.1, 0.1),  # K-shape pointed downward
        "Q": (0.7, 0.7, 0.1, 0.1, 0.1),  # G-shape pointed downward
        "R": (0.2, 1.0, 0.95, 0.1, 0.1), # Index & middle crossed
        "S": (0.2, 0.1, 0.1, 0.1, 0.1),  # Fist with thumb wrapped over fingers
        "T": (0.4, 0.2, 0.1, 0.1, 0.1),  # Thumb between index and middle
        "U": (0.2, 0.95, 0.95, 0.1, 0.1),# Index & middle held tight together
        "V": (0.2, 1.0, 1.0, 0.1, 0.1),  # Peace / V-shape separated
        "W": (0.2, 1.0, 1.0, 1.0, 0.1),  # Three fingers up (Index, Middle, Ring)
        "X": (0.2, 0.5, 0.1, 0.1, 0.1),  # Index hooked / bent
        "Y": (1.0, 0.1, 0.1, 0.1, 1.0),  # Shaka: Thumb and Pinky out
        "Z": (0.2, 0.9, 0.1, 0.1, 0.1),  # Index tracing Z in air
    }

    thumb_ext, idx_ext, mid_ext, ring_ext, pnk_ext = presets.get(letter, (0.5, 0.5, 0.5, 0.5, 0.5))

    def make_finger(mcp, ext, seg_len, spread_x=0.0):
        # When ext = 1.0: straight up (-y direction)
        # When ext = 0.0: curled inward (+z and slightly +y)
        pip_y = mcp[1] - seg_len * 0.9 * ext + (1.0 - ext) * seg_len * 0.3
        pip_z = mcp[2] - (1.0 - ext) * seg_len * 0.6
        pip_x = mcp[0] + spread_x * 0.3

        dip_y = pip_y - seg_len * 0.8 * ext + (1.0 - ext) * seg_len * 0.4
        dip_z = pip_z - (1.0 - ext) * seg_len * 0.7
        dip_x = pip_x + spread_x * 0.6

        tip_y = dip_y - seg_len * 0.7 * ext + (1.0 - ext) * seg_len * 0.5
        tip_z = dip_z - (1.0 - ext) * seg_len * 0.8
        tip_x = dip_x + spread_x * 0.8

        return (pip_x, pip_y, pip_z), (dip_x, dip_y, dip_z), (tip_x, dip_y, tip_z)

    # Thumb geometry
    t_ip = (
        t_mcp[0] + 0.10 * thumb_ext - (1.0 - thumb_ext) * 0.06,
        t_mcp[1] - 0.12 * thumb_ext,
        t_mcp[2] + 0.04 * (1.0 - thumb_ext)
    )
    t_tip = (
        t_ip[0] + 0.08 * thumb_ext - (1.0 - thumb_ext) * 0.08,
        t_ip[1] - 0.10 * thumb_ext,
        t_ip[2] + 0.06 * (1.0 - thumb_ext)
    )

    i_pip, i_dip, i_tip = make_finger(i_mcp, idx_ext, 0.16, spread_x=0.02)
    m_pip, m_dip, m_tip = make_finger(m_mcp, mid_ext, 0.17, spread_x=0.00)
    r_pip, r_dip, r_tip = make_finger(r_mcp, ring_ext, 0.16, spread_x=-0.02)
    p_pip, p_dip, p_tip = make_finger(p_mcp, pnk_ext, 0.14, spread_x=-0.04)

    raw_joints = [
        wrist,
        t_cmc, t_mcp, t_ip, t_tip,
        i_mcp, i_pip, i_dip, i_tip,
        m_mcp, m_pip, m_dip, m_tip,
        r_mcp, r_pip, r_dip, r_tip,
        p_mcp, p_pip, p_dip, p_tip,
    ]

    # Normalize: maximum distance from wrist = 1.0
    max_d = max(math.sqrt(x*x + y*y + z*z) for x, y, z in raw_joints)
    scale = 1.0 / max_d if max_d > 0 else 1.0

    landmarks = []
    for idx, (x, y, z) in enumerate(raw_joints):
        landmarks.append({
            "index": idx,
            "name": JOINT_NAMES[idx],
            "x": round(x * scale, 6),
            "y": round(y * scale, 6),
            "z": round(z * scale, 6),
            "std": 0.025
        })

    return landmarks

def generate_all_fingerspelling_keyframes():
    generated_count = 0
    for char_code in range(ord('A'), ord('Z') + 1):
        letter = chr(char_code)
        sign_name = f"FS_{letter}"
        lms = create_alphabet_landmarks(letter)

        payload = {
            "sign_name": sign_name,
            "type": "fingerspelling",
            "letter": letter,
            "version": "1.0",
            "category": "Fingerspelling",
            "hand_type": "right",
            "description": f"ISL Manual Alphabet Letter {letter}",
            "sample_count": 1,
            "normalized_landmarks": lms,
            "finger_extensions": {
                "thumb": bool(letter in "ALMPQ"),
                "index": bool(letter in "BDFGHKLPRUVXYZ"),
                "middle": bool(letter in "BCFHKMPRUVW"),
                "ring": bool(letter in "BCFW"),
                "pinky": bool(letter in "BCFIJWY")
            }
        }

        target_file = os.path.join(SIGNS_DIR, f"{sign_name}.json")
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        generated_count += 1

    print(f"[OK] Successfully generated all {generated_count} manual alphabet fingerspelling keyframes (FS_A to FS_Z).")

if __name__ == "__main__":
    generate_all_fingerspelling_keyframes()
