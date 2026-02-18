/**
 * Enemy/Soldier.ts - 精英士兵AI
 * 高智能敌人，会寻找和使用掩体，战术机动
 */

import * as THREE from 'three';
import { AICharacter, AICharacterType, AIState, AIConfig } from '../AICharacter';
import { BTSequence, BTSelector, BTCondition, BTAction, NodeStatus } from '../BehaviorTree';

// ============== 精英士兵配置 ==============
const SOLDIER_CONFIG: AIConfig = {
  type: AICharacterType.SOLDIER,
  health: 120,
  armor: 30,
  damage: 20,
  movement: {
    walkSpeed: 2.5,
    runSpeed: 4.0,
    patrolSpeed: 1.5,
    rotationSpeed: 8.0,       // 更快的转向
    acceleration: 12.0,
    deceleration: 15.0,
    minDistance: 8.0,         // 保持一定距离
    maxDistance: 30.0,
    retreatDistance: 0.4,    // 40% 血量
  },
  perception: {
    hearingRange: 40.0,
    viewAngle: Math.PI * 0.6, // 约108度
    viewDistance: 50.0,
  },
};

// ============== 掩体状态 ==============
interface CoverState {
  position: THREE.Vector3;
  quality: number;      // 掩体质量 0-1
  direction: THREE.Vector3;  // 掩体朝向（敌人来的方向）
}

// ============== 精英士兵AI ==============
export class Soldier extends AICharacter {
  // 战术属性
  private coverState: CoverState | null = null;
  private coverSearchTimer: number = 0;
  private suppressTimer: number = 0;
  private repositionTimer: number = 0;
  private grenadeCooldown: number = 0;
  
  // 战术偏好
  prefersHighCover: boolean = true;
  usesGrenades: boolean = true;
  suppressesEnemy: boolean = true;
  
  // 攻击模式
  private isSuppressing: boolean = false;
  private burstCount: number = 0;
  private burstSize: number = 3;  // 3发点射
  
  constructor(
    id: string, 
    name: string, 
    position?: THREE.Vector3,
    coverSpots?: THREE.Vector3[]
  ) {
    super(id, name, SOLDIER_CONFIG);
    
    if (position) {
      this.position.copy(position);
    }
    
    if (coverSpots) {
      this.coverSpots = coverSpots;
    }
    
    // 设置战术行为树
    this.setupTacticalBehaviorTree();
  }

  // ========== 战术行为树 ==========
  private setupTacticalBehaviorTree(): void {
    // 精英士兵使用更复杂的行为树
    // 优先级: 寻找掩体 > 压制射击 > 战术机动 > 巡逻
    
    const root = new BTSelector('soldier_root', [
      // 序列1: 低血量时寻找掩体
      new BTSequence('seekCover', [
        new BTCondition('isHealthLow', (ctx) => ctx.health < ctx.maxHealth * 0.5),
        new BTAction('findCover', (ctx) => {
          this.findAndMoveToCover();
          return NodeStatus.SUCCESS;
        }),
      ]),
      
      // 序列2: 被攻击时寻找掩体
      new BTSequence('coverWhenUnderFire', [
        new BTCondition('isTakingDamage', (ctx) => ctx.custom['isTakingDamage'] as boolean || false),
        new BTAction('emergencyCover', (ctx) => {
          this.findAndMoveToCover();
          return NodeStatus.SUCCESS;
        }),
      ]),
      
      // 序列3: 有目标时战斗
      new BTSequence('combat', [
        new BTCondition('hasTarget', (ctx) => ctx.target !== null),
        new BTSelector('combatActions', [
          // 点射攻击
          new BTSequence('burstFire', [
            new BTCondition('inRange', (ctx) => ctx.distanceToTarget < ctx.custom['maxRange'] as number),
            new BTAction('suppress', (ctx) => {
              this.performBurstFire();
              return NodeStatus.SUCCESS;
            }),
          ]),
          
          // 靠近或后退以保持距离
          new BTSequence('maintainDistance', [
            new BTCondition('outOfRange', (ctx) => ctx.distanceToTarget > (ctx.custom['maxRange'] as number) * 0.8),
            new BTAction('advance', (ctx) => {
              this.tacticalAdvance();
              return NodeStatus.SUCCESS;
            }),
          ]),
          
          // 重新定位
          new BTAction('reposition', (ctx) => {
            this.tacticalReposition();
            return NodeStatus.SUCCESS;
          }),
        ]),
      ]),
      
      // 默认: 巡逻
      new BTAction('patrol', (ctx) => {
        this.onPatrol();
        return NodeStatus.SUCCESS;
      }),
    ]);

    // 使用自定义行为树
    const { BehaviorTree } = require('../BehaviorTree');
    this.behaviorTree = new BehaviorTree(root, {
      custom: {
        maxRange: this.movementConfig.maxDistance,
        isTakingDamage: false,
      },
    });
  }

  // ========== 更新 ==========
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

    // 冷却更新
    this.updateTimers(deltaTime);

    // 感知更新
    this.updatePerception(deltaTime);

    // 战术AI
    if (this.target && this.perception.hasLineOfSight) {
      this.executeTacticalAI(deltaTime);
    } else if (this.patrolPoints.length > 0) {
      this.executePatrol(deltaTime);
    } else {
      this.setState(AIState.IDLE);
    }

    // 应用移动
    this.applyMovement(deltaTime);
    
    // 更新位置引用
    this.position.copy(this.mesh?.position || this.position);
  }

  // ========== 更新计时器 ==========
  private updateTimers(deltaTime: number): void {
    if (this.coverSearchTimer > 0) this.coverSearchTimer -= deltaTime;
    if (this.suppressTimer > 0) this.suppressTimer -= deltaTime;
    if (this.repositionTimer > 0) this.repositionTimer -= deltaTime;
    if (this.grenadeCooldown > 0) this.grenadeCooldown -= deltaTime;
  }

  // ========== 战术AI执行 ==========
  private executeTacticalAI(deltaTime: number): void {
    const distance = this.perception.distanceToTarget;
    
    // 检查是否需要寻找掩体
    if (this.shouldSeekCover()) {
      this.findAndMoveToCover();
      return;
    }
    
    // 保持理想距离
    const idealDistance = (this.movementConfig.minDistance + this.movementConfig.maxDistance) / 2;
    
    if (distance > idealDistance * 1.2) {
      // 太远，靠近
      this.setState(AIState.CHASE);
      this.tacticalAdvance();
    } else if (distance < this.movementConfig.minDistance) {
      // 太近，后退
      this.setState(AIState.RETREAT);
      this.tacticalRetreat();
    } else {
      // 距离合适，压制
      this.setState(AIState.ATTACK);
      this.performBurstFire();
      
      // 偶尔重新定位
      if (this.repositionTimer <= 0) {
        this.tacticalReposition();
        this.repositionTimer = 3.0 + Math.random() * 2.0;
      }
    }
    
    // 扔手雷
    if (this.usesGrenades && this.grenadeCooldown <= 0 && distance < 25) {
      this.throwGrenade();
    }
  }

  // ========== 是否应该寻找掩体 ==========
  private shouldSeekCover(): boolean {
    // 血量低
    if (this.health < this.maxHealth * this.movementConfig.retreatDistance) {
      return true;
    }
    
    // 被压制（持续受到攻击）
    if (this.suppressTimer > 2.0) {
      return true;
    }
    
    return false;
  }

  // ========== 寻找并移动到掩体 ==========
  findAndMoveToCover(): void {
    this.setState(AIState.COVER);
    
    if (this.coverSpots.length === 0) {
      // 没有预设掩体，搜索附近
      this.coverState = this.searchForCover();
    } else {
      // 使用预设掩体
      this.coverState = this.selectBestCover();
    }
    
    if (this.coverState) {
      this.moveToCover(this.coverState.position);
    }
  }

  // ========== 搜索附近掩体 ==========
  private searchForCover(): CoverState | null {
    // 简化的掩体搜索（实际需要射线检测）
    // 假设有一些可用的掩体位置
    
    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(1, 0, 1).normalize(),
      new THREE.Vector3(-1, 0, 1).normalize(),
    ];
    
    for (const dir of directions) {
      const testPos = this.position.clone().add(dir.multiplyScalar(3));
      // 这里的检测需要场景引用，实际应该使用射线检测
      const quality = Math.random() * 0.5 + 0.5;  // 模拟
      
      return {
        position: testPos,
        quality,
        direction: dir.clone().negate(),
      };
    }
    
    return null;
  }

  // ========== 选择最佳掩体 ==========
  private selectBestCover(): CoverState | null {
    if (!this.target) return null;
    
    let bestCover: CoverState | null = null;
    let bestScore = -Infinity;
    
    for (const coverPos of this.coverSpots) {
      // 计算分数：距离近、面向敌人、远离敌人视线
      const distToCover = this.position.distanceTo(coverPos);
      const distToEnemy = coverPos.distanceTo(this.target.position);
      
      // 距离权重
      const distScore = 10 - distToCover;
      
      // 远离敌人权重
      const enemyDistScore = distToEnemy - this.movementConfig.maxDistance;
      
      // 质量分数
      const quality = 0.5 + Math.random() * 0.5;
      
      const totalScore = distScore * 0.3 + enemyDistScore * 0.5 + quality * 0.2;
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestCover = {
          position: coverPos.clone(),
          quality,
          direction: new THREE.Vector3().subVectors(this.target.position, coverPos).normalize(),
        };
      }
    }
    
    return bestCover;
  }

  // ========== 移动到掩体 ==========
  private moveToCover(coverPosition: THREE.Vector3): void {
    const direction = new THREE.Vector3().subVectors(coverPosition, this.position);
    direction.y = 0;
    
    if (direction.length() > 0.5) {
      direction.normalize();
      
      // 旋转
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.rotation.y = THREE.MathUtils.lerp(
        this.rotation.y,
        targetRotation,
        this.movementConfig.rotationSpeed * (1/60)
      );
      
      // 移动
      this.velocity.x = direction.x * this.movementConfig.runSpeed;
      this.velocity.z = direction.z * this.movementConfig.runSpeed;
    } else {
      // 到达掩体
      this.velocity.set(0, 0, 0);
      this.coverTimer = 2.0 + Math.random() * 2.0;  // 在掩体停留
    }
  }

  // ========== 点射 ==========
  private performBurstFire(): void {
    if (this.burstCount <= 0) {
      this.burstCount = this.burstSize;
    }
    
    if (this.burstCount > 0) {
      this.attackCooldown = 0.15;  // 快速点射
      
      if (Date.now() - this.lastAttackTime > this.attackCooldown * 1000) {
        this.performAttack();
        this.burstCount--;
        this.lastAttackTime = Date.now();
      }
    } else {
      // 点射间隔
      this.attackCooldown = 0.5;
    }
  }

  // ========== 执行攻击 ==========
  protected performAttack(): void {
    if (!this.target || !this.isAlive) return;
    
    // 检查距离
    const distance = this.position.distanceTo(this.target.position);
    if (distance > this.movementConfig.maxDistance) return;
    
    console.log(`${this.name} fires burst for ${this.damage} damage!`);
    
    // 压制计时
    if (this.target) {
      // 通知目标被压制
    }
  }

  // ========== 战术前进 ==========
  private tacticalAdvance(): void {
    if (!this.target) return;
    
    const direction = new THREE.Vector3().subVectors(this.target.position, this.position);
    direction.y = 0;
    direction.normalize();
    
    // 侧面移动
    const lateral = new THREE.Vector3(-direction.z, 0, direction.x);
    direction.add(lateral.multiplyScalar(0.3));
    direction.normalize();
    
    this.moveWithCover(direction, this.movementConfig.walkSpeed);
  }

  // ========== 战术后退 ==========
  private tacticalRetreat(): void {
    if (!this.target) return;
    
    const direction = new THREE.Vector3().subVectors(this.position, this.target.position);
    direction.y = 0;
    direction.normalize();
    
    this.moveWithCover(direction, this.movementConfig.walkSpeed);
  }

  // ========== 带掩体的移动 ==========
  private moveWithCover(direction: THREE.Vector3, speed: number): void {
    // 旋转
    const targetRotation = Math.atan2(direction.x, direction.z);
    this.rotation.y = THREE.MathUtils.lerp(
      this.rotation.y,
      targetRotation,
      this.movementConfig.rotationSpeed * (1/60)
    );
    
    // 移动
    this.velocity.x = direction.x * speed;
    this.velocity.z = direction.z * speed;
  }

  // ========== 战术重新定位 ==========
  private tacticalReposition(): void {
    if (!this.target || this.coverSpots.length === 0) return;
    
    // 随机选择一个新的位置
    const randomIndex = Math.floor(Math.random() * this.coverSpots.length);
    const newPos = this.coverSpots[randomIndex];
    
    if (newPos.distanceTo(this.position) > 2.0) {
      this.currentCoverSpot = newPos;
      this.moveToCover(newPos);
    }
  }

  // ========== 扔手雷 ==========
  private throwGrenade(): void {
    if (!this.target) return;
    
    const distance = this.position.distanceTo(this.target.position);
    if (distance > 25) return;
    
    // 扔到目标位置附近
    const targetPos = this.target.position.clone();
    targetPos.x += (Math.random() - 0.5) * 3;
    targetPos.z += (Math.random() - 0.5) * 3;
    
    console.log(`${this.name} throws a grenade at ${targetPos}!`);
    this.grenadeCooldown = 8.0 + Math.random() * 4.0;
  }

  // ========== 应用移动 ==========
  private applyMovement(deltaTime: number): void {
    if (this.mesh) {
      this.mesh.position.x += this.velocity.x * deltaTime;
      this.mesh.position.z += this.velocity.z * deltaTime;
      this.mesh.rotation.y = this.rotation.y;
    }
  }

  // ========== 巡逻 ==========
  protected executePatrol(deltaTime: number): void {
    this.setState(AIState.PATROL);
    super.executePatrol(deltaTime);
  }

  // ========== 伤害处理覆盖 ==========
  takeDamage(amount: number, source: THREE.Object3D | null = null): void {
    super.takeDamage(amount, source);
    
    // 被攻击时增加压制计时
    this.suppressTimer += 1.0;
    
    // 血量低时寻找掩体
    if (this.health < this.maxHealth * 0.5 && this.state !== AIState.COVER) {
      this.findAndMoveToCover();
    }
  }

  // ========== 创建工厂 ==========
  static create(
    position: THREE.Vector3 = new THREE.Vector3(),
    coverSpots: THREE.Vector3[] = []
  ): Soldier {
    const id = `soldier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new Soldier(id, 'Elite Soldier', position, coverSpots);
  }
}

export default Soldier;
