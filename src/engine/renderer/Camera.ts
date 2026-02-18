/**
 * Camera.ts - FPS摄像机系统
 * 支持PC鼠标/键盘控制和移动端触控控制
 */

import * as THREE from 'three';

export interface CameraConfig {
  fov?: number;
  near?: number;
  far?: number;
  position?: THREE.Vector3;
  lookAt?: THREE.Vector3;
  enablePointerLock?: boolean;
}

export interface CameraControls {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  moveUp: boolean;
  moveDown: boolean;
  sprint: boolean;
  jump: boolean;
}

export interface CameraState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  isLocked: boolean;
}

export class Camera {
  private camera: THREE.PerspectiveCamera;
  private euler: THREE.Euler;
  private pitch: number = 0;
  private yaw: number = 0;

  // 控制状态
  private controls: CameraControls = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
    sprint: false,
    jump: false,
  };

  // 移动参数
  private moveSpeed: number = 10;
  private sprintMultiplier: number = 2;
  private lookSensitivity: number = 0.002;
  private touchSensitivity: number = 0.004;

  // 物理参数
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private damping: number = 10;
  private isGrounded: boolean = true;
  private gravity: number = 30;
  private jumpForce: number = 10;

  // 状态
  private isLocked: boolean = false;
  private isMobile: boolean = false;
  private enabled: boolean = true;

  // 回调
  private onLockCallback: (() => void) | null = null;
  private onUnlockCallback: (() => void) | null = null;

  // 虚拟摇杆输入（移动端）
  private virtualJoystickInput: { x: number; y: number } = { x: 0, y: 0 };

  constructor(config: CameraConfig = {}) {
    const { innerWidth, innerHeight } = window;

    this.camera = new THREE.PerspectiveCamera(
      config.fov || 75,
      innerWidth / innerHeight,
      config.near || 0.1,
      config.far || 1000
    );

    // 设置初始位置
    if (config.position) {
      this.camera.position.copy(config.position);
    } else {
      this.camera.position.set(0, 2, 5);
    }

    // 初始化旋转
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.euler.setFromQuaternion(this.camera.quaternion);

    // 检测移动端
    this.isMobile = this.detectMobile();

    // 初始化控制器
    this.initControls(config.enablePointerLock ?? !this.isMobile);
  }

  /**
   * 检测移动端设备
   */
  private detectMobile(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = [
      'android',
      'iphone',
      'ipad',
      'ipod',
      'mobile',
      'windows phone',
    ];
    const isMobileByUA = mobileKeywords.some((keyword) =>
      userAgent.includes(keyword)
    );
    return isMobileByUA || (window.innerWidth < 1024 && 'ontouchstart' in window);
  }

  /**
   * 初始化控制器
   */
  private initControls(enablePointerLock: boolean): void {
    // PC端：键盘事件
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    // PC端：鼠标移动
    document.addEventListener('mousemove', this.onMouseMove.bind(this));

    // PC端：指针锁定
    if (enablePointerLock) {
      document.addEventListener('click', () => {
        if (!this.isMobile && this.enabled) {
          this.lock();
        }
      });

      document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    }

    // 触摸事件由外部控制
  }

  /**
   * 键盘按下处理
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (!this.enabled || this.isMobile) return;

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.controls.moveForward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.controls.moveBackward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.controls.moveLeft = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.controls.moveRight = true;
        break;
      case 'Space':
        if (this.isGrounded) {
          this.controls.jump = true;
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.controls.sprint = true;
        break;
      case 'KeyE':
        this.controls.moveUp = true;
        break;
      case 'KeyQ':
        this.controls.moveDown = true;
        break;
    }
  }

  /**
   * 键盘释放处理
   */
  private onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.controls.moveForward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.controls.moveBackward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.controls.moveLeft = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.controls.moveRight = false;
        break;
      case 'Space':
        this.controls.jump = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.controls.sprint = false;
        break;
      case 'KeyE':
        this.controls.moveUp = false;
        break;
      case 'KeyQ':
        this.controls.moveDown = false;
        break;
    }
  }

  /**
   * 鼠标移动处理
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.enabled || !this.isLocked || this.isMobile) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.yaw -= movementX * this.lookSensitivity;
    this.pitch -= movementY * this.lookSensitivity;

    // 限制俯仰角
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

    this.updateCameraRotation();
  }

  /**
   * 指针锁定变化处理
   */
  private onPointerLockChange(): void {
    this.isLocked = document.pointerLockElement === this.camera.parent?.parent;

    if (this.isLocked && this.onLockCallback) {
      this.onLockCallback();
    } else if (!this.isLocked && this.onUnlockCallback) {
      this.onUnlockCallback();
    }
  }

  /**
   * 更新摄像机旋转
   */
  private updateCameraRotation(): void {
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
  }

  /**
   * 锁定指针（PC端）
   */
  public lock(): void {
    if (!this.isMobile && this.enabled) {
      document.body.requestPointerLock();
    }
  }

  /**
   * 解锁指针
   */
  public unlock(): void {
    document.exitPointerLock();
  }

  /**
   * 设置虚拟摇杆输入（移动端）
   */
  public setVirtualJoystickInput(x: number, y: number): void {
    this.virtualJoystickInput.x = x;
    this.virtualJoystickInput.y = y;
  }

  /**
   * 设置虚拟摄像机旋转（移动端触控）
   */
  public setTouchRotation(deltaX: number, deltaY: number): void {
    if (!this.enabled || !this.isMobile) return;

    this.yaw -= deltaX * this.touchSensitivity;
    this.pitch -= deltaY * this.touchSensitivity;

    // 限制俯仰角
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

    this.updateCameraRotation();
  }

  /**
   * 设置移动速度
   */
  public setMoveSpeed(speed: number): void {
    this.moveSpeed = speed;
  }

  /**
   * 设置鼠标灵敏度
   */
  public setLookSensitivity(sensitivity: number): void {
    this.lookSensitivity = sensitivity;
  }

  /**
   * 启用/禁用摄像机
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.controls = {
        moveForward: false,
        moveBackward: false,
        moveLeft: false,
        moveRight: false,
        moveUp: false,
        moveDown: false,
        sprint: false,
        jump: false,
      };
      this.velocity.set(0, 0, 0);
    }
  }

  /**
   * 锁定状态回调
   */
  public onLock(callback: () => void): void {
    this.onLockCallback = callback;
  }

  /**
   * 解锁状态回调
   */
  public onUnlock(callback: () => void): void {
    this.onUnlockCallback = callback;
  }

  /**
   * 获取摄像机实例
   */
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * 获取当前状态
   */
  public getState(): CameraState {
    return {
      position: this.camera.position.clone(),
      rotation: this.euler.clone(),
      velocity: this.velocity.clone(),
      isLocked: this.isLocked,
    };
  }

  /**
   * 获取控制状态
   */
  public getControls(): CameraControls {
    return { ...this.controls };
  }

  /**
   * 检查是否在地面上
   */
  public getIsGrounded(): boolean {
    return this.isGrounded;
  }

  /**
   * 设置地面状态
   */
  public setGrounded(grounded: boolean): void {
    this.isGrounded = grounded;
  }

  /**
   * 检查是否为移动端
   */
  public getIsMobile(): boolean {
    return this.isMobile;
  }

  /**
   * 更新摄像机
   */
  public update(delta: number): void {
    if (!this.enabled) return;

    const speed = this.moveSpeed * (this.controls.sprint ? this.sprintMultiplier : 1);

    // 计算移动方向
    const direction = new THREE.Vector3();

    // 键盘输入方向
    const forward = this.controls.moveForward ? 1 : (this.controls.moveBackward ? -1 : 0);
    const right = this.controls.moveRight ? 1 : (this.controls.moveLeft ? -1 : 0);
    const upDown = (this.controls.moveUp ? 1 : 0) - (this.controls.moveDown ? 1 : 0);

    // 虚拟摇杆输入（移动端）
    const joyForward = -this.virtualJoystickInput.y;
    const joyRight = this.virtualJoystickInput.x;

    // 合并输入
    const moveForward = forward + joyForward;
    const moveRight = right + joyRight;

    // 获取摄像机前方向（忽略俯仰）
    const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0))
    );
    const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0))
    );

    // 应用移动
    direction.addScaledVector(forwardDir, moveForward * speed);
    direction.addScaledVector(rightDir, moveRight * speed);
    direction.y += upDown * speed;

    // 应用跳跃
    if (this.controls.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.controls.jump = false;
    }

    // 应用重力
    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * delta;
    }

    // 平滑移动
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, direction.x, this.damping * delta);
    this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, direction.y, this.damping * delta);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, direction.z, this.damping * delta);

    // 更新位置
    this.camera.position.addScaledVector(this.velocity, delta);

    // 地面检测（简单实现）
    if (this.camera.position.y < 2) {
      this.camera.position.y = 2;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
  }

  /**
   * 设置位置
   */
  public setPosition(position: THREE.Vector3): void {
    this.camera.position.copy(position);
  }

  /**
   * 设置旋转（欧拉角）
   */
  public setRotation(pitch: number, yaw: number): void {
    this.pitch = pitch;
    this.yaw = yaw;
    this.updateCameraRotation();
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.setEnabled(false);
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
  }
}

export default Camera;
