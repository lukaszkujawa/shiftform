import { THREE } from './toon.js?v=cb728ba';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js?v=cb728ba';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js?v=cb728ba';
import { ShaderPass } from '../vendor/three/addons/postprocessing/ShaderPass.js?v=cb728ba';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js?v=cb728ba';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js?v=cb728ba';
import { Pass, FullScreenQuad } from '../vendor/three/addons/postprocessing/Pass.js?v=cb728ba';
import { BokehShader } from '../vendor/three/addons/shaders/BokehShader.js?v=cb728ba';

const STRENGTH = 0.7;
const RADIUS = 0.5;
const DEPTH_OF_FIELD = { aperture: 0.000005, maxblur: 0.006 };
const SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
const MIX = {
  uniforms: { baseTexture: { value: null }, glowTexture: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D glowTexture; varying vec2 vUv; void main() { float edge = smoothstep(0.85, 0.3, distance(vUv, vec2(0.5))); vec4 base = texture2D(baseTexture, vUv); gl_FragColor = vec4(base.rgb * mix(0.8, 1.0, edge), base.a) + vec4(texture2D(glowTexture, vUv).rgb, 0.0); }',
};

const target = (samples, depth = false) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, ...(depth ? { depthTexture: new THREE.DepthTexture(1, 1) } : {}) });
const GLOW_SCALE = 0.5;

class DepthOfField extends Pass {
  constructor(camera, settings) {
    super();
    this.camera = camera;
    this.material = new THREE.ShaderMaterial({ defines: { ...BokehShader.defines, DEPTH_PACKING: 0 }, uniforms: THREE.UniformsUtils.clone(BokehShader.uniforms), vertexShader: BokehShader.vertexShader, fragmentShader: BokehShader.fragmentShader });
    Object.assign(this.material.uniforms.aperture, { value: settings.aperture });
    Object.assign(this.material.uniforms.maxblur, { value: settings.maxblur });
    this.uniforms = this.material.uniforms;
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer, writeBuffer, readBuffer) {
    Object.assign(this.uniforms.tColor, { value: readBuffer.texture });
    Object.assign(this.uniforms.tDepth, { value: readBuffer.depthTexture });
    Object.assign(this.uniforms.nearClip, { value: this.camera.near });
    Object.assign(this.uniforms.farClip, { value: this.camera.far });
    Object.assign(this.uniforms.aspect, { value: this.camera.aspect });
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}
const glows = node => node.material?.userData?.bloom && node.material.opacity >= 0.6;

export function createBloom(gl, scene, overlay, camera) {
  const glow = new EffectComposer(gl, target(0)), final = new EffectComposer(gl, target(4, true));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), STRENGTH, RADIUS, 0);
  glow.renderToScreen = false;
  glow.addPass(new RenderPass(scene, camera));
  glow.addPass(bloom);
  const mix = new ShaderPass(new THREE.ShaderMaterial(MIX), 'baseTexture');
  mix.uniforms.glowTexture.value = glow.renderTarget2.texture;
  const focus = new DepthOfField(camera, DEPTH_OF_FIELD), over = new RenderPass(overlay, camera);
  over.clear = false;
  final.addPass(new RenderPass(scene, camera));
  final.addPass(focus);
  final.addPass(mix);
  final.addPass(over);
  final.addPass(new OutputPass());
  const swapped = new Map(), hidden = [];

  function darken(node) {
    if (glows(node) || !node.visible) return;
    if (node.material?.isShaderMaterial && node.material.side === THREE.BackSide) { hidden.push(node); node.visible = false; }
    else if (node.isMesh) { swapped.set(node, node.material); node.material = SHADOW; }
    else if (node.isSprite || node.isPoints || node.isLine) { hidden.push(node); node.visible = false; }
  }

  return {
    resize(width, height, pixels) {
      glow.setPixelRatio(pixels * GLOW_SCALE);
      final.setPixelRatio(pixels);
      for (const composer of [glow, final]) composer.setSize(width, height);
    },
    render(distance) {
      focus.uniforms.focus.value = distance;
      const background = scene.background;
      scene.background = null;
      scene.traverse(darken);
      glow.render();
      for (const [node, material] of swapped) node.material = material;
      for (const node of hidden) node.visible = true;
      swapped.clear();
      hidden.length = 0;
      scene.background = background;
      final.render();
    },
  };
}
