/**
 * AI System - 主入口
 * 导出所有AI系统模块
 */

// 核心
export { AICharacter, AICharacterType, AIState } from './AICharacter';
export { 
  BehaviorTree, 
  NodeType, 
  NodeStatus,
  BTContext,
  BTSequence,
  BTSelector,
  BTCondition,
  BTAction,
  BTDecorator,
  DecoratorType,
  createEnemyBehaviorTree,
} from './BehaviorTree';

// 敌人
export { Grunt } from './Enemy/Grunt';
export { Soldier } from './Enemy/Soldier';

// Boss
export { BossBase, BossPhaseConfig, BossConfig, BossEvents } from './Boss/BossBase';
export { Trainer } from './Boss/Trainer';

// ============== 快速工厂函数 ==============

import * as THREE from 'three';
import { Grunt } from './Enemy/Grunt';
import { Soldier } from './Enemy/Soldier';
import { Trainer } from './Boss/Trainer';
import { AICharacterType, AIConfig } from './AICharacter';

/**
 * 根据类型创建AI角色
 */
export function createAICharacter(
  type: AICharacterType, 
  id: string, 
  position?: THREE.Vector3,
  options?: Partial<AIConfig>
): Grunt | Soldier | null {
  switch (type) {
    case AICharacterType.GRUNT:
      return Grunt.create(position);
    case AICharacterType.SOLDIER:
      return Soldier.create(position);
    default:
      console.warn(`Unknown AI type: ${type}`);
      return null;
  }
}

/**
 * 创建Boss
 */
export function createBoss(
  type: string,
  id: string,
  position?: THREE.Vector3
): Trainer | null {
  switch (type) {
    case 'trainer':
      return Trainer.create(position);
    default:
      console.warn(`Unknown boss type: ${type}`);
      return null;
  }
}

/**
 * 创建一组敌人
 */
export function createEnemyWave(
  types: Array<{ type: AICharacterType; count: number }>,
  centerPosition: THREE.Vector3,
  spread: number = 10
): Array<Grunt | Soldier> {
  const enemies: Array<Grunt | Soldier> = [];
  
  for (const { type, count } of types) {
    for (let i = 0; i < count; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * spread * 2,
        0,
        (Math.random() - 0.5) * spread * 2
      );
      const position = centerPosition.clone().add(offset);
      
      const enemy = createAICharacter(type, `${type}_${i}`, position);
      if (enemy) {
        enemies.push(enemy);
      }
    }
  }
  
  return enemies;
}
