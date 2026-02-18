/**
 * WeaponSystem.ts - 武器系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 射击、后坐力、子弹追踪
 */

import * as THREE from 'three';
import { Core, GameEvent } from '../../core';
import { Player } from './Player';
import { FireMode, WeaponType } from '../../core/constants';

// ============== 武器数据 ==============
export interface WeaponData {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  headshotMultiplier: number;
  effectiveRange: number;
  maxRange: number;
  fireRate: number;
  fireMode: FireMode;
  burstCount: number;
  burstDelay: number;
  magSize: number;
  totalAmmo: number;
  reloadTime: number;
  verticalRecoil: number[];
  horizontalRecoil: number[];
  recoilRecovery: number;
  recoilKick: number;
  hipSpread: SpreadConfig;
  adsSpread: SpreadConfig;
  aimTime: number;
  aimFOV: number;
  shootSound: string;
  reloadSound: string;
  muzzleFlash: boolean;
  tracerColor: string;
  tracerFrequency: number;
}

export interface SpreadConfig {
  min: number;
  max: number;
  increaseRate: number;
  decreaseRate: number;
}

// ============== 武器实例 ==============
export class Weapon {
  public data: WeaponData;
  public currentAmmo: number;
  public totalAmmo: number;
  public isReloading: boolean = false;
  public isAiming: boolean = false;
  public lastShotTime: number = 0;
  public burstCount: number = 0;
  public currentSpread: number = 0;
  public mesh: THREE.Object3D | null = null;

  constructor(data: WeaponData) {
    this.data = data;
    this.currentAmmo = data.magSize;
    this.totalAmmo = data.totalAmmo;
  }

  public canFire(): boolean {
    const now = Date.now();
    const fireInterval = 60000 / this.data.fireRate;
    return !this.isReloading && this.currentAmmo > 0 && now - this.lastShotTime >= fireInterval;
  }

  public fire(origin: THREE.Vector3, direction: THREE.Vector3): BulletResult | null {
    if (!this.canFire()) return null;
    this.lastShotTime = Date.now();
    this.currentAmmo--;
    const spreadDirection = this.applySpread(direction);
    this.currentSpread = Math.min(this.data.hipSpread.max, this.currentSpread + this.data.hipSpread.increaseRate);
    return { origin: origin.clone(), direction: spreadDirection, damage: this.data.damage, range: this.data.effectiveRange };
  }

  private applySpread(direction: THREE.Vector3): THREE.Vector3 {
    const spread = this.currentSpread;
    const pitch = (Math.random() - 0.5) * spread;
    const yaw = (Math.random() - 0.5) * spread;
    const result = direction.clone();
    result.x += pitch;
    result.y += yaw;
    result.normalize();
    return result;
  }

  public updateSpread(deltaTime: number): void {
    this.currentSpread = Math.max(this.data.hipSpread.min, this.currentSpread - this.data.hipSpread.decreaseRate * deltaTime);
  }

  public getRecoil(): { pitch: number; yaw: number } {
    const recoilIndex = 0;
    const pitch = this.data.verticalRecoil[recoilIndex] * this.data.recoilKick;
    const yaw = this.data.horizontalRecoil[recoilIndex] * this.data.recoilKick * (Math.random() - 0.5);
    return { pitch, yaw };
  }

  public reload(): boolean {
    if (this.isReloading || this.currentAmmo === this.data.magSize || this.totalAmmo <= 0) return false;
    this.isReloading = true;
    setTimeout(() => {
      const needed = this.data.magSize - this.currentAmmo;
      const available = Math.min(needed, this.totalAmmo);
      this.totalAmmo -= available;
      this.currentAmmo += available;
      this.isReloading = false;
    }, this.data.reloadTime);
    return true;
  }

  public getAmmoString(): string {
    return `${this.currentAmmo} / ${this.totalAmmo}`;
  }

  public needsReload(): boolean {
    return this.currentAmmo === 0 && this.totalAmmo > 0;
  }
}

export interface BulletResult {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
  range: number;
}

// ============== 武器系统 ==============
export class WeaponSystem {
  private core: Core;
  private player: Player;
  private weapons: Map<string, Weapon> = new Map();
  private currentWeapon: Weapon | null = null;
  private bullets: Bullet[] = [];
  private scene: THREE.Scene | null = null;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  constructor(core: Core, player: Player) {
    this.core = core;
    this.player = player;
    this.init();
  }

  private init(): void {
    this.registerDefaultWeapons();
    this.core.eventBus.on(GameEvent.FRAME_UPDATE, () => this.update(0.016));
    console.log('[WeaponSystem] 初始化完成');
  }

  private registerDefaultWeapons(): void {
    const pistol: WeaponData = {
      id: 'quantum_pistol', name: '量子手枪', type: WeaponType.PISTOL,
      damage: 25, headshotMultiplier: 2.0, effectiveRange: 50, maxRange: 100,
      fireRate: 300, fireMode: FireMode.SEMI, burstCount: 1, burstDelay: 0,
      magSize: 12, totalAmmo: 48, reloadTime: 1500,
      verticalRecoil: [0.5, 0.4, 0.3, 0.2], horizontalRecoil: [0.1, 0.15, 0.1, 0.05],
      recoilRecovery: 5, recoilKick: 1.0,
      hipSpread: { min: 0.01, max: 0.05, increaseRate: 0.01, decreaseRate: 0.05 },
      adsSpread: { min: 0.001, max: 0.01, increaseRate: 0.005, decreaseRate: 0.1 },
      aimTime: 0.15, aimFOV: 60, shootSound: 'pistol_shoot', reloadSound: 'pistol_reload',
      muzzleFlash: true, tracerColor: '#00ffff', tracerFrequency: 0,
    };

    const rifle: WeaponData = {
      id: 'quantum_rifle', name: '量子步枪', type: WeaponType.RIFLE,
      damage: 30, headshotMultiplier: 2.0, effectiveRange: 100, maxRange: 200,
      fireRate: 600, fireMode: FireMode.AUTO, burstCount: 3, burstDelay: 100,
      magSize: 30, totalAmmo: 120, reloadTime: 2000,
      verticalRecoil: [0.3, 0.35, 0.3, 0.25, 0.2], horizontalRecoil: [0.1, 0.15, 0.12, 0.1, 0.08],
      recoilRecovery: 8, recoilKick: 0.8,
      hipSpread: { min: 0.02, max: 0.1, increaseRate: 0.02, decreaseRate: 0.03 },
      adsSpread: { min: 0.005, max: 0.03, increaseRate: 0.01, decreaseRate: 0.08 },
      aimTime: 0.2, aimFOV: 65, shootSound: 'rifle_shoot', reloadSound: 'rifle_reload',
      muzzleFlash: true, tracerColor: '#ff00ff', tracerFrequency: 3,
    };

    this.weapons.set(pistol.id, new Weapon(pistol));
    this.weapons.set(rifle.id, new Weapon(rifle));
    this.currentWeapon = this.weapons.get('quantum_pistol') || null;
  }

  public setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  public update(deltaTime: number): void {
    if (!this.currentWeapon) return;
    this.currentWeapon.updateSpread(deltaTime);
    this.updateBullets(deltaTime);
    
    const inputMgr = (this.player as any).inputManager;
    if (inputMgr?.isFiring()) {
      this.attemptFire();
    }
    
    // 自动换弹
    if (inputMgr?.getState()?.reload) {
      this.reload();
    }
  }

  private attemptFire(): void {
    if (!this.currentWeapon || !this.player) return;
    const result = this.currentWeapon.fire(this.player.position, this.player.getForwardVector());
    if (result) {
      this.createBullet(result);
      const recoil = this.currentWeapon.getRecoil();
      (this.player as any).addShake(recoil.pitch * 0.2);
      this.core.eventBus.emit(GameEvent.WEAPON_FIRED, { weaponId: this.currentWeapon.data.id, ammo: this.currentWeapon.currentAmmo });
    }
  }

  private createBullet(result: BulletResult): void {
    const bullet: Bullet = {
      origin: result.origin, direction: result.direction, damage: result.damage,
      range: result.range, speed: 100, distanceTraveled: 0, mesh: this.createBulletMesh(),
    };
    this.bullets.push(bullet);
    if (this.scene && bullet.mesh) {
      bullet.mesh.position.copy(bullet.origin);
      this.scene.add(bullet.mesh);
    }
  }

  private createBulletMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.05, 4, 4);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    return new THREE.Mesh(geometry, material);
  }

  private updateBullets(deltaTime: number): void {
    const bulletsToRemove: number[] = [];
    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      const movement = bullet.direction.clone().multiplyScalar(bullet.speed * deltaTime);
      bullet.origin.add(movement);
      bullet.distanceTraveled += movement.length();
      if (bullet.mesh) bullet.mesh.position.copy(bullet.origin);
      
      if (bullet.distanceTraveled >= bullet.range) {
        bulletsToRemove.push(i);
        this.removeBullet(i);
      }
    }
  }

  private removeBullet(index: number): void {
    const bullet = this.bullets[index];
    if (bullet.mesh && this.scene) this.scene.remove(bullet.mesh);
    this.bullets.splice(index, 1);
  }

  public switchWeapon(weaponId: string): boolean {
    const weapon = this.weapons.get(weaponId);
    if (!weapon) return false;
    this.currentWeapon = weapon;
    this.core.eventBus.emit(GameEvent.WEAPON_SWITCHED, weaponId);
    return true;
  }

  public getCurrentWeapon(): Weapon | null {
    return this.currentWeapon;
  }

  public reload(): void {
    if (this.currentWeapon) this.currentWeapon.reload();
  }
}

interface Bullet {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
  range: number;
  speed: number;
  distanceTraveled: number;
  mesh: THREE.Mesh | null;
}

export default WeaponSystem;
