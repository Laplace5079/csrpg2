/**
 * CS:RPG - Skill Tree System
 * 技能树数据结构（战斗/生存/特殊三个分支）
 */

import { PlayerStats } from './PlayerStats';

export type SkillBranch = 'combat' | 'survival' | 'special';
export type SkillTier = 'basic' | 'advanced' | 'ultimate';

/**
 * 技能效果
 */
export interface SkillEffect {
  stat: keyof PlayerStats;
  value: number;
  isPercentage?: boolean;
}

/**
 * 技能配置
 */
export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  branch: SkillBranch;
  tier: SkillTier;
  maxPoints: number;
  effects: SkillEffect[];
  prerequisites: string[];
  icon?: string;
}

/**
 * 玩家技能状态
 */
export interface PlayerSkill {
  skillId: string;
  currentPoints: number;
  unlocked: boolean;
}

/**
 * 技能树状态
 */
export interface SkillTreeState {
  skills: Map<string, PlayerSkill>;
  availablePoints: number;
  totalPointsSpent: number;
}

/**
 * 技能配置表
 */
export const SKILL_DATABASE: Record<string, SkillConfig> = {
  // === 战斗专精 (Combat) ===
  'combat_basic': {
    id: 'combat_basic',
    name: '枪械专精',
    description: '掌握各类枪械的使用技巧',
    branch: 'combat',
    tier: 'basic',
    maxPoints: 1,
    effects: [{ stat: 'weaponDamageBonus', value: 10, isPercentage: true }],
    prerequisites: [],
    icon: '🎯',
  },
  'combat_rapid_aim': {
    id: 'combat_rapid_aim',
    name: '快速瞄准',
    description: '减少瞄准时间，提高反应速度',
    branch: 'combat',
    tier: 'basic',
    maxPoints: 1,
    effects: [{ stat: 'recoilControl', value: 20 }],
    prerequisites: ['combat_basic'],
    icon: '👁️',
  },
  'combat_crit_boost': {
    id: 'combat_crit_boost',
    name: '暴击强化',
    description: '提高暴击率和暴击伤害',
    branch: 'combat',
    tier: 'basic',
    maxPoints: 1,
    effects: [
      { stat: 'criticalChance', value: 5 },
      { stat: 'criticalDamage', value: 25 },
    ],
    prerequisites: ['combat_basic'],
    icon: '💥',
  },
  'combat_piercing': {
    id: 'combat_piercing',
    name: '穿透弹',
    description: '子弹可以穿透目标，造成额外伤害',
    branch: 'combat',
    tier: 'advanced',
    maxPoints: 1,
    effects: [{ stat: 'weaponDamageBonus', value: 15, isPercentage: true }],
    prerequisites: ['combat_crit_boost'],
    icon: '🔫',
  },
  'combat_ultimate': {
    id: 'combat_ultimate',
    name: '火力全开',
    description: '终极技能：100%射速提升，持续10秒',
    branch: 'combat',
    tier: 'ultimate',
    maxPoints: 1,
    effects: [{ stat: 'fireRateBonus', value: 100, isPercentage: true }],
    prerequisites: ['combat_piercing', 'combat_rapid_aim'],
    icon: '⚡',
  },

  // === 生存 (Survival) ===
  'survival_basic': {
    id: 'survival_basic',
    name: '急救包',
    description: '增加可携带的急救包数量',
    branch: 'survival',
    tier: 'basic',
    maxPoints: 3,
    effects: [{ stat: 'maxMedkits', value: 1 }],
    prerequisites: [],
    icon: '🩹',
  },
  'survival_armor': {
    id: 'survival_armor',
    name: '护甲强化',
    description: '提高最大护甲值',
    branch: 'survival',
    tier: 'basic',
    maxPoints: 1,
    effects: [{ stat: 'maxArmor', value: 20, isPercentage: true }],
    prerequisites: ['survival_basic'],
    icon: '🛡️',
  },
  'survival_dodge': {
    id: 'survival_dodge',
    name: '闪避',
    description: '增加闪避攻击的概率',
    branch: 'survival',
    tier: 'basic',
    maxPoints: 1,
    effects: [{ stat: 'dodgeChance', value: 10 }],
    prerequisites: ['survival_basic'],
    icon: '💨',
  },
  'survival_will': {
    id: 'survival_will',
    name: '意志坚定',
    description: '减少负面效果的持续时间',
    branch: 'survival',
    tier: 'advanced',
    maxPoints: 1,
    effects: [{ stat: 'damageReduction', value: 15 }],
    prerequisites: ['survival_armor'],
    icon: '💪',
  },
  'survival_regen': {
    id: 'survival_regen',
    name: '快速恢复',
    description: '生命值自然恢复速度提升',
    branch: 'survival',
    tier: 'advanced',
    maxPoints: 1,
    effects: [{ stat: 'healthRegenRate', value: 2 }],
    prerequisites: ['survival_dodge'],
    icon: '❤️',
  },
  'survival_ultimate': {
    id: 'survival_ultimate',
    name: '不死之身',
    description: '终极技能：死亡时原地复活并恢复50%生命',
    branch: 'survival',
    tier: 'ultimate',
    maxPoints: 1,
    effects: [
      { stat: 'maxHealth', value: 20, isPercentage: true },
      { stat: 'damageReduction', value: 10 },
    ],
    prerequisites: ['survival_will', 'survival_regen'],
    icon: '✨',
  },

  // === 特殊 (Special) ===
  'special_basic': {
    id: 'special_basic',
    name: '手雷大师',
    description: '增加可携带的手雷数量',
    branch: 'special',
    tier: 'basic',
    maxPoints: 2,
    effects: [{ stat: 'maxGrenades', value: 1 }],
    prerequisites: [],
    icon: '💣',
  },
  'special_scanner': {
    id: 'special_scanner',
    name: '战术扫描',
    description: '显示范围内敌人的位置',
    branch: 'special',
    tier: 'basic',
    maxPoints: 1,
    effects: [],
    prerequisites: ['special_basic'],
    icon: '📡',
  },
  'special_stealth': {
    id: 'special_stealth',
    name: '隐形',
    description: '进入潜行状态，敌人难以发现',
    branch: 'special',
    tier: 'advanced',
    maxPoints: 1,
    effects: [{ stat: 'dodgeChance', value: 15 }],
    prerequisites: ['special_scanner'],
    icon: '👻',
  },
  'special_emp': {
    id: 'special_emp',
    name: 'EMP冲击',
    description: '释放EMP脉冲，沉默范围内所有敌人',
    branch: 'special',
    tier: 'advanced',
    maxPoints: 1,
    effects: [],
    prerequisites: ['special_basic'],
    icon: '⚡',
  },
  'special_ultimate': {
    id: 'special_ultimate',
    name: '量子爆发',
    description: '终极技能：召唤量子能量，对大范围敌人造成巨量伤害',
    branch: 'special',
    tier: 'ultimate',
    maxPoints: 1,
    effects: [
      { stat: 'weaponDamageBonus', value: 50, isPercentage: true },
      { stat: 'criticalChance', value: 20 },
    ],
    prerequisites: ['special_stealth', 'special_emp'],
    icon: '🌌',
  },
};

/**
 * 技能树类
 */
export class SkillTree {
  private state: SkillTreeState;
  private skillDatabase: Record<string, SkillConfig>;

  constructor(skillDatabase: Record<string, SkillConfig> = SKILL_DATABASE) {
    this.skillDatabase = skillDatabase;
    this.state = {
      skills: new Map(),
      availablePoints: 0,
      totalPointsSpent: 0,
    };

    // 初始化所有技能
    for (const skillId of Object.keys(this.skillDatabase)) {
      this.state.skills.set(skillId, {
        skillId,
        currentPoints: 0,
        unlocked: false,
      });
    }
  }

  /**
   * 初始化玩家技能点
   */
  initializeWithLevel(level: number): void {
    // 根据等级给予技能点（每2级1点）
    const points = Math.floor(level / 2);
    this.state.availablePoints = points;
  }

  /**
   * 检查技能是否可以学习
   */
  canLearn(skillId: string): { canLearn: boolean; reason?: string } {
    const skill = this.skillDatabase[skillId];
    if (!skill) {
      return { canLearn: false, reason: '技能不存在' };
    }

    const playerSkill = this.state.skills.get(skillId);
    if (!playerSkill) {
      return { canLearn: false, reason: '技能未初始化' };
    }

    // 检查是否已满级
    if (playerSkill.currentPoints >= skill.maxPoints) {
      return { canLearn: false, reason: '技能已满级' };
    }

    // 检查是否有可用点数
    if (this.state.availablePoints <= 0) {
      return { canLearn: false, reason: '没有可用技能点' };
    }

    // 检查前置技能
    for (const prereqId of skill.prerequisites) {
      const prereqSkill = this.state.skills.get(prereqId);
      if (!prereqSkill || !prereqSkill.unlocked) {
        return { canLearn: false, reason: `需要前置技能: ${this.skillDatabase[prereqId]?.name || prereqId}` };
      }
    }

    return { canLearn: true };
  }

  /**
   * 学习技能
   */
  learnSkill(skillId: string): { success: boolean; reason?: string } {
    const check = this.canLearn(skillId);
    if (!check.canLearn) {
      return { success: false, reason: check.reason };
    }

    const skill = this.skillDatabase[skillId];
    const playerSkill = this.state.skills.get(skillId)!;

    // 消耗技能点
    this.state.availablePoints--;
    playerSkill.currentPoints++;
    playerSkill.unlocked = true;
    this.state.totalPointsSpent++;

    // 如果是单点技能，立即解锁
    if (skill.maxPoints === 1) {
      playerSkill.unlocked = true;
    }

    return { success: true };
  }

  /**
   * 重置技能树
   */
  reset(availablePoints: number): void {
    for (const [skillId, playerSkill] of this.state.skills) {
      playerSkill.currentPoints = 0;
      playerSkill.unlocked = false;
    }
    this.state.availablePoints = availablePoints;
    this.state.totalPointsSpent = 0;
  }

  /**
   * 获取技能状态
   */
  getSkillState(skillId: string): PlayerSkill | undefined {
    return this.state.skills.get(skillId);
  }

  /**
   * 获取所有已解锁技能
   */
  getUnlockedSkills(): PlayerSkill[] {
    return Array.from(this.state.skills.values()).filter(s => s.unlocked);
  }

  /**
   * 获取可用技能点
   */
  getAvailablePoints(): number {
    return this.state.availablePoints;
  }

  /**
   * 获取当前技能状态
   */
  getState(): SkillTreeState {
    return this.state;
  }

  /**
   * 计算所有已学习技能的效果
   */
  calculateTotalEffects(): SkillEffect[] {
    const effects: SkillEffect[] = [];

    for (const [skillId, playerSkill] of this.state.skills) {
      if (!playerSkill.unlocked) continue;

      const config = this.skillDatabase[skillId];
      if (!config) continue;

      // 根据投入的点数计算效果
      const multiplier = playerSkill.currentPoints / config.maxPoints;
      for (const effect of config.effects) {
        effects.push({
          ...effect,
          value: effect.value * multiplier,
        });
      }
    }

    return effects;
  }

  /**
   * 获取指定分支的技能
   */
  getSkillsByBranch(branch: SkillBranch): { config: SkillConfig; state: PlayerSkill }[] {
    const result: { config: SkillConfig; state: PlayerSkill }[] = [];

    for (const [skillId, config] of Object.entries(this.skillDatabase)) {
      if (config.branch === branch) {
        const state = this.state.skills.get(skillId)!;
        result.push({ config, state });
      }
    }

    return result;
  }

  /**
   * 检查终极技能是否可学
   */
  canLearnUltimate(branch: SkillBranch): boolean {
    const branchSkills = this.getSkillsByBranch(branch);
    const ultimate = branchSkills.find(s => s.config.tier === 'ultimate');

    if (!ultimate) return false;

    return ultimate.state.unlocked === false;
  }

  /**
   * 获取技能树进度
   */
  getProgress(): {
    totalSkills: number;
    unlockedSkills: number;
    totalPoints: number;
    pointsSpent: number;
    branchProgress: Record<SkillBranch, { unlocked: number; total: number }>;
  } {
    const branches: SkillBranch[] = ['combat', 'survival', 'special'];
    const branchProgress = {} as Record<SkillBranch, { unlocked: number; total: number }>;

    let totalSkills = 0;
    let unlockedSkills = 0;

    for (const branch of branches) {
      const skills = this.getSkillsByBranch(branch);
      const unlocked = skills.filter(s => s.state.unlocked).length;
      branchProgress[branch] = { unlocked, total: skills.length };
      totalSkills += skills.length;
      unlockedSkills += unlocked;
    }

    return {
      totalSkills,
      unlockedSkills,
      totalPoints: this.state.availablePoints + this.state.totalPointsSpent,
      pointsSpent: this.state.totalPointsSpent,
      branchProgress,
    };
  }

  /**
   * 序列化技能状态
   */
  serialize(): string {
    const obj = {
      skills: Array.from(this.state.skills.entries()),
      availablePoints: this.state.availablePoints,
      totalPointsSpent: this.state.totalPointsSpent,
    };
    return JSON.stringify(obj);
  }

  /**
   * 反序列化技能状态
   */
  deserialize(json: string): void {
    const obj = JSON.parse(json);
    this.state.skills = new Map(obj.skills);
    this.state.availablePoints = obj.availablePoints;
    this.state.totalPointsSpent = obj.totalPointsSpent;
  }
}

// 默认技能树实例
export const defaultSkillTree = new SkillTree();

/**
 * 获取技能配置
 */
export function getSkillConfig(skillId: string): SkillConfig | undefined {
  return SKILL_DATABASE[skillId];
}

/**
 * 获取分支名称
 */
export function getBranchName(branch: SkillBranch): string {
  const names: Record<SkillBranch, string> = {
    combat: '战斗专精',
    survival: '生存',
    special: '特殊',
  };
  return names[branch];
}

/**
 * 获取层级名称
 */
export function getTierName(tier: SkillTier): string {
  const names: Record<SkillTier, string> = {
    basic: '基础',
    advanced: '进阶',
    ultimate: '终极',
  };
  return names[tier];
}
