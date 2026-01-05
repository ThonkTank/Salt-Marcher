// Ziel: Generische 3D-Vektor-Operationen für Combat-AI und Grid-Systeme
// Siehe: docs/services/combatSimulator/combatantAI.md

/**
 * 3D-Vektor mit x, y, z Komponenten.
 * Kompatibel mit GridPosition und MovementVector.
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Gewichteter Vektor für Attraction/Repulsion-Berechnungen.
 * Magnitude kann positiv (Attraction) oder negativ (Repulsion) sein.
 */
export interface WeightedVector {
  direction: Vector3;
  magnitude: number;
}

/** Berechnet Richtungsvektor von a nach b (nicht normalisiert). */
export function getDirectionVector(from: Vector3, to: Vector3): Vector3 {
  return {
    x: to.x - from.x,
    y: to.y - from.y,
    z: to.z - from.z,
  };
}

/** Berechnet die Länge (Magnitude) eines Vektors. */
export function vectorMagnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Normalisiert einen Vektor auf Einheitslänge. Gibt Nullvektor zurück wenn Magnitude = 0. */
export function normalizeVector(v: Vector3): Vector3 {
  const mag = vectorMagnitude(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: v.x / mag,
    y: v.y / mag,
    z: v.z / mag,
  };
}

/** Skaliert einen Vektor mit einem Skalar. */
export function scaleVector(v: Vector3, scalar: number): Vector3 {
  return {
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar,
  };
}

/** Addiert zwei Vektoren. */
export function addVectors(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

/** Subtrahiert Vektor b von a. */
export function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

/** Berechnet Skalarprodukt (dot product) zweier Vektoren. */
export function dotProduct(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Summiert gewichtete Vektoren zu einem Ergebnis-Vektor.
 * Jeder Vektor wird normalisiert und mit seiner Magnitude skaliert.
 */
export function sumWeightedVectors(vectors: WeightedVector[]): Vector3 {
  let result: Vector3 = { x: 0, y: 0, z: 0 };

  for (const { direction, magnitude } of vectors) {
    const normalized = normalizeVector(direction);
    const scaled = scaleVector(normalized, magnitude);
    result = addVectors(result, scaled);
  }

  return result;
}

/** Erzeugt einen Nullvektor. */
export function zeroVector(): Vector3 {
  return { x: 0, y: 0, z: 0 };
}
