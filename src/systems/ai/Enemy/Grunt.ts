/**
 * Enemy/Grunt.ts - 杂兵AI（变异体）
 * 低智能群居敌人，简单的追逐攻击行为
 */

import * as THREE from 'three';
import { AICharacter, AICharacterType, AIState, AIConfig, MovementConfig } from '../AICharacter';

// ============== 变异体配置 ==============
const GRUNT_CONFIG: AIConfig = {
  type: AICharacterType.GRUNT,
  health: 50,
  armor: 0,
  damage: 10,
  movement: {
    walkSpeed: 3.0,
    runSpeed: 5.5,
    patrolSpeed: 1.0,
    rotationSpeed: 3.0,
    acceleration: 15.0,
    deceleration: 10.0,
    minDistance: 1.5,      // 靠近后直接攻击
    maxDistance: 25.0,
    retreatDistance: 0.1,
  },
  perception: {
    hearingRange: 25.0,
    viewAngle: Math.PI / 2,  // 90度视野
    viewDistance: 30.0,
  },
};

// ============== 变异体AI ==============
export class Grunt extends AICharacter {
  // 特殊属性
  isEnraged: boolean = false;  // 狂暴状态
  screechCooldown: number = 0;
  
  constructor(id: string, name: string, position?: THREE.Vector3) {
    super(id, name, GRUNT_CONFIG);
    
    if (position) {
      this.position.copy(position);
    }
    
    // 变异体使用简单的追逐行为树
    this.setupBehaviorTree();
  }

  // ========== 设置行为树 ==========
  private setupBehaviorTree(): void {
    // 变异体使用内置的简单行为
    // 不需要复杂的行为树，直接追逐攻击
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
    if (this.screechCooldown > 0) {
      this.screechCooldown -= deltaTime;
    }

    // 狂暴检查
    if (!this.isEnraged && this.health < this.maxHealth * 0.3) {
      this.enterEnraged();
    }

    // 感知更新
    this.updatePerception(deltaTime);

    // AI逻辑
    if (this.target && this.perception.hasLineOfSight) {
      this.executeGruntAI(deltaTime);
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

  // ========== 变异体专属AI ==========
  private executeGruntAI(deltaTime: number): void {
    const distance = this.perception.distanceToTarget;
    
    // 距离判断
    if (distance < this.movementConfig.minDistance) {
      // 太近了，后退一点然后继续
      this.setState(AIState.ATTACK);
      this.attack(deltaTime);
    } else if (distance > this.movementConfig.maxDistance * 0.7) {
      // 太远了，追击
      this.setState(AIState.CHASE);
      this.chase(deltaTime);
    } else {
      // 适中距离，靠近攻击
      this.setState(AIState.CHASE);
      this.chase(deltaTime);
      
      // 靠近后攻击
      if (distance < this.movementConfig.minDistance + 2) {
        this.attack(deltaTime);
      }
    }
  }

  // ========== 追逐 ==========
  private chase(deltaTime: number): void {
    if (!this.target) return;
    
    const direction = new THREE.Vector3().subVectors(
      this.target.position,
      this.position
    );
    direction.y = 0;
    direction.normalize();
    
    // 旋转朝向目标
    const targetRotation = Math.atan2(direction.x, direction.z);
    this.rotation.y = THREE.MathUtils.lerp(
      this.rotation.y,
      targetRotation,
      this.movementConfig.rotationSpeed * deltaTime
    );
    
    // 移动（狂暴时更快）
    const speed = this.isEnraged 
      ? this.movementConfig.runSpeed * 1.5 
      : this.movementConfig.runSpeed;
    
    this.velocity.x = direction.x * speed;
    this.velocity.z = direction.z * speed;
  }

  // ========== 攻击 ==========
  private attack(deltaTime: number): void {
    this.setState(AIState.ATTACK);
    
    const now = Date.now();
    const attackInterval = this.isEnraged ? 500 : 1000;  // 狂暴攻速更快
    
    if (now - this.lastAttackTime > attackInterval) {
      this.performAttack();
      this.lastAttackTime = now;
    }
  }

  // ========== 执行攻击 ==========
  protected performAttack(): void {
    if (!this.target || !this.isAlive) return;
    
    // 检查距离
    const distance = this.position.distanceTo(this.target.position);
    if (distance > this.movementConfig.minDistance + 1) return;
    
    // 造成伤害（通过事件系统）
    // 这里可以触发伤害事件
    console.log(`${this.name} scratches for ${this.damage} damage!`);
    
    // 狂暴时可能发出尖叫
    if (this.isEnraged && this.screechCooldown <= 0) {
      this.screech();
    }
  }

  // ========== 尖叫（召集同伴） ==========
  private screech(): void {
    this.screechCooldown = 5.0;
    console.log(`${this.name} lets out a terrifying screech!`);
    // 可以触发附近变异体狂暴的事件
  }

  // ========== 进入狂暴 ==========
  private enterEnraged(): void {
    this.isEnraged = true;
    console.log(`${this.name} enters ENRAGED state!`);
    
    // 视觉反馈（如果有）
    if (this.mesh) {
      // 可以改变颜色表示狂暴
      // (this.mesh as THREE.Mesh).material.emissive = new THREE.Color(0xff0000);
    }
  }

  // ========== 巡逻 ==========
  private executePatrol(deltaTime: number): void {
    this.setState(AIState.PATROL);
    
    if (this.patrolPoints.length === 0) return;
    
    const targetPoint = this.patrolPoints[this.currentPatrolIndex];
    const distance = this.position.distanceTo(targetPoint);
    
    if (distance < 1.0) {
      // 到达巡逻点
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
    } else {
      // 移动向目标
      const direction = new THREE.Vector3().subVectors(targetPoint, this.position);
      direction.y = 0;
      direction.normalize();
      
      this.velocity.x = direction.x * this.movementConfig.patrolSpeed;
      this.velocity.z = direction.z * this.movementConfig.patrolSpeed;
      
      // 旋转
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.rotation.y = THREE.MathUtils.lerp(
        this.rotation.y,
        targetRotation,
        this.movementConfig.rotationSpeed * deltaTime
      );
    }
  }

  // ========== 应用移动 ==========
  private applyMovement(deltaTime: number): void {
    if (this.mesh) {
      this.mesh.position.x += this.velocity.x * deltaTime;
      this.mesh.position.z += this.velocity.z * deltaTime;
      this.mesh.rotation.y = this.rotation.y;
    }
  }

  // ========== 创建工厂方法 ==========
  static create(position: THREE.Vector3 = new THREE.Vector3()): Grunt {
    const id = `grunt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new Grunt(id, 'Mutant', position);
  }

  static createGroup(count: number, centerPosition: THREE.Vector3, spread: number = 5): Grunt[] {
    const grunts: Grunt[] = [];
    
    for (let i = 0; i < count; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * spread * 2,
        0,
        (Math.random() - 0.5) * spread * 2
      );
      const position = centerPosition.clone().add(offset);
      
      const grunt = Grunt.create(position);
      grunts.push(grunt);
    }
    
    return grunts;
  }
}

export default Grunt;
