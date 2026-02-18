/**
 * CS:RPG - Level System
 * 等级系统，经验曲线，升级奖励
 */

import { PlayerStats, createDefaultPlayerStats } from './PlayerStats';

export const MAX_LEVEL = 50;
export const BASE_EXP = 100;
export const EXP_CURVE_EXPONENT = 1.5;

/**
 * 经验曲线配置
 */
export interface ExpCurveConfig {
  baseExp: number;
  exponent: number;
  maxLevel: number;
}

/**
 * 升级奖励配置
 */
export interface LevelUpReward {
  level: number;
  stats: Partial<PlayerStats>;
  skills: string[];
  description: string;
}

/**
 * 等级系统类
 */
export class LevelSystem {
  private config: ExpCurveConfig;
  private rewards: Map<number, LevelUpReward>;

  constructor(config?: Partial<ExpCurveConfig>) {
    this.config = {
      baseExp: config?.baseExp ?? BASE_EXP,
      exponent: config?.exponent ?? EXP_CURVE_EXPONENT,
      maxLevel: config?.maxLevel ?? MAX_LEVEL,
    };

    this.rewards = new Map();
    this.initializeRewards();
  }

  /**
   * 计算指定等级所需经验
   */
  getExpForLevel(level: number): number {
    if (level <= 1) return 0;
    if (level > this.config.maxLevel) return Infinity;

    return Math.floor(this.config.baseExp * Math.pow(this.config.exponent, level - 1));
  }

  /**
   * 计算当前等级总经验需求
   */
  getTotalExpForLevel(level: number): number {
    let total = 0;
    for (let i = 2; i <= level; i++) {
      total += this.getExpForLevel(i);
    }
    return total;
  }

  /**
   * 获取当前等级经验进度（百分比）
   */
  getExpProgress(stats: PlayerStats): number {
    const expForNext = this.getExpForLevel(stats.level + 1);
    if (expForNext === Infinity) return 100;
    return (stats.experience / expForNext) * 100;
  }

  /**
   * 添加经验值
   */
  addExperience(stats: PlayerStats, amount: number): {
    stats: PlayerStats;
    leveledUp: boolean;
    newLevel: number;
    rewards: LevelUpReward[];
  } {
    let newExp = stats.experience + amount;
    let newLevel = stats.level;
    const rewards: LevelUpReward[] = [];

    // 检查是否升级
    while (newLevel < this.config.maxLevel) {
      const expNeeded = this.getExpForLevel(newLevel + 1);
      if (newExp >= expNeeded) {
        newExp -= expNeeded;
        newLevel++;

        // 获取升级奖励
        const reward = this.rewards.get(newLevel);
        if (reward) {
          rewards.push(reward);
        }
      } else {
        break;
      }
    }

    // 应用升级奖励
    let newStats = {
      ...stats,
      experience: newExp,
      level: newLevel,
      experienceToNextLevel: this.getExpForLevel(newLevel + 1),
    };

    // 应用所有升级奖励
    for (const reward of rewards) {
      newStats = { ...newStats, ...reward.stats };
    }

    return {
      stats: newStats,
      leveledUp: rewards.length > 0,
      newLevel,
      rewards,
    };
  }

  /**
   * 获取升级奖励
   */
  getLevelReward(level: number): LevelUpReward | undefined {
    return this.rewards.get(level);
  }

  /**
   * 初始化升级奖励
   */
  private initializeRewards(): void {
    // 2-10级每级奖励
    for (let level = 2; level <= 10; level++) {
      this.rewards.set(level, {
        level,
        stats: {
          maxHealth: 5,
          maxArmor: 3,
        },
        skills: [],
        description: `等级 ${level} 奖励: 最大生命值 +5, 最大护甲 +3`,
      });
    }

    // 11-20级奖励
    for (let level = 11; level <= 20; level++) {
      this.rewards.set(level, {
        level,
        stats: {
          maxHealth: 8,
          maxArmor: 5,
          criticalChance: 0.5,
        },
        skills: [],
        description: `等级 ${level} 奖励: 最大生命值 +8, 最大护甲 +5, 暴击率 +0.5%`,
      });
    }

    // 21-30级奖励
    for (let level = 21; level <= 30; level++) {
      this.rewards.set(level, {
        level,
        stats: {
          maxHealth: 10,
          maxArmor: 8,
          criticalChance: 1,
          weaponDamageBonus: 2,
        },
        skills: [],
        description: `等级 ${level} 奖励: 最大生命值 +10, 最大护甲 +8, 暴击率 +1%, 武器伤害 +2%`,
      });
    }

    // 31-40级奖励
    for (let level = 31; level <= 40; level++) {
      this.rewards.set(level, {
        level,
        stats: {
          maxHealth: 15,
          maxArmor: 10,
          criticalChance: 1,
          criticalDamage: 5,
          weaponDamageBonus: 3,
        },
        skills: [],
        description: `等级 ${level} 奖励: 最大生命值 +15, 最大护甲 +10, 暴击率 +1%, 暴击伤害 +5%, 武器伤害 +3%`,
      });
    }

    // 41-50级奖励
    for (let level = 41; level <= 50; level++) {
      this.rewards.set(level, {
        level,
        stats: {
          maxHealth: 20,
          maxArmor: 15,
          criticalChance: 1.5,
          criticalDamage: 10,
          weaponDamageBonus: 5,
          damageReduction: 1,
        },
        skills: [],
        description: `等级 ${level} 奖励: 最大生命值 +20, 最大护甲 +15, 暴击率 +1.5%, 暴击伤害 +10%, 武器伤害 +5%, 伤害减免 +1%`,
      });
    }

    // 设置特殊等级技能解锁
    this.setSkillUnlock(5, 'combat_basic');
    this.setSkillUnlock(10, 'survival_basic');
    this.setSkillUnlock(15, 'special_basic');
    this.setSkillUnlock(20, 'combat_advanced');
    this.setSkillUnlock(25, 'survival_advanced');
    this.setSkillUnlock(30, 'special_advanced');
    this.setSkillUnlock(40, 'combat_ultimate');
    this.setSkillUnlock(45, 'survival_ultimate');
    this.setSkillUnlock(50, 'special_ultimate');
  }

  /**
   * 设置技能解锁
   */
  private setSkillUnlock(level: number, skillId: string): void {
    const existing = this.rewards.get(level);
    if (existing) {
      existing.skills.push(skillId);
      existing.description += `, 解锁技能: ${skillId}`;
    } else {
      this.rewards.set(level, {
        level,
        stats: {},
        skills: [skillId],
        description: `等级 ${level} 奖励: 解锁技能 ${skillId}`,
      });
    }
  }

  /**
   * 获取等级进度信息
   */
  getLevelProgress(stats: PlayerStats): {
    currentLevel: number;
    currentExp: number;
    expToNext: number;
    progress: number;
    isMaxLevel: boolean;
  } {
    const expToNext = this.getExpForLevel(stats.level + 1);
    const isMaxLevel = stats.level >= this.config.maxLevel;

    return {
      currentLevel: stats.level,
      currentExp: stats.experience,
      expToNext: isMaxLevel ? 0 : expToNext,
      progress: isMaxLevel ? 100 : (stats.experience / expToNext) * 100,
      isMaxLevel,
    };
  }

  /**
   * 获取经验需求表
   */
  getExpTable(): { level: number; expRequired: number; totalExp: number }[] {
    const table: { level: number; expRequired: number; totalExp: number }[] = [];

    for (let level = 1; level <= this.config.maxLevel; level++) {
      table.push({
        level,
        expRequired: this.getExpForLevel(level),
        totalExp: this.getTotalExpForLevel(level),
      });
    }

    return table;
  }
}

// 默认等级系统实例
export const defaultLevelSystem = new LevelSystem();

/**
 * 便捷函数：获取等级经验需求
 */
export function getExpForLevel(level: number): number {
  return defaultLevelSystem.getExpForLevel(level);
}

/**
 * 便捷函数：添加经验
 */
export function addExperience(stats: PlayerStats, amount: number): {
  stats: PlayerStats;
  leveledUp: boolean;
  newLevel: number;
} {
  const result = defaultLevelSystem.addExperience(stats, amount);
  return {
    stats: result.stats,
    leveledUp: result.leveledUp,
    newLevel: result.newLevel,
  };
}

/**
 * 便捷函数：获取升级奖励描述
 */
export function getLevelUpDescription(rewards: LevelUpReward[]): string {
  return rewards.map(r => r.description).join('\n');
}
