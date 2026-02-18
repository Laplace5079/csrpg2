/**
 * VirtualJoystick.ts - 虚拟摇杆实现
 * 提供可自定义的虚拟摇杆控件
 */

export interface JoystickConfig {
  size?: number;
  maxDistance?: number;
  deadZone?: number;
  position?: 'left' | 'right' | 'custom';
  offset?: { x: number; y: number };
  baseColor?: string;
  knobColor?: string;
  opacity?: number;
}

export interface JoystickState {
  x: number; // -1 到 1，横向
  y: number; // -1 到 1，纵向（负值为向前）
  active: boolean;
  angle: number; // 弧度
  distance: number; // 0 到 1normalized distance
}

/**
 * 虚拟摇杆类
 */
export class VirtualJoystick {
  private container: HTMLElement;
  private baseElement: HTMLElement;
  private knobElement: HTMLElement;
  private config: Required<JoystickConfig>;

  // 状态
  private state: JoystickState = {
    x: 0,
    y: 0,
    active: false,
    angle: 0,
    distance: 0,
  };

  // 触摸追踪
  private activeTouchId: number | null = null;
  private centerX: number = 0;
  private centerY: number = 0;

  // 回调
  private moveCallbacks: ((state: JoystickState) => void)[] = [];
  private startCallbacks: (() => void)[] = [];
  private endCallbacks: (() => void)[] = [];

  constructor(config: JoystickConfig = {}) {
    this.config = {
      size: config.size || 120,
      maxDistance: config.maxDistance || (config.size || 120) * 0.4,
      deadZone: config.deadZone || 0.1,
      position: config.position || 'left',
      offset: config.offset || { x: 30, y: 30 },
      baseColor: config.baseColor || 'rgba(255, 255, 255, 0.2)',
      knobColor: config.knobColor || 'rgba(255, 255, 255, 0.5)',
      opacity: config.opacity || 1,
    };

    // 创建DOM元素
    this.container = this.createContainer();
    this.baseElement = this.createBase();
    this.knobElement = this.createKnob();

    this.baseElement.appendChild(this.knobElement);
    this.container.appendChild(this.baseElement);

    // 绑定事件
    this.bindEvents();
  }

  /**
   * 创建容器元素
   */
  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'virtual-joystick';
    container.style.position = 'absolute';
    container.style.zIndex = '1000';
    container.style.pointerEvents = 'auto';
    container.style.touchAction = 'none';
    container.style.userSelect = 'none';
    container.style.webkitUserSelect = 'none';

    // 设置位置
    this.applyPosition(container);

    // 设置尺寸
    container.style.width = `${this.config.size}px`;
    container.style.height = `${this.config.size}px`;
    container.style.opacity = String(this.config.opacity);

    return container;
  }

  /**
   * 应用位置
   */
  private applyPosition(element: HTMLElement): void {
    switch (this.config.position) {
      case 'left':
        element.style.left = `${this.config.offset.x}px`;
        element.style.bottom = `${this.config.offset.y}px`;
        element.style.right = 'auto';
        element.style.top = 'auto';
        break;
      case 'right':
        element.style.right = `${this.config.offset.x}px`;
        element.style.bottom = `${this.config.offset.y}px`;
        element.style.left = 'auto';
        element.style.top = 'auto';
        break;
      case 'custom':
        // 不设置位置，由外部控制
        break;
    }
  }

  /**
   * 创建底座元素
   */
  private createBase(): HTMLElement {
    const base = document.createElement('div');
    base.className = 'joystick-base';
    base.style.width = '100%';
    base.style.height = '100%';
    base.style.borderRadius = '50%';
    base.style.background = this.config.baseColor;
    base.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    base.style.boxSizing = 'border-box';
    base.style.display = 'flex';
    base.style.justifyContent = 'center';
    base.style.alignItems = 'center';

    return base;
  }

  /**
   * 创建摇杆元素
   */
  private createKnob(): HTMLElement {
    const knob = document.createElement('div');
    knob.className = 'joystick-knob';
    const knobSize = this.config.size * 0.4;
    knob.style.width = `${knobSize}px`;
    knob.style.height = `${knobSize}px`;
    knob.style.borderRadius = '50%';
    knob.style.background = this.config.knobColor;
    knob.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
    knob.style.transition = 'transform 0.1s ease-out';

    return knob;
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    // 触摸事件
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

    // 鼠标事件（用于桌面调试）
    this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  /**
   * 处理触摸开始
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.activeTouchId !== null) return;

    const touch = event.changedTouches[0];
    this.activeTouchId = touch.identifier;

    // 计算中心点
    const rect = this.container.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;

    // 更新状态
    this.state.active = true;

    // 移动摇杆
    this.updateKnob(touch.clientX, touch.clientY);

    // 触发回调
    this.startCallbacks.forEach((cb) => cb());
    this.moveCallbacks.forEach((cb) => cb(this.state));
  }

  /**
   * 处理触摸移动
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.activeTouchId === null) return;

    // 找到对应的触控点
    let touch: Touch | null = null;
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === this.activeTouchId) {
        touch = event.changedTouches[i];
        break;
      }
    }

    if (!touch) return;

    // 更新摇杆位置
    this.updateKnob(touch.clientX, touch.clientY);
  }

  /**
   * 处理触摸结束
   */
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();

    // 检查是否是当前摇杆的触控结束
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === this.activeTouchId) {
        this.resetKnob();
        this.activeTouchId = null;
        break;
      }
    }
  }

  /**
   * 处理鼠标按下
   */
  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();

    const rect = this.container.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;

    this.state.active = true;
    this.updateKnob(event.clientX, event.clientY);

    this.startCallbacks.forEach((cb) => cb());
    this.moveCallbacks.forEach((cb) => cb(this.state));
  }

  /**
   * 处理鼠标移动
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.state.active) return;

    this.updateKnob(event.clientX, event.clientY);
  }

  /**
   * 处理鼠标释放
   */
  private handleMouseUp(_event: MouseEvent): void {
    if (!this.state.active) return;

    this.resetKnob();
    this.state.active = false;

    this.endCallbacks.forEach((cb) => cb());
    this.moveCallbacks.forEach((cb) => cb(this.state));
  }

  /**
   * 更新摇杆位置
   */
  private updateKnob(clientX: number, clientY: number): void {
    // 计算偏移
    let deltaX = clientX - this.centerX;
    let deltaY = clientY - this.centerY;

    // 计算距离和角度
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX);

    // 限制距离
    const maxDistance = this.config.maxDistance;
    if (distance > maxDistance) {
      deltaX = Math.cos(angle) * maxDistance;
      deltaY = Math.sin(angle) * maxDistance;
    }

    // 应用到摇杆
    const knobSize = this.config.size * 0.4;
    const halfKnobSize = knobSize / 2;
    this.knobElement.style.transform = `translate(${deltaX - halfKnobSize}px, ${deltaY - halfKnobSize}px)`;

    // 计算归一化值
    let normalizedDistance = distance / maxDistance;

    // 应用死区
    if (normalizedDistance < this.config.deadZone) {
      normalizedDistance = 0;
    } else {
      normalizedDistance =
        (normalizedDistance - this.config.deadZone) / (1 - this.config.deadZone);
    }

    // 更新状态
    const normalizedX = (Math.cos(angle) * normalizedDistance);
    const normalizedY = (Math.sin(angle) * normalizedDistance);

    this.state = {
      x: Math.abs(deltaX) < 0.1 ? 0 : normalizedX,
      y: Math.abs(deltaY) < 0.1 ? 0 : -normalizedY, // 反转Y轴（向前为负）
      active: true,
      angle,
      distance: normalizedDistance,
    };

    // 移除过渡效果（移动时）
    this.knobElement.style.transition = 'none';

    // 触发回调
    this.moveCallbacks.forEach((cb) => cb(this.state));
  }

  /**
   * 重置摇杆位置
   */
  private resetKnob(): void {
    this.knobElement.style.transition = 'transform 0.2s ease-out';
    this.knobElement.style.transform = 'translate(-50%, -50%)';

    this.state = {
      x: 0,
      y: 0,
      active: false,
      angle: 0,
      distance: 0,
    };
  }

  /**
   * 添加到DOM
   */
  public appendTo(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  /**
   * 从DOM移除
   */
  public remove(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * 获取当前位置状态
   */
  public getState(): JoystickState {
    return { ...this.state };
  }

  /**
   * 注册移动回调
   */
  public onMove(callback: (state: JoystickState) => void): void {
    this.moveCallbacks.push(callback);
  }

  /**
   * 注册开始回调
   */
  public onStart(callback: () => void): void {
    this.startCallbacks.push(callback);
  }

  /**
   * 注册结束回调
   */
  public onEnd(callback: () => void): void {
    this.endCallbacks.push(callback);
  }

  /**
   * 设置位置
   */
  public setPosition(position: 'left' | 'right' | 'custom', offset?: { x: number; y: number }): void {
    this.config.position = position;
    if (offset) {
      this.config.offset = offset;
    }
    this.applyPosition(this.container);
  }

  /**
   * 设置死区
   */
  public setDeadZone(deadZone: number): void {
    this.config.deadZone = Math.max(0, Math.min(1, deadZone));
  }

  /**
   * 设置最大距离
   */
  public setMaxDistance(distance: number): void {
    this.config.maxDistance = distance;
  }

  /**
   * 设置可见性
   */
  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * 设置透明度
   */
  public setOpacity(opacity: number): void {
    this.container.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  }

  /**
   * 获取DOM边界
   */
  public getBoundingClientRect(): DOMRect {
    return this.container.getBoundingClientRect();
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.remove();
    this.moveCallbacks = [];
    this.startCallbacks = [];
    this.endCallbacks = [];
  }
}

export default VirtualJoystick;
