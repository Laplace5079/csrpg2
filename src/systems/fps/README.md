# FPS Core System

FPS 核心系统模块，提供完整的武器射击、后坐力、散布和弹道检测功能。

## 文件结构

```
src/systems/fps/
├── index.ts           # 模块导出
├── types.ts           # 类型定义
├── Recoil.ts          # 后坐力系统
├── Spread.ts          # 散布系统
├── BulletTrace.ts     # 弹道射线检测
├── Weapon.ts          # 武器基类
└── WeaponManager.ts   # 武器管理器
```

## 快速开始

```typescript
import { createWeaponManager, createWeapon } from './systems/fps';
import { WeaponData } from './systems/fps/types';
import * as THREE from 'three';

// 创建场景
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 16/9, 0.1, 1000);

// 创建武器管理器
const weaponManager = createWeaponManager(scene);
weaponManager.setCamera(camera);

// 添加强制
const m4a1Data: WeaponData = {
  id: 'm4a1',
  name: 'M4A1',
  type: 'rifle',
  category: 'primary',
  // ... 其他属性
};

weaponManager.addWeapon(m4a1Data, 0);

// 在游戏循环中更新
function gameLoop() {
  requestAnimationFrame(gameLoop);
  
  const delta = 1 / 60; // 假设60fps
  weaponManager.update(delta);
  
  // 渲染场景
}

gameLoop();
```

## 核心功能

### Weapon - 武器基类
- 射击、换弹、后坐力逻辑
- 支持多种射击模式 (semi/auto/burst)
- 弹药管理
- 事件系统

### WeaponManager - 武器管理器
- 多武器槽位管理
- 武器切换
- 瞄准/蹲下/冲刺状态同步

### RecoilSystem - 后坐力系统
- 预定义后坐力模式
- 自动恢复
- 视角抖动应用

### SpreadSystem - 散布系统
- 腰射/瞄准散布
- 动态散布增减
- 姿势和移动状态影响

### BulletTrace - 弹道射线检测
- 射线投射
- 穿透机制
- 伤害衰减
- 追踪弹效果

## 武器数据接口

参考 `src/data/weapons.json` 中的示例数据，或查看 `types.ts` 中的 `WeaponData` 接口定义。

## 技术规格

- **技术栈**: TypeScript + Three.js
- **目标平台**: WebGL (浏览器)
- **后坐力模式**: 预定义数组 (8发循环)
- **散布计算**: 锥形散布 + 随机采样
- **弹道检测**: Raycaster + 穿透计数
