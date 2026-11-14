import { THREE } from './toon.js?v=92c407e';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js?v=92c407e';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js?v=92c407e';
import { ShaderPass } from '../vendor/three/addons/postprocessing/ShaderPass.js?v=92c407e';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js?v=92c407e';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js?v=92c407e';

const STRENGTH = 0.7;
const RADIUS = 0.5;
const SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
const MIX = {
  uniforms: { baseTexture: { value: null }, glowTexture: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D glowTexture; varying vec2 vUv; void main() { float edge = smoothstep(0.85, 0.3, distance(vUv, vec2(0.5))); vec4 base = texture2D(baseTexture, vUv); gl_FragColor = vec4(base.rgb * mix(0.8, 1.0, edge), base.a) + vec4(texture2D(glowTexture, vUv).rgb, 0.0); }',
};

const target = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const glows = node => node.material?.userData?.bloom && node.material.opacity >= 0.6;

export function createBloom(gl, scene, camera) {
  const glow = new EffectComposer(gl, target()), final = new EffectComposer(gl, target());
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), STRENGTH, RADIUS, 0);
  glow.renderToScreen = false;
  glow.addPass(new RenderPass(scene, camera));
  glow.addPass(bloom);
  const mix = new ShaderPass(new THREE.ShaderMaterial(MIX), 'baseTexture');
  mix.uniforms.glowTexture.value = glow.renderTarget2.texture;
  final.addPass(new RenderPass(scene, camera));
  final.addPass(mix);
  final.addPass(new OutputPass());
  const swapped = new Map(), hidden = [];

  function darken(node) {
    if (glows(node) || !node.visible) return;
    if (node.isMesh && !node.userData.overlay) { swapped.set(node, node.material); node.material = SHADOW; }
    else if (node.isSprite || node.isPoints || node.isLine || node.userData.overlay) { hidden.push(node); node.visible = false; }
  }

  return {
    resize(width, height, pixels) {
      for (const composer of [glow, final]) {
        composer.setPixelRatio(pixels);
        composer.setSize(width, height);
      }
    },
    render() {
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
