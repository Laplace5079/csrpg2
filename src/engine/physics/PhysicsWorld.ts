/**
 * PhysicsWorld.ts - Cannon-es物理世界
 * 包含物理模拟、碰撞检测和刚体管理
 */

import * as CANNON from 'cannon-es';

export interface PhysicsConfig {
  gravity?: number;
  iterations?: number;
  tolerance?: number;
  broadphase?: 'SAP' | 'Naive' | 'Grid';
  allowSleep?: boolean;
  fixedTimeStep?: number;
  maxSubSteps?: number;
}

export interface RigidBodyConfig {
  mass?: number;
  position?: CANNON.Vec3;
  quaternion?: CANNON.Quaternion;
  shape: CANNON.Shape;
  material?: CANNON.Material;
  linearDamping?: number;
  angularDamping?: number;
  fixedRotation?: boolean;
  collisionFilterGroup?: number;
  collisionFilterMask?: number;
}

export interface CollisionEvent {
  bodyA: CANNON.Body;
  bodyB: CANNON.Body;
  contact: CANNON.ContactEquation;
}

export type CollisionCallback = (event: CollisionEvent) => void;

export class PhysicsWorld {
  private world: CANNON.World;
  private bodies: Map<string, CANNON.Body> = new Map();
  private materials: Map<string, CANNON.Material> = new Map();

  // 配置
  private fixedTimeStep: number;
  private maxSubSteps: number;

  // 碰撞回调
  private collisionCallbacks: Map<string, CollisionCallback[]> = new Map();

  // 调试渲染器
  private debugRenderer: ((body: CANNON.Body) => void) | null = null;

  // 状态
  private isPaused: boolean = false;
  private lastTime: number = 0;

  constructor(config: PhysicsConfig = {}) {
    // 创建物理世界
    this.world = new CANNON.World();

    // 设置重力
    this.world.gravity.set(0, -(config.gravity ?? 9.82), 0);

    // 设置求解器参数
    this.world.solver.iterations = config.iterations ?? 10;
    this.world.solver.tolerance = config.tolerance ?? 0.001;

    // 设置宽相算法
    switch (config.broadphase) {
      case 'SAP':
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        break;
      case 'Grid':
        this.world.broadphase = new CANNON.GridBroadphase(this.world);
        break;
      case 'Naive':
      default:
        this.world.broadphase = new CANNON.NaiveBroadphase(this.world);
        break;
    }

    // 允许休眠
    this.world.allowSleep = config.allowSleep ?? true;

    // 时间步长
    this.fixedTimeStep = config.fixedTimeStep ?? 1 / 60;
    this.maxSubSteps = config.maxSubSteps ?? 3;

    // 初始化默认材质
    this.initDefaultMaterials();
  }

  /**
   * 初始化默认材质
   */
  private initDefaultMaterials(): void {
    // 创建默认材质
    const defaultMaterial = new CANNON.Material('default');
    const groundMaterial = new CANNON.Material('ground');
    const playerMaterial = new CANNON.Material('player');
    const objectMaterial = new CANNON.Material('object');

    this.materials.set('default', defaultMaterial);
    this.materials.set('ground', groundMaterial);
    this.materials.set('player', playerMaterial);
    this.materials.set('object', objectMaterial);

    // 创建接触材质
    const defaultContact = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
      friction: 0.3,
      restitution: 0.3,
    });

    const groundPlayerContact = new CANNON.ContactMaterial(groundMaterial, playerMaterial, {
      friction: 0.5,
      restitution: 0.0,
    });

    const groundObjectContact = new CANNON.ContactMaterial(groundMaterial, objectMaterial, {
      friction: 0.4,
      restitution: 0.2,
    });

    // 添加接触材质
    this.world.addContactMaterial(defaultContact);
    this.world.addContactMaterial(groundPlayerContact);
    this.world.addContactMaterial(groundObjectContact);
  }

  /**
   * 获取材质
   */
  public getMaterial(name: string): CANNON.Material | undefined {
    return this.materials.get(name);
  }

  /**
   * 创建材质
   */
  public createMaterial(
    name: string,
    friction: number = 0.3,
    restitution: number = 0.3
  ): CANNON.Material {
    const material = new CANNON.Material(name);
    this.materials.set(name, material);

    // 创建与其他材质的接触
    this.materials.forEach((otherMat, otherName) => {
      if (otherName !== name) {
        const contact = new CANNON.ContactMaterial(material, otherMat, {
          friction,
          restitution,
        });
        this.world.addContactMaterial(contact);
      }
    });

    return material;
  }

  /**
   * 添加刚体
   */
  public addBody(id: string, config: RigidBodyConfig): CANNON.Body {
    const {
      mass = 0,
      position = new CANNON.Vec3(0, 0, 0),
      quaternion = new CANNON.Quaternion(0, 0, 0, 1),
      shape,
      material,
      linearDamping = 0.01,
      angularDamping = 0.01,
      fixedRotation = false,
      collisionFilterGroup = 1,
      collisionFilterMask = -1,
    } = config;

    const body = new CANNON.Body({
      mass,
      position,
      quaternion,
      shape,
      material: material || this.materials.get('default'),
      linearDamping,
      angularDamping,
      fixedRotation,
      collisionFilterGroup,
      collisionFilterMask,
    });

    // 绑定用户ID
    body.userData = { id };

    // 添加到世界
    this.world.addBody(body);
    this.bodies.set(id, body);

    // 启用碰撞事件
    body.addEventListener('collide', (e: any) => {
      this.handleCollision(id, e);
    });

    return body;
  }

  /**
   * 移除刚体
   */
  public removeBody(id: string): boolean {
    const body = this.bodies.get(id);
    if (body) {
      this.world.removeBody(body);
      this.bodies.delete(id);
      return true;
    }
    return false;
  }

  /**
   * 获取刚体
   */
  public getBody(id: string): CANNON.Body | undefined {
    return this.bodies.get(id);
  }

  /**
   * 处理碰撞事件
   */
  private handleCollision(bodyId: string, event: any): void {
    const callbacks = this.collisionCallbacks.get(bodyId);
    if (callbacks) {
      const otherBody = event.body;
      const contact = event.contact;

      callbacks.forEach((callback) => {
        callback({
          bodyA: event.body,
          bodyB: event.target,
          contact,
        });
      });
    }
  }

  /**
   * 注册碰撞回调
   */
  public onCollision(bodyId: string, callback: CollisionCallback): void {
    const callbacks = this.collisionCallbacks.get(bodyId) || [];
    callbacks.push(callback);
    this.collisionCallbacks.set(bodyId, callbacks);
  }

  /**
   * 移除碰撞回调
   */
  public offCollision(bodyId: string): void {
    this.collisionCallbacks.delete(bodyId);
  }

  /**
   * 创建球体刚体
   */
  public addSphere(
    id: string,
    radius: number,
    position: CANNON.Vec3,
    mass: number = 1,
    materialName: string = 'default'
  ): CANNON.Body {
    const shape = new CANNON.Sphere(radius);
    return this.addBody(id, {
      shape,
      position,
      mass,
      material: this.materials.get(materialName),
    });
  }

  /**
   * 创建盒状刚体
   */
  public addBox(
    id: string,
    halfExtents: CANNON.Vec3,
    position: CANNON.Vec3,
    mass: number = 1,
    materialName: string = 'default'
  ): CANNON.Body {
    const shape = new CANNON.Box(halfExtents);
    return this.addBody(id, {
      shape,
      position,
      mass,
      material: this.materials.get(materialName),
    });
  }

  /**
   * 创建平面刚体（地面）
   */
  public addPlane(
    id: string,
    normal: CANNON.Vec3 = new CANNON.Vec3(0, 1, 0),
    position: CANNON.Vec3 = new CANNON.Vec3(0, 0, 0),
    materialName: string = 'ground'
  ): CANNON.Body {
    const shape = new CANNON.Plane();
    const body = this.addBody(id, {
      shape,
      position,
      mass: 0,
      material: this.materials.get(materialName),
    });

    // 旋转平面使其朝上
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    body.quaternion = quat;

    return body;
  }

  /**
   * 创建静态地形
   */
  public addHeightfield(
    id: string,
    heightData: number[][],
    elementSize: number,
    position: CANNON.Vec3,
    materialName: string = 'ground'
  ): CANNON.Body {
    // 转换高度数据为一维数组
    const data = heightData.flat();

    const shape = new CANNON.Heightfield(data, {
      elementSize,
    });

    return this.addBody(id, {
      shape,
      position,
      mass: 0,
      material: this.materials.get(materialName),
    });
  }

  /**
   * 应用力到刚体
   */
  public applyForce(bodyId: string, force: CANNON.Vec3, point?: CANNON.Vec3): boolean {
    const body = this.bodies.get(bodyId);
    if (body) {
      body.applyForce(force, point || body.position);
      return true;
    }
    return false;
  }

  /**
   * 应用冲量到刚体
   */
  public applyImpulse(bodyId: string, impulse: CANNON.Vec3, point?: CANNON.Vec3): boolean {
    const body = this.bodies.get(bodyId);
    if (body) {
      body.applyImpulse(impulse, point || body.position);
      return true;
    }
    return false;
  }

  /**
   * 设置刚体速度
   */
  public setVelocity(bodyId: string, velocity: CANNON.Vec3): boolean {
    const body = this.bodies.get(bodyId);
    if (body) {
      body.velocity.copy(velocity);
      return true;
    }
    return false;
  }

  /**
   * 获取刚体速度
   */
  public getVelocity(bodyId: string): CANNON.Vec3 | null {
    const body = this.bodies.get(bodyId);
    return body ? body.velocity.clone() : null;
  }

  /**
   * 设置刚体位置
   */
  public setPosition(bodyId: string, position: CANNON.Vec3): boolean {
    const body = this.bodies.get(bodyId);
    if (body) {
      body.position.copy(position);
      return true;
    }
    return false;
  }

  /**
   * 获取刚体位置
   */
  public getPosition(bodyId: string): CANNON.Vec3 | null {
    const body = this.bodies.get(bodyId);
    return body ? body.position.clone() : null;
  }

  /**
   * 设置刚体旋转
   */
  public setQuaternion(bodyId: string, quaternion: CANNON.Quaternion): boolean {
    const body = this.bodies.get(bodyId);
    if (body) {
      body.quaternion.copy(quaternion);
      return true;
    }
    return false;
  }

  /**
   * 获取刚体旋转
   */
  public getQuaternion(bodyId: string): CANNON.Quaternion | null {
    const body = this.bodies.get(bodyId);
    return body ? body.quaternion.clone() : null;
  }

  /**
   * 唤醒刚体
   */
  public wakeUp(bodyId: string): boolean {
    const body = this.bodies.get(bodyId);
    if (body) {
      body.wakeUp();
      return true;
    }
    return false;
  }

  /**
   * 休眠刚体
   */
  public sleep(bodyId: string): boolean {
    const body = this.bodies.get(bodyId);
    if (body) {
      body.sleep();
      return true;
    }
    return false;
  }

  /**
   * 射线检测
   */
  public raycast(
    from: CANNON.Vec3,
    to: CANNON.Vec3,
    options?: {
      collisionFilterGroup?: number;
      collisionFilterMask?: number;
      skipBackfaces?: boolean;
    }
  ): CANNON.RaycastResult {
    const result = new CANNON.RaycastResult();

    const ray = new CANNON.Ray(from, to, {
      collisionFilterGroup: options?.collisionFilterGroup ?? -1,
      collisionFilterMask: options?.collisionFilterMask ?? -1,
      skipBackfaces: options?.skipBackfaces ?? true,
    });

    ray.intersectWorld(this.world, { mode: CANNON.Ray.CLOSEST, result });

    return result;
  }

  /**
   * 更新物理世界
   */
  public update(deltaTime?: number): void {
    if (this.isPaused) return;

    const time = performance.now() / 1000;

    if (!this.lastTime) {
      this.lastTime = time;
      return;
    }

    const dt = deltaTime !== undefined ? deltaTime : time - this.lastTime;
    this.lastTime = time;

    // 固定时间步长更新
    this.world.step(this.fixedTimeStep, dt, this.maxSubSteps);
  }

  /**
   * 暂停物理模拟
   */
  public pause(): void {
    this.isPaused = true;
  }

  /**
   * 恢复物理模拟
   */
  public resume(): void {
    this.isPaused = false;
    this.lastTime = 0;
  }

  /**
   * 获取物理世界
   */
  public getWorld(): CANNON.World {
    return this.world;
  }

  /**
   * 获取所有刚体
   */
  public getAllBodies(): Map<string, CANNON.Body> {
    return this.bodies;
  }

  /**
   * 同步Three.js对象到物理世界
   */
  public syncToThreeJS(
    bodyId: string,
    threeObject: { position: any; quaternion: any }
  ): boolean {
    const body = this.bodies.get(bodyId);
    if (body) {
      threeObject.position.set(body.position.x, body.position.y, body.position.z);
      threeObject.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w
      );
      return true;
    }
    return false;
  }

  /**
   * 同步物理世界到Three.js对象
   */
  public syncFromThreeJS(
    bodyId: string,
    threeObject: { position: any; quaternion: any }
  ): boolean {
    const body = this.bodies.get(bodyId);
    if (body) {
      body.position.set(
        threeObject.position.x,
        threeObject.position.y,
        threeObject.position.z
      );
      body.quaternion.set(
        threeObject.quaternion.x,
        threeObject.quaternion.y,
        threeObject.quaternion.z,
        threeObject.quaternion.w
      );
      return true;
    }
    return false;
  }

  /**
   * 设置调试渲染器
   */
  public setDebugRenderer(renderer: (body: CANNON.Body) => void): void {
    this.debugRenderer = renderer;
  }

  /**
   * 渲染调试信息
   */
  public debugRender(): void {
    if (this.debugRenderer) {
      this.bodies.forEach((body) => {
        this.debugRenderer!(body);
      });
    }
  }

  /**
   * 获取世界状态
   */
  public getState(): {
    isPaused: boolean;
    bodyCount: number;
    gravity: CANNON.Vec3;
  } {
    return {
      isPaused: this.isPaused,
      bodyCount: this.bodies.size,
      gravity: this.world.gravity.clone(),
    };
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.isPaused = true;

    // 移除所有刚体
    this.bodies.forEach((body, id) => {
      this.world.removeBody(body);
    });
    this.bodies.clear();

    // 清除碰撞回调
    this.collisionCallbacks.clear();

    // 清除材质
    this.materials.clear();
  }
}

export default PhysicsWorld;
