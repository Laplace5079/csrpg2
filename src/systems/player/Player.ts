/**
 * Player.ts - 玩家控制器
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 第一人称射击 + 物理胶囊体
 */

import * as THREE from 'three';
import { InputManager } from '../../engine/InputManager';
import { GAME_CONFIG } from '../../core/constants';
import { Core, GameEvent } from '../../core';

export enum PlayerState {
  IDLE = 'idle', WALKING = 'walking', RUNNING = 'running', JUMPING = 'jumping',
  CROUCHING = 'crouching', AIMING = 'aiming', FIRING = 'firing', RELOADING = 'reloading',
}

export class Player {
  private camera: THREE.PerspectiveCamera;
  public inputManager: InputManager;
  private core: Core;
  
  public position: THREE.Vector3 = new THREE.Vector3(0, GAME_CONFIG.PLAYER_HEIGHT, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  
  public state: PlayerState = PlayerState.IDLE;
  public isGrounded: boolean = true;
  public isSprinting: boolean = false;
  public isAiming: boolean = false;
  
  public moveSpeed: number = GAME_CONFIG.MOVE_SPEED;
  public sprintSpeed: number = GAME_CONFIG.SPRINT_SPEED;
  public crouchSpeed: number = GAME_CONFIG.CROUCH_SPEED;
  public jumpForce: number = GAME_CONFIG.JUMP_FORCE;
  
  private shakeIntensity: number = 0;
  private shakeDecay: number = 5;
  private currentShake: THREE.Vector3 = new THREE.Vector3();
  
  private aimOffset: number = 0;
  private targetAimOffset: number = 0;
  
  private stamina: number = 100;
  private maxStamina: number = 100;
  private staminaRegen: number = 10;
  private sprintDrain: number = 20;

  constructor(camera: THREE.PerspectiveCamera, inputManager: InputManager, core: Core) {
    this.camera = camera;
    this.inputManager = inputManager;
    this.core = core;
    this.init();
  }

  private init(): void {
    console.log('[Player] 初始化完成');
  }

  public update(deltaTime: number): void {
    const inputState = this.inputManager.getState();
    
    if (!inputState.isPointerLocked) return;
    
    this.updateMovement(inputState, deltaTime);
    this.updateRotation(inputState);
    this.updateState(inputState);
    this.updateCameraShake(deltaTime);
    this.updateAimOffset(deltaTime);
    this.updateStamina(deltaTime);
    
    this.applyToCamera();
    this.core.updatePlayerPosition(this.position);
    this.core.updatePlayerRotation(this.rotation);
  }

  private updateMovement(inputState: any, deltaTime: number): void {
    const movement = this.inputManager.getMovement();
    const isMoving = movement.x !== 0 || movement.z !== 0;
    
    let targetSpeed = this.moveSpeed;
    
    if (inputState.sprint && this.stamina > 0 && isMoving) {
      this.isSprinting = true;
      targetSpeed = this.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - this.sprintDrain * deltaTime);
    } else {
      this.isSprinting = false;
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * deltaTime);
    }
    
    if (inputState.crouch) targetSpeed = this.crouchSpeed;
    
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    forward.applyEuler(new THREE.Euler(0, this.rotation.y, 0));
    right.applyEuler(new THREE.Euler(0, this.rotation.y, 0));
    
    const targetVelocity = new THREE.Vector3();
    targetVelocity.addScaledVector(forward, -movement.z * targetSpeed);
    targetVelocity.addScaledVector(right, movement.x * targetSpeed);
    
    // 摩擦力参数
    const acceleration = 25;  // 加速度
    const friction = 15;     // 摩擦力
    
    // 平滑加速/减速 (lerp)
    if (isMoving) {
      // 加速
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelocity.x, acceleration * deltaTime);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelocity.z, acceleration * deltaTime);
    } else {
      // 摩擦减速
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, friction * deltaTime);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, friction * deltaTime);
    }
    
    if (inputState.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.state = PlayerState.JUMPING;
    }
    
    if (!this.isGrounded) {
      this.velocity.y -= 20 * deltaTime;
    }
    
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;
    
    if (this.position.y <= GAME_CONFIG.PLAYER_HEIGHT) {
      this.position.y = GAME_CONFIG.PLAYER_HEIGHT;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
  }

  private updateRotation(inputState: any): void {
    const mouseDelta = this.inputManager.getMouseDelta();
    this.rotation.y -= mouseDelta.x;
    this.rotation.x -= mouseDelta.y;
    this.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.rotation.x));
  }

  private updateState(inputState: any): void {
    if (!this.isGrounded) {
      this.state = PlayerState.JUMPING;
    } else if (inputState.crouch) {
      this.state = PlayerState.CROUCHING;
    } else if (this.isSprinting) {
      this.state = PlayerState.RUNNING;
    } else if (this.inputManager.isMoving()) {
      this.state = PlayerState.WALKING;
    } else if (inputState.aim) {
      this.state = PlayerState.AIMING;
    } else {
      this.state = PlayerState.IDLE;
    }
  }

  public addShake(intensity: number): void {
    this.shakeIntensity = Math.min(0.3, this.shakeIntensity + intensity * 0.3);
  }

  private updateCameraShake(deltaTime: number): void {
    if (this.shakeIntensity > 0) {
      this.currentShake.set(
        (Math.random() - 0.5) * this.shakeIntensity * 0.1,
        (Math.random() - 0.5) * this.shakeIntensity * 0.1,
        (Math.random() - 0.5) * this.shakeIntensity * 0.1
      );
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * deltaTime);
    } else {
      this.currentShake.set(0, 0, 0);
    }
  }

  private updateAimOffset(deltaTime: number): void {
    this.isAiming = this.inputManager.isAiming();
    this.targetAimOffset = this.isAiming ? 1 : 0;
    this.aimOffset = THREE.MathUtils.lerp(this.aimOffset, this.targetAimOffset, deltaTime * 10);
  }

  private updateStamina(deltaTime: number): void {}

  public getStamina(): number { return this.stamina; }
  public getStaminaRatio(): number { return this.stamina / this.maxStamina; }

  private applyToCamera(): void {
    this.camera.position.copy(this.position);
    const shakeOffset = this.currentShake.clone();
    const aimYOffset = this.aimOffset * 0.1;
    this.camera.position.y -= aimYOffset;
    this.camera.position.add(shakeOffset);
    this.camera.rotation.copy(this.rotation);
  }

  public isMoving(): boolean { return this.inputManager.isMoving(); }
  
  public getForwardVector(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(this.rotation);
    return forward;
  }
  
  public getRightVector(): THREE.Vector3 {
    const right = new THREE.Vector3(1, 0, 0);
    right.applyEuler(this.rotation);
    return right;
  }
  
  public getAimOffset(): number { return this.aimOffset; }
  public getState(): PlayerState { return this.state; }
  
  public takeDamage(amount: number): void {
    this.core.takeDamage(amount);
    this.addShake(0.5);
  }
  
  public teleport(position: THREE.Vector3): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
  }
}

export default Player;
