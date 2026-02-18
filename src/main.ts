/**
 * main.ts - 游戏入口点
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 完整游戏初始化 + 系统整合
 */

import * as THREE from 'three';
import { Core, GameEvent, GamePhase } from './core';
import { GAME_CONFIG } from './core/constants';

// 导入系统
import { InputManager } from './engine/InputManager';
import { Player } from './systems/player/Player';
import { WeaponSystem } from './systems/player/WeaponSystem';
import { UIManager } from './systems/ui/UIManager';
import { NPCManager } from './systems/npc/NPCManager';
import { QuestSystem } from './systems/npc/QuestSystem';

// ============== 游戏主类 ==============
class Game {
  private core: Core;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  
  // 游戏系统
  private inputManager: InputManager | null = null;
  private player: Player | null = null;
  private weaponSystem: WeaponSystem | null = null;
  private uiManager: UIManager | null = null;
  private npcManager: NPCManager | null = null;
  private questSystem: QuestSystem | null = null;
  
  // 游戏状态
  private isRunning: boolean = false;
  private lastTime: number = 0;
  
  constructor() {
    this.core = Core.getInstance();
  }
  
  // ============== 初始化 ==============
  public async init(): Promise<void> {
    console.log('[Game] 初始化墨境：孤军...');
    
    try {
      // 1. 渲染器
      this.updateLoadingStatus('初始化渲染器...', 10);
      await this.initRenderer();
      
      // 2. 场景
      this.updateLoadingStatus('创建游戏世界...', 30);
      await this.initScene();
      
      // 3. 核心系统
      this.updateLoadingStatus('加载核心系统...', 50);
      this.initCore();
      
      // 4. 输入系统
      this.updateLoadingStatus('初始化控制系统...', 60);
      this.initInput();
      
      // 5. 玩家
      this.updateLoadingStatus('创建玩家角色...', 70);
      this.initPlayer();
      
      // 6. 武器系统
      this.updateLoadingStatus('加载武器库...', 80);
      this.initWeapons();
      
      // 7. UI
      this.updateLoadingStatus('初始化界面...', 90);
      this.initUI();
      
      // 8. NPC/任务
      this.updateLoadingStatus('加载任务系统...', 95);
      this.initQuests();
      
      // 完成
      this.updateLoadingStatus('准备就绪!', 100);
      
      setTimeout(() => {
        this.hideLoadingScreen();
        this.showStartPrompt();
      }, 500);
      
      console.log('[Game] 初始化完成');
    } catch (error) {
      console.error('[Game] 初始化失败:', error);
      this.showError('游戏初始化失败: ' + (error as Error).message);
    }
  }
  
  // ============== 渲染器 ==============
  private async initRenderer(): Promise<void> {
    const container = document.getElementById('game-container');
    if (!container) throw new Error('找不到游戏容器');
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    
    if (!context) throw new Error('不支持 WebGL 2.0');
    
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context: context as WebGLRenderingContext,
      antialias: true,
    });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(this.renderer.domElement);
    this.core.renderer = this.renderer;
    
    console.log('[Game] 渲染器就绪');
  }
  
  // ============== 场景 ==============
  private async initScene(): Promise<void> {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x151530);
    this.scene.fog = new THREE.FogExp2(0x151530, 0.008);
    
    // 相机
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    this.camera.position.set(0, 1.8, 0);
    
    this.core.scene = this.scene;
    this.core.camera = this.camera;
    
    // 光照 - 更亮
    const ambient = new THREE.AmbientLight(0x606080, 1.2);
    this.scene.add(ambient);
    
    const directional = new THREE.DirectionalLight(0xffffff, 1.5);
    directional.position.set(10, 30, 10);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    this.scene.add(directional);
    
    // 霓虹点光 - 更亮
    const neonLight1 = new THREE.PointLight(0xff00ff, 2, 50);
    neonLight1.position.set(-15, 5, -15);
    this.scene.add(neonLight1);
    
    const neonLight2 = new THREE.PointLight(0x00ffff, 2, 50);
    neonLight2.position.set(15, 5, 15);
    this.scene.add(neonLight2);
    
    const neonLight3 = new THREE.PointLight(0x00ff00, 1.5, 40);
    neonLight3.position.set(0, 5, -20);
    this.scene.add(neonLight3);
    
    // 地面 - 更亮
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a4a,
      roughness: 0.7,
      metalness: 0.3,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // 网格 - 更亮
    const grid = new THREE.GridHelper(100, 50, 0x00ffff, 0x333366);
    this.scene.add(grid);
    
    // 障碍物 (可作为掩体)
    this.createObstacles();
    
    console.log('[Game] 场景就绪');
  }
  
  // ============== 创建障碍物 ==============
  private createObstacles(): void {
    if (!this.scene) return;
    
    const boxGeo = new THREE.BoxGeometry(2, 2, 2);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x333355,
      roughness: 0.7,
      metalness: 0.3,
    });
    
    // 随机放置一些箱子
    for (let i = 0; i < 20; i++) {
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(
        (Math.random() - 0.5) * 60,
        1,
        (Math.random() - 0.5) * 60
      );
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
    }
    
    // 墙壁
    const wallGeo = new THREE.BoxGeometry(20, 4, 1);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x222244,
      roughness: 0.9,
    });
    
    const walls = [
      { pos: [0, 2, -30], rot: 0 },
      { pos: [0, 2, 30], rot: 0 },
      { pos: [-30, 2, 0], rot: Math.PI / 2 },
      { pos: [30, 2, 0], rot: Math.PI / 2 },
    ];
    
    walls.forEach(w => {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(w.pos[0], w.pos[1], w.pos[2]);
      wall.rotation.y = w.rot;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
    });
  }
  
  // ============== 核心系统 ==============
  private initCore(): void {
    this.core.initialize();
    this.core.eventBus.on(GameEvent.LEVEL_UP, (level: number) => {
      this.uiManager?.showNotification(`升级到 ${level} 级!`);
    });
  }
  
  // ============== 输入系统 ==============
  private initInput(): void {
    this.inputManager = new InputManager();
    this.inputManager.init(document.body);
    
    // 窗口调整
    window.addEventListener('resize', () => this.onResize());
    
    console.log('[Game] 输入系统就绪');
  }
  
  // ============== 玩家 ==============
  private initPlayer(): void {
    if (!this.camera) return;
    
    this.player = new Player(this.camera, this.inputManager!, this.core);
    console.log('[Game] 玩家就绪');
  }
  
  // ============== 武器系统 ==============
  private initWeapons(): void {
    if (!this.player || !this.scene) return;
    
    this.weaponSystem = new WeaponSystem(this.core, this.player);
    this.weaponSystem.setScene(this.scene);
    
    console.log('[Game] 武器系统就绪');
  }
  
  // ============== UI ==============
  private initUI(): void {
    this.uiManager = UIManager.getInstance();
    this.uiManager.init();
    
    // 暂停菜单按钮
    this.inputManager?.onKeyDownRegister('Escape', () => {
      this.uiManager?.togglePauseMenu();
    });
    
    // 物品栏
    this.inputManager?.onKeyDownRegister('Tab', () => {
      this.uiManager?.toggleInventory();
    });
    
    console.log('[Game] UI就绪');
  }
  
  // ============== 任务系统 ==============
  private initQuests(): void {
    this.npcManager = NPCManager.getInstance();
    this.questSystem = new QuestSystem();
    console.log('[Game] 任务系统就绪');
  }
  
  // ============== 开始游戏 ==============
  private startGame(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.core.startNewGame();
    
    // 请求指针锁定
    this.inputManager?.requestPointerLock();
    
    // 开始游戏循环
    this.lastTime = performance.now();
    this.gameLoop();
  }
  
  // ============== 游戏循环 ==============
  private gameLoop = (): void => {
    if (!this.isRunning) return;
    
    requestAnimationFrame(this.gameLoop);
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    
    // 更新核心
    this.core.update(currentTime);
    
    // 更新玩家
    if (this.player && this.inputManager?.getState().isPointerLocked) {
      this.player.update(deltaTime);
      
      // 更新武器
      if (this.weaponSystem) {
        this.weaponSystem.update(deltaTime);
      }
      
      // 更新UI数据
      this.updateUI();
    }
    
    // 渲染
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };
  
  // ============== 更新UI ==============
  private updateUI(): void {
    if (!this.player || !this.weaponSystem) return;
    
    const weapon = this.weaponSystem.getCurrentWeapon();
    
    this.uiManager?.update({
      health: {
        current: this.core.player.health,
        max: this.core.player.maxHealth,
        armor: this.core.player.armor,
      },
      ammo: weapon ? {
        current: weapon.currentAmmo,
        total: weapon.totalAmmo,
        weapon: weapon.data.name,
      } : undefined,
    });
  }
  
  // ============== 显示开始提示 ==============
  private showStartPrompt(): void {
    const prompt = document.createElement('div');
    prompt.id = 'start-prompt';
    prompt.innerHTML = `
      <div class="start-title">墨境：孤军</div>
      <div class="start-subtitle">Ink Realm: Lone Army</div>
      <div class="start-instruction">点击开始游戏</div>
      <div class="start-controls">
        <div>WASD - 移动</div>
        <div>空格 - 跳跃</div>
        <div>鼠标 - 瞄准</div>
        <div>左键 - 射击</div>
        <div>R - 换弹</div>
      </div>
    `;
    prompt.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: rgba(10, 10, 26, 0.95);
      z-index: 1000;
      cursor: pointer;
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .start-title {
        font-size: 72px;
        font-weight: bold;
        background: linear-gradient(90deg, #ff00ff, #00ffff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 10px;
      }
      .start-subtitle {
        font-size: 24px;
        color: #888;
        margin-bottom: 50px;
      }
      .start-instruction {
        font-size: 28px;
        color: #00ffff;
        animation: pulse 2s infinite;
        margin-bottom: 30px;
      }
      .start-controls {
        font-size: 16px;
        color: #666;
        text-align: center;
        line-height: 2;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    
    prompt.addEventListener('click', () => {
      prompt.remove();
      this.startGame();
    });
    
    document.body.appendChild(prompt);
  }
  
  // ============== 窗口调整 ==============
  private onResize(): void {
    if (!this.camera || !this.renderer) return;
    
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  // ============== 加载状态 ==============
  private updateLoadingStatus(status: string, progress: number): void {
    const loadingBar = document.getElementById('loading-bar');
    const loadingStatus = document.getElementById('loading-status');
    
    if (loadingBar) loadingBar.style.width = `${progress}%`;
    if (loadingStatus) loadingStatus.textContent = status;
  }
  
  private hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
  }
  
  private showError(message: string): void {
    const status = document.getElementById('loading-status');
    if (status) {
      status.style.color = '#ff0000';
      status.textContent = message;
    }
  }
}

// ============== 启动 ==============
const game = new Game();
game.init();

(window as any).game = game;
