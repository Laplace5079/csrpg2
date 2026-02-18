/**
 * Spread System
 * Handles hip-fire and ADS spread with dynamic adjustment
 */

import * as THREE from 'three';
import { SpreadConfig } from './types';

export class SpreadSystem {
  private currentSpread: number = 0;
  private config: SpreadConfig;
  private isCrouching: boolean = false;
  private isSprinting: boolean = false;
  private isAiming: boolean = false;

  constructor(config: SpreadConfig) {
    this.config = {
      base: config.base || 1.0,
      max: config.max || 5.0,
      increasePerShot: config.increasePerShot || 0.3,
      decreasePerSecond: config.decreasePerSecond || 3.0,
      crouchBonus: config.crouchBonus || 0.5,
      sprintPenalty: config.sprintPenalty || 2.0
    };
    this.currentSpread = this.config.base;
  }

  /**
   * Increase spread when firing
   */
  applyFiringSpread(): void {
    this.currentSpread = Math.min(
      this.currentSpread + this.config.increasePerShot,
      this.getEffectiveMax()
    );
  }

  /**
   * Update spread recovery every frame
   * @param delta - Time since last frame in seconds
   */
  update(delta: number): void {
    // Decrease spread over time
    const decreaseAmount = this.config.decreasePerSecond * delta;
    this.currentSpread = Math.max(
      this.currentSpread - decreaseAmount,
      this.getEffectiveBase()
    );
  }

  /**
   * Get the effective base spread considering stance/movement
   */
  getEffectiveBase(): number {
    let base = this.config.base;
    
    // Apply crouch bonus
    if (this.isCrouching) {
      base *= this.config.crouchBonus;
    }
    
    // Apply sprint penalty
    if (this.isSprinting) {
      base *= this.config.sprintPenalty;
    }
    
    return base;
  }

  /**
   * Get the effective max spread considering stance/movement
   */
  getEffectiveMax(): number {
    let max = this.config.max;
    
    // Apply crouch bonus
    if (this.isCrouching) {
      max *= this.config.crouchBonus;
    }
    
    // Apply sprint penalty
    if (this.isSprinting) {
      max *= this.config.sprintPenalty;
    }
    
    return max;
  }

  /**
   * Get the current spread value in degrees
   */
  getCurrentSpread(): number {
    return this.currentSpread;
  }

  /**
   * Get spread as a spread factor (0-1 normalized)
   */
  getSpreadFactor(): number {
    const range = this.getEffectiveMax() - this.getEffectiveBase();
    if (range <= 0) return 0;
    return Math.min((this.currentSpread - this.getEffectiveBase()) / range, 1.0);
  }

  /**
   * Generate a random spread offset in 3D space
   * @param forwardDirection - The forward direction vector
   * @returns A direction vector with spread applied
   */
  getSpreadDirection(forwardDirection: THREE.Vector3): THREE.Vector3 {
    // Convert spread from degrees to radians
    const spreadRad = (this.currentSpread * Math.PI) / 180;
    
    // Generate random angle within spread cone
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * Math.tan(spreadRad);
    
    // Create perpendicular vectors
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forwardDirection, up).normalize();
    
    // If forward is parallel to up, use different basis
    if (right.lengthSq() < 0.001) {
      right.set(1, 0, 0);
    }
    up.crossVectors(right, forwardDirection).normalize();
    
    // Apply spread
    const spreadDir = forwardDirection.clone()
      .addScaledVector(right, radius * Math.cos(angle))
      .addScaledVector(up, radius * Math.sin(angle))
      .normalize();
    
    return spreadDir;
  }

  /**
   * Get 2D screen-space spread offset for crosshair
   * @returns {x, y} in normalized screen coordinates (-1 to 1)
   */
  getScreenSpreadOffset(): { x: number; y: number } {
    // Convert spread to screen space (simplified)
    const spreadFactor = this.getSpreadFactor();
    
    // Random direction
    const angle = Math.random() * Math.PI * 2;
    const radius = spreadFactor * 0.5; // Max 50% screen offset
    
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  }

  /**
   * Set crouching state
   */
  setCrouching(crouching: boolean): void {
    this.isCrouching = crouching;
  }

  /**
   * Set sprinting state
   */
  setSprinting(sprinting: boolean): void {
    this.isSprinting = sprinting;
  }

  /**
   * Set aiming state
   */
  setAiming(aiming: boolean): void {
    this.isAiming = aiming;
  }

  /**
   * Reset spread to base value
   */
  reset(): void {
    this.currentSpread = this.getEffectiveBase();
  }

  /**
   * Update spread configuration
   */
  setConfig(config: Partial<SpreadConfig>): void {
    if (config.base !== undefined) this.config.base = config.base;
    if (config.max !== undefined) this.config.max = config.max;
    if (config.increasePerShot !== undefined) this.config.increasePerShot = config.increasePerShot;
    if (config.decreasePerSecond !== undefined) this.config.decreasePerSecond = config.decreasePerSecond;
    if (config.crouchBonus !== undefined) this.config.crouchBonus = config.crouchBonus;
    if (config.sprintPenalty !== undefined) this.config.sprintPenalty = config.sprintPenalty;
    
    // Clamp current spread to new range
    this.currentSpread = THREE.MathUtils.clamp(
      this.currentSpread,
      this.getEffectiveBase(),
      this.getEffectiveMax()
    );
  }

  /**
   * Get whether player is aiming
   */
  isCurrentlyAiming(): boolean {
    return this.isAiming;
  }
}

/**
 * Factory function to create SpreadSystem from weapon data
 */
export function createSpreadFromWeapon(ads: boolean, hipConfig: SpreadConfig, adsConfig: SpreadConfig): SpreadSystem {
  return new SpreadSystem(ads ? adsConfig : hipConfig);
}

/**
 * Interpolate between hip and ADS spread
 */
export class SpreadInterpolator {
  private hipSpread: SpreadSystem;
  private adsSpread: SpreadSystem;
  private currentSpread: SpreadSystem;
  private transitionSpeed: number = 10;

  constructor(hipConfig: SpreadConfig, adsConfig: SpreadConfig) {
    this.hipSpread = new SpreadSystem(hipConfig);
    this.adsSpread = new SpreadSystem(adsConfig);
    this.currentSpread = this.hipSpread;
  }

  /**
   * Transition between hip and ADS
   */
  setAiming(aiming: boolean, delta: number): void {
    const targetSpread = aiming ? this.adsSpread : this.hipSpread;
    
    if (targetSpread !== this.currentSpread) {
      // Transfer current spread value during transition
      const currentValue = this.currentSpread.getCurrentSpread();
      targetSpread.setConfig({ base: currentValue, max: targetSpread['config'].max });
      this.currentSpread = targetSpread;
    }
    
    // Sync stance states
    this.currentSpread.setAiming(aiming);
  }

  /**
   * Apply firing spread
   */
  applyFiringSpread(): void {
    this.currentSpread.applyFiringSpread();
  }

  /**
   * Update spread
   */
  update(delta: number): void {
    this.hipSpread.update(delta);
    this.adsSpread.update(delta);
  }

  /**
   * Get current spread direction
   */
  getSpreadDirection(forward: THREE.Vector3): THREE.Vector3 {
    return this.currentSpread.getSpreadDirection(forward);
  }

  /**
   * Get screen spread offset
   */
  getScreenSpreadOffset(): { x: number; y: number } {
    return this.currentSpread.getScreenSpreadOffset();
  }

  /**
   * Set crouching
   */
  setCrouching(crouching: boolean): void {
    this.hipSpread.setCrouching(crouching);
    this.adsSpread.setCrouching(crouching);
  }

  /**
   * Set sprinting
   */
  setSprinting(sprinting: boolean): void {
    this.hipSpread.setSprinting(sprinting);
    this.adsSpread.setSprinting(sprinting);
  }

  /**
   * Reset spread
   */
  reset(): void {
    this.hipSpread.reset();
    this.adsSpread.reset();
  }

  /**
   * Get current spread value
   */
  getCurrentSpread(): number {
    return this.currentSpread.getCurrentSpread();
  }
}
