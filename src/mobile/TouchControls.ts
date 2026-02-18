/**
 * TouchControls.ts - 触控虚拟摇杆
 * 包含触控手势识别和虚拟摇杆控制
 */

import { VirtualJoystick, JoystickState } from './VirtualJoystick';

export interface TouchControlConfig {
  container: HTMLElement;
  joystickSize?: number;
  joystickPosition?: 'left' | 'right' | 'custom';
  joystickOffset?: { x: number; y: number };
  enableLookControl?: boolean;
  lookSensitivity?: number;
  deadZone?: number;
}

export interface TouchEventData {
  type: 'move' | 'look' | 'tap' | 'doubleTap' | 'pinch' | 'swipe';
  data: {
    move?: { x: number; y: number };
    look?: { deltaX: number; deltaY: number };
    tap?: { x: number; y: number };
    doubleTap?: { x: number; y: number };
    pinch?: { scale: number };
    swipe?: { direction: 'up' | 'down' | 'left' | 'right'; velocity: number };
  };
}

export interface TouchState {
  joystick: JoystickState;
  isLooking: boolean;
  isMoving: boolean;
  touchCount: number;
}

/**
 * 触控控制系统
 * 管理虚拟摇杆和触控手势
 */
export class TouchControls {
  private container: HTMLElement;
  private joystick: VirtualJoystick;
  private config: Required<TouchControlConfig>;

  // 触控状态
  private touchState: TouchState = {
    joystick: { x: 0, y: 0, active: false, angle: 0, distance: 0 },
    isLooking: false,
    isMoving: false,
    touchCount: 0,
  };

  // 触控追踪
  private activeTouches: Map<number, Touch> = new Map();
  private lookTouchId: number | null = null;
  private lastTapTime: number = 0;
  private lastTapPosition: { x: number; y: number } = { x: 0, y: 0 };

  // 回调函数
  private onJoystickMove: ((state: JoystickState) => void) | null = null;
  private onLookMove: ((deltaX: number, deltaY: number) => void) | null = null;
  private onTap: ((x: number, y: number) => void) | null = null;
  private onDoubleTap: ((x: number, y: number) => void) | null = null;
  private onPinch: ((scale: number) => void) | null = null;
  private onSwipe: ((direction: string, velocity: number) => void) | null = null;

  // 触摸板参数
  private initialPinchDistance: number = 0;
  private swipeThreshold: number = 50;
  private doubleTapTime: number = 300;

  constructor(config: TouchControlConfig) {
    this.container = config.container;
    this.config = {
      container: config.container,
      joystickSize: config.joystickSize || 120,
      joystickPosition: config.joystickPosition || 'left',
      joystickOffset: config.joystickOffset || { x: 30, y: 30 },
      enableLookControl: config.enableLookControl ?? true,
      lookSensitivity: config.lookSensitivity || 1.0,
      deadZone: config.deadZone || 0.1,
    };

    // 创建虚拟摇杆
    this.joystick = new VirtualJoystick({
      size: this.config.joystickSize,
      maxDistance: this.config.joystickSize * 0.4,
      deadZone: this.config.deadZone,
      position: this.config.joystickPosition,
      offset: this.config.joystickOffset,
    });

    this.init();
  }

  /**
   * 初始化触控系统
   */
  private init(): void {
    // 将摇杆添加到容器
    this.joystick.appendTo(this.container);

    // 绑定触控事件
    this.bindTouchEvents();

    // 监听摇杆变化
    this.joystick.onMove((state) => {
      this.touchState.joystick = state;
      this.touchState.isMoving = state.active;

      if (this.onJoystickMove) {
        this.onJoystickMove(state);
      }
    });
  }

  /**
   * 绑定触控事件
   */
  private bindTouchEvents(): void {
    // 阻止默认触摸行为
    this.container.style.touchAction = 'none';
    this.container.style.userSelect = 'none';
    this.container.style.webkitUserSelect = 'none';

    // 绑定触摸事件
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), {
      passive: false,
    });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), {
      passive: false,
    });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), {
      passive: false,
    });
    this.container.addEventListener('touchcancel', this.handleTouchEnd.bind(this), {
      passive: false,
    });
  }

  /**
   * 处理触摸开始
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();

    const touches = event.changedTouches;

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      this.activeTouches.set(touch.identifier, touch);
    }

    this.touchState.touchCount = this.activeTouches.size;

    // 单指触控 - 检查是否点击在摇杆区域外（用于视角控制）
    if (this.config.enableLookControl && this.activeTouches.size === 1) {
      const touch = this.activeTouches.values().next().value;
      if (touch && !this.isInJoystickArea(touch.clientX, touch.clientY)) {
        this.lookTouchId = touch.identifier;
        this.touchState.isLooking = true;

        // 检测双击
        const now = Date.now();
        if (
          now - this.lastTapTime < this.doubleTapTime &&
          this.isNearPosition(touch.clientX, touch.clientY, this.lastTapPosition)
        ) {
          if (this.onDoubleTap) {
            this.onDoubleTap(touch.clientX, touch.clientY);
          }
          this.lastTapTime = 0;
        } else {
          this.lastTapTime = now;
          this.lastTapPosition = { x: touch.clientX, y: touch.clientY };
        }
      }
    }

    // 双指触控 - 用于缩放
    if (this.activeTouches.size === 2) {
      this.initialPinchDistance = this.getPinchDistance();
    }
  }

  /**
   * 处理触摸移动
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();

    const touches = event.changedTouches;

    // 更新触控位置
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      if (this.activeTouches.has(touch.identifier)) {
        this.activeTouches.set(touch.identifier, touch);
      }
    }

    // 视角控制
    if (this.config.enableLookControl && this.lookTouchId !== null) {
      const lookTouch = this.activeTouches.get(this.lookTouchId);
      if (lookTouch) {
        const deltaX = (lookTouch.clientX - this.lastTapPosition.x) * this.config.lookSensitivity;
        const deltaY = (lookTouch.clientY - this.lastTapPosition.y) * this.config.lookSensitivity;

        if (this.onLookMove) {
          this.onLookMove(deltaX, deltaY);
        }

        this.lastTapPosition = { x: lookTouch.clientX, y: lookTouch.clientY };
      }
    }

    // 双指缩放
    if (this.activeTouches.size === 2) {
      const currentDistance = this.getPinchDistance();
      if (this.initialPinchDistance > 0) {
        const scale = currentDistance / this.initialPinchDistance;
        if (this.onPinch) {
          this.onPinch(scale);
        }
        this.initialPinchDistance = currentDistance;
      }
    }
  }

  /**
   * 处理触摸结束
   */
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();

    const touches = event.changedTouches;

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      this.activeTouches.delete(touch.identifier);

      // 如果结束的是视角控制触控
      if (touch.identifier === this.lookTouchId) {
        // 检测滑动
        if (this.onSwipe && this.touchState.isLooking) {
          const dx = touch.clientX - this.lastTapPosition.x;
          const dy = touch.clientY - this.lastTapPosition.y;

          if (Math.abs(dx) > this.swipeThreshold || Math.abs(dy) > this.swipeThreshold) {
            let direction: 'up' | 'down' | 'left' | 'right';
            const velocity = Math.sqrt(dx * dx + dy * dy);

            if (Math.abs(dx) > Math.abs(dy)) {
              direction = dx > 0 ? 'right' : 'left';
            } else {
              direction = dy > 0 ? 'down' : 'up';
            }

            this.onSwipe(direction, velocity);
          }
        }

        this.lookTouchId = null;
        this.touchState.isLooking = false;
      }
    }

    this.touchState.touchCount = this.activeTouches.size;
  }

  /**
   * 检查坐标是否在摇杆区域内
   */
  private isInJoystickArea(x: number, y: number): boolean {
    const joystickRect = this.joystick.getBoundingClientRect();
    return (
      x >= joystickRect.left &&
      x <= joystickRect.right &&
      y >= joystickRect.top &&
      y <= joystickRect.bottom
    );
  }

  /**
   * 检查坐标是否接近指定位置
   */
  private isNearPosition(
    x1: number,
    y1: number,
    pos2: { x: number; y: number }
  ): boolean {
    const threshold = 30;
    return Math.abs(x1 - pos2.x) < threshold && Math.abs(y1 - pos2.y) < threshold;
  }

  /**
   * 获取双指距离
   */
  private getPinchDistance(): number {
    const touches = Array.from(this.activeTouches.values());
    if (touches.length < 2) return 0;

    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 设置摇杆移动回调
   */
  public setOnJoystickMove(callback: (state: JoystickState) => void): void {
    this.onJoystickMove = callback;
  }

  /**
   * 设置视角移动回调
   */
  public setOnLookMove(callback: (deltaX: number, deltaY: number) => void): void {
    this.onLookMove = callback;
  }

  /**
   * 设置单击回调
   */
  public setOnTap(callback: (x: number, y: number) => void): void {
    this.onTap = callback;
  }

  /**
   * 设置双击回调
   */
  public setOnDoubleTap(callback: (x: number, y: number) => void): void {
    this.onDoubleTap = callback;
  }

  /**
   * 设置缩放回调
   */
  public setOnPinch(callback: (scale: number) => void): void {
    this.onPinch = callback;
  }

  /**
   * 设置滑动回调
   */
  public setOnSwipe(callback: (direction: string, velocity: number) => void): void {
    this.onSwipe = callback;
  }

  /**
   * 获取当前触控状态
   */
  public getState(): TouchState {
    return { ...this.touchState };
  }

  /**
   * 获取虚拟摇杆实例
   */
  public getJoystick(): VirtualJoystick {
    return this.joystick;
  }

  /**
   * 显示/隐藏摇杆
   */
  public setVisible(visible: boolean): void {
    this.joystick.setVisible(visible);
  }

  /**
   * 设置摇杆位置
   */
  public setJoystickPosition(position: 'left' | 'right' | 'custom', offset?: { x: number; y: number }): void {
    this.config.joystickPosition = position;
    if (offset) {
      this.config.joystickOffset = offset;
    }
    this.joystick.setPosition(position, this.config.joystickOffset);
  }

  /**
   * 设置死区
   */
  public setDeadZone(deadZone: number): void {
    this.config.deadZone = deadZone;
    this.joystick.setDeadZone(deadZone);
  }

  /**
   * 启用/禁用触控控制
   */
  public setEnabled(enabled: boolean): void {
    if (enabled) {
      this.joystick.setVisible(true);
      this.container.style.pointerEvents = 'auto';
    } else {
      this.joystick.setVisible(false);
      this.container.style.pointerEvents = 'none';
      this.activeTouches.clear();
      this.touchState = {
        joystick: { x: 0, y: 0, active: false, angle: 0, distance: 0 },
        isLooking: false,
        isMoving: false,
        touchCount: 0,
      };
    }
  }

  /**
   * 检测是否为移动设备
   */
  public static isMobileDevice(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    );
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.setEnabled(false);
    this.joystick.dispose();

    this.container.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.container.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.container.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.container.removeEventListener('touchcancel', this.handleTouchEnd.bind(this));
  }
}

export default TouchControls;
