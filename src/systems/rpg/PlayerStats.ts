/**
 * CS:RPG - Player Stats Interface and Calculations
 * 玩家属性接口和计算
 */

export type DamageType = 'physical' | 'energy' | 'armor_piercing' | 'explosive';

/**
 * 玩家基础属性接口
 */
export interface PlayerStats {
  // 基础
  level: number;
  experience: number;
  experienceToNextLevel: number;

  // 战斗
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;

  // 移动
  speed: number;
  sprintSpeed: number;

  // 武器加成
  weaponDamageBonus: number;
  fireRateBonus: number;
  reloadSpeedBonus: number;
  spreadReduction: number;
  recoilControl: number;

  // 防御
  damageReduction: number;
  criticalChance: number;
  criticalDamage: number;

  // 闪避
  dodgeChance: number;

  // 特殊
  maxGrenades: number;
  maxMedkits: number;
  healthRegenRate: number;
}

/**
 * 玩家状态（运行时）
 */
export interface PlayerState extends PlayerStats {
  // 运行时状态
  isAlive: boolean;
  isSprinting: boolean;
  isAiming: boolean;
  currentWeaponId: string | null;
  inventory: string[];
  equippedItems: {
    weapon: string | null;
    armor: string | null;
    helmet: string | null;
    accessory: string | null;
  };
}

/**
 * 创建默认玩家属性
 */
export function createDefaultPlayerStats(): PlayerStats {
  return {
    // 基础
    level: 1,
    experience: 0,
    experienceToNextLevel: 100,

    // 战斗
    health: 100,
    maxHealth: 100,
    armor: 0,
    maxArmor: 100,

    // 移动
    speed: 5,
    sprintSpeed: 8,

    // 武器加成
    weaponDamageBonus: 0,
    fireRateBonus: 0,
    reloadSpeedBonus: 0,
    spreadReduction: 0,
    recoilControl: 0,

    // 防御
    damageReduction: 0,
    criticalChance: 5, // 5% base crit chance
    criticalDamage: 150, // 150% base crit damage

    // 闪避
    dodgeChance: 0,

    // 特殊
    maxGrenades: 2,
    maxMedkits: 1,
    healthRegenRate: 0,
  };
}

/**
 * 创建默认玩家状态
 */
export function createDefaultPlayerState(): PlayerState {
  const stats = createDefaultPlayerStats();
  return {
    ...stats,
    isAlive: true,
    isSprinting: false,
    isAiming: false,
    currentWeaponId: null,
    inventory: [],
    equippedItems: {
      weapon: null,
      armor: null,
      helmet: null,
      accessory: null,
    },
  };
}

/**
 * 计算实际伤害减免（考虑护甲）
 */
export function calculateDamageReduction(armor: number, damage: number): number {
  // 护甲减伤公式: damage / (damage + armor * 10)
  const reduction = armor / (armor + 100);
  return Math.min(reduction, 0.9); // 最大90%减伤
}

/**
 * 恢复生命值
 */
export function healPlayer(stats: PlayerStats, amount: number): PlayerStats {
  const newHealth = Math.min(stats.health + amount, stats.maxHealth);
  return { ...stats, health: newHealth };
}

/**
 * 恢复护甲
 */
export function restoreArmor(stats: PlayerStats, amount: number): PlayerStats {
  const newArmor = Math.min(stats.armor + amount, stats.maxArmor);
  return { ...stats, armor: newArmor };
}

/**
 * 受到伤害
 */
export function takeDamage(stats: PlayerStats, damage: number): PlayerStats {
  const damageReduction = calculateDamageReduction(stats.armor, damage);
  const actualDamage = Math.floor(damage * (1 - damageReduction));

  let newArmor = stats.armor;
  let newHealth = stats.health;

  // 先消耗护甲
  if (newArmor > 0) {
    const armorDamage = Math.min(newArmor, actualDamage);
    newArmor -= armorDamage;
    newHealth -= (actualDamage - armorDamage);
  } else {
    newHealth -= actualDamage;
  }

  newHealth = Math.max(0, newHealth);

  return {
    ...stats,
    armor: newArmor,
    health: newHealth,
    isAlive: newHealth > 0,
  };
}

/**
 * 生命值自然恢复
 */
export function processHealthRegen(stats: PlayerStats, deltaTime: number): PlayerStats {
  if (stats.healthRegenRate <= 0 || stats.health >= stats.maxHealth) {
    return stats;
  }

  const healAmount = stats.healthRegenRate * deltaTime;
  const newHealth = Math.min(stats.health + healAmount, stats.maxHealth);

  return { ...stats, health: newHealth };
}

/**
 * 玩家属性加成
 */
export interface StatBonus {
  stat: keyof PlayerStats;
  value: number;
  source: string;
}

/**
 * 应用属性加成
 */
export function applyStatBonus(stats: PlayerStats, bonus: StatBonus): PlayerStats {
  const currentValue = stats[bonus.stat];

  // 特殊处理某些属性
  if (bonus.stat === 'criticalChance' || bonus.stat === 'spreadReduction' || bonus.stat === 'dodgeChance') {
    // 百分比加成
    return {
      ...stats,
      [bonus.stat]: currentValue + bonus.value,
    };
  }

  // 数值加成
  return {
    ...stats,
    [bonus.stat]: currentValue + bonus.value,
  };
}

/**
 * 批量应用属性加成
 */
export function applyStatBonuses(stats: PlayerStats, bonuses: StatBonus[]): PlayerStats {
  let result = stats;
  for (const bonus of bonuses) {
    result = applyStatBonus(result, bonus);
  }
  return result;
}

/**
 * 玩家属性变化事件
 */
export interface StatChangeEvent {
  stat: keyof PlayerStats;
  oldValue: number | string;
  newValue: number | string;
  change: number | string;
  source: string;
}

/**
 * 获取属性显示名称
 */
export function getStatDisplayName(stat: keyof PlayerStats): string {
  const displayNames: Record<string, string> = {
    level: '等级',
    experience: '经验',
    experienceToNextLevel: '升级所需经验',
    health: '生命值',
    maxHealth: '最大生命值',
    armor: '护甲',
    maxArmor: '最大护甲',
    speed: '移动速度',
    sprintSpeed: '冲刺速度',
    weaponDamageBonus: '武器伤害加成',
    fireRateBonus: '射速加成',
    reloadSpeedBonus: '换弹速度加成',
    spreadReduction: '散布减少',
    recoilControl: '后坐力控制',
    damageReduction: '伤害减免',
    criticalChance: '暴击率',
    criticalDamage: '暴击伤害',
    dodgeChance: '闪避率',
    maxGrenades: '最大手雷数',
    maxMedkits: '最大急救包数',
    healthRegenRate: '生命恢复速度',
  };

  return displayNames[stat] || stat;
}

/**
 * 获取属性变化描述
 */
export function formatStatChange(event: StatChangeEvent): string {
  const statName = getStatDisplayName(event.stat as keyof PlayerStats);

  if (typeof event.change === 'number') {
    const prefix = event.change >= 0 ? '+' : '';
    return `${statName}: ${prefix}${event.change}`;
  }

  return `${statName}: ${event.oldValue} -> ${event.newValue}`;
}
