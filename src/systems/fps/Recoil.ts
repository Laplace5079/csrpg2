/**
 * Recoil System
 * Handles weapon recoil with predefined patterns
 */

import * as THREE from 'three';
import { RecoilConfig } from './types';

export class RecoilSystem {
  private currentRecoil: THREE.Vector2 = new THREE.Vector2(0, 0);
  private targetRecoil: THREE.Vector2 = new THREE.Vector2(0, 0);
  private shotIndex: number = 0;
  private isRecovering: boolean = false;
  private recoveryDelay: number = 0;
  private config: RecoilConfig;

  constructor(config: RecoilConfig) {
    this.config = {
      vertical: config.vertical || [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.4, 1.3],
      horizontal: config.horizontal || [-0.3, 0.3, -0.4, 0.4, -0.5, 0.5, -0.4, 0.4],
      recoverySpeed: config.recoverySpeed || 8,
      recoveryDelay: config.recoveryDelay || 0.1,
      kickMultiplier: config.kickMultiplier || 1.0
    };
  }

  /**
   * Apply recoil for a single shot
   * @param camera - The camera to apply recoil to
   */
  applyRecoil(camera: THREE.Camera): void {
    // Get recoil values based on shot index (loops through pattern)
    const vRecoil = this.config.vertical[this.shotIndex % this.config.vertical.length];
    const hRecoil = this.config.horizontal[this.shotIndex % this.config.horizontal.length];

    // Apply to target (additive)
    this.targetRecoil.x += vRecoil * this.config.kickMultiplier * 0.1;
    this.targetRecoil.y += hRecoil * this.config.kickMultiplier * 0.05;

    // Reset recovery state
    this.isRecovering = false;
    this.recoveryDelay = this.config.recoveryDelay;

    // Increment shot index
    this.shotIndex++;
  }

  /**
   * Update recoil recovery every frame
   * @param camera - The camera to update
   * @param delta - Time since last frame in seconds
   */
  update(camera: THREE.Camera, delta: number): void {
    // Handle recovery delay
    if (!this.isRecovering && this.recoveryDelay > 0) {
      this.recoveryDelay -= delta;
      if (this.recoveryDelay <= 0) {
        this.isRecovering = true;
      }
      return;
    }

    // Recovery interpolation
    const recoverySpeed = this.config.recoverySpeed * delta;
    
    // Lerp current recoil toward target (which is typically 0 during recovery)
    this.currentRecoil.x = THREE.MathUtils.lerp(this.currentRecoil.x, this.targetRecoil.x, recoverySpeed);
    this.currentRecoil.y = THREE.MathUtils.lerp(this.currentRecoil.y, this.targetRecoil.y, recoverySpeed);

    // Lerp target toward zero for recovery
    this.targetRecoil.x = THREE.MathUtils.lerp(this.targetRecoil.x, 0, recoverySpeed);
    this.targetRecoil.y = THREE.MathUtils.lerp(this.targetRecoil.y, 0, recoverySpeed);

    // Apply to camera rotation (in radians)
    if (camera instanceof THREE.PerspectiveCamera) {
      // Apply as small rotation offsets
      camera.rotation.x += this.currentRecoil.x * 0.001;
      camera.rotation.y += this.currentRecoil.y * 0.001;
    }
  }

  /**
   * Get current recoil offset for visual effects (HUD, weapon sway)
   */
  getCurrentOffset(): THREE.Vector2 {
    return this.currentRecoil.clone();
  }

  /**
   * Get raw recoil offset (before camera application)
   */
  getRawOffset(): THREE.Vector2 {
    return new THREE.Vector2(
      this.targetRecoil.x - this.currentRecoil.x,
      this.targetRecoil.y - this.currentRecoil.y
    );
  }

  /**
   * Reset recoil state (e.g., on weapon switch)
   */
  reset(): void {
    this.currentRecoil.set(0, 0);
    this.targetRecoil.set(0, 0);
    this.shotIndex = 0;
    this.isRecovering = false;
    this.recoveryDelay = 0;
  }

  /**
   * Update recoil configuration
   */
  setConfig(config: Partial<RecoilConfig>): void {
    if (config.vertical) this.config.vertical = config.vertical;
    if (config.horizontal) this.config.horizontal = config.horizontal;
    if (config.recoverySpeed !== undefined) this.config.recoverySpeed = config.recoverySpeed;
    if (config.recoveryDelay !== undefined) this.config.recoveryDelay = config.recoveryDelay;
    if (config.kickMultiplier !== undefined) this.config.kickMultiplier = config.kickMultiplier;
  }

  /**
   * Get the current shot index (for debugging)
   */
  getShotIndex(): number {
    return this.shotIndex;
  }

  /**
   * Check if currently recovering
   */
  isInRecovery(): boolean {
    return this.isRecovering;
  }
}

/**
 * Factory function to create RecoilSystem from weapon data
 */
export function createRecoilFromWeapon(
  verticalRecoil: number[],
  horizontalRecoil: number[],
  recoilRecovery: number
): RecoilSystem {
  return new RecoilSystem({
    vertical: verticalRecoil,
    horizontal: horizontalRecoil,
    recoverySpeed: recoilRecovery,
    recoveryDelay: 0.1,
    kickMultiplier: 1.0
  });
}
