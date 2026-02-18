/**
 * FPS System Exports
 * Core FPS systems for CS:RPG
 */

// Types
export * from './types';

// Core Systems
export { Weapon, createWeapon } from './Weapon';
export type { WeaponEvent, WeaponEventType, WeaponEventCallback } from './Weapon';

export { WeaponManager, createWeaponManager } from './WeaponManager';
export type { WeaponSlot } from './WeaponManager';

// Ballistics
export { RecoilSystem, createRecoilFromWeapon } from './Recoil';
export { SpreadSystem, SpreadInterpolator, createSpreadFromWeapon } from './Spread';
export { BulletTrace, TracerEffect } from './BulletTrace';
export type { TraceableEntity } from './BulletTrace';
