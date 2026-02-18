/**
 * BehaviorTree.ts - 行为树执行器
 * 支持序列、选择、并行、装饰器等节点类型
 */

import * as THREE from 'three';

// ============== 节点类型定义 ==============
export enum NodeType {
  SEQUENCE = 'sequence',
  SELECTOR = 'selector',
  PARALLEL = 'parallel',
  CONDITION = 'condition',
  ACTION = 'action',
  DECORATOR = 'decorator',
}

// ============== 节点状态 ==============
export enum NodeStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILURE = 'failure',
}

// ============== 基础节点接口 ==============
export interface BTNodeConfig {
  type: NodeType;
  name?: string;
  children?: BTNode[];
}

export interface BTNode {
  type: NodeType;
  name: string;
  execute(context: BTContext): NodeStatus;
  reset(): void;
}

// ============== 行为树上下文 ==============
export interface BTContext {
  // 实体引用
  self: AICharacter;
  target: THREE.Object3D | null;
  
  // 环境信息
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  
  // 状态数据
  isAlive: boolean;
  health: number;
  maxHealth: number;
  armor: number;
  
  // 感知数据
  hasLineOfSight: boolean;
  distanceToTarget: number;
  isInCover: boolean;
  
  // 寻路数据
  patrolPoints: THREE.Vector3[];
  currentPatrolIndex: number;
  coverSpots: THREE.Vector3[];
  
  // 自定义数据
  custom: Record<string, unknown>;
}

// ============== 序列节点 - 顺序执行子节点 ==============
export class BTSequence implements BTNode {
  type = NodeType.SEQUENCE;
  name: string;
  children: BTNode[];

  constructor(name: string, children: BTNode[]) {
    this.name = name;
    this.children = children;
  }

  execute(context: BTContext): NodeStatus {
    for (const child of this.children) {
      const result = child.execute(context);
      if (result === NodeStatus.FAILURE) {
        return NodeStatus.FAILURE;
      }
      if (result === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }
    }
    return NodeStatus.SUCCESS;
  }

  reset(): void {
    this.children.forEach(child => child.reset());
  }
}

// ============== 选择节点 - 优先级选择 ==============
export class BTSelector implements BTNode {
  type = NodeType.SELECTOR;
  name: string;
  children: BTNode[];

  constructor(name: string, children: BTNode[]) {
    this.name = name;
    this.children = children;
  }

  execute(context: BTContext): NodeStatus {
    for (const child of this.children) {
      const result = child.execute(context);
      if (result === NodeStatus.SUCCESS) {
        return NodeStatus.SUCCESS;
      }
      if (result === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }
    }
    return NodeStatus.FAILURE;
  }

  reset(): void {
    this.children.forEach(child => child.reset());
  }
}

// ============== 条件节点 - 判断条件 ==============
export type ConditionFn = (context: BTContext) => boolean;

export class BTCondition implements BTNode {
  type = NodeType.CONDITION;
  name: string;
  condition: ConditionFn;

  constructor(name: string, condition: ConditionFn) {
    this.name = name;
    this.condition = condition;
  }

  execute(context: BTContext): NodeStatus {
    return this.condition(context) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }

  reset(): void {
    // 条件节点无状态需要重置
  }
}

// ============== 动作节点 - 执行行为 ==============
export type ActionFn = (context: BTContext) => NodeStatus;

export class BTAction implements BTNode {
  type = NodeType.ACTION;
  name: string;
  action: ActionFn;
  private lastStatus: NodeStatus = NodeStatus.SUCCESS;

  constructor(name: string, action: ActionFn) {
    this.name = name;
    this.action = action;
  }

  execute(context: BTContext): NodeStatus {
    this.lastStatus = this.action(context);
    return this.lastStatus;
  }

  reset(): void {
    this.lastStatus = NodeStatus.SUCCESS;
  }
}

// ============== 装饰器节点 ==============
export enum DecoratorType {
  INVERTER = 'inverter',      // 反转结果
  REPEATER = 'repeater',      // 重复执行
  TIMEOUT = 'timeout',        // 超时限制
  SUCCESS_RATE = 'success',   // 强制成功
  FAILURE_RATE = 'failure',   // 强制失败
}

export class BTDecorator implements BTNode {
  type = NodeType.DECORATOR;
  name: string;
  child: BTNode;
  decoratorType: DecoratorType;
  params: Record<string, number>;

  constructor(
    name: string,
    decoratorType: DecoratorType,
    child: BTNode,
    params: Record<string, number> = {}
  ) {
    this.name = name;
    this.decoratorType = decoratorType;
    this.child = child;
    this.params = params;
  }

  execute(context: BTContext): NodeStatus {
    const result = this.child.execute(context);
    
    switch (this.decoratorType) {
      case DecoratorType.INVERTER:
        return result === NodeStatus.SUCCESS 
          ? NodeStatus.FAILURE 
          : result === NodeStatus.FAILURE 
            ? NodeStatus.SUCCESS 
            : result;
      
      case DecoratorType.SUCCESS_RATE:
        return NodeStatus.SUCCESS;
      
      case DecoratorType.FAILURE_RATE:
        return NodeStatus.FAILURE;
      
      default:
        return result;
    }
  }

  reset(): void {
    this.child.reset();
  }
}

// ============== 行为树类 ==============
export class BehaviorTree {
  root: BTNode;
  private context: BTContext;
  private lastStatus: NodeStatus = NodeStatus.SUCCESS;

  constructor(root: BTNode, initialContext: Partial<BTContext>) {
    this.root = root;
    this.context = this.createDefaultContext();
    Object.assign(this.context, initialContext);
  }

  private createDefaultContext(): BTContext {
    return {
      self: null as unknown as AICharacter,
      target: null,
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      velocity: new THREE.Vector3(),
      isAlive: true,
      health: 100,
      maxHealth: 100,
      armor: 0,
      hasLineOfSight: false,
      distanceToTarget: Infinity,
      isInCover: false,
      patrolPoints: [],
      currentPatrolIndex: 0,
      coverSpots: [],
      custom: {},
    };
  }

  update(deltaTime: number): NodeStatus {
    if (!this.context.isAlive) {
      return NodeStatus.FAILURE;
    }

    this.lastStatus = this.root.execute(this.context);
    return this.lastStatus;
  }

  reset(): void {
    this.root.reset();
    this.lastStatus = NodeStatus.SUCCESS;
  }

  setContext(context: Partial<BTContext>): void {
    Object.assign(this.context, context);
  }

  getContext(): BTContext {
    return this.context;
  }

  getLastStatus(): NodeStatus {
    return this.lastStatus;
  }
}

// ============== 工具函数 - 创建常用行为树 ==============
export function createEnemyBehaviorTree(): BehaviorTree {
  // 敌人AI行为树结构
  // 优先级: 低血量撤退 > 发现目标攻击 > 巡逻
  
  const root = new BTSelector('root', [
    // 序列1: 低血量时撤退
    new BTSequence('retreatWhenLowHealth', [
      new BTCondition('isHealthLow', (ctx) => ctx.health < ctx.maxHealth * 0.3),
      new BTAction('retreat', (ctx) => {
        ctx.self.onRetreat();
        return NodeStatus.SUCCESS;
      }),
    ]),
    
    // 序列2: 有视线时攻击
    new BTSequence('attackWhenVisible', [
      new BTCondition('hasLineOfSight', (ctx) => ctx.hasLineOfSight),
      new BTAction('approach', (ctx) => {
        ctx.self.onApproachTarget(ctx.target!);
        return NodeStatus.RUNNING;
      }),
      new BTAction('attack', (ctx) => {
        ctx.self.onAttack(ctx.target!);
        return NodeStatus.SUCCESS;
      }),
    ]),
    
    // 默认: 巡逻
    new BTAction('patrol', (ctx) => {
      ctx.self.onPatrol();
      return NodeStatus.SUCCESS;
    }),
  ]);

  return new BehaviorTree(root, {
    custom: {
      attackRange: 20,
      retreatHealthThreshold: 0.3,
      patrolWaitTime: 2.0,
    },
  });
}

// ============== AICharacter 引用（前置声明） ==============
export class AICharacter {
  // 基础属性
  id: string;
  name: string;
  position: THREE.Vector3 = new THREE.Vector3();
  rotation: THREE.Euler = new THREE.Euler();
  velocity: THREE.Vector3 = new THREE.Vector3();
  
  // 战斗属性
  health: number = 100;
  maxHealth: number = 100;
  armor: number = 0;
  damage: number = 10;
  
  // 状态
  isAlive: boolean = true;
  isMoving: boolean = false;
  isAttacking: boolean = false;
  
  // 行为树
  behaviorTree: BehaviorTree | null = null;
  
  // 目标
  target: THREE.Object3D | null = null;
  
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
  
  // 虚方法 - 子类实现
  onRetreat(): void {}
  onApproachTarget(target: THREE.Object3D): void {}
  onAttack(target: THREE.Object3D): void {}
  onPatrol(): void {}
  update(deltaTime: number): void {}
  takeDamage(amount: number): void {}
  die(): void {}
}

export default BehaviorTree;
