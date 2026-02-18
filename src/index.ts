/**
 * 渲染引擎和移动端适配模块
 * 统一导出所有渲染和移动端相关模块
 */

// 渲染引擎
export { Renderer, RendererConfig, RenderQuality } from './engine/renderer/Renderer';
export { Camera, CameraConfig, CameraControls, CameraState } from './engine/renderer/Camera';
export { PhysicsWorld, PhysicsConfig, RigidBodyConfig, CollisionEvent, CollisionCallback } from './engine/physics/PhysicsWorld';

// 移动端适配
export { TouchControls, TouchControlConfig, TouchEventData, TouchState } from './mobile/TouchControls';
export { VirtualJoystick, JoystickConfig, JoystickState } from './mobile/VirtualJoystick';
export {
  MobileHUD,
  HUDConfig,
  HUDButtonConfig,
  HUDTheme,
  DEFAULT_HUD_THEME,
  MOBILE_HUD_THEME,
  createHUDStyles,
  injectHUDStyles,
  detectDevice,
  watchDeviceChange,
  createHUDButton,
  createHUDContainer,
  removeHUDContainer,
} from './mobile/MobileHUD';
