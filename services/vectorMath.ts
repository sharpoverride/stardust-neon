import { Vector3, Vector2 } from '../types';

// Camera Configuration
const FOV = 500; 
const NEAR_CLIP = 1;
const VIEW_DISTANCE = 5000;

// Camera Position (Chase View)
export const CAMERA_POS = { x: 0, y: 8, z: -30 }; // High and back
export const CAMERA_PITCH = 0.2; // Radians, looking slightly down

/**
 * Projects a 3D point into 2D screen space using a camera with position and pitch.
 */
export const projectVector = (v: Vector3, width: number, height: number, _cameraZ: number): Vector2 | null => {
  // 1. Translate to Camera Space
  const rX = v.x - CAMERA_POS.x;
  const rY = v.y - CAMERA_POS.y;
  const rZ = v.z - CAMERA_POS.z; // Use fixed global camera Z for consistency

  // 2. Rotate around X-axis (Pitch)
  // Ry' = y*cos(theta) - z*sin(theta)
  // Rz' = y*sin(theta) + z*cos(theta)
  const cos = Math.cos(CAMERA_PITCH);
  const sin = Math.sin(CAMERA_PITCH);

  const pitchY = rY * cos - rZ * sin;
  const pitchZ = rY * sin + rZ * cos;

  // 3. Clip
  if (pitchZ <= NEAR_CLIP || pitchZ > VIEW_DISTANCE) {
    return null; 
  }

  // 4. Project
  const scale = FOV / pitchZ;
  
  // 5. Screen Transform
  // Invert Y because canvas Y increases downwards
  const x = rX * scale + width / 2;
  const y = -pitchY * scale + height / 2;

  return { x, y };
};

/**
 * Unprojects a 2D normalized screen point (-1 to 1) into 3D world space at a specific Z depth.
 * Used for accurate mouse targeting.
 */
export const unprojectVector = (normX: number, normY: number, targetZ: number, width: number, height: number): Vector3 => {
  const rZ = targetZ - CAMERA_POS.z;
  const cos = Math.cos(CAMERA_PITCH);
  const sin = Math.sin(CAMERA_PITCH);
  const tan = Math.tan(CAMERA_PITCH);

  // Derivation of pitchZ from ScreenY
  // ScreenY_centered = -pitchY * (FOV / pitchZ)
  // pitchY = -(ScreenY_centered / FOV) * pitchZ
  // let slopeY = -(normY * height/2) / FOV
  // pitchY = slopeY * pitchZ
  
  // Rotation Logic Reversal:
  // pitchZ = rY*sin + rZ*cos
  // We substitute rY (derived from pitchY) into this to solve for pitchZ
  
  const sy = normY * (height / 2);
  const slopeY = -sy / FOV; 

  // Solved for pitchZ given fixed Z (rZ) and screen slope Y
  const pitchZ = (rZ * (sin * tan + cos)) / (1 - slopeY * tan);
  
  const scale = FOV / pitchZ;

  // Solve rX
  const sx = normX * (width / 2);
  const rX = sx / scale;

  // Solve rY
  const pitchY = slopeY * pitchZ;
  const rY = pitchY * cos + pitchZ * sin;

  return {
    x: rX + CAMERA_POS.x,
    y: rY + CAMERA_POS.y,
    z: targetZ
  };
};

/**
 * Calculates scale factor based on projected Z depth.
 */
export const getScaleFactor = (z: number, _cameraZ: number): number => {
  const rZ = z - CAMERA_POS.z;
  
  // Approximate depth after pitch for scaling (simplification)
  const pitchZ = (0 - CAMERA_POS.y) * Math.sin(CAMERA_PITCH) + rZ * Math.cos(CAMERA_PITCH);

  if (pitchZ <= NEAR_CLIP) return 0;
  return FOV / pitchZ;
};

export const checkCollision = (a: Vector3, rA: number, b: Vector3, rB: number): boolean => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  const distSq = dx*dx + dy*dy + dz*dz;
  const radSum = rA + rB;
  return distSq < radSum * radSum;
};

// --- Models ---

// A complex, Arwing-inspired heavy fighter.
export const SHIP_MODEL: Vector3[] = [
  { x: 0, y: 0.2, z: 6 }, 
  { x: 1.5, y: 0, z: 1 },
  { x: 4.5, y: -0.5, z: -2 }, 
  { x: 2, y: 0, z: -3 },
  { x: 1.5, y: 0.5, z: -4 }, 
  { x: 1, y: 0, z: -4 },     
  { x: 1.5, y: -0.5, z: -4 }, 
  { x: 0, y: -0.5, z: -3 },
  { x: -1.5, y: -0.5, z: -4 },
  { x: -1, y: 0, z: -4 },
  { x: -1.5, y: 0.5, z: -4 },
  { x: -2, y: 0, z: -3 },
  { x: -4.5, y: -0.5, z: -2 }, 
  { x: -1.5, y: 0, z: 1 },     
  { x: 0, y: 0.2, z: 6 },
  { x: 0, y: 1.5, z: -1 }, 
  { x: 0.5, y: 0.5, z: -3 }, 
  { x: -0.5, y: 0.5, z: -3 }, 
  { x: 0, y: 1.5, z: -1 }, 
  { x: 0, y: 0.2, z: 6 }, 
];

// A vertical-oriented "Razor" interceptor.
export const ENEMY_INTERCEPTOR_MODEL: Vector3[] = [
  { x: 0, y: -1, z: 2 }, 
  { x: 0, y: 1, z: 2 },  
  { x: 0, y: 3, z: -2 }, 
  { x: 0, y: 0.5, z: -3 }, 
  { x: 0, y: -0.5, z: -3 }, 
  { x: 0, y: -3, z: -2 }, 
  { x: 0, y: -1, z: 2 },  
  { x: 2.5, y: 1, z: 0 }, 
  { x: 3, y: 0, z: 1.5 }, 
  { x: 2.5, y: -1, z: 0 }, 
  { x: 0, y: -1, z: 2 },  
  { x: 0, y: 1, z: 2 }, 
  { x: -2.5, y: 1, z: 0 }, 
  { x: -3, y: 0, z: 1.5 }, 
  { x: -2.5, y: -1, z: 0 }, 
  { x: 0, y: -1, z: 2 },  
];

export const CAMERA_Z_OFFSET = -30;