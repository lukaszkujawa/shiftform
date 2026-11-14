import { THREE } from './toon.js';

export const covers = [];

export function build() {
  return { group: new THREE.Group(), update() {} };
}
