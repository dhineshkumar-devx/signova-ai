/**
 * One-Euro Filter implementation for 3D Landmark & Bone Rotation Smoothing.
 * Reference: Casiez et al., "1 € Filter: A Simple Speed-based Low-pass Filter for Noisy Input in HCI", CHI 2012.
 */

export class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.y = alpha * value + (1 - alpha) * (this.s ?? value);
    this.s = this.y;
    return this.y;
  }

  hasLastRawValue(): boolean {
    return this.y !== null;
  }

  lastRawValue(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number | null = null;

  constructor(minCutoff: number = 1.0, beta: number = 0.007, dCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  filter(val: number, timestamp: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilter.filter(val, 1.0);
    }

    const dt = Math.max((timestamp - this.lastTime) / 1000.0, 1e-4);
    const rate = 1.0 / dt;
    this.lastTime = timestamp;

    const dx = this.xFilter.hasLastRawValue() ? (val - this.xFilter.lastRawValue()) * rate : 0.0;
    const edx = this.dxFilter.filter(dx, this.alpha(rate, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    return this.xFilter.filter(val, this.alpha(rate, cutoff));
  }

  reset(): void {
    this.lastTime = null;
    this.xFilter.reset();
    this.dxFilter.reset();
  }
}

export class OneEuroFilter3D {
  private xf: OneEuroFilter;
  private yf: OneEuroFilter;
  private zf: OneEuroFilter;

  constructor(minCutoff: number = 1.0, beta: number = 0.007) {
    this.xf = new OneEuroFilter(minCutoff, beta);
    this.yf = new OneEuroFilter(minCutoff, beta);
    this.zf = new OneEuroFilter(minCutoff, beta);
  }

  filter(x: number, y: number, z: number, timestamp: number): [number, number, number] {
    return [
      this.xf.filter(x, timestamp),
      this.yf.filter(y, timestamp),
      this.zf.filter(z, timestamp),
    ];
  }

  reset(): void {
    this.xf.reset();
    this.yf.reset();
    this.zf.reset();
  }
}
