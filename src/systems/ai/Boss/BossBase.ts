/**
 * Boss/BossBase.ts - Boss基类
 * 支持多阶段Boss战，具有特殊机制和阶段转换
 */

import * as THREE from 'three';
import { AICharacter, AICharacterType, AIState, AIConfig, MovementConfig } from '../AICharacter';

// ============== Boss阶段配置 ==============
export interface BossPhaseConfig {
  name: string;
  health: number;              // 该阶段血量
  damageMultiplier: number;    // 伤害倍率
  speedMultiplier: number;     // 速度倍率
  mechanics: string[];          // 特殊机制列表
  onEnter?: () => void;        // 进入阶段回调
  onExit?: () => void;         // 退出阶段回调
}

// ============== Boss事件 ==============
export interface BossEvents {
  onPhaseChange: (phaseIndex: number, phaseName: string) => void;
  onEnrage: () => void;
  onSpecialAttack: (attackName: string) => void;
  onDefeat: () => void;
}

// ============== Boss配置 ==============
export interface BossConfig extends AIConfig {
  phases: BossPhaseConfig[];
  enrageThreshold: number;     // 狂暴血量百分比（如0.2=20%）
  enrageEffects?: {
    damageMultiplier: number;
    speedMultiplier: number;
  };
  introDialogue?: string[];
  victoryDialogue?: string[];
}

// ============== 默认Boss配置 ==============
const DEFAULT_BOSS_MOVEMENT: MovementConfig = {
  walkSpeed: 1.5,
  runSpeed: 3.0,
  patrolSpeed: 1.0,
  rotationSpeed: 2.0,
  acceleration: 5.0,
  deceleration: 5.0,
  minDistance: 5.0,
  maxDistance: 15.0,
  retreatDistance: 0.1,
};

// ============== Boss基类 ==============
export class BossBase extends AICharacter {
  // 阶段系统
  private phases: BossPhaseConfig[] = [];
  private currentPhaseIndex: number = 0;
  private phaseHealthThresholds: number[] = [];
  
  // 狂暴状态
  isEnraged: boolean = false;
  private enrageThreshold: number = 0.2;
  private enrageEffects = {
    damageMultiplier: 1.5,
    speedMultiplier: 1.3,
  };
  
  // 战斗状态
  private specialAttackCooldown: number = 0;
  private currentSpecialAttack: string | null = null;
  private isPerformingSpecial: boolean = false;
  private hitCount: number = 0;
  private hitThreshold: number = 10;  // 每10次攻击转换阶段
  
  // 对话
  introDialogue: string[] = [];
  victoryDialogue: string[] = [];
  
  // 事件
  events: BossEvents = {
    onPhaseChange: () => {},
    onEnrage: () => {},
    onSpecialAttack: () => {},
    onDefeat: () => {},
  };

  constructor(id: string, name: string, config: BossConfig) {
    // 使用第一阶段属性初始化基类
    const initialPhase = config.phases[0];
    const initialConfig: AIConfig = {
      ...config,
      health: initialPhase.health,
      damage: config.damage * initialPhase.damageMultiplier,
    };
    initialConfig.movement = { ...DEFAULT_BOSS_MOVEMENT, ...config.movement };
    
    super(id, name, initialConfig);
    
    // 设置类型为Boss
    this.characterType = AICharacterType.BOSS;
    
    // 初始化阶段
    this.phases = config.phases;
    this.calculatePhaseThresholds();
    
    // 狂暴设置
    this.enrageThreshold = config.enrageThreshold;
    if (config.enrageEffects) {
      this.enrageEffects = config.enrageEffects;
    }
    
    // 对话设置
    this.introDialogue = config.introDialogue || [];
    this.victoryDialogue = config.victoryDialogue || [];
    
    // 创建Boss特定行为树
    this.setupBossBehaviorTree();
  }

  // ========== 计算阶段阈值 ==========
  private calculatePhaseThresholds(): void {
    let totalHealth = 0;
    for (const phase of this.phases) {
      totalHealth += phase.health;
    }
    
    this.phaseHealthThresholds = [];
    let accumulated = 0;
    for (const phase of this.phases) {
      accumulated += phase.health;
      this.phaseHealthThresholds.push(1 - (accumulated / totalHealth));
    }
  }

  // ========== Boss特定行为树 ==========
  protected setupBossBehaviorTree(): void {
    // 子类实现具体行为树
  }

  // ========== 获取当前阶段 ==========
  getCurrentPhase(): BossPhaseConfig {
    return this.phases[this.currentPhaseIndex];
  }

  // ========== 获取当前阶段索引 ==========
  getCurrentPhaseIndex(): number {
    return this.currentPhaseIndex;
  }

  // ========== 获取阶段数量 ==========
  getPhaseCount(): number {
    return this.phases.length;
  }

  // ========== 进入下一阶段 ==========
  protected advanceToNextPhase(): void {
    if (this.currentPhaseIndex >= this.phases.length - 1) {
      return;  // 已经是最后阶段
    }
    
    const oldPhase = this.phases[this.currentPhaseIndex];
    if (oldPhase.onExit) {
      oldPhase.onExit();
    }
    
    this.currentPhaseIndex++;
    const newPhase = this.phases[this.currentPhaseIndex];
    
    // 应用新阶段属性
    this.damage = this.damage * (newPhase.damageMultiplier / oldPhase.damageMultiplier);
    this.movementConfig.runSpeed = this.movementConfig.runSpeed * 
      (newPhase.speedMultiplier / oldPhase.speedMultiplier);
    
    if (newPhase.onEnter) {
      newPhase.onEnter();
    }
    
    // 事件
    this.events.onPhaseChange(this.currentPhaseIndex, newPhase.name);
    
    console.log(`${this.name} enters phase ${this.currentPhaseIndex + 1}: ${newPhase.name}`);
  }

  // ========== 检查阶段转换 ==========
  protected checkPhaseTransition(): void {
    if (this.currentPhaseIndex >= this.phases.length - 1) return;
    
    const healthPercent = this.health / this.maxHealth;
    const threshold = this.phaseHealthThresholds[this.currentPhaseIndex];
    
    if (healthPercent <= threshold) {
      this.advanceToNextPhase();
    }
  }

  // ========== 进入狂暴 ==========
  protected enterEnrage(): void {
    if (this.isEnraged) return;
    
    this.isEnraged = true;
    this.damage *= this.enrageEffects.damageMultiplier;
    this.movementConfig.runSpeed *= this.enrageEffects.speedMultiplier;
    
    console.log(`${this.name} is ENRAGED!`);
    this.events.onEnrage();
  }

  // ========== 检查狂暴 ==========
  protected checkEnrage(): void {
    if (this.isEnraged) return;
    
    const healthPercent = this.health / this.maxHealth;
    if (healthPercent <= this.enrageThreshold) {
      this.enterEnrage();
    }
  }

  // ========== 执行特殊攻击 ==========
  performSpecialAttack(attackName: string): void {
    if (this.isPerformingSpecial) return;
    
    this.isPerformingSpecial = true;
    this.currentSpecialAttack = attackName;
    
    console.log(`${this.name} performs special attack: ${attackName}`);
    this.events.onSpecialAttack(attackName);
  }

  // ========== 结束特殊攻击 ==========
  protected endSpecialAttack(): void {
    this.isPerformingSpecial = false;
    this.currentSpecialAttack = null;
    this.specialAttackCooldown = 3.0;
  }

  // ========== 伤害处理 ==========
  takeDamage(amount: number, source: THREE.Object3D | null = null): void {
    if (!this.isAlive) return;
    
    // Boss受击会有特殊效果
    this.hitCount++;
    
    super.takeDamage(amount, source);
    
    // 检查阶段转换
    this.checkPhaseTransition();
    
    // 检查狂暴
    this.checkEnrage();
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
    if (this.specialAttackCooldown > 0) {
      this.specialAttackCooldown -= deltaTime;
    }
    
    // 特殊攻击结束检查
    if (this.isPerformingSpecial && this.currentSpecialAttack) {
      this.updateSpecialAttack(deltaTime);
    }
    
    // 感知更新
    this.updatePerception(deltaTime);
    
    // Boss逻辑
    if (!this.isPerformingSpecial) {
      this.executeBossAI(deltaTime);
    }
    
    // 应用移动
    this.applyMovement(deltaTime);
    
    // 更新位置引用
    this.position.copy(this.mesh?.position || this.position);
  }

  // ========== Boss AI执行（子类实现） ==========
  protected executeBossAI(deltaTime: number): void {
    // 子类实现具体逻辑
  }

  // ========== 特殊攻击更新（子类实现） ==========
  protected updateSpecialAttack(deltaTime: number): void {
    // 子类实现具体逻辑
  }

  // ========== 应用移动 ==========
  protected applyMovement(deltaTime: number): void {
    if (this.mesh) {
      this.mesh.position.x += this.velocity.x * deltaTime;
      this.mesh.position.z += this.velocity.z * deltaTime;
      this.mesh.rotation.y = this.rotation.y;
    }
  }

  // ========== 获取对话 ==========
  getIntroDialogue(): string[] {
    return this.introDialogue;
  }

  // ========== 获取胜利对话 ==========
  getVictoryDialogue(): string[] {
    return this.victoryDialogue;
  }

  // ========== 死亡覆盖 ==========
  die(): void {
    super.die();
    this.events.onDefeat();
  }

  // ========== 重置 ==========
  reset(): void {
    this.currentPhaseIndex = 0;
    this.isEnraged = false;
    this.health = this.maxHealth;
    this.isPerformingSpecial = false;
    this.currentSpecialAttack = null;
    this.hitCount = 0;
    this.specialAttackCooldown = 0;
    
    // 重置到第一阶段属性
    const firstPhase = this.phases[0];
    this.damage = this.damage / firstPhase.damageMultiplier;
    this.movementConfig.runSpeed = this.movementConfig.runSpeed / firstPhase.speedMultiplier;
  }
}

export default BossBase;
