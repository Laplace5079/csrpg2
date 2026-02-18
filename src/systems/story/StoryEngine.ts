/**
 * StoryEngine.ts - 叙事引擎
 * 负责管理游戏主线剧情、章节进度和剧情触发
 */

import { DialogueSystem, DialogueNode, DialogueChoice } from './DialogueSystem';

export interface StoryChapter {
  id: string;
  title: string;
  description: string;
  dialogues: string[];  // 对话节点ID数组
  prerequisites?: string[];  // 解锁条件
  unlocksLevel?: string;  // 解锁的关卡ID
}

export interface StoryState {
  currentChapterId: string;
  completedChapters: string[];
  dialogueProgress: number;  // 当前章节内的对话进度
  flags: Record<string, boolean>;  // 剧情flag
  variables: Record<string, string | number | boolean>;  // 剧情变量
}

export interface StoryEvent {
  type: 'chapter_start' | 'chapter_complete' | 'dialogue_start' | 'dialogue_end' | 'flag_set' | 'variable_changed';
  data: any;
  timestamp: number;
}

type StoryEventListener = (event: StoryEvent) => void;

export class StoryEngine {
  private chapters: Map<string, StoryChapter> = new Map();
  private state: StoryState;
  private dialogueSystem: DialogueSystem;
  private listeners: StoryEventListener[] = [];
  
  // 默认状态
  private static readonly DEFAULT_STATE: StoryState = {
    currentChapterId: 'chapter_1',
    completedChapters: [],
    dialogueProgress: 0,
    flags: {},
    variables: {}
  };

  constructor(dialogueSystem: DialogueSystem) {
    this.dialogueSystem = dialogueSystem;
    this.state = { ...StoryEngine.DEFAULT_STATE };
  }

  /**
   * 加载剧情章节数据
   */
  loadChapters(chapters: StoryChapter[]): void {
    chapters.forEach(chapter => {
      this.chapters.set(chapter.id, chapter);
    });
  }

  /**
   * 获取当前章节
   */
  getCurrentChapter(): StoryChapter | undefined {
    return this.chapters.get(this.state.currentChapterId);
  }

  /**
   * 获取章节数据
   */
  getChapter(chapterId: string): StoryChapter | undefined {
    return this.chapters.get(chapterId);
  }

  /**
   * 推进剧情到下一个对话
   */
  advanceDialogue(): DialogueNode | null {
    const chapter = this.getCurrentChapter();
    if (!chapter) return null;

    const dialogueIndex = this.state.dialogueProgress;
    if (dialogueIndex >= chapter.dialogues.length) {
      // 当前章节对话已结束
      this.completeChapter();
      return null;
    }

    const dialogueId = chapter.dialogues[dialogueIndex];
    this.state.dialogueProgress++;
    
    this.emitEvent({
      type: 'dialogue_start',
      data: { dialogueId, chapterId: chapter.id },
      timestamp: Date.now()
    });

    return this.dialogueSystem.getDialogue(dialogueId);
  }

  /**
   * 开始特定章节
   */
  startChapter(chapterId: string): boolean {
    const chapter = this.chapters.get(chapterId);
    if (!chapter) return false;

    // 检查前置条件
    if (chapter.prerequisites) {
      for (const prereq of chapter.prerequisites) {
        if (!this.state.completedChapters.includes(prereq)) {
          console.warn(`Chapter ${chapterId} prerequisites not met: ${prereq}`);
          return false;
        }
      }
    }

    this.state.currentChapterId = chapterId;
    this.state.dialogueProgress = 0;

    this.emitEvent({
      type: 'chapter_start',
      data: { chapterId, title: chapter.title },
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * 完成当前章节
   */
  completeChapter(): void {
    const chapterId = this.state.currentChapterId;
    const chapter = this.chapters.get(chapterId);
    
    if (!chapter) return;

    if (!this.state.completedChapters.includes(chapterId)) {
      this.state.completedChapters.push(chapterId);
    }

    this.emitEvent({
      type: 'chapter_complete',
      data: { chapterId, title: chapter.title, unlocksLevel: chapter.unlocksLevel },
      timestamp: Date.now()
    });
  }

  /**
   * 设置剧情flag
   */
  setFlag(flagName: string, value: boolean): void {
    this.state.flags[flagName] = value;
    
    this.emitEvent({
      type: 'flag_set',
      data: { flagName, value },
      timestamp: Date.now()
    });
  }

  /**
   * 获取flag状态
   */
  getFlag(flagName: string): boolean {
    return !!this.state.flags[flagName];
  }

  /**
   * 设置剧情变量
   */
  setVariable(name: string, value: string | number | boolean): void {
    this.state.variables[name] = value;
    
    this.emitEvent({
      type: 'variable_changed',
      data: { name, value },
      timestamp: Date.now()
    });
  }

  /**
   * 获取剧情变量
   */
  getVariable<T = string | number | boolean>(name: string): T | undefined {
    return this.state.variables[name] as T | undefined;
  }

  /**
   * 检查是否满足对话条件
   */
  checkCondition(condition: string): boolean {
    // 解析条件表达式
    // 支持格式: flag:flagName, variable:name=value, chapter:chapterId
    const parts = condition.split(':');
    const type = parts[0];
    const value = parts[1];

    switch (type) {
      case 'flag':
        return this.getFlag(value);
      case 'variable':
        const [varName, varValue] = value.split('=');
        return this.state.variables[varName] == varValue;
      case 'chapter':
        return this.state.completedChapters.includes(value);
      default:
        return false;
    }
  }

  /**
   * 获取可用对话选项
   */
  getAvailableChoices(choices: DialogueChoice[]): DialogueChoice[] {
    return choices.filter(choice => {
      if (!choice.condition) return true;
      return this.checkCondition(choice.condition);
    });
  }

  /**
   * 订阅剧情事件
   */
  subscribe(listener: StoryEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * 触发事件
   */
  private emitEvent(event: StoryEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * 获取当前状态
   */
  getState(): Readonly<StoryState> {
    return { ...this.state };
  }

  /**
   * 保存状态到JSON
   */
  serialize(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * 从JSON加载状态
   */
  deserialize(json: string): void {
    try {
      const loadedState = JSON.parse(json);
      this.state = { ...StoryEngine.DEFAULT_STATE, ...loadedState };
    } catch (e) {
      console.error('Failed to deserialize story state:', e);
    }
  }

  /**
   * 重置剧情进度
   */
  reset(): void {
    this.state = { ...StoryEngine.DEFAULT_STATE };
  }
}

export default StoryEngine;
