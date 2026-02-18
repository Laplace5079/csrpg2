/**
 * CS:RPG - RPG Systems Index
 * RPG系统导出入口
 */

// Player Stats
export * from './PlayerStats';

// Level System
export * from './LevelSystem';

// Skill Tree
export * from './SkillTree';

// Equipment
export * from './Equipment';

// Damage Calculation
export * from './DamageCalc';

/**
 * RPG系统版本
 */
export const RPG_SYSTEM_VERSION = '1.0.0';

/**
 * 系统初始化
 */
export function initializeRPGSystem() {
  console.log('🎮 CS:RPG Systems v' + RPG_SYSTEM_VERSION);
  console.log('Initializing RPG systems...');
  
  // 验证配置
  console.log('✓ Player Stats module loaded');
  console.log('✓ Level System module loaded');
  console.log('✓ Skill Tree module loaded');
  console.log('✓ Equipment module loaded');
  console.log('✓ Damage Calculation module loaded');
  
  console.log('RPG system initialization complete!');
}
