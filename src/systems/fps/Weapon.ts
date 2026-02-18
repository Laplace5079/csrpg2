/**
 * Weapon System
 * Core weapon class with firing, reloading, and recoil handling
 */

import * as THREE from 'three';
import { WeaponData, WeaponState, HitResult, DamageType } from './types';
import { RecoilSystem, createRecoilFromWeapon } from './Recoil';
import { SpreadInterpolator, SpreadConfig } from './Spread';
import { BulletTrace, TracerEffect, TraceableEntity } from './BulletTrace';

// Event types for weapon actions
export type WeaponEventType = 
  | 'fire'
  | 'reload_start'
  | 'reload_complete'
  | 'empty'
  | 'firemode_change'
  | 'weapon_switch';

export interface WeaponEvent {
  type: WeaponEventType;
  weapon: Weapon;
  data?: Record<string, unknown>;
}

export type WeaponEventCallback = (event: WeaponEvent) => void;

export class Weapon {
  // Weapon data
  public readonly data: WeaponData;
  
  // State
  public state: WeaponState;
  
  // Systems
  private recoilSystem: RecoilSystem;
  private spreadSystem: SpreadInterpolator;
  private bulletTrace: BulletTrace;
  private tracerEffect: TracerEffect;
  
  // Timing
  private fireCooldown: number = 0;
  private lastFireTime: number = 0;
  private burstShotsRemaining: number = 0;
  
  // Callbacks
  private eventCallbacks: WeaponEventCallback[] = [];

  constructor(data: WeaponData, scene: THREE.Scene) {
    this.data = data;
    
    // Initialize state
    this.state = {
      id: data.id,
      currentAmmo: data.magSize,
      magAmmo: data.magSize,
      totalAmmo: data.totalAmmo,
      isReloading: false,
      isFiring: false,
      lastFireTime: 0,
      reloadStartTime: 0,
      burstCount: 0,
      spread: 0,
      recoilOffset: { x: 0, y: 0 }
    };

    // Calculate fire cooldown from RPM
    this.fireCooldown = 60000 / data.fireRate; // RPM to ms

    // Initialize systems
    this.recoilSystem = createRecoilFromWeapon(
      data.verticalRecoil,
      data.horizontalRecoil,
      data.recoilRecovery
    );

    this.spreadSystem = new SpreadInterpolator(data.hipSpread, data.adsSpread);

    this.bulletTrace = new BulletTrace(scene);
    this.tracerEffect = new TracerEffect(scene, this.parseTracerColor(data.tracerColor));
  }

  /**
   * Subscribe to weapon events
   */
  onEvent(callback: WeaponEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Emit event to all subscribers
   */
  private emit(type: WeaponEventType, data?: Record<string, unknown>): void {
    const event: WeaponEvent = { type, weapon: this, data };
    this.eventCallbacks.forEach(cb => cb(event));
  }

  /**
   * Start firing
   */
  startFiring(): void {
    if (this.state.isReloading) return;
    this.state.isFiring = true;
    
    if (this.data.fireMode === 'burst') {
      this.burstShotsRemaining = this.data.burstCount;
    }
  }

  /**
   * Stop firing
   */
  stopFiring(): void {
    this.state.isFiring = false;
    this.burstShotsRemaining = 0;
  }

  /**
   * Attempt to fire the weapon
   * @param origin - Bullet origin position
   * @param direction - Firing direction
   * @param entities - Optional entities to hit
   * @returns Hit result or null if couldn't fire
   */
  fire(origin: THREE.Vector3, direction: THREE.Vector3, entities: TraceableEntity[] = []): HitResult | null {
    const now = performance.now();
    
    // Check if can fire
    if (!this.canFire()) {
      if (this.state.currentAmmo <= 0) {
        this.emit('empty');
      }
      return null;
    }

    // Check fire rate cooldown
    if (now - this.lastFireTime < this.fireCooldown) {
      return null;
    }

    // Handle burst mode
    if (this.data.fireMode === 'burst') {
      if (this.burstShotsRemaining <= 0) {
        return null;
      }
      this.burstShotsRemaining--;
    }

    // Consume ammo
    this.state.currentAmmo--;
    this.lastFireTime = now;

    // Apply recoil
    this.recoilSystem.applyRecoil(null as unknown as THREE.Camera);

    // Apply spread
    const spreadDirection = this.spreadSystem.getSpreadDirection(direction);
    
    // Create bullet trace config
    const traceConfig = {
      origin: origin.clone(),
      direction: spreadDirection,
      maxDistance: this.data.maxRange,
      damage: this.data.damage,
      damageType: this.data.damageType,
      falloff: this.data.damageFalloff,
      pierces: this.getPierceCount(),
      radius: 0.1
    };

    // Perform trace
    const hitResult = this.bulletTrace.trace(traceConfig, entities);

    // Spawn tracer effect
    const tracerEnd = hitResult.point || origin.clone().addScaledVector(spreadDirection, this.data.maxRange);
    this.tracerEffect.spawn(origin, tracerEnd);

    // Apply firing spread
    this.spreadSystem.applyFiringSpread();

    // Emit fire event
    this.emit('fire', { hitResult });

    return hitResult;
  }

  /**
   * Check if weapon can fire
   */
  private canFire(): boolean {
    return (
      !this.state.isReloading &&
      this.state.currentAmmo > 0 &&
      (this.data.fireMode !== 'burst' || this.burstShotsRemaining > 0)
    );
  }

  /**
   * Get pierce count based on weapon type
   */
  private getPierceCount(): number {
    switch (this.data.type) {
      case 'sniper':
      case 'lmg':
        return 2;
      case 'rifle':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Start reload
   */
  reload(): boolean {
    if (this.state.isReloading) return false;
    if (this.state.currentAmmo >= this.data.magSize) return false;
    if (this.state.totalAmmo <= 0) return false;

    this.state.isReloading = true;
    this.state.reloadStartTime = performance.now();
    this.emit('reload_start');

    // Schedule reload completion
    setTimeout(() => {
      this.completeReload();
    }, this.data.reloadTime);

    return true;
  }

  /**
   * Complete reload
   */
  private completeReload(): void {
    const needed = this.data.magSize - this.state.currentAmmo;
    const available = Math.min(needed, this.state.totalAmmo);

    this.state.totalAmmo -= available;
    this.state.currentAmmo += available;
    this.state.isReloading = false;

    this.emit('reload_complete');
  }

  /**
   * Cancel reload (e.g., when switching weapons)
   */
  cancelReload(): void {
    if (this.state.isReloading) {
      this.state.isReloading = false;
    }
  }

  /**
   * Update weapon systems
   * @param camera - Player camera for recoil application
   * @param delta - Time since last frame in seconds
   */
  update(camera: THREE.Camera, delta: number): void {
    // Update recoil
    this.recoilSystem.update(camera as THREE.Camera, delta);
    
    // Update spread
    this.spreadSystem.update(delta);
    
    // Update tracers
    this.tracerEffect.update(delta);

    // Update state spread value
    this.state.spread = this.spreadSystem.getCurrentSpread();
    
    // Update recoil offset for weapon model
    const recoilOffset = this.recoilSystem.getRawOffset();
    this.state.recoilOffset = { x: recoilOffset.x, y: recoilOffset.y };
  }

  /**
   * Set aiming state
   */
  setAiming(aiming: boolean, delta: number = 0): void {
    this.spreadSystem.setAiming(aiming, delta);
  }

  /**
   * Set crouching state
   */
  setCrouching(crouching: boolean): void {
    this.spreadSystem.setCrouching(crouching);
  }

  /**
   * Set sprinting state
   */
  setSprinting(sprinting: boolean): void {
    this.spreadSystem.setSprinting(sprinting);
  }

  /**
   * Add ammo to weapon
   */
  addAmmo(amount: number): void {
    this.state.totalAmmo += amount;
  }

  /**
   * Get reload progress (0-1)
   */
  getReloadProgress(): number {
    if (!this.state.isReloading) return 1;
    
    const elapsed = performance.now() - this.state.reloadStartTime;
    return Math.min(elapsed / this.data.reloadTime, 1);
  }

  /**
   * Get reload time remaining in seconds
   */
  getReloadTimeRemaining(): number {
    if (!this.state.isReloading) return 0;
    
    const elapsed = performance.now() - this.state.reloadStartTime;
    return Math.max(0, (this.data.reloadTime - elapsed) / 1000);
  }

  /**
   * Get effective fire rate considering current state
   */
  getEffectiveFireRate(): number {
    return this.data.fireRate;
  }

  /**
   * Check if weapon is ready to fire
   */
  isReadyToFire(): boolean {
    return (
      !this.state.isReloading &&
      this.state.currentAmmo > 0 &&
      performance.now() - this.lastFireTime >= this.fireCooldown
    );
  }

  /**
   * Reset weapon state (e.g., on weapon switch)
   */
  reset(): void {
    this.stopFiring();
    this.cancelReload();
    this.recoilSystem.reset();
    this.spreadSystem.reset();
  }

  /**
   * Get weapon display name
   */
  getName(): string {
    return this.data.name;
  }

  /**
   * Get weapon type
   */
  getType(): string {
    return this.data.type;
  }

  /**
   * Parse tracer color from string
   */
  private parseTracerColor(colorStr: string): number {
    if (colorStr.startsWith('#')) {
      return parseInt(colorStr.slice(1), 16);
    }
    // Default yellow
    return 0xffff00;
  }

  /**
   * Enable/disable bullet trace debug
   */
  setTraceDebug(enabled: boolean): void {
    this.bulletTrace.setDebugMode(enabled);
  }

  /**
   * Dispose weapon resources
   */
  dispose(): void {
    this.eventCallbacks = [];
    this.tracerEffect.dispose();
  }
}

/**
 * Factory function to create weapon from data
 */
export function createWeapon(data: WeaponData, scene: THREE.Scene): Weapon {
  return new Weapon(data, scene);
}
