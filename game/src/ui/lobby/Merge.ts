import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Draw-call saver. Inside every group, the plain meshes that share a material are baked into one mesh, so a Mosaic's forearm
 * (four parts) or a slot cabinet (fifteen) is a single draw. Groups themselves are kept, so every joint still animates.
 * Anything flagged `userData.keep` (pick volumes, glowing rings), instanced meshes and multi-material meshes are left alone.
 */
export function mergeStatic(root: THREE.Object3D): number {
  let saved = 0;
  const visit = (node: THREE.Object3D) => {
    for (const c of [...node.children]) if (!(c as THREE.Mesh).isMesh) visit(c);
    const buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; list: THREE.Mesh[] }>();
    for (const c of node.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || m.userData.keep || Array.isArray(m.material) || !m.visible) continue;
      const mat = m.material as THREE.Material, key = `${mat.uuid}|${m.castShadow ? 1 : 0}|${m.receiveShadow ? 1 : 0}`;
      let b = buckets.get(key); if (!b) buckets.set(key, b = { mat, cast: m.castShadow, recv: m.receiveShadow, list: [] }); b.list.push(m);
    }
    for (const b of buckets.values()) {
      if (b.list.length < 2) continue;
      const geos: THREE.BufferGeometry[] = [];
      for (const m of b.list) { m.updateMatrix(); const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); g.applyMatrix4(m.matrix); for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k); geos.push(g); }
      const merged = mergeGeometries(geos, false); if (!merged) continue;
      const out = new THREE.Mesh(merged, b.mat); out.castShadow = b.cast; out.receiveShadow = b.recv; node.add(out);
      for (const m of b.list) node.remove(m);
      saved += b.list.length - 1;
    }
  };
  visit(root);
  return saved;
}
