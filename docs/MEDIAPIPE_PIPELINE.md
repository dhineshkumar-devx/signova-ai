# MediaPipe Landmark Extraction & Preprocessing Pipeline

## 1. Landmark Breakdown (MediaPipe Holistic)

MediaPipe Holistic tracks 543 total 3D spatial points:

| Model Segment | Index Range | Landmark Count | Usage in ISL |
| :--- | :--- | :--- | :--- |
| **Pose** | 0 - 32 | 33 points | Arm movement, shoulder positioning, body posture |
| **Left Hand** | 33 - 53 | 21 points | Fine finger articulation & hand orientation |
| **Right Hand** | 54 - 74 | 21 points | Fine finger articulation & hand orientation |
| **Face Mesh** | 75 - 542 | 468 points | Non-manual signals (mouthing, eyebrow motion, head tilt) |

---

## 2. Spatial Normalization Algorithm

Raw keypoint coordinates $(x, y, z)$ are sensitive to camera distance, subject scaling, and position within the frame. The preprocessing pipeline applies the following transformations:

### Step 1: Center Normalization
Center the origin $(0,0,0)$ at the mid-point of the left and right shoulder landmarks:

$$\mathbf{p}_{\text{chest}} = \frac{\mathbf{p}_{\text{left\_shoulder}} + \mathbf{p}_{\text{right\_shoulder}}}{2}$$

$$\mathbf{p}'_i = \mathbf{p}_i - \mathbf{p}_{\text{chest}}$$

### Step 2: Distance Scaling
Scale coordinates by the shoulder distance $d_{\text{shoulder}} = \|\mathbf{p}_{\text{left\_shoulder}} - \mathbf{p}_{\text{right\_shoulder}}\|_2$:

$$\mathbf{p}''_i = \frac{\mathbf{p}'_i}{d_{\text{shoulder}}}$$

### Step 3: Missing Hand Landmark Handling
When a hand is not detected by MediaPipe (e.g., hidden or out of frame), hand landmarks are initialized to zero vectors and flagged with visibility indicator $v = 0$.

---

## 3. Temporal Resampling & Padding

To uniform sequence lengths for batch processing in PyTorch:
- **Resampling**: Linear interpolation for sequences longer than $T_{\text{target}}$ (e.g., 30 frames).
- **Padding**: Zero-padding or edge-reflection for sequences shorter than $T_{\text{target}}$.
