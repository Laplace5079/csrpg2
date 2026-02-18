/**
 * Boss/Trainer.ts - 训练官Boss
 * 教学+实战两阶段Boss
 * 阶段1: 训练模式 - 演示动作，邀请玩家决斗
 * 阶段2: 实战模式 - 组合攻击、闪光弹、狂暴
 */

import * as THREE from 'three';
import { BossBase, BossPhaseConfig, BossConfig } from './BossBase';
import { AIState } from '../AICharacter';
import { BTSequence, BTSelector, BTCondition, BTAction, NodeStatus } from '../BehaviorTree';

// ============== 训练官Boss配置 ==============
const TRAINER_PHASES: BossPhaseConfig[] = [
  {
    name: '训练模式',
    health: 500,
    damageMultiplier: 0.5,
    speedMultiplier: 0.7,
    mechanics: ['demonstration', 'duel_invite', 'teaching'],
    onEnter: () => console.log('Training phase started - Demonstrating techniques'),
    onExit: () => console.log('Training phase ended'),
  },
  {
    name: '实战模式',
    health: 500,
    damageMultiplier: 1.0,
    speedMultiplier: 1.0,
    mechanics: ['combo', 'flashbang', 'enrage', 'aggressive'],
    onEnter: () => console.log('Combat phase started - Time to fight!'),
    onExit: () => console.log('Combat phase ended'),
  },
];

const TRAINER_CONFIG: BossConfig = {
  type: 'boss' as any,
  health: 1000,  // 总生命值（两阶段各500）
  armor: 50,
  damage: 25,
  movement: {
    walkSpeed: 2.0,
    runSpeed: 4.5,
    patrolSpeed: 1.5,
    rotationSpeed: 6.0,
    acceleration: 8.0,
    deceleration: 10.0,
    minDistance: 5.0,
    maxDistance: 25.0,
    retreatDistance: 0.2,
  },
  perception: {
    hearingRange: 50.0,
    viewAngle: Math.PI * 0.7,
    viewDistance: 60.0,
  },
  phases: TRAINER_PHASES,
  enrageThreshold: 0.2,
  enrageEffects: {
    damageMultiplier: 1.5,
    speedMultiplier: 1.3,
  },
  introDialogue: [
    "欢迎来到训练营，新兵。",
    "我是训练官X-1，将负责你的实战考核。",
    "让我看看你有多少本事...",
  ],
  victoryDialogue: [
    "不错嘛，竟然能把我逼到这一步...",
    "但训练官的尊严不允许失败！",
    "来，正式的战斗现在开始！",
  ],
};

// ============== 攻击模式 ==============
enum AttackMode {
  DEMONSTRATION = 'demonstration',  // 演示
  DUEL = 'duel',                      // 决斗
  COMBO = 'combo',                    // 连招
  FLASHBANG = 'flashbang',            // 闪光弹
  ENRAGE = 'enrage',                  // 狂暴攻击
}

// ============== 训练官Boss ==============
export class Trainer extends BossBase {
  // 训练官特有状态
  private attackMode: AttackMode = AttackMode.DEMONSTRATION;
  private comboCount: number = 0;
  private maxCombos: number = 3;
  private comboWindow: number = 0;
  private flashbangCooldown: number = 0;
  private teachingTimer: number = 0;
  private demonstrationComplete: boolean = false;
  
  // 动画状态
  private currentAnimation: string = 'idle';
  private animationTimer: number = 0;
  
  // 教学提示
  private teachingTips: string[] = [
    "按鼠标左键射击",
    "按Shift键加速",
    "按空格键跳跃",
    "按R键换弹",
    "瞄准头部造成更高伤害",
  ];
  private currentTipIndex: number = 0;

  constructor(id: string, name: string = '训练官X-1') {
    super(id, name, TRAINER_CONFIG);
    
    // 设置行为树
    this.setupTrainerBehaviorTree();
  }

  // ========== 训练官特定行为树 ==========
  private setupTrainerBehaviorTree(): void {
    const root = new BTSelector('trainer_root', [
      // 阶段1: 训练模式
      new BTSequence('trainingPhase', [
        new BTCondition('isTrainingPhase', () => this.getCurrentPhaseIndex() === 0),
        new BTSelector('trainingActions', [
          // 演示动作
          new BTSequence('demonstration', [
            new BTCondition('shouldDemonstrate', () => !this.demonstrationComplete),
            new BTAction('performDemonstration', () => {
              this.performDemonstration();
              return NodeStatus.SUCCESS;
            }),
          ]),
          
          // 教学提示
          new BTSequence('teaching', [
            new BTCondition('shouldTeach', () => this.teachingTimer <= 0),
            new BTAction('giveTip', () => {
              this.giveTeachingTip();
              return NodeStatus.SUCCESS;
            }),
          ]),
          
          // 邀请决斗
          new BTAction('inviteDuel', () => {
            this.inviteToDuel();
            return NodeStatus.SUCCESS;
          }),
        ]),
      ]),
      
      // 阶段2: 实战模式
      new BTSequence('combatPhase', [
        new BTCondition('isCombatPhase', () => this.getCurrentPhaseIndex() === 1),
        new BTSelector('combatActions', [
          // 连招攻击
          new BTSequence('comboAttack', () => {
            return this.comboCount < this.maxCombos ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
          }, [
            new BTAction('performCombo', () => {
              this.performComboAttack();
              return NodeStatus.RUNNING;
            }),
          ]),
          
          // 闪光弹
          new BTSequence('flashbang', [
            new BTCondition('canFlashbang', () => this.flashbangCooldown <= 0),
            new BTAction('throwFlashbang', () => {
              this.throwFlashbang();
              return NodeStatus.SUCCESS;
            }),
          ]),
          
          // 狂暴攻击
          new BTSequence('enrageAttack', [
            new BTCondition('isEnraged', () => this.isEnraged),
            new BTAction('enrageAttacks', () => {
              this.performEnrageAttack();
              return NodeStatus.SUCCESS;
            }),
          ]),
          
          // 普通攻击
          new BTAction('normalAttack', () => {
            this.performNormalAttack();
            return NodeStatus.SUCCESS;
          }),
        ]),
      ]),
      
      // 默认: 待机
      new BTAction('idle', () => {
        this.setState(AIState.IDLE);
        return NodeStatus.SUCCESS;
      }),
    ]);

    const { BehaviorTree } = require('../BehaviorTree');
    this.behaviorTree = new BehaviorTree(root, {});
  }

  // ========== Boss AI执行 ==========
  protected executeBossAI(deltaTime: number): void {
    // 训练模式AI
    if (this.getCurrentPhaseIndex() === 0) {
      this.executeTrainingAI(deltaTime);
    }
    // 实战模式AI
    else {
      this.executeCombatAI(deltaTime);
    }
    
    // 更新动画计时
    if (this.animationTimer > 0) {
      this.animationTimer -= deltaTime;
    }
  }

  // ========== 训练模式AI ==========
  private executeTrainingAI(deltaTime: number): void {
    this.teachingTimer -= deltaTime;
    
    // 保持一定距离，观察玩家
    const distance = this.perception.distanceToTarget;
    
    if (distance > this.movementConfig.maxDistance * 0.8) {
      // 太远，靠近
      this.setState(AIState.CHASE);
      this.moveTowardPlayer(this.movementConfig.walkSpeed);
    } else if (distance < this.movementConfig.minDistance * 2) {
      // 太近，后退
      this.setState(AIState.RETREAT);
      this.retreatFromPlayer();
    } else {
      // 距离合适，原地演示
      this.setState(AIState.IDLE);
      this.performIdleDemonstration(deltaTime);
    }
  }

  // ========== 实战模式AI ==========
  private executeCombatAI(deltaTime: number): void {
    const distance = this.perception.distanceToTarget;
    
    // 连招窗口
    if (this.comboWindow > 0) {
      this.comboWindow -= deltaTime;
      if (this.comboWindow <= 0) {
        this.comboCount = 0;
      }
    }
    
    // 闪光弹冷却
    if (this.flashbangCooldown > 0) {
      this.flashbangCooldown -= deltaTime;
    }
    
    // 狂暴后攻击更激进
    if (this.isEnraged) {
      this.setState(AIState.CHASE);
      this.moveTowardPlayer(this.movementConfig.runSpeed);
      
      // 偶尔使用特殊攻击
      if (Math.random() < 0.02) {
        this.performSpecialAttack('enrage_burst');
      }
    } else {
      // 正常战斗AI
      if (distance > this.movementConfig.maxDistance * 0.7) {
        this.setState(AIState.CHASE);
        this.moveTowardPlayer(this.movementConfig.runSpeed);
      } else if (distance < this.movementConfig.minDistance) {
        this.setState(AIState.ATTACK);
        this.comboAttack();
      } else {
        // 中距离，战术机动
        this.setState(AIState.ATTACK);
        this.tacticalMovement(deltaTime);
      }
    }
  }

  // ========== 移动向玩家 ==========
  private moveTowardPlayer(speed: number): void {
    if (!this.target) return;
    
    const direction = new THREE.Vector3().subVectors(this.target.position, this.position);
    direction.y = 0;
    
    if (direction.length() > 0.1) {
      direction.normalize();
      
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
  }

  // ========== 后退 ==========
  private retreatFromPlayer(): void {
    if (!this.target) return;
    
    const direction = new THREE.Vector3().subVectors(this.position, this.target.position);
    direction.y = 0;
    direction.normalize();
    
    const targetRotation = Math.atan2(direction.x, direction.z);
    this.rotation.y = THREE.MathUtils.lerp(
      this.rotation.y,
      targetRotation,
      this.movementConfig.rotationSpeed * (1/60)
    );
    
    this.velocity.x = direction.x * this.movementConfig.walkSpeed;
    this.velocity.z = direction.z * this.movementConfig.walkSpeed;
  }

  // ========== 战术移动 ==========
  private tacticalMovement(deltaTime: number): void {
    // 侧向移动
    if (!this.target) return;
    
    const toTarget = new THREE.Vector3().subVectors(this.target.position, this.position);
    toTarget.y = 0;
    
    const lateral = new THREE.Vector3(-toTarget.z, 0, toTarget.x).normalize();
    const forward = toTarget.normalize();
    
    // 随机选择移动方向
    const direction = Math.random() > 0.5 ? lateral : lateral.clone().negate();
    direction.multiplyScalar(0.3);
    direction.add(forward.multiplyScalar(0.7));
    direction.normalize();
    
    const targetRotation = Math.atan2(direction.x, direction.z);
    this.rotation.y = THREE.MathUtils.lerp(
      this.rotation.y,
      targetRotation,
      this.movementConfig.rotationSpeed * deltaTime
    );
    
    this.velocity.x = direction.x * this.movementConfig.walkSpeed;
    this.velocity.z = direction.z * this.movementConfig.walkSpeed;
  }

  // ========== 演示动作 ==========
  private performDemonstration(): void {
    if (this.demonstrationComplete) return;
    
    // 演示各种动作
    const demonstrations = ['shoot', 'reload', 'melee', 'grenade'];
    const randomDemo = demonstrations[Math.floor(Math.random() * demonstrations.length)];
    
    console.log(`[训练官] 演示: ${randomDemo}`);
    this.currentAnimation = randomDemo;
    this.animationTimer = 2.0;
    
    // 演示2-3次后完成
    if (Math.random() < 0.3) {
      this.demonstrationComplete = true;
    }
  }

  // ========== 待机演示 ==========
  private performIdleDemonstration(deltaTime: number): void {
    // 偶尔做一些动作
    if (this.animationTimer <= 0) {
      const actions = ['aim', 'check_weapon', 'stretch', 'turn'];
      const action = actions[Math.floor(Math.random() * actions.length)];
      
      this.currentAnimation = action;
      this.animationTimer = 1.5;
      
      // 播放动作
      console.log(`[训练官] ${action}`);
    }
  }

  // ========== 教学提示 ==========
  private giveTeachingTip(): void {
    if (this.currentTipIndex < this.teachingTips.length) {
      const tip = this.teachingTips[this.currentTipIndex];
      console.log(`[训练官] 提示: ${tip}`);
      this.currentTipIndex++;
      this.teachingTimer = 10.0;
    }
  }

  // ========== 邀请决斗 ==========
  private inviteToDuel(): void {
    console.log('[训练官] 来吧！让我们一对一较量！');
    // 可以触发特殊UI提示
  }

  // ========== 连招攻击 ==========
  private comboAttack(): void {
    this.performAttack();
    this.comboCount++;
    this.comboWindow = 2.0;
  }

  // ========== 执行普通攻击 ==========
  protected performAttack(): void {
    if (!this.target || !this.isAlive) return;
    
    const distance = this.position.distanceTo(this.target.position);
    if (distance > this.movementConfig.maxDistance) return;
    
    // 计算伤害
    let finalDamage = this.damage;
    
    // 狂暴伤害加成
    if (this.isEnraged) {
      finalDamage *= this.enrageEffects.damageMultiplier;
    }
    
    // 连招伤害加成
    if (this.comboCount > 0) {
      finalDamage *= (1 + this.comboCount * 0.2);
    }
    
    console.log(`[训练官] 射击! 伤害: ${finalDamage}`);
  }

  // ========== 组合攻击 ==========
  private performComboAttack(): void {
    console.log(`[训练官] 连招攻击 #${this.comboCount + 1}!`);
    this.comboCount++;
    this.performAttack();
    this.comboWindow = 1.5;
  }

  // ========== 闪光弹 ==========
  private throwFlashbang(): void {
    if (!this.target) return;
    
    // 扔到玩家位置
    const targetPos = this.target.position.clone();
    targetPos.x += (Math.random() - 0.5) * 2;
    targetPos.z += (Math.random() - 0.5) * 2;
    
    console.log(`[训练官] 投掷闪光弹! 位置: ${targetPos}`);
    this.flashbangCooldown = 10.0;
    
    // 可以触发闪光效果
    this.performSpecialAttack('flashbang');
  }

  // ========== 普通攻击 ==========
  private performNormalAttack(): void {
    this.comboAttack();
  }

  // ========== 狂暴攻击 ==========
  private performEnrageAttack(): void {
    // 更快的攻击速度
    const now = Date.now();
    if (now - this.lastAttackTime > 300) {
      this.performAttack();
      this.lastAttackTime = now;
    }
  }

  // ========== 特殊攻击更新 ==========
  protected updateSpecialAttack(deltaTime: number): void {
    if (this.currentSpecialAttack === 'flashbang') {
      // 闪光弹效果持续时间
      this.animationTimer -= deltaTime;
      if (this.animationTimer <= 0) {
        this.endSpecialAttack();
      }
    } else {
      super.updateSpecialAttack(deltaTime);
    }
  }

  // ========== 阶段特定事件 ==========
  onPhaseEnter(phaseIndex: number): void {
    if (phaseIndex === 1) {
      // 进入实战模式
      console.log('[训练官] 训练结束！现在开始真正的战斗！');
      this.demonstrationComplete = false;
      this.currentTipIndex = 0;
    }
  }

  // ========== 创建工厂 ==========
  static create(position: THREE.Vector3 = new THREE.Vector3()): Trainer {
    const id = `trainer_${Date.now()}`;
    const trainer = new Trainer(id, '训练官X-1');
    trainer.position.copy(position);
    return trainer;
  }
}

export default Trainer;
