/**
 * LevelManager.ts - 关卡管理器
 * 负责管理游戏关卡的配置、进度、解锁和加载
 */

import { StoryEngine } from './StoryEngine';

export interface LevelObjective {
  id: string;
  description: string;
  type: 'eliminate' | 'survive' | 'collect' | 'reach' | 'protect' | 'custom';
  target?: string;  // 目标ID或数量
  requiredCount?: number;  // 所需数量
  optional?: boolean;  // 是否可选
}

export interface LevelEnemy {
  id: string;
  type: string;
  count: number;
  spawnPoints?: string[];  // 生成点
  spawnDelay?: number;  // 生成延迟(ms)
  behavior?: string;  // 行为模式
}

export interface LevelSpawnPoint {
  id: string;
  position: { x: number; y: number; z: number };
  type: 'enemy' | 'ally' | 'item' | 'trigger';
}

export interface LevelReward {
  experience: number;
  items?: string[];
  currency?: number;
  unlocks?: string[];
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  chapter: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
  
  // 环境配置
  environment: {
    background: string;
    music: string;
    ambient?: string;
    timeOfDay?: 'dawn' | 'day' | 'dusk' | 'night';
    weather?: 'clear' | 'rain' | 'storm' | 'snow';
  };
  
  // 游戏机制
  objectives: LevelObjective[];
  enemies: LevelEnemy[];
  spawnPoints: LevelSpawnPoint[];
  
  // 玩家配置
  player: {
    allowedWeapons?: string[];
    maxHealth?: number;
    startingPosition?: { x: number; y: number; z: number };
    abilities?: string[];
  };
  
  // 奖励
  reward: LevelReward;
  
  // 关卡流程
  sequence?: string[];  // 事件序列ID
  
  // 解锁条件
  unlockCondition?: {
    type: 'chapter_complete' | 'flag' | 'level_complete' | 'item';
    value: string;
  };
  
  // 下一关
  nextLevel?: string;
  
  // 元数据
  estimatedTime?: number;  // 预计完成时间(分钟)
  recommendedLevel?: number;  // 建议等级
}

export interface LevelState {
  levelId: string;
  completed: boolean;
  bestTime?: number;
  bestScore?: number;
  attempts: number;
  objectivesCompleted: string[];
  enemiesDefeated: number;
  damageDealt: number;
  damageTaken: number;
}

export interface LevelProgress {
  currentLevelId: string | null;
  unlockedLevels: string[];
  completedLevels: string[];
  levelStates: Map<string, LevelState>;
}

type LevelEventType = 'start' | 'complete' | 'fail' | 'objective_complete' | 'unlock';
type LevelEventListener = (data: any) => void;

export class LevelManager {
  private levels: Map<string, LevelConfig> = new Map();
  private progress: LevelProgress;
  private storyEngine: StoryEngine | null = null;
  private listeners: Map<LevelEventType, LevelEventListener[]> = new Map();

  constructor() {
    this.progress = {
      currentLevelId: null,
      unlockedLevels: ['level_1'],  // 第一关默认解锁
      completedLevels: [],
      levelStates: new Map()
    };

    // 初始化事件监听器容器
    ['start', 'complete', 'fail', 'objective_complete', 'unlock'].forEach(event => {
      this.listeners.set(event as LevelEventType, []);
    });
  }

  /**
   * 关联叙事引擎
   */
  setStoryEngine(engine: StoryEngine): void {
    this.storyEngine = engine;
  }

  /**
   * 加载关卡配置
   */
  loadLevels(levels: LevelConfig[]): void {
    levels.forEach(level => {
      this.levels.set(level.id, level);
    });
  }

  /**
   * 添加单个关卡
   */
  addLevel(level: LevelConfig): void {
    this.levels.set(level.id, level);
  }

  /**
   * 获取关卡配置
   */
  getLevel(levelId: string): LevelConfig | undefined {
    return this.levels.get(levelId);
  }

  /**
   * 获取所有关卡
   */
  getAllLevels(): LevelConfig[] {
    return Array.from(this.levels.values());
  }

  /**
   * 按章节获取关卡
   */
  getLevelsByChapter(chapter: number): LevelConfig[] {
    return Array.from(this.levels.values()).filter(level => level.chapter === chapter);
  }

  /**
   * 检查关卡是否解锁
   */
  isLevelUnlocked(levelId: string): boolean {
    const level = this.levels.get(levelId);
    if (!level) return false;

    // 已解锁
    if (this.progress.unlockedLevels.includes(levelId)) return true;

    // 检查解锁条件
    if (level.unlockCondition) {
      return this.checkUnlockCondition(level.unlockCondition);
    }

    return false;
  }

  /**
   * 检查解锁条件
   */
  private checkUnlockCondition(condition: LevelConfig['unlockCondition']): boolean {
    if (!condition || !this.storyEngine) return false;

    switch (condition.type) {
      case 'chapter_complete':
        return this.storyEngine.getState().completedChapters.includes(condition.value);
      case 'flag':
        return this.storyEngine.getFlag(condition.value);
      case 'level_complete':
        return this.progress.completedLevels.includes(condition.value);
      case 'item':
        // 需要检查背包系统
        return false;
      default:
        return false;
    }
  }

  /**
   * 解锁关卡
   */
  unlockLevel(levelId: string): boolean {
    if (this.progress.unlockedLevels.includes(levelId)) return true;

    const level = this.levels.get(levelId);
    if (!level) return false;

    if (this.isLevelUnlocked(levelId)) {
      this.progress.unlockedLevels.push(levelId);
      
      this.emit('unlock', { levelId, levelName: level.name });
      return true;
    }

    return false;
  }

  /**
   * 开始关卡
   */
  startLevel(levelId: string): LevelConfig | null {
    if (!this.isLevelUnlocked(levelId)) {
      console.warn(`Level ${levelId} is locked`);
      return null;
    }

    const level = this.levels.get(levelId);
    if (!level) return null;

    this.progress.currentLevelId = levelId;
    
    // 初始化关卡状态
    if (!this.progress.levelStates.has(levelId)) {
      this.progress.levelStates.set(levelId, {
        levelId,
        completed: false,
        attempts: 0,
        objectivesCompleted: [],
        enemiesDefeated: 0,
        damageDealt: 0,
        damageTaken: 0
      });
    }

    // 增加尝试次数
    const state = this.progress.levelStates.get(levelId)!;
    state.attempts++;

    this.emit('start', { levelId, levelName: level.name });
    
    return level;
  }

  /**
   * 完成关卡
   */
  completeLevel(levelId: string, time: number, score: number): void {
    const state = this.progress.levelStates.get(levelId);
    if (!state) return;

    state.completed = true;
    state.bestTime = state.bestTime ? Math.min(state.bestTime, time) : time;
    state.bestScore = state.bestScore ? Math.max(state.bestScore, score) : score;

    if (!this.progress.completedLevels.includes(levelId)) {
      this.progress.completedLevels.push(levelId);
    }

    const level = this.levels.get(levelId);
    this.emit('complete', { levelId, time, score, reward: level?.reward });

    // 解锁下一关
    if (level?.nextLevel) {
      this.unlockLevel(level.nextLevel);
    }
  }

  /**
   * 失败关卡
   */
  failLevel(levelId: string): void {
    this.emit('fail', { levelId });
  }

  /**
   * 标记目标完成
   */
  completeObjective(levelId: string, objectiveId: string): void {
    const state = this.progress.levelStates.get(levelId);
    if (!state) return;

    if (!state.objectivesCompleted.includes(objectiveId)) {
      state.objectivesCompleted.push(objectiveId);
      this.emit('objective_complete', { levelId, objectiveId });
    }
  }

  /**
   * 更新敌人击杀数
   */
  updateEnemiesDefeated(levelId: string, count: number): void {
    const state = this.progress.levelStates.get(levelId);
    if (state) {
      state.enemiesDefeated += count;
    }
  }

  /**
   * 获取当前关卡
   */
  getCurrentLevel(): LevelConfig | null {
    if (!this.progress.currentLevelId) return null;
    return this.levels.get(this.progress.currentLevelId) || null;
  }

  /**
   * 获取当前关卡状态
   */
  getCurrentLevelState(): LevelState | null {
    if (!this.progress.currentLevelId) return null;
    return this.progress.levelStates.get(this.progress.currentLevelId) || null;
  }

  /**
   * 获取进度
   */
  getProgress(): Readonly<LevelProgress> {
    return {
      ...this.progress,
      levelStates: new Map(this.progress.levelStates)
    };
  }

  /**
   * 获取已解锁关卡列表
   */
  getUnlockedLevels(): LevelConfig[] {
    return this.progress.unlockedLevels
      .map(id => this.levels.get(id))
      .filter((level): level is LevelConfig => level !== undefined);
  }

  /**
   * 获取已完成关卡列表
   */
  getCompletedLevels(): LevelConfig[] {
    return this.progress.completedLevels
      .map(id => this.levels.get(id))
      .filter((level): level is LevelConfig => level !== undefined);
  }

  /**
   * 订阅关卡事件
   */
  on(event: LevelEventType, listener: LevelEventListener): () => void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.push(listener);
    }
    return () => this.off(event, listener);
  }

  /**
   * 取消订阅
   */
  off(event: LevelEventType, listener: LevelEventListener): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发关卡事件
   */
  private emit(event: LevelEventType, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  /**
   * 导出进度为JSON
   */
  exportProgress(): string {
    const exportData = {
      currentLevelId: this.progress.currentLevelId,
      unlockedLevels: this.progress.unlockedLevels,
      completedLevels: this.progress.completedLevels,
      levelStates: Array.from(this.progress.levelStates.entries())
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 从JSON导入进度
   */
  importProgress(json: string): void {
    try {
      const data = JSON.parse(json);
      this.progress.currentLevelId = data.currentLevelId || null;
      this.progress.unlockedLevels = data.unlockedLevels || ['level_1'];
      this.progress.completedLevels = data.completedLevels || [];
      this.progress.levelStates = new Map(data.levelStates || []);
    } catch (e) {
      console.error('Failed to import level progress:', e);
    }
  }

  /**
   * 重置进度
   */
  reset(): void {
    this.progress = {
      currentLevelId: null,
      unlockedLevels: ['level_1'],
      completedLevels: [],
      levelStates: new Map()
    };
  }

  /**
   * 获取下一关卡
   */
  getNextLevel(currentLevelId: string): LevelConfig | null {
    const level = this.levels.get(currentLevelId);
    if (!level || !level.nextLevel) return null;
    return this.levels.get(level.nextLevel) || null;
  }
}

export default LevelManager;
