
import React, { useEffect, useRef, useCallback } from 'react';
import { Entity, Vector3, Particle, KeyState, MissionData } from '../types';
import { projectVector, unprojectVector, getScaleFactor, SHIP_MODEL, ENEMY_INTERCEPTOR_MODEL, checkCollision, CAMERA_POS } from '../services/vectorMath';

interface GameEngineProps {
  mission: MissionData;
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  onHealthUpdate: (health: number) => void;
  width: number;
  height: number;
  paused: boolean;
}

// System Constants
const BASE_SCROLL_SPEED = 2.5;
const FIRE_RATE = 100; 
const FLOOR_Y = -6; 
const SHIP_LAG = 0.08; // Factor for ship following reticle (Physics weight)
const RETICLE_LAG = 0.15; // Factor for Big Square following Small Dot (HUD weight)
const AIM_DISTANCE = 400; // Aiming plane distance
const SHIP_MARGIN = 5; // World units to keep ship from clipping edge

const GameEngineComponent: React.FC<GameEngineProps> = ({ mission, onGameOver, onScoreUpdate, onHealthUpdate, width, height, paused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  const playerRef = useRef<Entity>({
    id: 'player',
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    type: 'PLAYER',
    active: true,
    color: '#00ffff',
    rotation: 0,
    health: 100,
    scoreValue: 0,
    radius: 3
  });

  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  const lastReportedScoreRef = useRef<number>(0);
  const lastReportedHealthRef = useRef<number>(100);
  const gameTimeRef = useRef<number>(0);
  const keysRef = useRef<KeyState>({});
  const lastFireTimeRef = useRef<number>(0);
  
  // Input State (Normalized -1 to 1) - Represents the "Small Dot"
  const inputRef = useRef({ x: 0, y: 0, active: false });
  // HUD State (Normalized -1 to 1) - Represents the "Big Square"
  const reticleRef = useRef({ x: 0, y: 0 });

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    
    const handleMove = (x: number, y: number) => {
        if (paused) return;
        // Normalize -1 to 1 based on screen center
        const normX = (x - width / 2) / (width / 2);
        const normY = (y - height / 2) / (height / 2);
        inputRef.current = { x: normX, y: normY, active: true };
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };
    const handleTouchStart = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    
    const canvas = canvasRef.current;
    if (canvas) {
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      if (canvas) {
          canvas.removeEventListener('touchstart', handleTouchStart);
          canvas.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, [width, height, paused]);

  // Main Loop
  const animate = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Only update physics if not paused
    if (!paused) {
        gameTimeRef.current += deltaTime;
        update(deltaTime);
    }
    
    // Always render (to show pause state)
    render();

    if (!paused) {
        if (scoreRef.current !== lastReportedScoreRef.current) {
            onScoreUpdate(scoreRef.current);
            lastReportedScoreRef.current = scoreRef.current;
        }
        if (Math.ceil(playerRef.current.health) !== lastReportedHealthRef.current) {
            lastReportedHealthRef.current = Math.ceil(playerRef.current.health);
            onHealthUpdate(lastReportedHealthRef.current);
        }
        
        if (playerRef.current.health > 0) {
            requestRef.current = requestAnimationFrame(animate);
        } else {
            onGameOver(scoreRef.current);
        }
    } else {
        requestRef.current = requestAnimationFrame(animate);
    }

  }, [mission, onGameOver, onScoreUpdate, onHealthUpdate, paused]); 

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  // --- LOGIC ---
  const update = (dt: number) => {
    const player = playerRef.current;

    // 1. Update Reticle Physics (Big Square follows Small Dot)
    reticleRef.current.x += (inputRef.current.x - reticleRef.current.x) * RETICLE_LAG;
    reticleRef.current.y += (inputRef.current.y - reticleRef.current.y) * RETICLE_LAG;
    
    // 2. Ship Movement Logic
    
    // Dynamic Screen Bounds Calculation at Z=0 (Player Depth)
    // Calculate world X at screen edge (normX = 1)
    const rightEdge = unprojectVector(1, 0, 0, width, height).x;
    const xLimit = Math.max(10, rightEdge - SHIP_MARGIN); // Safety clamp
    
    // Calculate world Y at screen top (normY = -1)
    const topEdge = unprojectVector(0, -1, 0, width, height).y;
    // We add margin so ship doesn't disappear off top
    const yMax = topEdge - 3; 

    // Target World Position for ship
    // We use Z=0 so the mouse position maps directly to the ship's plane
    const moveTargetPos = unprojectVector(inputRef.current.x, inputRef.current.y, 0, width, height);

    // Clamp ship target to calculated screen bounds
    const targetX = Math.max(-xLimit, Math.min(xLimit, moveTargetPos.x));
    const targetY = Math.max(FLOOR_Y + 1, Math.min(yMax, moveTargetPos.y));

    // Lerp Ship towards clamped target
    const lerpFactor = SHIP_LAG;
    player.position.x += (targetX - player.position.x) * lerpFactor;
    player.position.y += (targetY - player.position.y) * lerpFactor;
    
    // Bank angle
    player.rotation = (player.position.x - targetX) * 0.06;
    
    // Thrusters
    if (gameTimeRef.current % 30 < 16) {
        spawnThrusterParticle(player.position, player.rotation);
    }

    const scrollSpeed = BASE_SCROLL_SPEED * mission.speedModifier * (dt / 16);

    // Spawning
    if (gameTimeRef.current > 1500 && Math.random() < 0.02 * mission.enemyDensity) {
      spawnEnemy(mission.themeColor);
    }
    
    // Firing
    const isFiring = keysRef.current['Space'] || keysRef.current['Enter'] || true; 
    if (isFiring && timeNow() - lastFireTimeRef.current > FIRE_RATE) {
        // Aiming Logic: Fires EXACTLY towards the 3D point corresponding to the mouse cursor at AIM_DISTANCE
        const aimPos = unprojectVector(inputRef.current.x, inputRef.current.y, AIM_DISTANCE, width, height);
        
        spawnProjectile(player.position, aimPos, true);
        lastFireTimeRef.current = timeNow();
    }

    // Entities
    entitiesRef.current.forEach(ent => {
      if (!ent.active) return;

      if (ent.type === 'PROJECTILE_Player') {
          ent.position.x += ent.velocity.x * (dt/16);
          ent.position.y += ent.velocity.y * (dt/16);
          ent.position.z += ent.velocity.z * (dt/16);
      }
      else if (ent.type === 'PROJECTILE_Enemy') ent.position.z -= 2.0 * (dt/16);
      else if (ent.type.startsWith('ENEMY')) {
        ent.position.z -= scrollSpeed; 
        ent.position.x += Math.sin(ent.position.z * 0.02 + Number(ent.id)) * 0.3;
        // Enemy shoots at player
        if (Math.random() < 0.015 && ent.position.z > 50 && ent.position.z < 300) {
            spawnProjectile(ent.position, player.position, false);
        }
      }

      if (ent.position.z < -40 || ent.position.z > 500) ent.active = false;

      // Collisions
      if (ent.type.startsWith('ENEMY') && ent.active) {
         entitiesRef.current.filter(p => p.type === 'PROJECTILE_Player' && p.active).forEach(proj => {
            if (checkCollision(ent.position, ent.radius, proj.position, proj.radius)) {
              ent.health -= 50;
              proj.active = false;
              spawnExplosion(ent.position, ent.color);
              if (ent.health <= 0) {
                ent.active = false;
                scoreRef.current += ent.scoreValue;
              }
            }
         });
         if (checkCollision(player.position, player.radius, ent.position, ent.radius)) {
           ent.active = false;
           player.health -= 20;
           spawnExplosion(player.position, '#ff0000');
         }
      }
      if (ent.type === 'PROJECTILE_Enemy' && ent.active && checkCollision(player.position, player.radius, ent.position, ent.radius)) {
          ent.active = false;
          player.health -= 10;
          spawnExplosion(player.position, '#ffaa00');
      }
    });

    entitiesRef.current = entitiesRef.current.filter(e => e.active);

    // Particles
    particlesRef.current.forEach(p => {
      p.position.x += p.velocity.x * (dt/16);
      p.position.y += p.velocity.y * (dt/16);
      p.position.z += p.velocity.z * (dt/16);
      p.life -= dt;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const spawnThrusterParticle = (pos: Vector3, rot: number) => {
    [-1, 1].forEach(offset => {
        particlesRef.current.push({
            position: { x: pos.x + offset, y: pos.y, z: pos.z - 2 },
            velocity: { x: (Math.random()-0.5)*0.2, y: (Math.random()-0.5)*0.2, z: -2 },
            life: 200, maxLife: 200, color: '#00ffff'
        });
    });
  };

  const spawnEnemy = (color: string) => {
    entitiesRef.current.push({
      id: Math.random().toString(),
      type: 'ENEMY_Interceptor',
      position: { x: (Math.random() * 80) - 40, y: (Math.random() * 20), z: 400 },
      velocity: { x: 0, y: 0, z: 0 },
      scale: { x: 2.5, y: 2.5, z: 2.5 },
      active: true, color, rotation: 0, health: 50, scoreValue: 100, radius: 4
    });
  };

  const spawnProjectile = (startPos: Vector3, targetPos: Vector3, isPlayer: boolean) => {
    const speed = isPlayer ? 6.0 : 2.0;
    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const dz = targetPos.z - startPos.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    const vel = {
        x: (dx / dist) * speed,
        y: (dy / dist) * speed,
        z: (dz / dist) * speed
    };

    entitiesRef.current.push({
      id: Math.random().toString(),
      type: isPlayer ? 'PROJECTILE_Player' : 'PROJECTILE_Enemy',
      position: { ...startPos, z: startPos.z + (isPlayer ? 5 : -5) },
      velocity: vel,
      scale: { x: 1, y: 1, z: 1 },
      active: true, color: isPlayer ? '#00ffaa' : '#ff5555', rotation: 0, health: 1, scoreValue: 0, radius: 2
    });
  };

  const spawnExplosion = (pos: Vector3, color: string) => {
    for(let i=0; i<15; i++) {
        particlesRef.current.push({
            position: { ...pos },
            velocity: { x: (Math.random()-0.5)*3, y: (Math.random()-0.5)*3, z: (Math.random()-0.5)*3 },
            life: 500, maxLife: 500, color
        });
    }
  };

  // --- RENDERER ---
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Clear
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Horizon Gradient
    const horizonY = height * 0.4; 
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(1, '#110022');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, horizonY);
    ctx.strokeStyle = mission.themeColor;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, horizonY); ctx.lineTo(width, horizonY); ctx.stroke();

    ctx.globalCompositeOperation = 'lighter';

    // Grid
    drawGrid(ctx, mission.themeColor, gameTimeRef.current * 0.1);

    // Stardust
    ctx.fillStyle = '#ffffff';
    for(let i=0; i<60; i++) {
       const x = Math.sin(i * 123.4) * 200;
       const y = Math.cos(i * 567.8) * 100 + 50; 
       const z = (gameTimeRef.current * 0.2 + i * 30) % 500;
       const pt = projectVector({x,y,z: 500 - z}, width, height, 0);
       if(pt) ctx.fillRect(pt.x, pt.y, 2, 2);
    }

    // Entities
    const all = [playerRef.current, ...entitiesRef.current].sort((a,b) => b.position.z - a.position.z);
    all.forEach(ent => { if(ent.active) drawEntity(ctx, ent); });

    // Particles
    particlesRef.current.forEach(p => {
        const pt = projectVector(p.position, width, height, 0);
        if(pt) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI*2); ctx.fill();
        }
    });

    // --- HUD RETICLE (Dual Layer) ---
    drawReticle(ctx);

    ctx.globalAlpha = 1.0;
  };

  const drawReticle = (ctx: CanvasRenderingContext2D) => {
    // 1. Primary "Small Target" (Precise Aim / Mouse)
    const sx = (inputRef.current.x * (width / 2)) + (width / 2);
    const sy = (inputRef.current.y * (height / 2)) + (height / 2);
    
    // Draw Small Dot/Crosshair
    ctx.shadowBlur = 5; ctx.shadowColor = '#00ff00';
    ctx.fillStyle = '#00ff00';
    ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI*2); ctx.fill();
    // Tiny Cross
    ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx-8, sy); ctx.lineTo(sx+8, sy); ctx.moveTo(sx, sy-8); ctx.lineTo(sx, sy+8); ctx.stroke();
    
    // 2. Secondary "Big Square" (Targeting Computer / Lagged)
    // Uses reticleRef which lags behind inputRef
    const bx = (reticleRef.current.x * (width / 2)) + (width / 2);
    const by = (reticleRef.current.y * (height / 2)) + (height / 2);

    // Green Brackets
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 10;
    
    const s = 30; // Size
    const g = 10; // Gap
    
    ctx.beginPath();
    // Top Left
    ctx.moveTo(bx - s, by - s + g); ctx.lineTo(bx - s, by - s); ctx.lineTo(bx - s + g, by - s);
    // Top Right
    ctx.moveTo(bx + s - g, by - s); ctx.lineTo(bx + s, by - s); ctx.lineTo(bx + s, by - s + g);
    // Bottom Right
    ctx.moveTo(bx + s, by + s - g); ctx.lineTo(bx + s, by + s); ctx.lineTo(bx + s - g, by + s);
    // Bottom Left
    ctx.moveTo(bx - s + g, by + s); ctx.lineTo(bx - s, by + s); ctx.lineTo(bx - s, by + s - g);
    ctx.stroke();

    // 3. Laser Sight Connection
    // Connects Ship Nose -> Big Square (Computed Target)
    const noseZ = 200;
    const nosePt = projectVector({ x: playerRef.current.position.x, y: playerRef.current.position.y, z: noseZ }, width, height, 0);

    if (nosePt) {
        // Dotted line connecting nose to reticle 
        ctx.strokeStyle = '#00ff00';
        ctx.setLineDash([4, 8]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nosePt.x, nosePt.y);
        ctx.lineTo(bx, by); // Connect to Brackets
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    ctx.shadowBlur = 0;
  };

  const drawEntity = (ctx: CanvasRenderingContext2D, ent: Entity) => {
    let model = SHIP_MODEL;
    if (ent.type === 'ENEMY_Interceptor') model = ENEMY_INTERCEPTOR_MODEL;
    
    if (ent.type.startsWith('PROJECTILE')) {
        const pt = projectVector(ent.position, width, height, 0);
        const scale = getScaleFactor(ent.position.z, 0);
        if(pt) {
            ctx.shadowBlur = 15; ctx.shadowColor = ent.color; ctx.fillStyle = ent.color;
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 8 * scale * 0.1, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
        }
        return;
    }

    ctx.strokeStyle = ent.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15; ctx.shadowColor = ent.color;
    ctx.beginPath();
    let first = true;
    for(const v of model) {
        const cos = Math.cos(ent.rotation); const sin = Math.sin(ent.rotation);
        const rx = v.x * cos - v.y * sin; const ry = v.x * sin + v.y * cos;
        const worldPos = { x: ent.position.x + rx * ent.scale.x, y: ent.position.y + ry * ent.scale.y, z: ent.position.z + v.z * ent.scale.z };
        const pt = projectVector(worldPos, width, height, 0);
        if (pt) { if (first) { ctx.moveTo(pt.x, pt.y); first = false; } else { ctx.lineTo(pt.x, pt.y); } }
    }
    ctx.closePath(); ctx.stroke();
    // Glassy fill
    ctx.fillStyle = ent.color; ctx.globalAlpha = 0.1; ctx.fill(); ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, color: string, offset: number) => {
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
    for (let x = -200; x <= 200; x += 40) {
        const p1 = projectVector({x, y: FLOOR_Y, z: 0}, width, height, 0);
        const p2 = projectVector({x, y: FLOOR_Y, z: 800}, width, height, 0);
        if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
    }
    const gap = 60; const zOffset = offset % gap;
    for (let z = 0; z < 800; z += gap) {
        const rZ = z - zOffset; if(rZ < 0) continue;
        const p1 = projectVector({x: -200, y: FLOOR_Y, z: rZ}, width, height, 0);
        const p2 = projectVector({x: 200, y: FLOOR_Y, z: rZ}, width, height, 0);
        if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
    }
    ctx.globalAlpha = 1.0;
  };

  const timeNow = () => new Date().getTime();

  return <canvas ref={canvasRef} width={width} height={height} className="block cursor-none touch-none" style={{width: '100%', height: '100%'}} />;
};

export const GameEngine = React.memo(GameEngineComponent);
