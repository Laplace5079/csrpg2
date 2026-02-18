/**
 * DialogueSystem.ts - 对话系统
 * 负责管理游戏中所有对话内容、角色和交互逻辑
 */

export interface DialogueCharacter {
  id: string;
  name: string;
  avatar?: string;  // 头像资源路径
  color?: string;  // 对话框颜色（十六进制）
}

export interface DialogueContent {
  text: string;
  emotion?: string;  // 表情状态
}

export interface DialogueChoice {
  id: string;
  text: string;
  nextDialogueId?: string;  // 跳转到的对话ID
  condition?: string;  // 显示条件 flag:xxx, variable:xxx=yyy
  effect?: DialogueEffect;  // 选择后的效果
  requiresFlag?: string;  // 需要解锁的flag
}

export interface DialogueEffect {
  setFlag?: string;  // 设置flag
  setVariable?: { name: string; value: string | number | boolean };  // 设置变量
  startChapter?: string;  // 开始章节
  unlockLevel?: string;  // 解锁关卡
  playSound?: string;  // 播放音效
}

export interface DialogueNode {
  id: string;
  characterId: string;
  content: DialogueContent[];
  choices?: DialogueChoice[];
  nextDialogueId?: string;  // 下一句对话（无选项时）
  background?: string;  // 背景
  music?: string;  // 背景音乐
  effect?: string;  // 场景特效
  autoAdvance?: boolean;  // 是否自动继续
  autoAdvanceDelay?: number;  // 自动继续延迟(ms)
}

export interface DialogueScene {
  id: string;
  name: string;
  dialogues: DialogueNode[];
}

type DialogueEventType = 'start' | 'end' | 'choice' | 'complete';
type DialogueEventListener = (data: { dialogueId: string; choiceId?: string }) => void;

export class DialogueSystem {
  private dialogues: Map<string, DialogueNode> = new Map();
  private characters: Map<string, DialogueCharacter> = new Map();
  private scenes: Map<string, DialogueScene> = new Map();
  private listeners: Map<DialogueEventType, DialogueEventListener[]> = new Map();

  constructor() {
    // 初始化事件监听器容器
    ['start', 'end', 'choice', 'complete'].forEach(event => {
      this.listeners.set(event as DialogueEventType, []);
    });
  }

  /**
   * 加载对话数据
   */
  loadDialogues(dialogues: DialogueNode[]): void {
    dialogues.forEach(dialogue => {
      this.dialogues.set(dialogue.id, dialogue);
    });
  }

  /**
   * 加载角色数据
   */
  loadCharacters(characters: DialogueCharacter[]): void {
    characters.forEach(character => {
      this.characters.set(character.id, character);
    });
  }

  /**
   * 加载对话场景
   */
  loadScenes(scenes: DialogueScene[]): void {
    scenes.forEach(scene => {
      this.scenes.set(scene.id, scene);
    });
  }

  /**
   * 获取对话节点
   */
  getDialogue(dialogueId: string): DialogueNode | undefined {
    return this.dialogues.get(dialogueId);
  }

  /**
   * 获取角色信息
   */
  getCharacter(characterId: string): DialogueCharacter | undefined {
    return this.characters.get(characterId);
  }

  /**
   * 获取对话场景
   */
  getScene(sceneId: string): DialogueScene | undefined {
    return this.scenes.get(sceneId);
  }

  /**
   * 获取场景中的所有对话
   */
  getSceneDialogues(sceneId: string): DialogueNode[] {
    const scene = this.scenes.get(sceneId);
    return scene ? scene.dialogues : [];
  }

  /**
   * 获取角色的所有对话
   */
  getCharacterDialogues(characterId: string): DialogueNode[] {
    const result: DialogueNode[] = [];
    this.dialogues.forEach(dialogue => {
      if (dialogue.characterId === characterId) {
        result.push(dialogue);
      }
    });
    return result;
  }

  /**
   * 搜索包含特定文本的对话
   */
  searchDialogues(query: string): DialogueNode[] {
    const lowerQuery = query.toLowerCase();
    const result: DialogueNode[] = [];
    
    this.dialogues.forEach(dialogue => {
      for (const content of dialogue.content) {
        if (content.text.toLowerCase().includes(lowerQuery)) {
          result.push(dialogue);
          break;
        }
      }
    });
    
    return result;
  }

  /**
   * 检查对话是否存在
   */
  hasDialogue(dialogueId: string): boolean {
    return this.dialogues.has(dialogueId);
  }

  /**
   * 添加对话节点
   */
  addDialogue(dialogue: DialogueNode): void {
    this.dialogues.set(dialogue.id, dialogue);
  }

  /**
   * 添加角色
   */
  addCharacter(character: DialogueCharacter): void {
    this.characters.set(character.id, character);
  }

  /**
   * 订阅对话事件
   */
  on(event: DialogueEventType, listener: DialogueEventListener): () => void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.push(listener);
    }
    return () => this.off(event, listener);
  }

  /**
   * 取消订阅
   */
  off(event: DialogueEventType, listener: DialogueEventListener): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发对话事件
   */
  private emit(event: DialogueEventType, data: { dialogueId: string; choiceId?: string }): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  /**
   * 开始对话（触发start事件）
   */
  startDialogue(dialogueId: string): void {
    this.emit('start', { dialogueId });
  }

  /**
   * 对话结束（触发end事件）
   */
  endDialogue(dialogueId: string): void {
    this.emit('end', { dialogueId });
  }

  /**
   * 选择对话选项（触发choice事件）
   */
  selectChoice(dialogueId: string, choiceId: string): void {
    this.emit('choice', { dialogueId, choiceId });
  }

  /**
   * 场景对话完成（触发complete事件）
   */
  completeScene(sceneId: string): void {
    this.emit('complete', { dialogueId: sceneId });
  }

  /**
   * 获取所有角色列表
   */
  getAllCharacters(): DialogueCharacter[] {
    return Array.from(this.characters.values());
  }

  /**
   * 获取所有对话ID
   */
  getAllDialogueIds(): string[] {
    return Array.from(this.dialogues.keys());
  }

  /**
   * 导出所有数据为JSON
   */
  exportToJSON(): string {
    return JSON.stringify({
      dialogues: Array.from(this.dialogues.values()),
      characters: Array.from(this.characters.values()),
      scenes: Array.from(this.scenes.values())
    }, null, 2);
  }

  /**
   * 从JSON导入数据
   */
  importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.dialogues) this.loadDialogues(data.dialogues);
      if (data.characters) this.loadCharacters(data.characters);
      if (data.scenes) this.loadScenes(data.scenes);
    } catch (e) {
      console.error('Failed to import dialogue data:', e);
    }
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    this.dialogues.clear();
    this.characters.clear();
    this.scenes.clear();
  }
}

export default DialogueSystem;
