import { Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type OrbitBody = {
  offset: number;
  size: number;
  color: string;
};

type OrbitConfig = {
  radiusX: number;
  radiusY: number;
  rotation: [number, number, number];
  speed: number;
  direction: 1 | -1;
  dashed?: boolean;
  bodies: OrbitBody[];
};

const orbitConfigs: OrbitConfig[] = [
  { radiusX: 1.55, radiusY: 0.44, rotation: [0.82, 0.04, 0.08], speed: 0.58, direction: 1, bodies: [{ offset: 0.2, size: 0.024, color: "#e0f2fe" }] },
  { radiusX: 1.92, radiusY: 0.58, rotation: [1.18, -0.36, -0.62], speed: 0.42, direction: -1, dashed: true, bodies: [{ offset: 1.1, size: 0.025, color: "#7dd3fc" }] },
  { radiusX: 1.18, radiusY: 0.96, rotation: [-0.28, 1.12, 0.36], speed: 0.66, direction: 1, bodies: [{ offset: 0.8, size: 0.023, color: "#bfdbfe" }] },
  { radiusX: 1.96, radiusY: 0.62, rotation: [0.46, 0.82, 1.22], speed: 0.32, direction: 1, dashed: true, bodies: [{ offset: 2.2, size: 0.026, color: "#ffffff" }] },
  { radiusX: 1.38, radiusY: 0.32, rotation: [1.44, 0.54, -1.42], speed: 0.9, direction: -1, bodies: [{ offset: 0.5, size: 0.022, color: "#67e8f9" }] },
];

function GalaxyScene() {
  const rootRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (!rootRef.current) return;
    rootRef.current.rotation.y = Math.sin(time * 0.13) * 0.1;
    rootRef.current.rotation.x = Math.cos(time * 0.11) * 0.06;
    rootRef.current.rotation.z = Math.sin(time * 0.16) * 0.03;
  });

  return (
    <group ref={rootRef}>
      <ambientLight intensity={0.86} />
      <pointLight position={[0, 0, 2.2]} intensity={3.8} color="#7dd3fc" />
      <pointLight position={[0.12, 0.08, 1.7]} intensity={3.4} color="#fff176" />
      <BackgroundStars />
      <EnergyCore />
      {orbitConfigs.map((orbit, index) => (
        <Orbit key={index} config={orbit} />
      ))}
      <Sparkles count={120} scale={[4.6, 3.6, 3.2]} size={1.85} speed={0.16} opacity={0.48} color="#bfdbfe" />
    </group>
  );
}

function EnergyCore() {
  const coreRef = useRef<THREE.Group>(null);
  const denseCloudRef = useRef<THREE.Points>(null);
  const glowCloudRef = useRef<THREE.Points>(null);
  const ringARef = useRef<THREE.Points>(null);
  const ringBRef = useRef<THREE.Points>(null);
  const ringCRef = useRef<THREE.Points>(null);

  const denseCloud = useMemo(() => createFilledNebulaSphere(1180, 0.36, 0.76, "gold"), []);
  const glowCloud = useMemo(() => createFilledNebulaSphere(420, 0.48, 0.6, "gold"), []);
  const ringA = useMemo(() => createParticleRing(420, 0.74, 0.1, "red"), []);
  const ringB = useMemo(() => createParticleRing(520, 1.08, 0.13, "purple"), []);
  const ringC = useMemo(() => createParticleRing(620, 1.42, 0.17), []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(time * 2.35) * 0.04;
    if (coreRef.current) coreRef.current.scale.setScalar(pulse);
    if (denseCloudRef.current) {
      denseCloudRef.current.rotation.y = time * 0.18;
      denseCloudRef.current.rotation.z = Math.sin(time * 0.44) * 0.08;
    }
    if (glowCloudRef.current) {
      glowCloudRef.current.rotation.y = -time * 0.11;
      glowCloudRef.current.rotation.x = Math.sin(time * 0.32) * 0.08;
    }
    if (ringARef.current) ringARef.current.rotation.z = time * 0.42;
    if (ringBRef.current) ringBRef.current.rotation.z = -time * 0.28;
    if (ringCRef.current) ringCRef.current.rotation.z = time * 0.16;
  });

  return (
    <group ref={coreRef}>
      <ParticlePoints data={glowCloud} size={0.04} opacity={0.86} refObject={glowCloudRef} />
      <ParticlePoints data={denseCloud} size={0.036} opacity={1} refObject={denseCloudRef} />
      <ParticlePoints data={ringA} size={0.022} opacity={1} refObject={ringARef} rotation={[Math.PI / 2.35, 0.08, 0]} />
      <ParticlePoints data={ringB} size={0.02} opacity={0.96} refObject={ringBRef} rotation={[Math.PI / 2.8, 0.55, 0.42]} />
      <ParticlePoints data={ringC} size={0.016} opacity={0.82} refObject={ringCRef} rotation={[Math.PI / 2.1, -0.52, -0.28]} />
    </group>
  );
}

function ParticlePoints({
  data,
  size,
  opacity,
  refObject,
  rotation,
}: {
  data: ParticleData;
  size: number;
  opacity: number;
  refObject: React.RefObject<THREE.Points | null>;
  rotation?: [number, number, number];
}) {
  return (
    <points ref={refObject} rotation={rotation}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} vertexColors transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

type ParticleData = {
  positions: Float32Array;
  colors: Float32Array;
};

function createFilledNebulaSphere(count: number, radius: number, flatten: number, theme: "default" | "gold" = "default"): ParticleData {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette =
    theme === "gold"
      ? [
          new THREE.Color("#fffbe6"),
          new THREE.Color("#fff8b8"),
          new THREE.Color("#fff176"),
          new THREE.Color("#ffe66d"),
          new THREE.Color("#fff3c4"),
          new THREE.Color("#ffffff"),
        ]
      : [
          new THREE.Color("#f8fafc"),
          new THREE.Color("#dbeafe"),
          new THREE.Color("#a5f3fc"),
          new THREE.Color("#67e8f9"),
          new THREE.Color("#7dd3fc"),
          new THREE.Color("#93c5fd"),
          new THREE.Color("#c4b5fd"),
          new THREE.Color("#ddd6fe"),
          new THREE.Color("#bbf7d0"),
          new THREE.Color("#fbcfe8"),
        ];

  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.5) / count;
    const theta = index * 2.399963;
    const y = 1 - 2 * t;
    const bandRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const volumeRadius = Math.cbrt(((index * 37) % count) / count) * radius;
    const shellNoise = (Math.sin(index * 11.17) + Math.cos(index * 5.91)) * radius * 0.012;
    positions[index * 3] = Math.cos(theta) * bandRadius * volumeRadius + shellNoise;
    positions[index * 3 + 1] = y * volumeRadius * flatten + Math.sin(index * 0.31) * radius * 0.018;
    positions[index * 3 + 2] = Math.sin(theta) * bandRadius * volumeRadius * 0.86 + Math.cos(index * 0.23) * radius * 0.018;
    const color = palette[index % palette.length];
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  return { positions, colors };
}

function createParticleRing(count: number, radius: number, jitter: number, theme: "default" | "red" | "purple" = "default"): ParticleData {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette =
    theme === "red"
      ? [
          new THREE.Color("#fff1f2"),
          new THREE.Color("#ff8a8a"),
          new THREE.Color("#ff4d6d"),
          new THREE.Color("#ff1744"),
          new THREE.Color("#ff0033"),
        ]
      : theme === "purple"
        ? [
            new THREE.Color("#faf5ff"),
            new THREE.Color("#f0abfc"),
            new THREE.Color("#d946ef"),
            new THREE.Color("#b026ff"),
            new THREE.Color("#8b5cf6"),
          ]
        : [
            new THREE.Color("#dbeafe"),
            new THREE.Color("#93c5fd"),
            new THREE.Color("#67e8f9"),
            new THREE.Color("#5eead4"),
            new THREE.Color("#bfdbfe"),
            new THREE.Color("#c4b5fd"),
            new THREE.Color("#e9d5ff"),
            new THREE.Color("#ccfbf1"),
            new THREE.Color("#f8fafc"),
          ];

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const lane = (index % 7) - 3;
    const localRadius = radius + lane * jitter * 0.16 + Math.sin(index * 1.97) * jitter * 0.12;
    positions[index * 3] = Math.cos(angle) * localRadius;
    positions[index * 3 + 1] = Math.sin(angle) * localRadius * (0.58 + lane * 0.006);
    positions[index * 3 + 2] = Math.sin(angle * 2.2 + lane) * jitter * 0.16;
    const color = palette[index % palette.length];
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  return { positions, colors };
}

function Orbit({ config }: { config: OrbitConfig }) {
  const lineRef = useRef<THREE.Line>(null);
  const points = useMemo(() => {
    const vertices: THREE.Vector3[] = [];
    for (let point = 0; point <= 220; point += 1) {
      const angle = (point / 220) * Math.PI * 2;
      vertices.push(new THREE.Vector3(Math.cos(angle) * config.radiusX, Math.sin(angle) * config.radiusY, 0));
    }
    return vertices;
  }, [config.radiusX, config.radiusY]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: config.dashed ? "#93c5fd" : "#7dd3fc",
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [config.dashed],
  );
  const lineObject = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  return (
    <group rotation={config.rotation}>
      <primitive ref={lineRef} object={lineObject} />
      {config.bodies.map((body, bodyIndex) => (
        <OrbitingBody key={bodyIndex} config={config} body={body} bodyIndex={bodyIndex} />
      ))}
    </group>
  );
}

function OrbitingBody({ config, body, bodyIndex }: { config: OrbitConfig; body: OrbitBody; bodyIndex: number }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const tailRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const angle = body.offset + time * config.speed * config.direction;
    const depth = (Math.sin(angle) + 1) / 2;
    const scale = 0.54 + depth * 0.3;
    const opacity = 0.68 + depth * 0.32;
    const x = Math.cos(angle) * config.radiusX;
    const y = Math.sin(angle) * config.radiusY;

    if (bodyRef.current) {
      bodyRef.current.position.set(x, y, 0.035 + bodyIndex * 0.01);
      bodyRef.current.scale.setScalar(scale);
      const currentMaterial = bodyRef.current.material as THREE.MeshBasicMaterial;
      currentMaterial.opacity = opacity;
    }

    if (haloRef.current) {
      haloRef.current.position.set(x, y, 0.03);
      haloRef.current.scale.setScalar(scale * 1.28);
      const currentMaterial = haloRef.current.material as THREE.MeshBasicMaterial;
      currentMaterial.opacity = 0.22 + depth * 0.18;
    }

    tailRefs.current.forEach((tail, index) => {
      if (!tail) return;
      const trailAngle = angle - config.direction * (index + 1) * 0.13;
      const trailDepth = (Math.sin(trailAngle) + 1) / 2;
      tail.position.set(Math.cos(trailAngle) * config.radiusX, Math.sin(trailAngle) * config.radiusY, -0.02 - index * 0.003);
      tail.scale.setScalar(scale * (0.5 - index * 0.095));
      const currentMaterial = tail.material as THREE.MeshBasicMaterial;
      currentMaterial.opacity = (0.34 - index * 0.055) * (0.62 + trailDepth * 0.38);
    });
  });

  return (
    <>
      <mesh ref={haloRef}>
        <sphereGeometry args={[body.size * 1.8, 18, 18]} />
        <meshBasicMaterial color={body.color} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={bodyRef}>
        <sphereGeometry args={[body.size, 24, 24]} />
        <meshBasicMaterial color={body.color} transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {Array.from({ length: 4 }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            tailRefs.current[index] = node;
          }}
        >
          <sphereGeometry args={[body.size * 0.45, 14, 14]} />
          <meshBasicMaterial color={body.color} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function BackgroundStars() {
  const pointsRef = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => {
    const count = 380;
    const positionData = new Float32Array(count * 3);
    const colorData = new Float32Array(count * 3);
    const palette = [new THREE.Color("#bfdbfe"), new THREE.Color("#7dd3fc"), new THREE.Color("#60a5fa"), new THREE.Color("#f8fafc")];

    for (let index = 0; index < count; index += 1) {
      const radius = 1.4 + Math.random() * 3.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positionData[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positionData[index * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius * 0.78;
      positionData[index * 3 + 2] = Math.cos(phi) * radius;
      const color = palette[index % palette.length];
      colorData[index * 3] = color.r;
      colorData[index * 3 + 1] = color.g;
      colorData[index * 3 + 2] = color.b;
    }

    return { positions: positionData, colors: colorData };
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.018;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.14) * 0.035;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.013} vertexColors transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

export default function ParticleGalaxyCore() {
  return (
    <div className="particle-galaxy-core" aria-label="多维职业匹配粒子星体球">
      <Canvas camera={{ position: [0, 0, 5.2], fov: 46 }} dpr={[1, 1.65]} gl={{ antialias: true, alpha: true }}>
        <GalaxyScene />
      </Canvas>
      <div className="particle-galaxy-label">
        <span>Career Intelligence Core</span>
        <strong>多维职业匹配引擎</strong>
      </div>
    </div>
  );
}
