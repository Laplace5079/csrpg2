/**
 * Weapon Manager System
 * Manages multiple weapons, switching, and player weapon state
 */

import * as THREE from 'three';
import { Weapon, WeaponEvent, WeaponEventCallback } from './Weapon';
import { WeaponData, WeaponCategory } from './types';
import { TraceableEntity } from './BulletTrace';

// Weapon slot configuration
export interface WeaponSlot {
  index: number;
  category: WeaponCategory;
  weapon?: Weapon;
}

export class WeaponManager {
  // Scene reference
  private scene: THREE.Scene;
  
  // Weapon slots
  private slots: WeaponSlot[] = [];
  private currentSlotIndex: number = 0;
  
  // Current weapon reference
  private currentWeapon: Weapon | null = null;
  
  // Player state
  private isAiming: boolean = false;
  private isCrouching: boolean = false;
  private isSprinting: boolean = false;
  
  // Camera reference for recoil
  private camera: THREE.Camera | null = null;
  
  // Ray origin for shooting (weapon position)
  private rayOrigin: THREE.Vector3 = new THREE.Vector3();
  
  // Event callbacks
  private eventCallbacks: ((event: WeaponEvent) => void)[] = [];
  
  // Hit entities for damage
  private hitEntities: TraceableEntity[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeSlots();
  }

  /**
   * Initialize weapon slots
   */
  private initializeSlots(): void {
    // Primary weapons (slots 0-1)
    this.slots.push({ index: 0, category: 'primary' });
    this.slots.push({ index: 1, category: 'primary' });
    
    // Secondary weapons (slots 2-3)
    this.slots.push({ index: 2, category: 'secondary' });
    this.slots.push({ index: 3, category: 'secondary' });
    
    // Melee (slot 4)
    this.slots.push({ index: 4, category: 'melee' });
    
    // Equipment (slot 5)
    this.slots.push({ index: 5, category: 'equipment' });
  }

  /**
   * Set camera reference
   */
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  /**
   * Set ray origin (weapon position)
   */
  setRayOrigin(origin: THREE.Vector3): void {
    this.rayOrigin.copy(origin);
  }

  /**
   * Update ray origin from camera
   */
  private updateRayOrigin(): void {
    if (this.camera) {
      // Get position slightly in front of camera
      this.rayOrigin.copy(this.camera.position);
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(this.camera.quaternion);
      this.rayOrigin.addScaledVector(forward, 0.5);
    }
  }

  /**
   * Add a weapon to a slot
   */
  addWeapon(data: WeaponData, slotIndex?: number): boolean {
    // Find appropriate slot based on category
    let targetSlot = slotIndex;
    
    if (targetSlot === undefined) {
      const slot = this.slots.find(s => 
        s.category === data.category && !s.weapon
      );
      if (slot) {
        targetSlot = slot.index;
      } else {
        // Try to replace existing weapon in category
        const existingSlot = this.slots.find(s => s.category === data.category);
        if (existingSlot) {
          targetSlot = existingSlot.index;
        }
      }
    }

    if (targetSlot === undefined || targetSlot < 0 || targetSlot >= this.slots.length) {
      return false;
    }

    const slot = this.slots[targetSlot];
    
    // Remove existing weapon if any
    if (slot.weapon) {
      slot.weapon.dispose();
    }

    // Create new weapon
    const weapon = new Weapon(data, this.scene);
    
    // Forward events
    weapon.onEvent(event => {
      this.eventCallbacks.forEach(cb => cb(event));
    });

    slot.weapon = weapon;

    // If this is the first weapon, equip it
    if (!this.currentWeapon) {
      this.equipWeapon(targetSlot);
    }

    return true;
  }

  /**
   * Remove weapon from slot
   */
  removeWeapon(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.slots.length) {
      return false;
    }

    const slot = this.slots[slotIndex];
    if (!slot.weapon) {
      return false;
    }

    // Unequip if currently equipped
    if (this.currentWeapon === slot.weapon) {
      this.unequipWeapon();
    }

    slot.weapon.dispose();
    slot.weapon = undefined;
    return true;
  }

  /**
   * Equip weapon from slot
   */
  equipWeapon(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.slots.length) {
      return false;
    }

    const slot = this.slots[slotIndex];
    if (!slot.weapon) {
      return false;
    }

    // Unequip current weapon
    if (this.currentWeapon) {
      this.currentWeapon.reset();
    }

    // Equip new weapon
    this.currentSlotIndex = slotIndex;
    this.currentWeapon = slot.weapon;
    
    // Apply player states to new weapon
    this.currentWeapon.setAiming(this.isAiming);
    this.currentWeapon.setCrouching(this.isCrouching);
    this.currentWeapon.setSprinting(this.isSprinting);

    return true;
  }

  /**
   * Unequip current weapon
   */
  private unequipWeapon(): void {
    if (this.currentWeapon) {
      this.currentWeapon.cancelReload();
      this.currentWeapon = null;
    }
  }

  /**
   * Switch to next weapon
   */
  switchToNext(): void {
    const nextIndex = (this.currentSlotIndex + 1) % this.slots.length;
    this.equipWeapon(nextIndex);
  }

  /**
   * Switch to previous weapon
   */
  switchToPrevious(): void {
    const prevIndex = (this.currentSlotIndex - 1 + this.slots.length) % this.slots.length;
    this.equipWeapon(prevIndex);
  }

  /**
   * Switch to weapon by category
   */
  switchToCategory(category: WeaponCategory): boolean {
    const slot = this.slots.find(s => 
      s.category === category && s.weapon !== undefined
    );
    
    if (slot) {
      return this.equipWeapon(slot.index);
    }
    return false;
  }

  /**
   * Start firing
   */
  startFiring(): void {
    if (this.currentWeapon) {
      this.currentWeapon.startFiring();
    }
  }

  /**
   * Stop firing
   */
  stopFiring(): void {
    if (this.currentWeapon) {
      this.currentWeapon.stopFiring();
    }
  }

  /**
   * Fire current weapon
   */
  fire(direction: THREE.Vector3): { hit: boolean; result?: unknown } | null {
    if (!this.currentWeapon) return null;

    // Update ray origin from camera
    this.updateRayOrigin();

    // Fire the weapon
    const result = this.currentWeapon.fire(
      this.rayOrigin.clone(),
      direction,
      this.hitEntities
    );

    return result ? { hit: result.hit, result } : null;
  }

  /**
   * Reload current weapon
   */
  reload(): boolean {
    if (this.currentWeapon) {
      return this.currentWeapon.reload();
    }
    return false;
  }

  /**
   * Set aiming state
   */
  setAiming(aiming: boolean): void {
    this.isAiming = aiming;
    if (this.currentWeapon) {
      this.currentWeapon.setAiming(aiming);
    }
  }

  /**
   * Toggle aiming
   */
  toggleAiming(): boolean {
    this.setAiming(!this.isAiming);
    return this.isAiming;
  }

  /**
   * Set crouching state
   */
  setCrouching(crouching: boolean): void {
    this.isCrouching = crouching;
    if (this.currentWeapon) {
      this.currentWeapon.setCrouching(crouching);
    }
  }

  /**
   * Set sprinting state
   */
  setSprinting(sprinting: boolean): void {
    this.isSprinting = sprinting;
    if (this.currentWeapon) {
      this.currentWeapon.setSprinting(sprinting);
    }
  }

  /**
   * Set target entities for damage
   */
  setHitEntities(entities: TraceableEntity[]): void {
    this.hitEntities = entities;
  }

  /**
   * Add hit entity
   */
  addHitEntity(entity: TraceableEntity): void {
    if (!this.hitEntities.includes(entity)) {
      this.hitEntities.push(entity);
    }
  }

  /**
   * Remove hit entity
   */
  removeHitEntity(entityId: string): void {
    const index = this.hitEntities.findIndex(e => e.id === entityId);
    if (index >= 0) {
      this.hitEntities.splice(index, 1);
    }
  }

  /**
   * Update all weapon systems
   */
  update(delta: number): void {
    if (this.currentWeapon && this.camera) {
      this.currentWeapon.update(this.camera, delta);
    }
  }

  /**
   * Get current weapon
   */
  getCurrentWeapon(): Weapon | null {
    return this.currentWeapon;
  }

  /**
   * Get weapon in slot
   */
  getWeaponInSlot(slotIndex: number): Weapon | undefined {
    if (slotIndex >= 0 && slotIndex < this.slots.length) {
      return this.slots[slotIndex].weapon;
    }
    return undefined;
  }

  /**
   * Get current slot index
   */
  getCurrentSlotIndex(): number {
    return this.currentSlotIndex;
  }

  /**
   * Get all slots
   */
  getSlots(): WeaponSlot[] {
    return [...this.slots];
  }

  /**
   * Get weapons by category
   */
  getWeaponsByCategory(category: WeaponCategory): Weapon[] {
    return this.slots
      .filter(s => s.category === category && s.weapon)
      .map(s => s.weapon!);
  }

  /**
   * Check if is aiming
   */
  isAiming(): boolean {
    return this.isAiming;
  }

  /**
   * Check if is crouching
   */
  isCrouching(): boolean {
    return this.isCrouching;
  }

  /**
   * Check if is sprinting
   */
  isSprinting(): boolean {
    return this.isSprinting;
  }

  /**
   * Get total ammo across all weapons
   */
  getTotalAmmo(): number {
    return this.slots.reduce((total, slot) => {
      if (slot.weapon) {
        return total + slot.weapon.state.totalAmmo;
      }
      return total;
    }, 0);
  }

  /**
   * Add ammo to current weapon
   */
  addAmmoToCurrent(amount: number): void {
    if (this.currentWeapon) {
      this.currentWeapon.addAmmo(amount);
    }
  }

  /**
   * Add ammo to all weapons of type
   */
  addAmmoToAll(amount: number): void {
    this.slots.forEach(slot => {
      if (slot.weapon) {
        slot.weapon.addAmmo(amount);
      }
    });
  }

  /**
   * Subscribe to weapon events
   */
  onEvent(callback: (event: WeaponEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Get weapon by ID
   */
  getWeaponById(id: string): Weapon | undefined {
    for (const slot of this.slots) {
      if (slot.weapon && slot.weapon.data.id === id) {
        return slot.weapon;
      }
    }
    return undefined;
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.slots.forEach(slot => {
      if (slot.weapon) {
        slot.weapon.setTraceDebug(enabled);
      }
    });
  }

  /**
   * Dispose all weapons
   */
  dispose(): void {
    this.slots.forEach(slot => {
      if (slot.weapon) {
        slot.weapon.dispose();
        slot.weapon = undefined;
      }
    });
    this.eventCallbacks = [];
    this.currentWeapon = null;
  }
}

/**
 * Factory function to create weapon manager
 */
export function createWeaponManager(scene: THREE.Scene): WeaponManager {
  return new WeaponManager(scene);
}
