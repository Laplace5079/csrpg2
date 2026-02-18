/**
 * MobileHUD.ts - 移动端HUD布局
 * 提供自适应UI布局，支持PC/移动端自动切换
 */

import * as React from 'react';

export interface HUDConfig {
  showJoystick?: boolean;
  showActionButtons?: boolean;
  showMinimap?: boolean;
  showHealthBar?: boolean;
  showChatButton?: boolean;
  showInventoryButton?: boolean;
  joystickPosition?: 'left' | 'right';
  buttonSize?: number;
}

export interface HUDButtonConfig {
  icon: string;
  label?: string;
  position: { x: number; y: number };
  onClick?: () => void;
  onLongPress?: () => void;
  backgroundColor?: string;
  iconColor?: string;
}

export interface HUDTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: number;
  opacity: number;
}

// 默认主题
export const DEFAULT_HUD_THEME: HUDTheme = {
  primaryColor: '#4a90d9',
  secondaryColor: '#6c757d',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  textColor: '#ffffff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  borderRadius: 8,
  opacity: 0.9,
};

// 移动端主题
export const MOBILE_HUD_THEME: HUDTheme = {
  primaryColor: '#ff6b6b',
  secondaryColor: '#4ecdc4',
  backgroundColor: 'rgba(30, 30, 30, 0.7)',
  textColor: '#ffffff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  borderRadius: 12,
  opacity: 0.95,
};

/**
 * 生成HUD样式
 */
export function createHUDStyles(theme: HUDTheme, isMobile: boolean): string {
  return `
    .hud-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
      font-family: ${theme.fontFamily};
      user-select: none;
      -webkit-user-select: none;
    }

    .hud-container * {
      pointer-events: auto;
    }

    .hud-joystick-area {
      position: absolute;
      bottom: 30px;
      ${isMobile ? 'left: 30px;' : 'left: 50%;'}
      width: 150px;
      height: 150px;
    }

    .hud-action-buttons {
      position: absolute;
      bottom: 30px;
      right: 30px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .hud-button {
      width: ${isMobile ? '60px' : '50px'};
      height: ${isMobile ? '60px' : '50px'};
      border-radius: ${theme.borderRadius}px;
      background: ${theme.backgroundColor};
      border: 2px solid ${theme.primaryColor};
      color: ${theme.textColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${isMobile ? '24px' : '20px'};
      cursor: pointer;
      transition: transform 0.1s, background 0.2s;
      opacity: ${theme.opacity};
    }

    .hud-button:active {
      transform: scale(0.95);
      background: ${theme.primaryColor};
    }

    .hud-button.secondary {
      border-color: ${theme.secondaryColor};
    }

    .hud-top-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: 15px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .hud-health-bar {
      background: ${theme.backgroundColor};
      border-radius: ${theme.borderRadius}px;
      padding: 10px 15px;
      opacity: ${theme.opacity};
      min-width: 150px;
    }

    .hud-health-label {
      color: ${theme.textColor};
      font-size: 12px;
      margin-bottom: 5px;
    }

    .hud-health-fill {
      height: 8px;
      background: linear-gradient(90deg, #ff4444, #ff8844);
      border-radius: 4px;
      transition: width 0.3s;
    }

    .hud-minimap {
      width: ${isMobile ? '120px' : '100px'};
      height: ${isMobile ? '120px' : '100px'};
      background: ${theme.backgroundColor};
      border: 2px solid ${theme.primaryColor};
      border-radius: 50%;
      opacity: ${theme.opacity};
      overflow: hidden;
    }

    .hud-minimap-content {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${theme.textColor};
      font-size: 10px;
    }

    .hud-bottom-right {
      position: absolute;
      bottom: 30px;
      right: 30px;
      display: flex;
      gap: 10px;
    }

    .hud-small-button {
      width: ${isMobile ? '45px' : '40px'};
      height: ${isMobile ? '45px' : '40px'};
      border-radius: ${theme.borderRadius}px;
      background: ${theme.backgroundColor};
      border: 1px solid ${theme.secondaryColor};
      color: ${theme.textColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${isMobile ? '18px' : '16px'};
      cursor: pointer;
      opacity: ${theme.opacity};
    }

    .hud-crosshair {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 20px;
      pointer-events: none;
    }

    .hud-crosshair::before,
    .hud-crosshair::after {
      content: '';
      position: absolute;
      background: ${theme.textColor};
    }

    .hud-crosshair::before {
      width: 2px;
      height: 100%;
      left: 50%;
      transform: translateX(-50%);
    }

    .hud-crosshair::after {
      width: 100%;
      height: 2px;
      top: 50%;
      transform: translateY(-50%);
    }

    @media (max-width: 768px) {
      .hud-container {
        display: ${isMobile ? 'flex' : 'none'};
      }
    }

    @media (min-width: 769px) {
      .hud-container.hud-show-desktop {
        display: block;
      }
    }
  `;
}

/**
 * 注入HUD样式到页面
 */
export function injectHUDStyles(theme: HUDTheme, isMobile: boolean): void {
  const existingStyle = document.getElementById('hud-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement('style');
  style.id = 'hud-styles';
  style.textContent = createHUDStyles(theme, isMobile);
  document.head.appendChild(style);
}

/**
 * 检测设备类型
 */
export function detectDevice(): { isMobile: boolean; isTablet: boolean; isDesktop: boolean } {
  const width = window.innerWidth;
  const userAgent = navigator.userAgent.toLowerCase();
  
  const isMobileByUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTablet = /ipad|android|tablet/i.test(userAgent);
  
  const isMobile = isMobileByUA || (width < 768);
  const isTabletByWidth = width >= 768 && width < 1024;
  const isDesktop = !isMobile && !isTabletByWidth;

  return {
    isMobile: isMobile || isTabletByWidth,
    isTablet: isTablet || isTabletByWidth,
    isDesktop,
  };
}

/**
 * 监听设备变化
 */
export function watchDeviceChange(
  onChange: (device: { isMobile: boolean; isTablet: boolean; isDesktop: boolean }) => void
): () => void {
  let lastDevice = detectDevice();

  const handleResize = () => {
    const newDevice = detectDevice();
    if (
      newDevice.isMobile !== lastDevice.isMobile ||
      newDevice.isTablet !== lastDevice.isTablet
    ) {
      lastDevice = newDevice;
      onChange(newDevice);
    }
  };

  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}

/**
 * React组件：移动端HUD
 */
export const MobileHUD: React.FC<{
  config?: HUDConfig;
  theme?: HUDTheme;
  health?: number;
  onAttack?: () => void;
  onJump?: () => void;
  onInteract?: () => void;
  onChat?: () => void;
  onInventory?: () => void;
}> = ({
  config = {},
  theme = MOBILE_HUD_THEME,
  health = 100,
  onAttack,
  onJump,
  onInteract,
  onChat,
  onInventory,
}) => {
  const device = detectDevice();
  const isMobile = device.isMobile || device.isTablet;

  // 注入样式
  React.useEffect(() => {
    injectHUDStyles(theme, isMobile);
  }, [theme, isMobile]);

  if (!isMobile && !config.showJoystick) {
    return null;
  }

  return (
    <div className="hud-container">
      {/* 顶部状态栏 */}
      <div className="hud-top-bar">
        {config.showHealthBar !== false && (
          <div className="hud-health-bar">
            <div className="hud-health-label">HP: {Math.round(health)}%</div>
            <div
              className="hud-health-fill"
              style={{ width: `${Math.max(0, Math.min(100, health))}%` }}
            />
          </div>
        )}

        {config.showMinimap !== false && (
          <div className="hud-minimap">
            <div className="hud-minimap-content">Map</div>
          </div>
        )}
      </div>

      {/* 虚拟摇杆区域（由TouchControls处理） */}
      {config.showJoystick !== false && (
        <div className="hud-joystick-area" id="joystick-area" />
      )}

      {/* 动作按钮 */}
      {config.showActionButtons !== false && (
        <div className="hud-action-buttons">
          <button
            className="hud-button"
            onClick={onAttack}
            title="Attack"
          >
            ⚔️
          </button>
          <button
            className="hud-button secondary"
            onClick={onJump}
            title="Jump"
          >
            ⬆️
          </button>
          <button
            className="hud-button secondary"
            onClick={onInteract}
            title="Interact"
          >
            ✋
          </button>
        </div>
      )}

      {/* 右下角按钮 */}
      <div className="hud-bottom-right">
        {config.showChatButton !== false && (
          <button
            className="hud-small-button"
            onClick={onChat}
            title="Chat"
          >
            💬
          </button>
        )}
        {config.showInventoryButton !== false && (
          <button
            className="hud-small-button"
            onClick={onInventory}
            title="Inventory"
          >
            🎒
          </button>
        )}
      </div>

      {/* 准星 */}
      <div className="hud-crosshair" />
    </div>
  );
};

/**
 * 创建自定义HUD按钮
 */
export function createHUDButton(
  config: HUDButtonConfig,
  container: HTMLElement
): HTMLElement {
  const button = document.createElement('button');
  button.className = 'hud-button';
  button.innerHTML = config.icon;
  button.style.position = 'absolute';
  button.style.left = `${config.position.x}px`;
  button.style.top = `${config.position.y}px`;

  if (config.backgroundColor) {
    button.style.background = config.backgroundColor;
  }
  if (config.iconColor) {
    button.style.color = config.iconColor;
  }
  if (config.label) {
    button.title = config.label;
  }

  if (config.onClick) {
    button.addEventListener('click', config.onClick);
  }

  if (config.onLongPress) {
    let pressTimer: ReturnType<typeof setTimeout>;
    
    button.addEventListener('mousedown', () => {
      pressTimer = setTimeout(config.onLongPress, 500);
    });
    
    button.addEventListener('mouseup', () => {
      clearTimeout(pressTimer);
    });
    
    button.addEventListener('mouseleave', () => {
      clearTimeout(pressTimer);
    });
  }

  container.appendChild(button);
  return button;
}

/**
 * 创建全屏HUD容器
 */
export function createHUDContainer(id: string = 'hud-container'): HTMLElement {
  let container = document.getElementById(id);
  
  if (!container) {
    container = document.createElement('div');
    container.id = id;
    container.className = 'hud-container';
    document.body.appendChild(container);
  }

  return container;
}

/**
 * 移除HUD容器
 */
export function removeHUDContainer(id: string = 'hud-container'): void {
  const container = document.getElementById(id);
  if (container) {
    container.remove();
  }

  const styles = document.getElementById('hud-styles');
  if (styles) {
    styles.remove();
  }
}

export default MobileHUD;
