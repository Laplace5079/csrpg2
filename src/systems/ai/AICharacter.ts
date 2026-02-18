/**
 * AICharacter.ts - AI角色基类
 * 所有AI角色的基类，提供基础的状态管理和行为执行
 */

import * as THREE from 'three';
import { 
  BehaviorTree, 
  BTContext, 
  NodeStatus,
  createEnemyBehaviorTree 
} from './BehaviorTree';

// ============== AI角色类型 ==============
export enum AICharacterType {
  GRUNT = 'grunt',           // 杂兵/变异体
  SOLDIER = 'soldier',       // 精英士兵
  HEAVY = 'heavy',           // 重装兵
  BOMBER = 'bomber',         // 自爆兵
  BOSS = 'boss',             // Boss
}

// ============== AI状态 ==============
export enum AIState {
  IDLE = 'idle',
  PATROL = 'patrol',
  CHASE = 'chase',
  ATTACK = 'attack',
  RETREAT = 'retreat',
  COVER = 'cover',
  DEAD = 'dead',
  STUNNED = 'stunned',
}

// ============== 感知系统 ==============
export interface PerceptionData {
  hasLineOfSight: boolean;
  distanceToTarget: number;
  lastSeenTime: number;
  hearingRange: number;
  viewAngle: number;
  viewDistance: number;
}

// ============== 移动配置 ==============
export interface MovementConfig {
  walkSpeed: number;
  runSpeed: number;
  patrolSpeed: number;
  rotationSpeed: number;
  acceleration: number;
  deceleration: number;
  minDistance: number;       // 最小攻击距离
  maxDistance: number;       // 最大攻击距离
  retreatDistance: number;  // 撤退距离
}

// ============== AI配置 ==============
export interface AIConfig {
  type: AICharacterType;
  health: number;
  armor: number;
  damage: number;
  movement: MovementConfig;
  perception: Partial<PerceptionData>;
  patrolPoints?: THREE.Vector3[];
  coverSpots?: THREE.Vector3[];
}

// ============== 默认配置 ==============
const DEFAULT_MOVEMENT: MovementConfig = {
  walkSpeed: 2.0,
  runSpeed: 4.0,
  patrolSpeed: 1.5,
  rotationSpeed: 5.0,
  acceleration: 10.0,
  deceleration: 8.0,
  minDistance: 5.0,
  maxDistance: 20.0,
  retreatDistance: 0.3,  // 30% 血量
};

const DEFAULT_PERCEPTION: PerceptionData = {
  hasLineOfSight: false,
  distanceToTarget: Infinity,
  lastSeenTime: 0,
  hearingRange: 30.0,
  viewAngle: Math.PI / 3,  // 60度
  viewDistance: 40.0,
};

// ============== AI角色基类 ==============
export class AICharacter {
  // ========== 唯一标识 ==========
  id: string;
  name: string;
  
  // ========== 类型 ==========
  characterType: AICharacterType;
  
  // ========== Three.js 对象引用 ==========
  mesh: THREE.Object3D | null = null;
  
  // ========== 变换 ==========
  position: THREE.Vector3 = new THREE.Vector3();
  rotation: THREE.Euler = new THREE.Euler();
  velocity: THREE.Vector3 = new THREE.Vector3();
  targetPosition: THREE.Vector3 = new THREE.Vector3();
  
  // ========== 战斗属性 ==========
  health: number;
  maxHealth: number;
  armor: number;
  damage: number;
  
  // ========== 状态 ==========
  state: AIState = AIState.IDLE;
  previousState: AIState = AIState.IDLE;
  isAlive: boolean = true;
  isStunned: boolean = false;
  stunTime: number = 0;
  
  // ========== 行为系统 ==========
  behaviorTree: BehaviorTree | null = null;
  
  // ========== 目标 ==========
  target: THREE.Object3D | null = null;
  lastKnownTargetPosition: THREE.Vector3 = new THREE.Vector3();
  
  // ========== 移动配置 ==========
  movementConfig: MovementConfig;
  
  // ========== 感知系统 ==========
  perception: PerceptionData;
  
  // ========== 巡逻点 ==========
  patrolPoints: THREE.Vector3[] = [];
  currentPatrolIndex: number = 0;
  patrolWaitTime: number = 0;
  patrolDirection: number = 1;
  
  // ========== 掩体点 ==========
  coverSpots: THREE.Vector3[] = [];
  currentCoverSpot: THREE.Vector3 | null = null;
  coverTimer: number = 0;
  
  // ========== 攻击系统 ==========
  attackCooldown: number = 0;
  attackRate: number = 1.0;  // 每秒攻击次数
  lastAttackTime: number = 0;
  
  // ========== 事件回调 ==========
  onDeathCallbacks: Array<() => void> = [];
  onDamageCallbacks: Array<(amount: number, source: THREE.Object3D | null) => void> = [];
  onStateChangeCallbacks: Array<(newState: AIState, oldState: AIState) => void> = [];

  // ========== 构造函数 ==========
  constructor(id: string, name: string, config: AIConfig) {
    this.id = id;
    this.name = name;
    this.characterType = config.type;
    
    // 战斗属性
    this.maxHealth = config.health;
    this.health = config.health;
    this.armor = config.armor;
    this.damage = config.damage;
    
    // 配置
    this.movementConfig = { ...DEFAULT_MOVEMENT, ...config.movement };
    this.perception = { ...DEFAULT_PERCEPTION, ...config.perception };
    
    // 巡逻点
    if (config.patrolPoints) {
      this.patrolPoints = config.patrolPoints;
    }
    
    // 掩体点
    if (config.coverSpots) {
      this.coverSpots = config.coverSpots;
    }
    
    // 创建默认行为树
    this.behaviorTree = createEnemyBehaviorTree();
  }

  // ========== 设置Mesh引用 ==========
  setMesh(mesh: THREE.Object3D): void {
    this.mesh = mesh;
    this.position = mesh.position;
  }

  // ========== 设置目标 ==========
  setTarget(target: THREE.Object3D | null): void {
    this.target = target;
    if (target) {
      this.lastKnownTargetPosition.copy(target.position);
      this.perception.lastSeenTime = Date.now();
    }
  }

  // ========== 状态管理 ==========
  setState(newState: AIState): void {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.previousState = oldState;
    this.state = newState;
    
    // 退出旧状态
    this.onExitState(oldState);
    
    // 进入新状态
    this.onEnterState(newState);
    
    // 触发回调
    this.onStateChangeCallbacks.forEach(cb => cb(newState, oldState));
  }

  protected onEnterState(state: AIState): void {
    switch (state) {
      case AIState.PATROL:
        this.velocity.set(0, 0, 0);
        break;
      case AIState.COVER:
        this.coverTimer = 0;
        break;
    }
  }

  protected onExitState(state: AIState): void {
    switch (state) {
      case AIState.COVER:
        this.currentCoverSpot = null;
        break;
    }
  }

  // ========== 感知更新 ==========
  updatePerception(deltaTime: number): void {
    if (!this.target || !this.isAlive) {
      this.perception.hasLineOfSight = false;
      this.perception.distanceToTarget = Infinity;
      return;
    }

    // 计算距离
    this.perception.distanceToTarget = this.position.distanceTo(this.target.position);
    
    // 检查视线
    this.perception.hasLineOfSight = this.checkLineOfSight();
    
    // 更新最后已知位置
    if (this.perception.hasLineOfSight) {
      this.lastKnownTargetPosition.copy(this.target.position);
      this.perception.lastSeenTime = Date.now();
    }
  }

  protected checkLineOfSight(): boolean {
    if (!this.target) return false;
    
    // 简单检查：距离和角度
    const toTarget = new THREE.Vector3().subVectors(
      this.target.position, 
      this.position
    );
    const distance = toTarget.length();
    
    if (distance > this.perception.viewDistance) return false;
    
    // 检查角度
    const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.rotation);
    const angle = forward.angleTo(toTarget.normalize());
    
    if (angle > this.perception.viewAngle / 2) return false;
    
    // TODO: 射线检测（需要场景引用）
    return true;
  }

  // ========== 移动控制 ==========
  moveToward(targetPos: THREE.Vector3, speed: number, deltaTime: number): void {
    const direction = new THREE.Vector3().subVectors(targetPos, this.position);
    direction.y = 0;  // 保持水平移动
    
    if (direction.length() > 0.1) {
      direction.normalize();
      
      // 旋转朝向
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.rotation.y = THREE.MathUtils.lerp(
        this.rotation.y,
        targetRotation,
        this.movementConfig.rotationSpeed * deltaTime
      );
      
      // 移动
      this.velocity.x = direction.x * speed;
      this.velocity.z = direction.z * speed;
    } else {
      // 停止
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  stop(): void {
    this.velocity.set(0, 0, 0);
  }

  // ========== 行为接口（供行为树调用） ==========
  onRetreat(): void {
    this.setState(AIState.RETREAT);
  }

  onApproachTarget(target: THREE.Object3D): void {
    const distance = this.position.distanceTo(target.position);
    
    if (distance > this.movementConfig.maxDistance) {
      this.setState(AIState.CHASE);
      this.moveToward(target.position, this.movementConfig.runSpeed, 1/60);
    } else if (distance < this.movementConfig.minDistance) {
      // 后退
      const retreatDir = new THREE.Vector3().subVectors(this.position, target.position);
      retreatDir.normalize().multiplyScalar(0.5);
      this.moveToward(
        this.position.clone().add(retreatDir),
        this.movementConfig.walkSpeed,
        1/60
      );
    } else {
      this.setState(AIState.ATTACK);
    }
  }

  onAttack(target: THREE.Object3D): void {
    this.setState(AIState.ATTACK);
    
    // 攻击冷却检查
    const now = Date.now();
    if (now - this.lastAttackTime > 1000 / this.attackRate) {
      this.performAttack();
      this.lastAttackTime = now;
    }
  }

  protected performAttack(): void {
    // 子类实现具体攻击逻辑
    console.log(`${this.name} attacks ${this.target?.name}`);
  }

  onPatrol(): void {
    this.setState(AIState.PATROL);
    
    if (this.patrolPoints.length === 0) {
      this.setState(AIState.IDLE);
      return;
    }

    // 等待时间
    if (this.patrolWaitTime > 0) {
      this.patrolWaitTime -= 1/60;
      return;
    }

    const targetPoint = this.patrolPoints[this.currentPatrolIndex];
    const distance = this.position.distanceTo(targetPoint);
    
    if (distance < 1.0) {
      // 到达下一个点
      this.currentPatrolIndex += this.patrolDirection;
      
      // 循环
      if (this.currentPatrolIndex >= this.patrolPoints.length) {
        this.currentPatrolIndex = this.patrolPoints.length - 1;
        this.patrolDirection = -1;
      } else if (this.currentPatrolIndex < 0) {
        this.currentPatrolIndex = 0;
        this.patrolDirection = 1;
      }
      
      // 等待
      this.patrolWaitTime = 2.0;
    } else {
      this.moveToward(targetPoint, this.movementConfig.patrolSpeed, 1/60);
    }
  }

  // ========== 寻找最近掩体 ==========
  findNearestCover(): THREE.Vector3 | null {
    if (this.coverSpots.length === 0) return null;
    
    let nearest: THREE.Vector3 | null = null;
    let nearestDist = Infinity;
    
    for (const cover of this.coverSpots) {
      const dist = this.position.distanceTo(cover);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = cover;
      }
    }
    
    return nearest;
  }

  // ========== 伤害处理 ==========
  takeDamage(amount: number, source: THREE.Object3D | null = null): void {
    if (!this.isAlive) return;
    
    // 护甲减伤
    let damage = amount;
    if (this.armor > 0) {
      const armorDamage = Math.min(this.armor, damage * 0.5);
      this.armor -= armorDamage;
      damage -= armorDamage;
    }
    
    this.health -= damage;
    
    // 伤害回调
    this.onDamageCallbacks.forEach(cb => cb(amount, source));
    
    // 死亡检查
    if (this.health <= 0) {
      this.die();
    }
    
    // 尝试寻找掩体
    if (this.armor > 0 && this.characterType === AICharacterType.SOLDIER) {
      const cover = this.findNearestCover();
      if (cover) {
        this.currentCoverSpot = cover;
        this.setState(AIState.COVER);
      }
    }
  }

  // ========== 死亡处理 ==========
  die(): void {
    this.isAlive = false;
    this.health = 0;
    this.setState(AIState.DEAD);
    this.stop();
    
    // 死亡回调
    this.onDeathCallbacks.forEach(cb => cb());
  }

  // ========== 击晕 ==========
  stun(duration: number): void {
    this.isStunned = true;
    this.stunTime = duration;
    this.setState(AIState.STUNNED);
    this.stop();
  }

  // ========== 事件注册 ==========
  onDeath(callback: () => void): void {
    this.onDeathCallbacks.push(callback);
  }

  onDamage(callback: (amount: number, source: THREE.Object3D | null) => void): void {
    this.onDamageCallbacks.push(callback);
  }

  onStateChange(callback: (newState: AIState, oldState: AIState) => void): void {
    this.onStateChangeCallbacks.push(callback);
  }

  // ========== 主更新循环 ==========
  update(deltaTime: number): void {
    if (!this.isAlive) return;
    
    // 击晕处理
    if (this.isStunned) {
      this.stunTime -= deltaTime;
      if (this.stunTime <= 0) {
        this.isStunned = false;
        this.setState(this.previousState);
      }
      return;
    }
    
    // 感知更新
    this.updatePerception(deltaTime);
    
    // 行为树更新
    if (this.behaviorTree) {
      const context = this.createBTContext();
      this.behaviorTree.setContext(context);
      this.behaviorTree.update(deltaTime);
    }
    
    // 应用速度
    if (this.mesh) {
      this.mesh.position.x += this.velocity.x * deltaTime;
      this.mesh.position.z += this.velocity.z * deltaTime;
      this.mesh.rotation.y = this.rotation.y;
    }
    
    // 更新位置引用
    this.position.copy(this.mesh?.position || this.position);
  }

  // ========== 创建行为树上下文 ==========
  protected createBTContext(): BTContext {
    return {
      self: this,
      target: this.target,
      position: this.position.clone(),
      rotation: this.rotation.clone(),
      velocity: this.velocity.clone(),
      isAlive: this.isAlive,
      health: this.health,
      maxHealth: this.maxHealth,
      armor: this.armor,
      hasLineOfSight: this.perception.hasLineOfSight,
      distanceToTarget: this.perception.distanceToTarget,
      isInCover: this.state === AIState.COVER,
      patrolPoints: this.patrolPoints,
      currentPatrolIndex: this.currentPatrolIndex,
      coverSpots: this.coverSpots,
      custom: {},
    };
  }
}

export default AICharacter;
