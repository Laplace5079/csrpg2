/**
 * FPS System Type Definitions
 * Core types for weapons, damage, and ballistics
 */

// Weapon Types
export type WeaponType = 'rifle' | 'pistol' | 'shotgun' | 'sniper' | 'smg' | 'lmg' | 'grenade' | 'melee';
export type FireMode = 'semi' | 'auto' | 'burst';
export type DamageType = 'physical' | 'energy' | 'armor_piercing' | 'explosive';
export type ReloadType = 'full' | 'partial' | 'tactical';
export type WeaponCategory = 'primary' | 'secondary' | 'melee' | 'equipment';

// Falloff Curve Configuration
export interface FalloffCurve {
  type: 'linear' | 'exponential' | 'step';
  startDistance: number;
  endDistance: number;
  minDamagePercent: number;
}

// Spread Configuration
export interface SpreadConfig {
  base: number;           // Base spread in degrees
  max: number;             // Maximum spread in degrees
  increasePerShot: number; // Spread increase per shot
  decreasePerSecond: number; // Spread recovery speed
  crouchBonus: number;     // Crouch spread reduction
  sprintPenalty: number;  // Sprint spread penalty
}

// Recoil Pattern Configuration
export interface RecoilConfig {
  vertical: number[];     // Vertical recoil values per shot
  horizontal: number[];   // Horizontal recoil values per shot
  recoverySpeed: number;  // Recoil recovery speed
  recoveryDelay: number;  // Delay before recovery starts
  kickMultiplier: number; // Visual kick multiplier
}

// Weapon Data Interface (from TECHNICAL_DOC.md)
export interface WeaponData {
  id: string;
  name: string;
  type: WeaponType;
  category: WeaponCategory;
  
  // Damage
  damage: number;
  damageFalloff: FalloffCurve;
  damageType: DamageType;
  
  // Range
  effectiveRange: number;
  maxRange: number;
  
  // Fire Rate (RPM)
  fireRate: number;
  fireMode: FireMode;
  burstCount: number;
  
  // Ammo
  magSize: number;
  totalAmmo: number;
  reloadTime: number;
  reloadType: ReloadType;
  
  // Recoil
  verticalRecoil: number[];
  horizontalRecoil: number[];
  recoilRecovery: number;
  
  // Spread
  hipSpread: SpreadConfig;
  adsSpread: SpreadConfig;
  
  // Effects
  shootSound: string;
  reloadSound: string;
  muzzleFlash: string;
  tracerColor: string;
  
  // Visual
  modelPath?: string;
  iconPath?: string;
}

// Weapon State
export interface WeaponState {
  id: string;
  currentAmmo: number;
  magAmmo: number;
  totalAmmo: number;
  isReloading: boolean;
  isFiring: boolean;
  lastFireTime: number;
  reloadStartTime: number;
  burstCount: number;
  spread: number;
  recoilOffset: { x: number; y: number };
}

// Hit Result
export interface HitResult {
  hit: boolean;
  point?: THREE.Vector3;
  normal?: THREE.Vector3;
  entity?: unknown;
  damage: number;
  distance: number;
}

// Bullet Trace Config
export interface BulletTraceConfig {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  maxDistance: number;
  damage: number;
  damageType: DamageType;
  falloff: FalloffCurve;
  pierces: number;
  radius: number;
}

// Three.js import for types
import * as THREE from 'three';
