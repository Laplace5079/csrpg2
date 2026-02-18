/**
 * CS:RPG - Equipment System
 * 装备系统，稀有度，属性加成
 */

import { PlayerStats } from './PlayerStats';

export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type EquipmentType = 'weapon' | 'armor' | 'helmet' | 'accessory' | 'grenade' | 'medkit';

/**
 * 装备稀有度配置
 */
export const RARITY_CONFIG: Record<EquipmentRarity, {
  name: string;
  color: string;
  dropRate: number;
  effectSlots: number;
  bonusMultiplier: number;
}> = {
  common: {
    name: '普通',
    color: '#9E9E9E',
    dropRate: 60,
    effectSlots: 0,
    bonusMultiplier: 1,
  },
  uncommon: {
    name: '优秀',
    color: '#4CAF50',
    dropRate: 25,
    effectSlots: 1,
    bonusMultiplier: 1.1,
  },
  rare: {
    name: '稀有',
    color: '#2196F3',
    dropRate: 10,
    effectSlots: 2,
    bonusMultiplier: 1.25,
  },
  epic: {
    name: '史诗',
    color: '#9C27B0',
    dropRate: 4,
    effectSlots: 3,
    bonusMultiplier: 1.5,
  },
  legendary: {
    name: '传说',
    color: '#FF9800',
    dropRate: 1,
    effectSlots: 4,
    bonusMultiplier: 2,
  },
};

/**
 * 装备效果槽
 */
export interface EquipmentEffect {
  id: string;
  stat: keyof PlayerStats;
  value: number;
  isPercentage: boolean;
  name: string;
  description: string;
}

/**
 * 装备基础数据
 */
export interface EquipmentData {
  id: string;
  name: string;
  type: EquipmentType;
  rarity: EquipmentRarity;
  level: number;
  baseStats: Partial<PlayerStats>;
  effects: EquipmentEffect[];
  description: string;
  icon?: string;
  model?: string;
}

/**
 * 玩家装备实例
 */
export interface EquipmentInstance {
  instanceId: string;
  data: EquipmentData;
  equipped: boolean;
  enhancementLevel: number;
}

/**
 * 装备效果库
 */
export const EFFECT_DATABASE: Record<string, Omit<EquipmentEffect, 'id'>> = {
  // 通用效果
  'health_boost': {
    stat: 'maxHealth',
    value: 20,
    isPercentage: false,
    name: '生命强化',
    description: '增加最大生命值',
  },
  'armor_boost': {
    stat: 'maxArmor',
    value: 15,
    isPercentage: false,
    name: '护甲强化',
    description: '增加最大护甲',
  },
  'damage_boost': {
    stat: 'weaponDamageBonus',
    value: 5,
    isPercentage: true,
    name: '伤害增强',
    description: '增加武器伤害',
  },
  'crit_chance': {
    stat: 'criticalChance',
    value: 3,
    isPercentage: false,
    name: '精准射击',
    description: '增加暴击率',
  },
  'crit_damage': {
    stat: 'criticalDamage',
    value: 10,
    isPercentage: false,
    name: '暴击强化',
    description: '增加暴击伤害',
  },
  'fire_rate': {
    stat: 'fireRateBonus',
    value: 5,
    isPercentage: true,
    name: '快速射击',
    description: '增加射速',
  },
  'reload_speed': {
    stat: 'reloadSpeedBonus',
    value: 10,
    isPercentage: true,
    name: '快速换弹',
    description: '减少换弹时间',
  },
  'spread_reduction': {
    stat: 'spreadReduction',
    value: 5,
    isPercentage: false,
    name: '精准控制',
    description: '减少散布',
  },
  'recoil_control': {
    stat: 'recoilControl',
    value: 10,
    isPercentage: true,
    name: '后坐力控制',
    description: '减少后坐力',
  },
  'damage_reduction': {
    stat: 'damageReduction',
    value: 3,
    isPercentage: false,
    name: '伤害减免',
    description: '减少受到的伤害',
  },
  'speed_boost': {
    stat: 'speed',
    value: 0.5,
    isPercentage: false,
    name: '移动加速',
    description: '增加移动速度',
  },
  'health_regen': {
    stat: 'healthRegenRate',
    value: 1,
    isPercentage: false,
    name: '生命恢复',
    description: '生命值自然恢复',
  },
  'dodge': {
    stat: 'dodgeChance',
    value: 2,
    isPercentage: false,
    name: '闪避',
    description: '闪避攻击概率',
  },
};

/**
 * 装备数据库
 */
export const EQUIPMENT_DATABASE: Record<string, EquipmentData> = {
  // 护甲
  'armor_common_1': {
    id: 'armor_common_1',
    name: '基础防弹衣',
    type: 'armor',
    rarity: 'common',
    level: 1,
    baseStats: {
      maxArmor: 20,
      maxHealth: 10,
    },
    effects: [],
    description: '标准的警用防弹衣，提供基本的防护。',
    icon: '🛡️',
  },
  'armor_uncommon_1': {
    id: 'armor_uncommon_1',
    name: '强化防弹衣',
    type: 'armor',
    rarity: 'uncommon',
    level: 5,
    baseStats: {
      maxArmor: 35,
      maxHealth: 15,
    },
    effects: [
      { id: 'effect_1', ...EFFECT_DATABASE['armor_boost'] },
    ],
    description: '经过强化的防弹衣，提供更好的防护。',
    icon: '🛡️',
  },
  'armor_rare_1': {
    id: 'armor_rare_1',
    name: '精英防弹衣',
    type: 'armor',
    rarity: 'rare',
    level: 10,
    baseStats: {
      maxArmor: 50,
      maxHealth: 25,
    },
    effects: [
      { id: 'effect_1', ...EFFECT_DATABASE['armor_boost'] },
      { id: 'effect_2', ...EFFECT_DATABASE['damage_reduction'] },
    ],
    description: '精英级别的防弹衣，兼顾防护与机动。',
    icon: '🛡️',
  },
  'armor_epic_1': {
    id: 'armor_epic_1',
    name: '量子护甲',
    type: 'armor',
    rarity: 'epic',
    level: 20,
    baseStats: {
      maxArmor: 75,
      maxHealth: 40,
    },
    effects: [
      { id: 'effect_1', ...EFFECT_DATABASE['armor_boost'] },
      { id: 'effect_2', ...EFFECT_DATABASE['damage_reduction'] },
      { id: 'effect_3', ...EFFECT_DATABASE['health_regen'] },
    ],
    description: '使用量子材料制造的先进护甲。',
    icon: '🛡️',
  },
  'armor_legendary_1': {
    id: 'armor_legendary_1',
    name: '虚空守护者',
    type: 'armor',
    rarity: 'legendary',
    level: 30,
    baseStats: {
      maxArmor: 100,
      maxHealth: 60,
    },
    effects: [
      { id: 'effect_1', ...EFFECT_DATABASE['armor_boost'] },
      { id: 'effect_2', ...EFFECT_DATABASE['damage_reduction'] },
      { id: 'effect_3', ...EFFECT_DATABASE['health_regen'] },
      { id: 'effect_4', ...EFFECT_DATABASE['dodge'] },
    ],
    description: '传说中的终极护甲，拥有近乎完美的防护。',
    icon: '🛡️',
  },

  // 头盔
  'helmet_common_1': {
    id: 'helmet_common_1',
    name: '基础头盔',
    type: 'helmet',
    rarity: 'common',
    level: 1,
    baseStats: {
      maxHealth: 5,
    },
    effects: [],
    description: '标准防护头盔。',
    icon: '⛑️',
  },
  'helmet_rare_1': {
    id: 'helmet_rare_1',
    name: '战术头盔',
    type: 'helmet',
    rarity: 'rare',
    level: 10,
    baseStats: {
      maxHealth: 15,
    },
    effects: [
      { id: 'effect_1', ...EFFECT_DATABASE['crit_reduction'] },
      { id: 'effect_2', ...EFFECT_DATABASE['health_boost'] },
    ],
    description: '配备护目镜的战术头盔。',
    icon: '⛑️',
  },

  // 配件
  'accessory_uncommon_1': {
    id: 'accessory_uncommon_1',
    name: '敏捷挂件',
    type: 'accessory',
    rarity: 'uncommon',
    level: 5,
    baseStats: {
      speed: 0.5,
      sprintSpeed: 0.8,
    },
    effects: [
      { id: 'effect_1', ...EFFECT_DATABASE['speed_boost'] },
    ],
    description: '轻便的挂件，增加移动速度。',
    icon: '🎒',
  },
  'accessory_epic_1': {
    id: 'accessory_epic_1',
    name: '能量核心',
    type: 'accessory',
    rarity: 'epic',
    level: 20,
    baseStats: {
      maxHealth: 20,
      healthRegenRate: 2,
    },
    effects: [
      { id: 'effect_1', ...EFFECT_DATABASE['health_boost'] },
      { id: 'effect_2', ...EFFECT_DATABASE['health_regen'] },
      { id: 'effect_3', ...EFFECT_DATABASE['damage_reduction'] },
    ],
    description: '蕴含能量的核心，持续恢复生命。',
    icon: '🔋',
  },
};

// 添加缺失的效果到数据库
EFFECT_DATABASE['crit_reduction'] = {
  stat: 'damageReduction',
  value: 5,
  isPercentage: false,
  name: '头部防护',
  description: '减少头部受到的暴击伤害',
};

/**
 * 装备管理器类
 */
export class EquipmentManager {
  private inventory: Map<string, EquipmentInstance>;
  private equipped: Map<EquipmentType, EquipmentInstance | null>;

  constructor() {
    this.inventory = new Map();
    this.equipped = new Map();

    // 初始化装备槽
    const types: EquipmentType[] = ['weapon', 'armor', 'helmet', 'accessory', 'grenade', 'medkit'];
    for (const type of types) {
      this.equipped.set(type, null);
    }
  }

  /**
   * 生成唯一实例ID
   */
  private generateInstanceId(): string {
    return `eq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 添加装备到背包
   */
  addEquipment(data: EquipmentData): EquipmentInstance {
    const instance: EquipmentInstance = {
      instanceId: this.generateInstanceId(),
      data,
      equipped: false,
      enhancementLevel: 0,
    };

    this.inventory.set(instance.instanceId, instance);
    return instance;
  }

  /**
   * 装备物品
   */
  equip(instanceId: string): boolean {
    const instance = this.inventory.get(instanceId);
    if (!instance) return false;

    const type = instance.data.type;
    const existing = this.equipped.get(type);

    // 卸下已有装备
    if (existing) {
      existing.equipped = false;
    }

    // 装备新装备
    instance.equipped = true;
    this.equipped.set(type, instance);

    return true;
  }

  /**
   * 卸下装备
   */
  unequip(type: EquipmentType): EquipmentInstance | null {
    const instance = this.equipped.get(type);
    if (instance) {
      instance.equipped = false;
      this.equipped.set(type, null);
    }
    return instance;
  }

  /**
   * 获取已装备的物品
   */
  getEquipped(type: EquipmentType): EquipmentInstance | null {
    return this.equipped.get(type) || null;
  }

  /**
   * 获取所有已装备物品
   */
  getAllEquipped(): EquipmentInstance[] {
    return Array.from(this.equipped.values()).filter((e): e is EquipmentInstance => e !== null);
  }

  /**
   * 移除装备（丢弃）
   */
  removeEquipment(instanceId: string): boolean {
    const instance = this.inventory.get(instanceId);
    if (!instance) return false;

    if (instance.equipped) {
      this.unequip(instance.data.type);
    }

    this.inventory.delete(instanceId);
    return true;
  }

  /**
   * 计算所有装备提供的属性加成
   */
  calculateEquipmentBonuses(): Partial<PlayerStats> {
    const bonuses: Partial<PlayerStats> = {};
    const equipped = this.getAllEquipped();

    for (const instance of equipped) {
      const rarityConfig = RARITY_CONFIG[instance.data.rarity];

      // 应用基础属性（乘以稀有度加成）
      for (const [key, value] of Object.entries(instance.data.baseStats)) {
        const statKey = key as keyof PlayerStats;
        const multiplier = rarityConfig.bonusMultiplier;
        bonuses[statKey] = (bonuses[statKey] || 0) + (value as number) * multiplier;
      }

      // 应用效果槽
      for (const effect of instance.data.effects) {
        const value = effect.isPercentage ? effect.value : effect.value * rarityConfig.bonusMultiplier;
        bonuses[effect.stat] = (bonuses[effect.stat] || 0) + value;
      }
    }

    return bonuses;
  }

  /**
   * 获取背包中的所有装备
   */
  getInventory(): EquipmentInstance[] {
    return Array.from(this.inventory.values());
  }

  /**
   * 根据稀有度随机生成装备
   */
  static generateRandomEquipment(level: number, type?: EquipmentType): EquipmentData {
    // 随机稀有度
    const roll = Math.random() * 100;
    let rarity: EquipmentRarity = 'common';
    let cumulative = 0;

    const rarities: EquipmentRarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    for (const r of rarities) {
      cumulative += RARITY_CONFIG[r].dropRate;
      if (roll <= cumulative) {
        rarity = r;
        break;
      }
    }

    // 随机类型
    const types: EquipmentType[] = type ? [type] : ['armor', 'helmet', 'accessory'];
    const selectedType = types[Math.floor(Math.random() * types.length)];

    // 生成装备名称
    const rarityName = RARITY_CONFIG[rarity].name;
    const typeNames: Record<EquipmentType, string> = {
      weapon: '武器',
      armor: '护甲',
      helmet: '头盔',
      accessory: '配件',
      grenade: '手雷',
      medkit: '急救包',
    };

    return {
      id: `generated_${Date.now()}`,
      name: `${rarityName} ${typeNames[selectedType]}`,
      type: selectedType,
      rarity,
      level,
      baseStats: EquipmentManager.generateBaseStats(selectedType, level, rarity),
      effects: EquipmentManager.generateEffects(rarity, level),
      description: `一件${rarityName}级别的${typeNames[selectedType]}。`,
      icon: EquipmentManager.getTypeIcon(selectedType),
    };
  }

  /**
   * 生成基础属性
   */
  private static generateBaseStats(type: EquipmentType, level: number, rarity: EquipmentRarity): Partial<PlayerStats> {
    const multiplier = RARITY_CONFIG[rarity].bonusMultiplier;
    const baseValues: Record<EquipmentType, Partial<PlayerStats>> = {
      weapon: { weaponDamageBonus: 5 * level },
      armor: { maxArmor: 10 * level, maxHealth: 5 * level },
      helmet: { maxHealth: 8 * level, damageReduction: 2 * level },
      accessory: { speed: 0.2 * level, healthRegenRate: 0.5 * level },
      grenade: {},
      medkit: {},
    };

    const base = baseValues[type];
    const result: Partial<PlayerStats> = {};
    for (const [key, value] of Object.entries(base)) {
      result[key as keyof PlayerStats] = (value as number) * multiplier;
    }

    return result;
  }

  /**
   * 生成效果
   */
  private static generateEffects(rarity: EquipmentRarity, level: number): EquipmentEffect[] {
    const slots = RARITY_CONFIG[rarity].effectSlots;
    const effects: EquipmentEffect[] = [];
    const effectKeys = Object.keys(EFFECT_DATABASE);
    const shuffled = effectKeys.sort(() => Math.random() - 0.5);

    for (let i = 0; i < slots && i < shuffled.length; i++) {
      const effectData = EFFECT_DATABASE[shuffled[i]];
      effects.push({
        id: `effect_${i}`,
        ...effectData,
        value: effectData.value * (1 + level * 0.1),
      });
    }

    return effects;
  }

  /**
   * 获取类型图标
   */
  private static getTypeIcon(type: EquipmentType): string {
    const icons: Record<EquipmentType, string> = {
      weapon: '🔫',
      armor: '🛡️',
      helmet: '⛑️',
      accessory: '🎒',
      grenade: '💣',
      medkit: '🩹',
    };
    return icons[type];
  }

  /**
   * 序列化装备管理器
   */
  serialize(): string {
    return JSON.stringify({
      inventory: Array.from(this.inventory.entries()),
      equipped: Array.from(this.equipped.entries()),
    });
  }

  /**
   * 反序列化装备管理器
   */
  deserialize(json: string): void {
    const obj = JSON.parse(json);
    this.inventory = new Map(obj.inventory);
    this.equipped = new Map(obj.equipped);
  }
}

/**
 * 便捷函数：获取稀有度配置
 */
export function getRarityConfig(rarity: EquipmentRarity) {
  return RARITY_CONFIG[rarity];
}

/**
 * 便捷函数：获取稀有度颜色
 */
export function getRarityColor(rarity: EquipmentRarity): string {
  return RARITY_CONFIG[rarity].color;
}

/**
 * 便捷函数：获取装备数据
 */
export function getEquipmentData(id: string): EquipmentData | undefined {
  return EQUIPMENT_DATABASE[id];
}

/**
 * 便捷函数：生成随机掉落
 */
export function generateLoot(level: number, type?: EquipmentType): EquipmentData {
  return EquipmentManager.generateRandomEquipment(level, type);
}

/**
 * 便捷函数：计算装备总加成
 */
export function calculateTotalEquipmentStats(manager: EquipmentManager): Partial<PlayerStats> {
  return manager.calculateEquipmentBonuses();
}
