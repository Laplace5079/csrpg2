/**
 * Bullet Trace System
 * Handles raycasting for bullet trajectories with penetration and damage falloff
 */

import * as THREE from 'three';
import { BulletTraceConfig, HitResult, FalloffCurve, DamageType } from './types';

// Entity interface for hit detection
export interface TraceableEntity {
  id: string;
  position: THREE.Vector3;
  boundingBox: THREE.Box3;
  takeDamage: (damage: number, damageType: DamageType, point: THREE.Vector3) => void;
  isAlive: boolean;
}

export class BulletTrace {
  private scene: THREE.Scene;
  private raycaster: THREE.Raycaster;
  private debugMode: boolean = false;
  private debugLines: THREE.Line[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 1000; // Default max distance
  }

  /**
   * Enable/disable debug visualization
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (!enabled) {
      this.clearDebugLines();
    }
  }

  /**
   * Clear debug visualization lines
   */
  private clearDebugLines(): void {
    this.debugLines.forEach(line => {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.debugLines = [];
  }

  /**
   * Create debug line for bullet trace
   */
  private createDebugLine(origin: THREE.Vector3, end: THREE.Vector3, color: number = 0xff0000): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const material = new THREE.LineBasicMaterial({ 
      color, 
      transparent: true, 
      opacity: 0.5 
    });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.debugLines.push(line);
  }

  /**
   * Perform bullet trace with optional penetration
   */
  trace(config: BulletTraceConfig, entities: TraceableEntity[] = []): HitResult {
    const { origin, direction, maxDistance, damage, damageType, falloff, pierces, radius } = config;

    // Setup raycaster
    this.raycaster.set(origin, direction);
    this.raycaster.far = maxDistance;

    // Find all intersections with scene objects
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // Filter to only include entities if provided
    let filteredIntersects = intersects;
    if (entities.length > 0) {
      // Get bounding boxes of entities
      const entityMeshes = entities.map(e => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        mesh.position.copy(e.position);
        mesh.userData['entity'] = e;
        mesh.geometry.computeBoundingBox();
        if (e.boundingBox) {
          mesh.geometry.boundingBox = e.boundingBox.clone();
        }
        return mesh;
      });
      
      // Re-raycast against entity meshes
      const entityIntersects = this.raycaster.intersectObjects(entityMeshes, false);
      
      // Sort by distance
      entityIntersects.sort((a, b) => a.distance - b.distance);
      
      // Check penetration - limit hits based on pierce count
      let currentDistance = 0;
      let lastHitEntity: TraceableEntity | null = null;
      
      for (const intersect of entityIntersects) {
        if (currentDistance >= maxDistance) break;
        
        const entity = intersect.object.userData['entity'] as TraceableEntity;
        if (!entity || !entity.isAlive || entity === lastHitEntity) continue;
        
        // Calculate damage with falloff
        const finalDamage = this.calculateDamage(damage, falloff, intersect.distance);
        
        // Apply damage to entity
        if (entity.takeDamage) {
          entity.takeDamage(finalDamage, damageType, intersect.point);
        }
        
        lastHitEntity = entity;
        currentDistance += intersect.distance;
        
        // Debug visualization
        if (this.debugMode) {
          this.createDebugLine(origin, intersect.point, 0xff0000);
        }
        
        // If can't pierce, return first hit
        if (pierces <= 0) {
          return {
            hit: true,
            point: intersect.point.clone(),
            normal: intersect.face?.normal.clone(),
            entity,
            damage: finalDamage,
            distance: intersect.distance
          };
        }
      }
      
      // Return result based on entity hits
      if (entityIntersects.length > 0) {
        const firstHit = entityIntersects[0];
        return {
          hit: true,
          point: firstHit.point.clone(),
          normal: firstHit.face?.normal.clone(),
          entity: firstHit.object.userData['entity'],
          damage: this.calculateDamage(damage, falloff, firstHit.distance),
          distance: firstHit.distance
        };
      }
      
      filteredIntersects = intersects.filter(i => !i.object.userData['entity']);
    }

    // Check environment hits (walls, objects)
    if (filteredIntersects.length > 0) {
      const hit = filteredIntersects[0];
      
      // Debug visualization
      if (this.debugMode) {
        this.createDebugLine(origin, hit.point, 0xffff00);
      }
      
      return {
        hit: true,
        point: hit.point.clone(),
        normal: hit.face?.normal.clone(),
        entity: undefined,
        damage: this.calculateDamage(damage, falloff, hit.distance),
        distance: hit.distance
      };
    }

    // No hit - trace to max distance
    const endPoint = origin.clone().addScaledVector(direction, maxDistance);
    
    if (this.debugMode) {
      this.createDebugLine(origin, endPoint, 0x00ff00);
    }

    return {
      hit: false,
      point: endPoint,
      damage: this.calculateDamage(damage, falloff, maxDistance),
      distance: maxDistance
    };
  }

  /**
   * Calculate damage with falloff based on distance
   */
  calculateDamage(baseDamage: number, falloff: FalloffCurve, distance: number): number {
    if (distance <= falloff.startDistance) {
      return baseDamage;
    }
    
    if (distance >= falloff.endDistance) {
      return baseDamage * falloff.minDamagePercent / 100;
    }

    const range = falloff.endDistance - falloff.startDistance;
    const progress = (distance - falloff.startDistance) / range;
    
    switch (falloff.type) {
      case 'linear':
        return baseDamage * (1 - progress * (1 - falloff.minDamagePercent / 100));
      
      case 'exponential':
        return baseDamage * Math.pow(falloff.minDamagePercent / 100, progress);
      
      case 'step':
        return progress < 0.5 ? baseDamage : baseDamage * falloff.minDamagePercent / 100;
      
      default:
        return baseDamage;
    }
  }

  /**
   * Perform multiple traces for shotgun/spread weapons
   */
  traceMultiple(
    config: BulletTraceConfig, 
    spreadDirections: THREE.Vector3[],
    entities: TraceableEntity[] = []
  ): HitResult[] {
    return spreadDirections.map(direction => {
      const singleConfig: BulletTraceConfig = {
        ...config,
        direction: direction.clone().normalize()
      };
      return this.trace(singleConfig, entities);
    });
  }

  /**
   * Get point at distance along ray
   */
  getPointAtDistance(origin: THREE.Vector3, direction: THREE.Vector3, distance: number): THREE.Vector3 {
    return origin.clone().addScaledVector(direction, distance);
  }

  /**
   * Line of sight check
   */
  hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3, entities: TraceableEntity[] = []): boolean {
    const direction = to.clone().sub(from).normalize();
    const distance = from.distanceTo(to);
    
    const result = this.trace({
      origin: from,
      direction,
      maxDistance: distance,
      damage: 0,
      damageType: 'physical',
      falloff: { type: 'linear', startDistance: 0, endDistance: distance, minDamagePercent: 100 },
      pierces: 0,
      radius: 0
    }, entities);
    
    // If we hit something before reaching target, no line of sight
    return !result.hit || result.distance >= distance;
  }

  /**
   * Update scene reference
   */
  setScene(scene: THREE.Scene): void {
    this.clearDebugLines();
    this.scene = scene;
  }
}

/**
 * Tracer effect for bullet trails
 */
export class TracerEffect {
  private scene: THREE.Scene;
  private tracerPool: THREE.Mesh[] = [];
  private activeTracers: THREE.Mesh[] = [];
  private tracerGeometry: THREE.CylinderGeometry;
  private tracerMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, color: number = 0xffff00) {
    this.scene = scene;
    
    // Create reusable geometry (thin cylinder)
    this.tracerGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1, 4);
    this.tracerGeometry.rotateX(Math.PI / 2); // Orient along Z axis
    
    this.tracerMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
  }

  /**
   * Spawn a tracer from origin to target
   */
  spawn(start: THREE.Vector3, end: THREE.Vector3): void {
    let tracer: THREE.Mesh;
    
    // Reuse from pool if available
    if (this.tracerPool.length > 0) {
      tracer = this.tracerPool.pop()!;
    } else {
      tracer = new THREE.Mesh(this.tracerGeometry, this.tracerMaterial.clone());
    }
    
    // Position and scale
    const direction = end.clone().sub(start);
    const length = direction.length();
    
    tracer.position.copy(start).addScaledVector(direction, 0.5);
    tracer.scale.set(1, 1, length);
    tracer.lookAt(end);
    
    this.scene.add(tracer);
    this.activeTracers.push(tracer);
  }

  /**
   * Update and cleanup expired tracers
   */
  update(delta: number): void {
    const lifetime = 0.15; // Tracer lifetime in seconds
    
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const tracer = this.activeTracers[i];
      const material = tracer.material as THREE.MeshBasicMaterial;
      
      // Fade out
      material.opacity -= delta / lifetime;
      
      if (material.opacity <= 0) {
        this.scene.remove(tracer);
        this.tracerPool.push(tracer);
        this.activeTracers.splice(i, 1);
      }
    }
  }

  /**
   * Clear all active tracers
   */
  clear(): void {
    this.activeTracers.forEach(tracer => {
      this.scene.remove(tracer);
      this.tracerPool.push(tracer);
    });
    this.activeTracers = [];
  }

  /**
   * Set tracer color
   */
  setColor(color: number): void {
    this.tracerMaterial.color.setHex(color);
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clear();
    this.tracerGeometry.dispose();
    this.tracerMaterial.dispose();
  }
}
