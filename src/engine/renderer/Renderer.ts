/**
 * Renderer.ts - Three.js渲染器配置
 * 包含WebGL渲染优化配置、PC/移动端自动切换
 */

import * as THREE from 'three';
import { WebGLRenderer, WebGLRendererParameters } from 'three';

export interface RendererConfig {
  container: HTMLElement;
  width?: number;
  height?: number;
  pixelRatio?: number;
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'high-performance' | 'low-power' | 'default';
  stencil?: boolean;
  depth?: boolean;
}

export interface RenderQuality {
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  pixelRatio: number;
  postProcessing: boolean;
}

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private width: number;
  private height: number;
  private isMobile: boolean;
  private animationId: number | null = null;
  private quality: RenderQuality;
  private resizeCallback: (() => void) | null = null;

  // 默认质量配置
  private readonly QUALITY_PRESETS = {
    high: {
      shadows: true,
      shadowMapSize: 2048,
      antialias: true,
      pixelRatio: Math.min(window.devicePixelRatio, 2),
      postProcessing: true,
    },
    medium: {
      shadows: true,
      shadowMapSize: 1024,
      antialias: true,
      pixelRatio: Math.min(window.devicePixelRatio, 1.5),
      postProcessing: false,
    },
    low: {
      shadows: false,
      shadowMapSize: 512,
      antialias: false,
      pixelRatio: 1,
      postProcessing: false,
    },
    mobile: {
      shadows: false,
      shadowMapSize: 512,
      antialias: false,
      pixelRatio: Math.min(window.devicePixelRatio, 1.5),
      postProcessing: false,
    },
  };

  constructor(config: RendererConfig) {
    this.container = config.container;
    this.width = config.width || window.innerWidth;
    this.height = config.height || window.innerHeight;
    this.isMobile = this.detectMobile();

    // 根据设备类型选择质量配置
    this.quality = this.isMobile
      ? this.QUALITY_PRESETS.mobile
      : this.QUALITY_PRESETS.medium;

    // 创建渲染器配置
    const rendererParams: WebGLRendererParameters = {
      alpha: config.alpha ?? false,
      antialias: this.quality.antialias,
      depth: config.depth ?? true,
      stencil: config.stencil ?? false,
      powerPreference: this.isMobile ? 'low-power' : (config.powerPreference || 'high-performance'),
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      logarithmicDepthBuffer: false,
    };

    this.renderer = new WebGLRenderer(rendererParams);
    this.init();
  }

  private init(): void {
    // 设置渲染器尺寸
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(this.quality.pixelRatio);

    // 渲染优化配置
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 输出配置
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.useLegacyLights = false;

    // 移动端特定优化
    if (this.isMobile) {
      this.renderer.setOpaqueSort((a, b) => a.renderOrder - b.renderOrder);
    }

    // 添加到DOM
    this.container.appendChild(this.renderer.domElement);

    // 绑定窗口大小变化
    this.bindResize();
  }

  /**
   * 检测是否为移动端设备
   */
  private detectMobile(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = [
      'android',
      'iphone',
      'ipad',
      'ipod',
      'mobile',
      'windows phone',
      'blackberry',
    ];
    const isMobileByUA = mobileKeywords.some((keyword) =>
      userAgent.includes(keyword)
    );

    // 也检查触摸支持
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    return isMobileByUA || (isTouchDevice && window.innerWidth < 1024);
  }

  /**
   * 绑定窗口大小变化事件
   */
  private bindResize(): void {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.resize(width, height);
      }
    });

    resizeObserver.observe(this.container);

    // 传统resize事件作为后备
    window.addEventListener('resize', () => {
      if (!this.container.parentElement) return;
      const rect = this.container.getBoundingClientRect();
      this.resize(rect.width, rect.height);
    });
  }

  /**
   * 调整渲染器尺寸
   */
  public resize(width: number, height: number): void {
    this.width = Math.floor(width);
    this.height = Math.floor(height);
    this.renderer.setSize(this.width, this.height);

    if (this.resizeCallback) {
      this.resizeCallback();
    }
  }

  /**
   * 设置质量预设
   */
  public setQuality(preset: 'high' | 'medium' | 'low' | 'mobile'): void {
    const newQuality = this.QUALITY_PRESETS[preset];
    if (newQuality) {
      this.quality = { ...newQuality };
      this.renderer.setPixelRatio(this.quality.pixelRatio);
      this.renderer.shadowMap.enabled = this.quality.shadows;
    }
  }

  /**
   * 动态调整质量（运行时）
   */
  public adjustQuality(fps: number): void {
    if (fps < 30 && !this.isMobile) {
      this.setQuality('low');
    } else if (fps > 55 && !this.isMobile) {
      this.setQuality('high');
    }
  }

  /**
   * 获取渲染器实例
   */
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * 获取DOM元素
   */
  public getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * 获取渲染器尺寸
   */
  public getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * 检查是否为移动端
   */
  public getIsMobile(): boolean {
    return this.isMobile;
  }

  /**
   * 设置resize回调
   */
  public onResize(callback: () => void): void {
    this.resizeCallback = callback;
  }

  /**
   * 渲染场景
   */
  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  /**
   * 开始渲染循环
   */
  public startRenderLoop(
    scene: THREE.Scene,
    camera: THREE.Camera,
    callback?: (delta: number) => void
  ): void {
    let lastTime = performance.now();

    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (callback) {
        callback(delta);
      }

      this.renderer.render(scene, camera);
    };

    animate();
  }

  /**
   * 停止渲染循环
   */
  public stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.stopRenderLoop();
    this.renderer.dispose();
    this.renderer.forceContextLoss();

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  /**
   * 获取WebGL上下文信息
   */
  public getContextInfo(): {
    vendor: string;
    renderer: string;
    version: string;
    maxTextureSize: number;
    maxAnisotropy: number;
  } {
    const gl = this.renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

    return {
      vendor: debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        : 'Unknown',
      renderer: debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : 'Unknown',
      version: gl.getParameter(gl.VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
    };
  }
}

export default Renderer;
