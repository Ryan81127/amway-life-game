import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ORGANS, ORGAN_MAP, type OrganDef, type Part } from '../data/organs';
import { useStore } from '../store';

const HOME_TARGET = new THREE.Vector3(0, 0.92, 0);
const HOME_DIST = 3.3;

/* ---------- 基本形狀 ---------- */
function Shape({ part, children }: { part: Part; children: React.ReactNode }) {
  const { shape, pos, scale, rot } = part;
  return (
    <mesh position={pos} scale={scale} rotation={rot ?? [0, 0, 0]}>
      {shape === 'sphere' && <sphereGeometry args={[1, 32, 24]} />}
      {shape === 'capsule' && <capsuleGeometry args={[1, 1, 8, 16]} />}
      {shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
      {shape === 'torus' && <torusGeometry args={[1, 0.3, 12, 40]} />}
      {children}
    </mesh>
  );
}

const cap = (pos: Part['pos'], r: number, len: number, rot?: Part['rot'], sz = 1): { pos: Part['pos']; r: number; len: number; rot?: Part['rot']; sz: number } => ({ pos, r, len, rot, sz });

/* 皮膚（身體外形）。肌肉層使用相同輪廓、略小的版本。 */
const BODY = [
  cap([0, 1.14, 0], 0.17, 0.28, undefined, 0.68), // 軀幹
  cap([0, 1.49, 0], 0.052, 0.06), // 頸
  cap([0.235, 1.25, 0], 0.046, 0.25, [0, 0, 0.12]), cap([-0.235, 1.25, 0], 0.046, 0.25, [0, 0, -0.12]), // 上臂
  cap([0.278, 0.95, 0.01], 0.038, 0.24, [0, 0, 0.05]), cap([-0.278, 0.95, 0.01], 0.038, 0.24, [0, 0, -0.05]), // 前臂
  cap([0.092, 0.64, 0], 0.074, 0.3), cap([-0.092, 0.64, 0], 0.074, 0.3), // 大腿
  cap([0.092, 0.25, 0], 0.05, 0.3), cap([-0.092, 0.25, 0], 0.05, 0.3), // 小腿
];

function BodyShell({ shrink, children, withHead = true }: { shrink: number; children: React.ReactNode; withHead?: boolean }) {
  const noRay = () => null;
  return (
    <group>
      {withHead && (
        <mesh position={[0, 1.615, 0]} scale={[0.095 * shrink, 0.115 * shrink, 0.105 * shrink]} raycast={noRay}>
          <sphereGeometry args={[1, 32, 24]} />{children}
        </mesh>
      )}
      {BODY.map((b, i) => (
        <mesh key={i} position={b.pos} rotation={b.rot ?? [0, 0, 0]} scale={[shrink, 1, b.sz * shrink]} raycast={noRay}>
          <capsuleGeometry args={[b.r, b.len, 8, 20]} />{children}
        </mesh>
      ))}
      {[1, -1].map((sx) => (
        <group key={sx}>
          <mesh position={[sx * 0.292, 0.765, 0.015]} scale={[0.028 * shrink, 0.055 * shrink, 0.04 * shrink]} raycast={noRay}>
            <sphereGeometry args={[1, 16, 12]} />{children}
          </mesh>
          <mesh position={[sx * 0.092, 0.035, 0.05]} scale={[0.045 * shrink, 0.035 * shrink, 0.11 * shrink]} raycast={noRay}>
            <sphereGeometry args={[1, 16, 12]} />{children}
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* 骨骼（示意） */
function Skeleton() {
  const mat = <meshStandardMaterial color="#e9e4d4" roughness={0.6} />;
  const bone = (a: [number, number, number], b: [number, number, number], r: number, key: string) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return (
      <mesh key={key} position={mid} quaternion={q} raycast={() => null}>
        <cylinderGeometry args={[r, r, va.distanceTo(vb), 10]} />{mat}
      </mesh>
    );
  };
  return (
    <group>
      <mesh position={[0, 1.625, 0]} scale={[0.082, 0.098, 0.092]} raycast={() => null}><sphereGeometry args={[1, 24, 18]} />{mat}</mesh>
      {Array.from({ length: 17 }, (_, i) => (
        <mesh key={i} position={[0, 0.9 + i * 0.037, -0.07 + Math.sin(i / 5.2) * 0.012]} raycast={() => null}>
          <cylinderGeometry args={[0.02, 0.02, 0.026, 10]} />{mat}
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={`r${i}`} position={[0, 1.16 + i * 0.038, -0.005]} rotation={[Math.PI / 2, 0, 0]} scale={[1 - Math.abs(i - 2.5) * 0.045, 0.62, 1]} raycast={() => null}>
          <torusGeometry args={[0.135, 0.007, 8, 40]} />{mat}
        </mesh>
      ))}
      <mesh position={[0, 0.9, -0.01]} rotation={[Math.PI / 2.3, 0, 0]} scale={[1, 0.65, 1]} raycast={() => null}><torusGeometry args={[0.115, 0.022, 10, 32]} />{mat}</mesh>
      {[1, -1].flatMap((s) => [
        bone([s * 0.02, 1.43, 0.04], [s * 0.2, 1.42, 0], 0.009, `cl${s}`),
        bone([s * 0.215, 1.4, 0], [s * 0.255, 1.1, 0], 0.014, `hu${s}`),
        bone([s * 0.26, 1.08, 0.01], [s * 0.29, 0.82, 0.01], 0.011, `ra${s}`),
        bone([s * 0.092, 0.86, 0], [s * 0.092, 0.47, 0], 0.02, `fe${s}`),
        bone([s * 0.092, 0.44, 0], [s * 0.092, 0.07, 0], 0.016, `ti${s}`),
      ])}
    </group>
  );
}

/* 血管與神經：以曲線管狀幾何表示主要走向 */
type P3 = [number, number, number];
function tube(points: P3[], r: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 48, r, 8, false);
}
const mirror = (pts: P3[]): P3[] => pts.map(([x, y, z]) => [-x, y, z]);

function Tubes({ paths, color, glow }: { paths: { pts: P3[]; r: number }[]; color: string; glow: number }) {
  const geos = useMemo(() => paths.map((p) => tube(p.pts, p.r)), [paths]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} raycast={() => null}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

const ARM: P3[] = [[0.01, 1.37, -0.01], [0.17, 1.41, 0], [0.235, 1.26, 0], [0.265, 1.05, 0.01], [0.29, 0.8, 0.015]];
const LEG: P3[] = [[0, 0.93, -0.04], [0.085, 0.84, 0], [0.092, 0.5, 0.01], [0.092, 0.08, 0]];
const NECK: P3[] = [[0.01, 1.37, -0.01], [0.035, 1.47, 0.01], [0.04, 1.57, 0.02], [0.03, 1.66, 0.01]];
const ARTERIES = [
  { pts: [[0.02, 1.3, 0.03], [0.01, 1.375, 0.01], [0.0, 1.34, -0.035], [0, 1.1, -0.045], [0, 0.93, -0.04]] as P3[], r: 0.011 },
  ...[ARM, LEG, NECK].flatMap((p) => [{ pts: p, r: 0.006 }, { pts: mirror(p), r: 0.006 }]),
];
const off = (pts: P3[], dx: number, dz: number): P3[] => pts.map(([x, y, z]) => [x + Math.sign(x || 1) * dx, y, z + dz]);
const VEINS = [
  { pts: [[-0.02, 1.3, 0.02], [-0.025, 1.1, -0.03], [-0.02, 0.93, -0.03]] as P3[], r: 0.011 },
  ...[ARM, LEG, NECK].flatMap((p) => [{ pts: off(p, 0.014, 0.012), r: 0.006 }, { pts: off(mirror(p), 0.014, 0.012), r: 0.006 }]),
];
const NERVES = [
  { pts: [[0, 1.58, -0.03], [0, 1.3, -0.065], [0, 0.92, -0.06]] as P3[], r: 0.008 },
  ...[ARM, LEG].flatMap((p) => [{ pts: off(p, -0.012, -0.015), r: 0.004 }, { pts: off(mirror(p), -0.012, -0.015), r: 0.004 }]),
];

/* ---------- 器官 ---------- */
function Organ({ def, state }: { def: OrganDef; state: 'normal' | 'flag' | 'selected' | 'dim' }) {
  const group = useRef<THREE.Group>(null);
  const select = useStore((s) => s.selectOrgan);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // 心臟：示意性的搏動動畫
    if (def.id === 'heart' && group.current) group.current.scale.setScalar(1 + Math.max(0, Math.sin(t * 6.2)) * 0.05);
    const pulse = state === 'flag' ? 0.45 + Math.sin(t * 3) * 0.25 : state === 'selected' ? 0.5 : 0.06;
    mats.current.forEach((m) => m && (m.emissiveIntensity = pulse));
  });
  const emissive = state === 'selected' ? '#35e0c8' : state === 'flag' ? '#ffb020' : def.color;
  return (
    <group
      ref={group}
      position={def.focus}
      onClick={(e) => { e.stopPropagation(); select(def.id); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <group position={[-def.focus[0], -def.focus[1], -def.focus[2]]}>
        {def.parts.map((p, i) => (
          <Shape key={i} part={p}>
            <meshStandardMaterial
              ref={(m) => { if (m) mats.current[i] = m; }}
              color={def.color} emissive={emissive} roughness={0.45}
              transparent={state === 'dim'} opacity={state === 'dim' ? 0.35 : 1}
            />
          </Shape>
        ))}
      </group>
    </group>
  );
}

/* ---------- 鏡頭聚焦 ---------- */
function CameraRig() {
  const selected = useStore((s) => s.selectedOrgan);
  const spotlight = useStore((s) => s.spotlight);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update(): void; addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void } | null;
  const camera = useThree((s) => s.camera);
  const anim = useRef<{ target: THREE.Vector3; pos: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!controls) return;
    const focusId = selected ?? (spotlight && spotlight.length === 1 ? spotlight[0] : null);
    const def = focusId ? ORGAN_MAP[focusId] : null;
    const target = def ? new THREE.Vector3(...def.focus) : HOME_TARGET.clone();
    const dist = def ? def.dist : HOME_DIST;
    // 保留使用者目前的觀看方向，只改變距離與目標
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (def && def.layer === 'organ' && dir.z < 0.2) dir.set(0.25, 0.1, 1).normalize();
    anim.current = { target, pos: target.clone().add(dir.multiplyScalar(dist)) };
  }, [selected, spotlight, controls, camera]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => { anim.current = null; };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  useFrame((_, dt) => {
    if (!anim.current || !controls) return;
    const k = 1 - Math.exp(-dt * 5);
    controls.target.lerp(anim.current.target, k);
    camera.position.lerp(anim.current.pos, k);
    controls.update();
    if (camera.position.distanceTo(anim.current.pos) < 0.003) anim.current = null;
  });
  return null;
}

/* 讓外部（報告）可以擷取目前 3D 畫面 */
function CaptureBridge() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    useStore.setState({
      capture: () => {
        try { gl.render(scene, camera); return gl.domElement.toDataURL('image/jpeg', 0.86); } catch { return null; }
      },
    });
    return () => { useStore.setState({ capture: null }); };
  }, [gl, scene, camera]);
  return null;
}

function Scene({ flagged }: { flagged: string[] }) {
  const { selectedOrgan, spotlight, skinOpacity, layers } = useStore();
  const active = spotlight ?? flagged;
  const layerGlow = (id: string) => (selectedOrgan === id ? 0.9 : active.includes(id) ? 0.55 : 0.12);
  const sel = selectedOrgan ? ORGAN_MAP[selectedOrgan] : null;
  const skinTint = selectedOrgan === 'skin' ? '#35e0c8' : active.includes('skin') ? '#ffb020' : '#7fd6e8';
  const muscleOn = layers.muscle || selectedOrgan === 'muscles' || (!!spotlight && spotlight.includes('muscles'));
  const nerveOn = layers.nerve || selectedOrgan === 'nerves';
  const vesselOn = layers.vessel || selectedOrgan === 'vessels';

  return (
    <>
      <color attach="background" args={['#071a30']} />
      <hemisphereLight args={['#cfe9ff', '#0b2238', 1.1]} />
      <directionalLight position={[2, 3, 4]} intensity={1.6} />
      <directionalLight position={[-3, 2, -3]} intensity={0.5} color="#7fd6e8" />

      {layers.skeleton && <Skeleton />}
      {muscleOn && (
        <BodyShell shrink={0.9} withHead={false}>
          <meshStandardMaterial color="#a8423c" emissive="#ff6a4a" emissiveIntensity={layerGlow('muscles')} roughness={0.7} transparent opacity={layers.muscle ? 0.85 : 0.3} depthWrite={layers.muscle} />
        </BodyShell>
      )}
      {vesselOn && (<><Tubes paths={ARTERIES} color="#e03a4a" glow={layerGlow('vessels')} /><Tubes paths={VEINS} color="#3d6fe0" glow={layerGlow('vessels') * 0.6} /></>)}
      {nerveOn && <Tubes paths={NERVES} color="#f2d24b" glow={layerGlow('nerves')} />}
      {layers.organ && ORGANS.filter((o) => o.layer === 'organ').map((o) => (
        <Organ key={o.id} def={o} state={selectedOrgan === o.id ? 'selected' : active.includes(o.id) ? 'flag' : spotlight ? 'dim' : 'normal'} />
      ))}
      {skinOpacity > 0.01 && (
        <BodyShell shrink={1}>
          <meshPhysicalMaterial color={skinTint} transparent opacity={skinOpacity} roughness={0.35} depthWrite={skinOpacity > 0.95} side={THREE.FrontSide} emissive={skinTint} emissiveIntensity={selectedOrgan === 'skin' || active.includes('skin') ? 0.35 : 0.05} />
        </BodyShell>
      )}

      {sel && (
        <Html position={[sel.focus[0], sel.focus[1] + (sel.layer === 'organ' ? 0.1 : 0.85), sel.focus[2]]} center zIndexRange={[5, 0]}>
          <div className="organ-tag">{sel.name}</div>
        </Html>
      )}
      <gridHelper args={[3, 30, '#14506b', '#0d3350']} position={[0, 0, 0]} />
      <OrbitControls makeDefault target={HOME_TARGET} minDistance={0.3} maxDistance={6} enableDamping />
      <CameraRig />
      <CaptureBridge />
    </>
  );
}

export default function BodyViewer({ flagged }: { flagged: string[] }) {
  return (
    <Canvas
      camera={{ position: [0.5, 1.15, HOME_DIST], fov: 32, near: 0.05, far: 30 }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => useStore.getState().selectOrgan(null)}
    >
      <Scene flagged={flagged} />
    </Canvas>
  );
}
