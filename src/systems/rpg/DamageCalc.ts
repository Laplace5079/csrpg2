/**
 * CS:RPG - Damage Calculation System
 * 伤害计算公式
 */

import { DamageType } from './PlayerStats';
import { EquipmentRarity, RARITY_CONFIG } from './Equipment';

export type DamageCategory = 'headshot' | 'bodyshot' | 'legshot';

/**
 * 伤害计算输入
 */
export interface DamageInput {
  baseDamage: number;
  damageType: DamageType;
  distance?: number;
  targetArmor: number;
  targetHasHelmet: boolean;
  isCritical: boolean;
  isHeadshot: boolean;
  attackerBonuses: DamageBonuses;
  targetBonuses: TargetBonuses;
}

/**
 * 攻击者伤害加成
 */
export interface DamageBonuses {
  weaponDamageBonus: number; // 百分比
  fireRateBonus: number; // 百分比
  criticalDamage: number; // 百分比（如150表示1.5倍）
  armorPiercing: number; // 数值
  headshotBonus: number; // 百分比
}

/**
 * 目标防御属性
 */
export interface TargetBonuses {
  damageReduction: number; // 百分比
  dodgeChance: number; // 百分比
  armor: number;
  hasHelmet: boolean;
  helmetArmor: number;
}

/**
 * 伤害计算输出
 */
export interface DamageResult {
  finalDamage: number;
  armorDamage: number;
  healthDamage: number;
  isHeadshot: boolean;
  isCritical: boolean;
  isDodged: boolean;
  damageType: DamageType;
  details: DamageBreakdown;
}

/**
 * 伤害明细
 */
export interface DamageBreakdown {
  baseDamage: number;
  damageTypeMultiplier: number;
  distanceFalloff: number;
  criticalMultiplier: bonusMultiplier;
  headshotMultiplier: bonusMultiplier;
  armorPiercing: number;
  armorReduction: number;
  finalReduction: number;
  totalMultiplier: number;
}

interface bonusMultiplier {
  value: number;
  source: string;
}

/**
 * 武器类型对不同伤害类型的加成
 */
const DAMAGE_TYPE_MULTIPLIERS: Record<DamageType, number> = {
  physical: 1.0,
  energy: 1.1,
  armor_piercing: 1.3,
  explosive: 1.2,
};

/**
 * 身体部位伤害倍率
 */
const BODY_PART_MULTIPLIERS: Record<DamageCategory, number> = {
  headshot: 2.5,
  bodyshot: 1.0,
  legshot: 0.75,
};

/**
 * 伤害计算器类
 */
export class DamageCalculator {
  private config: {
    baseCriticalChance: number;
    baseCriticalDamage: number;
    baseDodgeChance: number;
    maxDistanceFalloff: number;
    armorEffectiveness: number;
  };

  constructor(config?: Partial<DamageCalculator['config']>) {
    this.config = {
      baseCriticalChance: 5,
      baseCriticalDamage: 150,
      baseDodgeChance: 0,
      maxDistanceFalloff: 100,
      armorEffectiveness: 0.1,
      ...config,
    };
  }

  /**
   * 计算最终伤害
   */
  calculate(input: DamageInput): DamageResult {
    // 1. 基础伤害
    let damage = input.baseDamage;

    // 2. 伤害类型加成
    const typeMultiplier = DAMAGE_TYPE_MULTIPLIERS[input.damageType];
    damage *= typeMultiplier;

    // 3. 距离衰减
    if (input.distance !== undefined) {
      const falloff = this.calculateDistanceFalloff(input.distance);
      damage *= falloff;
    }

    // 4. 暴击加成
    let criticalMultiplier = 1;
    if (input.isCritical) {
      const critDamage = input.attackerBonuses.criticalDamage / 100;
      criticalMultiplier = critDamage;
      damage *= criticalMultiplier;
    }

    // 5. 头部射击加成
    let headshotMultiplier = 1;
    if (input.isHeadshot) {
      const headshotBonus = 1 + input.attackerBonuses.headshotBonus / 100;
      headshotMultiplier = headshotBonus * BODY_PART_MULTIPLIERS.headshot;
      damage *= headshotMultiplier;
    }

    // 6. 武器伤害加成
    damage *= (1 + input.attackerBonuses.weaponDamageBonus / 100);

    // 7. 计算护甲穿透
    const armorPiercing = input.attackerBonuses.armorPiercing;
    let effectiveArmor = input.targetArmor - armorPiercing;
    effectiveArmor = Math.max(0, effectiveArmor);

    // 8. 计算护甲减伤
    const armorReduction = this.calculateArmorReduction(
      effectiveArmor,
      input.damageType,
      input.targetHasHelmet,
      input.targetBonuses
    );

    // 9. 应用最终减伤
    const totalReduction = armorReduction + input.targetBonuses.damageReduction / 100;
    const finalDamage = Math.floor(damage * (1 - totalReduction));

    // 10. 计算护甲伤害
    const armorDamage = Math.min(input.targetArmor, Math.floor(damage * 0.3));

    // 11. 检查闪避
    const dodgeRoll = Math.random() * 100;
    const isDodged = dodgeRoll < input.targetBonuses.dodgeChance;

    return {
      finalDamage: isDodged ? 0 : finalDamage,
      armorDamage: isDodged ? 0 : armorDamage,
      healthDamage: isDodged ? 0 : Math.max(0, finalDamage - armorDamage),
      isHeadshot: input.isHeadshot,
      isCritical: input.isCritical,
      isDodged,
      damageType: input.damageType,
      details: {
        baseDamage: input.baseDamage,
        damageTypeMultiplier: {
          value: typeMultiplier,
          source: 'damageType',
        },
        distanceFalloff: this.calculateDistanceFalloff(input.distance || 0),
        criticalMultiplier: {
          value: criticalMultiplier,
          source: input.isCritical ? 'critical' : 'none',
        },
        headshotMultiplier: {
          value: headshotMultiplier,
          source: input.isHeadshot ? 'headshot' : 'none',
        },
        armorPiercing,
        armorReduction,
        finalReduction: totalReduction,
        totalMultiplier: typeMultiplier * (input.isCritical ? input.attackerBonuses.criticalDamage / 100 : 1) * (input.isHeadshot ? headshotMultiplier : 1),
      },
    };
  }

  /**
   * 计算距离衰减
   */
  private calculateDistanceFalloff(distance: number): number {
    const maxRange = this.config.maxDistanceFalloff;
    if (distance <= 0) return 1;
    if (distance >= maxRange) return 0.3; // 最小伤害为30%

    // 线性衰减
    return 1 - (distance / maxRange) * 0.7;
  }

  /**
   * 计算护甲减伤
   */
  private calculateArmorReduction(
    armor: number,
    damageType: DamageType,
    hasHelmet: boolean,
    targetBonuses: TargetBonuses
  ): number {
    if (armor <= 0) return 0;

    // 穿甲弹对护甲效果降低
    const piercingPenalty = damageType === 'armor_piercing' ? 0.5 : 1;

    // 护甲减伤公式: armor / (armor + 100) * effectiveness
    const baseReduction = (armor / (armor + 100)) * this.config.armorEffectivity * piercingPenalty;

    return Math.min(baseReduction, 0.8); // 最大80%减伤
  }

  /**
   * 判定是否暴击
   */
  rollCritical(baseCriticalChance: number): boolean {
    const roll = Math.random() * 100;
    return roll < baseCriticalChance;
  }

  /**
   * 判定是否闪避
   */
  rollDodge(dodgeChance: number): boolean {
    const roll = Math.random() * 100;
    return roll < dodgeChance;
  }

  /**
   * 快速计算单发伤害
   */
  quickCalculate(
    baseDamage: number,
    isHeadshot: boolean,
    attackerCritChance: number,
    attackerCritDamage: number,
    attackerDamageBonus: number,
    targetArmor: number
  ): number {
    // 随机暴击
    const isCritical = this.rollCritical(attackerCritChance);

    // 基础伤害
    let damage = baseDamage;

    // 头部加成
    if (isHeadshot) {
      damage *= BODY_PART_MULTIPLIERS.headshot;
    }

    // 暴击加成
    if (isCritical) {
      damage *= attackerCritDamage / 100;
    }

    // 伤害加成
    damage *= (1 + attackerDamageBonus / 100);

    // 护甲减伤
    const armorReduction = targetArmor / (targetArmor + 100) * this.config.armorEffectivity;
    damage *= (1 - armorReduction);

    return Math.floor(damage);
  }

  /**
   * 计算DPS（每秒伤害）
   */
  calculateDPS(
    damagePerShot: number,
    fireRateRPM: number,
    reloadTime: number,
    magSize: number
  ): {
    sustained: number;
    burst: number;
    timeToEmpty: number;
    reloadRatio: number;
  } {
    // 爆发DPS
    const burstDPS = (damagePerShot * fireRateRPM) / 60;

    // 持续DPS（考虑换弹）
    const timeToEmpty = (magSize / fireRateRPM) * 60; // 秒
    const totalCycleTime = timeToEmpty + reloadTime;
    const shotsPerCycle = magSize + (fireRateRPM / 60) * reloadTime;
    const sustainedDPS = (damagePerShot * shotsPerCycle) / totalCycleTime;

    return {
      sustained: Math.round(sustainedDPS),
      burst: Math.round(burstDPS),
      timeToEmpty: Math.round(timeToEmpty * 10) / 10,
      reloadRatio: Math.round((reloadTime / totalCycleTime) * 100),
    };
  }

  /**
   * 计算预期伤害（考虑命中率）
   */
  calculateExpectedDamage(
    baseDamage: number,
    accuracy: number, // 0-100
    critChance: number,
    critDamage: number,
    headshotRatio: number,
    targetArmor: number
  ): {
    expected: number;
    dps: number;
  } {
    // 命中伤害
    const hitDamage = this.quickCalculate(
      baseDamage,
      false,
      critChance,
      critDamage,
      0,
      targetArmor
    );

    // 头部伤害
    const headDamage = this.quickCalculate(
      baseDamage,
      true,
      critChance,
      critDamage,
      0,
      targetArmor
    );

    // 预期伤害 = 命中概率 * (身体伤害 + 头部射击比例 * 头部加成)
    const hitRatio = accuracy / 100;
    const expected = hitRatio * (hitDamage * (1 - headshotRatio) + headDamage * headshotRatio);

    return {
      expected: Math.round(expected),
      dps: Math.round(expected * 10), // 假设10发/秒
    };
  }
}

// 默认伤害计算器实例
export const defaultDamageCalculator = new DamageCalculator();

/**
 * 便捷函数：计算伤害
 */
export function calculateDamage(input: DamageInput): DamageResult {
  return defaultDamageCalculator.calculate(input);
}

/**
 * 便捷函数：快速计算
 */
export function quickDamage(
  baseDamage: number,
  isHeadshot: boolean,
  critChance: number,
  critDamage: number,
  damageBonus: number,
  armor: number
): number {
  return defaultDamageCalculator.quickCalculate(
    baseDamage,
    isHeadshot,
    critChance,
    critDamage,
    damageBonus,
    armor
  );
}

/**
 * 便捷函数：计算DPS
 */
export function calculateWeaponDPS(
  damage: number,
  fireRate: number,
  reloadTime: number,
  magSize: number
) {
  return defaultDamageCalculator.calculateDPS(damage, fireRate, reloadTime, magSize);
}

/**
 * 武器伤害类型说明
 */
export function getDamageTypeInfo(type: DamageType): {
  name: string;
  description: string;
  color: string;
} {
  const info: Record<DamageType, { name: string; description: string; color: string }> = {
    physical: {
      name: '物理',
      description: '标准子弹伤害',
      color: '#FFFFFF',
    },
    energy: {
      name: '能量',
      description: '对护甲有额外加成',
      color: '#00BFFF',
    },
    armor_piercing: {
      name: '穿甲',
      description: '穿透护甲，降低减伤效果',
      color: '#FFD700',
    },
    explosive: {
      name: '爆炸',
      description: '范围伤害，衰减较慢',
      color: '#FF4500',
    },
  };

  return info[type];
}

/**
 * 获取身体部位伤害说明
 */
export function getBodyPartInfo(part: DamageCategory): {
  name: string;
  multiplier: number;
  description: string;
} {
  const info: Record<DamageCategory, { name: string; multiplier: number; description: string }> = {
    headshot: {
      name: '头部',
      multiplier: BODY_PART_MULTIPLIERS.headshot,
      description: '造成2.5倍伤害',
    },
    bodyshot: {
      name: '身体',
      multiplier: BODY_PART_MULTIPLIERS.bodyshot,
      description: '标准伤害',
    },
    legshot: {
      name: '腿部',
      multiplier: BODY_PART_MULTIPLIERS.legshot,
      description: '伤害降低25%',
    },
  };

  return info[part];
}

/**
 * 格式化伤害结果
 */
export function formatDamageResult(result: DamageResult): string {
  const parts: string[] = [];

  parts.push(`基础伤害: ${result.details.baseDamage}`);

  if (result.isHeadshot) {
    parts.push(`头部射击: x${result.details.headshotMultiplier.value.toFixed(1)}`);
  }

  if (result.isCritical) {
    parts.push(`暴击: x${result.details.criticalMultiplier.value.toFixed(1)}`);
  }

  if (result.isDodged) {
    return '伤害: 0 (被闪避)';
  }

  parts.push(`最终伤害: ${result.finalDamage}`);

  if (result.armorDamage > 0) {
    parts.push(`护甲伤害: ${result.armorDamage}`);
  }

  return parts.join(' | ');
}
