import { ScatteringDataPoint } from '../types';
import { BOHR_SQ_TO_CM2, BOHR_SQ_TO_ANGSTROM2 } from './elsepaPhysicsEngine';

export function validateAngularGrid(min: number, max: number, step: number): string | null {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) {
    return 'Angular grid values must be valid numbers.';
  }
  if (min < 0 || max > 180) {
    return 'Angles must be between 0° and 180°.';
  }
  if (min >= max) {
    return 'Minimum angle must be strictly less than maximum angle.';
  }
  if (step <= 0) {
    return 'Angle step must be strictly greater than 0°.';
  }
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  if (count > 10000) {
    return `Angular grid exceeds the 10,000-point limit (${count.toLocaleString()} points).`;
  }
  return null;
}

export function interpolatePoint(data: ScatteringDataPoint[], theta: number): ScatteringDataPoint {
  const thetaClamped = Math.max(0, Math.min(180, theta));
  const angleRad = (thetaClamped * Math.PI) / 180;

  if (data.length === 0) {
    return {
      angleDeg: thetaClamped,
      angleRad,
      dcsAu: 0,
      dcsCm2: 0,
      dcsAngstrom2: 0,
      shermanS: 0,
      spinT: 0,
      spinU: 0,
      reF: 0,
      imF: 0,
      reG: 0,
      imG: 0,
    };
  }

  if (thetaClamped <= data[0].angleDeg) {
    return { ...data[0], angleDeg: thetaClamped, angleRad };
  }
  if (thetaClamped >= data[data.length - 1].angleDeg) {
    return { ...data[data.length - 1], angleDeg: thetaClamped, angleRad };
  }

  // Binary search for bracket [idx, idx + 1]
  let low = 0;
  let high = data.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (data[mid].angleDeg <= thetaClamped) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const i0 = Math.max(0, high);
  const i1 = Math.min(data.length - 1, i0 + 1);

  const p0 = data[i0];
  const p1 = data[i1];

  if (Math.abs(p0.angleDeg - thetaClamped) < 1e-9) {
    return { ...p0, angleDeg: thetaClamped, angleRad };
  }
  if (Math.abs(p1.angleDeg - thetaClamped) < 1e-9) {
    return { ...p1, angleDeg: thetaClamped, angleRad };
  }

  const dTheta = p1.angleDeg - p0.angleDeg;
  const t = dTheta > 0 ? (thetaClamped - p0.angleDeg) / dTheta : 0;

  // Logarithmic interpolation for DCS
  let dcsAu: number;
  if (p0.dcsAu > 0 && p1.dcsAu > 0) {
    dcsAu = Math.exp((1 - t) * Math.log(p0.dcsAu) + t * Math.log(p1.dcsAu));
  } else {
    dcsAu = (1 - t) * p0.dcsAu + t * p1.dcsAu;
  }

  const shermanS = (1 - t) * p0.shermanS + t * p1.shermanS;
  const spinT = (1 - t) * (isNaN(p0.spinT) ? 0 : p0.spinT) + t * (isNaN(p1.spinT) ? 0 : p1.spinT);
  const spinU = (1 - t) * (isNaN(p0.spinU) ? 0 : p0.spinU) + t * (isNaN(p1.spinU) ? 0 : p1.spinU);

  const reF = (1 - t) * p0.reF + t * p1.reF;
  const imF = (1 - t) * p0.imF + t * p1.imF;
  const reG = (1 - t) * p0.reG + t * p1.reG;
  const imG = (1 - t) * p0.imG + t * p1.imG;

  return {
    angleDeg: thetaClamped,
    angleRad,
    dcsAu,
    dcsCm2: dcsAu * BOHR_SQ_TO_CM2,
    dcsAngstrom2: dcsAu * BOHR_SQ_TO_ANGSTROM2,
    shermanS,
    spinT,
    spinU,
    reF,
    imF,
    reG,
    imG,
  };
}

export function resampleScatteringData(
  data: ScatteringDataPoint[],
  minAngle: number,
  maxAngle: number,
  angleStep: number
): ScatteringDataPoint[] {
  const err = validateAngularGrid(minAngle, maxAngle, angleStep);
  if (err) throw new Error(err);

  const resampled: ScatteringDataPoint[] = [];
  const numSteps = Math.floor((maxAngle - minAngle) / angleStep + 1e-9);

  for (let i = 0; i <= numSteps; i++) {
    const angle = minAngle + i * angleStep;
    const ptAngle = angle > maxAngle ? maxAngle : angle;
    resampled.push(interpolatePoint(data, ptAngle));
  }

  if (Math.abs(resampled[resampled.length - 1].angleDeg - maxAngle) > 1e-6 && resampled[resampled.length - 1].angleDeg < maxAngle) {
    resampled.push(interpolatePoint(data, maxAngle));
  }

  return resampled;
}

export function integratePartialCrossSection(
  data: ScatteringDataPoint[],
  minDeg: number,
  maxDeg: number
): number {
  if (data.length < 2 || minDeg >= maxDeg) return 0;
  const clampMin = Math.max(minDeg, data[0].angleDeg);
  const clampMax = Math.min(maxDeg, data[data.length - 1].angleDeg);
  if (clampMin >= clampMax) return 0;

  const grid: Array<{ angleRad: number; dcsAu: number }> = [];

  // Left boundary
  const startPt = interpolatePoint(data, clampMin);
  grid.push({ angleRad: (clampMin * Math.PI) / 180, dcsAu: startPt.dcsAu });

  // Internal grid points
  for (const pt of data) {
    if (pt.angleDeg > clampMin + 1e-9 && pt.angleDeg < clampMax - 1e-9) {
      grid.push({ angleRad: pt.angleRad, dcsAu: pt.dcsAu });
    }
  }

  // Right boundary
  const endPt = interpolatePoint(data, clampMax);
  grid.push({ angleRad: (clampMax * Math.PI) / 180, dcsAu: endPt.dcsAu });

  let integral = 0;
  for (let i = 0; i < grid.length - 1; i++) {
    const th0 = grid[i].angleRad;
    const th1 = grid[i + 1].angleRad;
    const dth = th1 - th0;
    const y0 = grid[i].dcsAu * Math.sin(th0);
    const y1 = grid[i + 1].dcsAu * Math.sin(th1);
    integral += 0.5 * (y0 + y1) * dth;
  }

  return 2 * Math.PI * integral;
}
