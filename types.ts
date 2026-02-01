
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  position: Vector3;
  velocity: Vector3;
  scale: Vector3;
  type: 'PLAYER' | 'ENEMY_Interceptor' | 'ENEMY_Turret' | 'OBSTACLE_Pillar' | 'PROJECTILE_Player' | 'PROJECTILE_Enemy' | 'DEBRIS';
  active: boolean;
  color: string;
  rotation: number; // Z-axis rotation for visuals
  health: number;
  scoreValue: number;
  radius: number; // For collision
}

export interface Particle {
  position: Vector3;
  velocity: Vector3;
  life: number;
  maxLife: number;
  color: string;
}

export interface GameState {
  status: 'MENU' | 'BRIEFING' | 'PLAYING' | 'GAMEOVER' | 'PAUSED';
  score: number;
  wave: number;
  health: number;
  missionData?: MissionData;
}

export interface MissionData {
  title: string;
  briefing: string;
  themeColor: string;
  enemyDensity: number;
  speedModifier: number;
}

export interface KeyState {
  [key: string]: boolean;
}
