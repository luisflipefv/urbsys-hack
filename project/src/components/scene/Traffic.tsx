import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { Line2 } from 'three-stdlib';
import type { BlockLevel } from '@/lib/interventions';
import {
  DIAGONAL_ROADS,
  LANE_OFFSET,
  LANE_OUTER_OFFSET,
  LOOP_HALF_LENGTH,
  MARECHAL_LANE_OFFSET,
  QUEUE_HALF_LENGTH,
  ROAD_TOP,
  STREET_LANE_OFFSET,
  createRandom,
  type Pt2,
} from './cityLayout';

type Axis = 'x' | 'z' | 'diag';
type Side = 1 | -1;
type Vec3 = [number, number, number];

const CORNER_RADIUS = 1.35;

interface WorldSample {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

interface SmoothWorldPath {
  samples: Array<WorldSample & { s: number }>;
  totalLen: number;
  entryU: number;
  exitU: number;
}

/** Calcula o deslocamento X do eixo central da R. Anselmo Serrate (diagonal para z > 0, reto na Av. Mal. Campos para z <= 0) */
export function anselmoCenterX(worldZ: number): { x: number; dxDz: number } {
  if (worldZ <= 0) {
    return { x: 0, dxDz: 0 };
  }
  if (worldZ <= 18) {
    const slope = -8.4 / 18;
    return { x: worldZ * slope, dxDz: slope };
  }
  const slope2 = (-14.5 - -8.4) / 18;
  return { x: -8.4 + (worldZ - 18) * slope2, dxDz: slope2 };
}

/**
 * Constrói uma curva suave parametrizada por comprimento de arco em coordenadas globais (x, z)
 * arredondando todas as esquinas (inclusive ângulos diagonais) com curvas de Bézier quadráticas.
 */
function buildSmoothWorldPath(
  waypoints: Pt2[],
  cornerRadius: number,
  entryU: number,
  exitU: number,
): SmoothWorldPath {
  const rawPts: Pt2[] = [];
  const n = waypoints.length;

  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) {
      rawPts.push(waypoints[i]);
      continue;
    }

    const prev = waypoints[i - 1];
    const cur = waypoints[i];
    const next = waypoints[i + 1];

    const vInX = cur[0] - prev[0];
    const vInZ = cur[1] - prev[1];
    const lenIn = Math.hypot(vInX, vInZ) || 1;

    const vOutX = next[0] - cur[0];
    const vOutZ = next[1] - cur[1];
    const lenOut = Math.hypot(vOutX, vOutZ) || 1;

    const d = Math.min(cornerRadius, lenIn * 0.4, lenOut * 0.4);
    const ax = cur[0] - (vInX / lenIn) * d;
    const az = cur[1] - (vInZ / lenIn) * d;
    const bx = cur[0] + (vOutX / lenOut) * d;
    const bz = cur[1] + (vOutZ / lenOut) * d;

    const arcSteps = 12;
    for (let s = 0; s <= arcSteps; s++) {
      const t = s / arcSteps;
      const omt = 1 - t;
      const px = omt * omt * ax + 2 * omt * t * cur[0] + t * t * bx;
      const pz = omt * omt * az + 2 * omt * t * cur[1] + t * t * bz;
      rawPts.push([px, pz]);
    }
  }

  // Subdivide segmentos retos longos para amostragem uniforme
  const densePts: Pt2[] = [rawPts[0]];
  for (let i = 1; i < rawPts.length; i++) {
    const [x0, z0] = densePts[densePts.length - 1];
    const [x1, z1] = rawPts[i];
    const segLen = Math.hypot(x1 - x0, z1 - z0);
    if (segLen < 1e-4) continue;
    const sub = Math.max(1, Math.ceil(segLen / 0.4));
    for (let k = 1; k <= sub; k++) {
      const t = k / sub;
      densePts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
    }
  }

  const samples: Array<WorldSample & { s: number }> = [];
  let accS = 0;
  for (let i = 0; i < densePts.length; i++) {
    if (i > 0) {
      accS += Math.hypot(densePts[i][0] - densePts[i - 1][0], densePts[i][1] - densePts[i - 1][1]);
    }
    const prev = densePts[Math.max(0, i - 1)];
    const next = densePts[Math.min(densePts.length - 1, i + 1)];
    const tx = next[0] - prev[0];
    const tz = next[1] - prev[1];
    const tLen = Math.hypot(tx, tz) || 1;
    samples.push({
      x: densePts[i][0],
      z: densePts[i][1],
      dx: tx / tLen,
      dz: tz / tLen,
      s: accS,
    });
  }

  return {
    samples,
    totalLen: accS,
    entryU,
    exitU,
  };
}

function sampleSmoothPath(path: SmoothWorldPath, dist: number): WorldSample {
  const { samples, totalLen } = path;
  if (samples.length === 0) return { x: 0, z: 0, dx: 1, dz: 0 };
  if (dist <= 0) return samples[0];
  if (dist >= totalLen) return samples[samples.length - 1];

  let lo = 0;
  let hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].s <= dist) lo = mid;
    else hi = mid;
  }

  const a = samples[lo];
  const b = samples[hi];
  const span = Math.max(1e-5, b.s - a.s);
  const t = (dist - a.s) / span;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    dx: a.dx + (b.dx - a.dx) * t,
    dz: a.dz + (b.dz - a.dz) * t,
  };
}

/**
 * Define os waypoints reais de desvio adaptados às ruas diagonais ao redor da FAESA:
 * - Eixo X (side = +1, Av. Vitória sentido Leste): desvia pela diagonal R. Leoni Souza Guedes -> R. Aluysio Simões -> R. Camilo Gianordoli
 * - Eixo X (side = -1, Av. Vitória sentido Oeste): desvia pela R. Camilo Gianordoli -> faixa z = -8.6 -> diagonal R. Gilberto Paixão
 * - Eixo Z (side = +1, Av. Mal. Campos -> R. Anselmo Serrate): desvia antes da FAESA em z = -8.6 -> R. Camilo Gianordoli -> R. Aluysio Simões -> reentra na diagonal da R. Anselmo Serrate ao sul da FAESA
 * - Eixo Z (side = -1, R. Anselmo Serrate -> Av. Mal. Campos): desvia na R. Aluysio Simões (z = 9.2, antes do trecho bloqueado ao lado da FAESA) -> R. Camilo Gianordoli -> z = -9.2 -> Av. Mal. Campos
 */
function createDetourPathForLane(axis: 'x' | 'z', side: Side, laneW: number): SmoothWorldPath {
  if (axis === 'x' && side === 1) {
    // Sentido Leste na Av. Vitória: desce pela diagonal R. Leoni Souza Guedes (-7.8, 0) -> (-11.43, 8.6)
    const entryU = -9.4;
    const exitU = 10.6;
    const leoniTopX = -7.8 + (laneW / 18) * -7.6;
    const leoniBotX = -7.8 + (8.6 / 18) * -7.6;
    return buildSmoothWorldPath(
      [
        [entryU, laneW],
        [leoniTopX, laneW],
        [leoniBotX, 8.6],
        [8.8, 8.6],
        [8.8, laneW],
        [exitU, laneW],
      ],
      CORNER_RADIUS,
      entryU,
      exitU,
    );
  }

  if (axis === 'x' && side === -1) {
    // Sentido Oeste na Av. Vitória: sobe pela R. Camilo Gianordoli (9.0), segue por z = -8.6 e desce pela diagonal R. Gilberto Paixão (-9, -9) -> (-7.8, 0)
    const entryU = -10.6; // worldX = +10.6
    const exitU = 9.4; // worldX = -9.4
    const gilbertoBotX = -7.8 - (laneW / 9.0) * 1.2;
    return buildSmoothWorldPath(
      [
        [10.6, -laneW],
        [9.0, -laneW],
        [9.0, -8.6],
        [-8.9, -8.6],
        [gilbertoBotX, -laneW],
        [-9.4, -laneW],
      ],
      CORNER_RADIUS,
      entryU,
      exitU,
    );
  }

  if (axis === 'z' && side === 1) {
    // Sentido Sul (Av. Mal. Campos -> R. Anselmo Serrate): contorna o trecho bloqueado ao lado da FAESA (z = 0..9)
    const entryU = -10.4; // worldZ = -10.4
    const exitU = 10.6; // worldZ = +10.6 (já ao sul da R. Aluysio Simões)
    const anselmoReentryX = anselmoCenterX(8.6).x + laneW;
    const anselmoExitX = anselmoCenterX(exitU).x + laneW;
    return buildSmoothWorldPath(
      [
        [laneW, entryU],
        [laneW, -8.6],
        [8.6, -8.6],
        [8.6, 8.6],
        [anselmoReentryX, 8.6],
        [anselmoExitX, exitU],
      ],
      CORNER_RADIUS,
      entryU,
      exitU,
    );
  }

  // Sentido Norte (R. Anselmo Serrate -> Av. Mal. Campos): desvia na R. Aluysio Simões (z = 9.2) sem passar pelo trecho bloqueado ao lado da FAESA
  const entryU = -10.6; // worldZ = +10.6
  const exitU = 10.6; // worldZ = -10.6
  const anselmoStartX = anselmoCenterX(10.6).x - laneW;
  const anselmoTurnX = anselmoCenterX(9.2).x - laneW;
  return buildSmoothWorldPath(
    [
      [anselmoStartX, 10.6],
      [anselmoTurnX, 9.2],
      [9.4, 9.2],
      [9.4, -9.2],
      [-laneW, -9.2],
      [-laneW, -10.6],
    ],
    CORNER_RADIUS,
    entryU,
    exitU,
  );
}

function DetourRouteLine({ axis, side }: { axis: 'x' | 'z'; side: Side }) {
  const dashedLineRef = useRef<Line2>(null);
  const laneW = axis === 'x' ? (LANE_OFFSET + LANE_OUTER_OFFSET) / 2 : MARECHAL_LANE_OFFSET * 0.75;
  const y = ROAD_TOP + 0.032;

  const { points, entryPt, exitPt } = useMemo(() => {
    const path = createDetourPathForLane(axis, side, laneW);
    const pts: Vec3[] = path.samples.map((s) => [s.x, y, s.z]);
    const first = path.samples[0];
    const last = path.samples[path.samples.length - 1];
    return {
      points: pts,
      entryPt: [first.x, y + 0.002, first.z] as Vec3,
      exitPt: [last.x, y + 0.002, last.z] as Vec3,
    };
  }, [axis, side, laneW, y]);

  useFrame((_, delta) => {
    if (dashedLineRef.current?.material) {
      dashedLineRef.current.material.dashOffset -= delta * 3.2;
    }
  });

  return (
    <group>
      {/* Trilha base luminosa do desvio seguindo as ruas diagonais */}
      <Line points={points} color="#0ea5e9" lineWidth={6} transparent opacity={0.28} />
      {/* Linha tracejada animada indicando o sentido do fluxo */}
      <Line
        ref={dashedLineRef}
        points={points}
        color="#38bdf8"
        lineWidth={2.6}
        dashed
        dashScale={1}
        dashSize={0.85}
        gapSize={0.55}
      />
      {/* Marcadores de início e retorno do desvio */}
      {[entryPt, exitPt].map((pt, idx) => (
        <mesh key={idx} position={pt} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.34, 20]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      ))}
    </group>
  );
}

function DetourRoutes({ level }: { level: BlockLevel }) {
  return (
    <group>
      {/* Desvio Sul da Av. Vitória pela diagonal R. Leoni Souza Guedes */}
      <DetourRouteLine axis="x" side={1} />
      {level === 'total' && (
        <>
          {/* Desvio Norte da Av. Vitória pela diagonal R. Gilberto Paixão */}
          <DetourRouteLine axis="x" side={-1} />
          {/* Desvio do eixo Av. Marechal Campos ↔ R. Anselmo Serrate contornando a FAESA */}
          <DetourRouteLine axis="z" side={1} />
        </>
      )}
    </group>
  );
}

function lerpAngle(current: number, target: number, t: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

interface Vehicle {
  axis: Axis;
  side: Side;
  laneIndex: 0 | 1;
  targetLaneW: number;
  kind: 'car' | 'bus';
  color: string;
  u: number;
  w: number;
  baseSpeed: number;
  speed: number;
  onDetour: boolean;
  detourDist: number;
  detourPath: SmoothWorldPath;
  heading: number;
  diagRoadIndex?: number;
  diagLength?: number;
}

const CAR_COLORS = ['#e2e8f0', '#60a5fa', '#34d399', '#f472b6', '#94a3b8', '#a78bfa', '#f1f5f9'];
const BUS_COLORS = ['#0d9488', '#0ea5e9'];
const SIZES = {
  car: { length: 1.5, width: 0.7, height: 0.6 },
  bus: { length: 2.8, width: 0.9, height: 1.0 },
};

function initialHeading(axis: 'x' | 'z', side: Side): number {
  const dx = axis === 'x' ? side : 0;
  const dz = axis === 'z' ? side : 0;
  return Math.atan2(-dz, dx);
}

function createVehicles(): Vehicle[] {
  const random = createRandom(99);
  const vehicles: Vehicle[] = [];
  const sides: Side[] = [1, -1];
  const span = LOOP_HALF_LENGTH * 2;

  // 1. Fluxo intenso em Pista Dupla (2 faixas por sentido) na Av. Vitória (eixo X)
  const avLanes: Array<{ laneIndex: 0 | 1; offset: number; count: number }> = [
    { laneIndex: 0, offset: LANE_OFFSET, count: 9 },
    { laneIndex: 1, offset: LANE_OUTER_OFFSET, count: 9 },
  ];

  for (const side of sides) {
    for (const lane of avLanes) {
      const detourPath = createDetourPathForLane('x', side, lane.offset);
      for (let i = 0; i < lane.count; i++) {
        const isBus = lane.laneIndex === 1 ? random() < 0.28 : random() < 0.08;
        const baseSpeed = isBus ? 2.4 + random() * 0.5 : 3.3 + random() * 1.2;
        const slotU = -LOOP_HALF_LENGTH + ((i + 0.5) / lane.count) * span + (random() - 0.5) * 1.1;
        vehicles.push({
          axis: 'x',
          side,
          laneIndex: lane.laneIndex,
          targetLaneW: lane.offset,
          kind: isBus ? 'bus' : 'car',
          color: isBus
            ? BUS_COLORS[Math.floor(random() * BUS_COLORS.length)]
            : CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
          u: slotU,
          w: lane.offset,
          baseSpeed,
          speed: baseSpeed,
          onDetour: false,
          detourDist: 0,
          detourPath,
          heading: initialHeading('x', side),
        });
      }
    }
  }

  // 2. Fluxo no eixo Av. Marechal Campos (norte, z < 0) ↔ R. Anselmo Serrate (diagonal ao lado da FAESA, z > 0)
  const zCount = 7;
  for (const side of sides) {
    const detourPath = createDetourPathForLane('z', side, STREET_LANE_OFFSET);
    for (let i = 0; i < zCount; i++) {
      const isBus = random() < 0.14;
      const baseSpeed = isBus ? 2.3 + random() * 0.5 : 3.0 + random() * 1.1;
      const slotU = -LOOP_HALF_LENGTH + ((i + 0.5) / zCount) * span + (random() - 0.5) * 1.2;
      const laneIndex: 0 | 1 = i % 2 === 0 ? 0 : 1;
      const worldZ = side * slotU;
      const initialW = worldZ < 0 ? (laneIndex === 0 ? 0.58 : 1.48) : STREET_LANE_OFFSET;
      vehicles.push({
        axis: 'z',
        side,
        laneIndex,
        targetLaneW: initialW,
        kind: isBus ? 'bus' : 'car',
        color: isBus
          ? BUS_COLORS[Math.floor(random() * BUS_COLORS.length)]
          : CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
        u: slotU,
        w: initialW,
        baseSpeed,
        speed: baseSpeed,
        onDetour: false,
        detourDist: 0,
        detourPath,
        heading: initialHeading('z', side),
      });
    }
  }

  // 3. Veículos trafegando pelas demais ruas em diagonal (R. Leoni Souza Guedes, R. Prof. Arnaud Cabral, R. Bruno Becacici)
  const activeDiagIndices = [2, 3, 4];
  const dummyPath = createDetourPathForLane('x', 1, LANE_OFFSET);
  for (const diagIdx of activeDiagIndices) {
    const road = DIAGONAL_ROADS[diagIdx];
    const len = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
    const angle = Math.atan2(-(road.z2 - road.z1), road.x2 - road.x1);
    for (const side of sides) {
      for (let i = 0; i < 2; i++) {
        const baseSpeed = 2.6 + random() * 0.9;
        vehicles.push({
          axis: 'diag',
          side,
          laneIndex: 0,
          targetLaneW: 0.52,
          kind: 'car',
          color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
          u: ((i + 0.35) / 2) * len,
          w: 0.52,
          baseSpeed,
          speed: baseSpeed,
          onDetour: false,
          detourDist: 0,
          detourPath: dummyPath,
          heading: side === 1 ? angle : angle + Math.PI,
          diagRoadIndex: diagIdx,
          diagLength: len,
        });
      }
    }
  }

  return vehicles;
}

interface TrafficProps {
  active: boolean;
  level: BlockLevel;
}

export function Traffic({ active, level }: TrafficProps) {
  const vehicles = useMemo(createVehicles, []);
  const nodes = useRef<(Group | null)[]>([]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const total = level === 'total';

    vehicles.forEach((vehicle, index) => {
      const node = nodes.current[index];
      if (!node) return;

      // Movimentação nas ruas diagonais secundárias (R. Leoni Souza Guedes, R. Prof. Arnaud Cabral, R. Bruno Becacici)
      if (vehicle.axis === 'diag' && vehicle.diagRoadIndex !== undefined && vehicle.diagLength) {
        const road = DIAGONAL_ROADS[vehicle.diagRoadIndex];
        const len = vehicle.diagLength;
        vehicle.u += vehicle.speed * dt;
        if (vehicle.u > len) vehicle.u -= len;

        const t = vehicle.side === 1 ? vehicle.u / len : 1 - vehicle.u / len;
        const ux = (road.x2 - road.x1) / len;
        const uz = (road.z2 - road.z1) / len;
        const nx = -uz * vehicle.side;
        const nz = ux * vehicle.side;

        const worldX = road.x1 + (road.x2 - road.x1) * t + nx * vehicle.w;
        const worldZ = road.z1 + (road.z2 - road.z1) * t + nz * vehicle.w;
        const targetHeading = Math.atan2(-uz * vehicle.side, ux * vehicle.side);
        vehicle.heading = lerpAngle(vehicle.heading, targetHeading, Math.min(1, dt * 12));

        const height = SIZES[vehicle.kind].height;
        node.position.set(worldX, ROAD_TOP + height / 2, worldZ);
        node.rotation.set(0, vehicle.heading, 0);
        return;
      }

      // Em Bloqueio Total, tanto a Av. Vitória (eixo X) quanto o eixo Av. Marechal Campos ↔ R. Anselmo Serrate (eixo Z, diagonal ao lado da FAESA) são bloqueados e desviados
      const laneBlocked =
        active &&
        (vehicle.axis === 'x' ? total || vehicle.side > 0 : total);

      // Se o bloqueio da faixa foi desativado mas o veículo estava em desvio, permite concluir ou retornar suavemente
      if (!laneBlocked && vehicle.onDetour) {
        vehicle.onDetour = false;
        vehicle.u = vehicle.detourPath.exitU;
      }

      const distance = Math.abs(vehicle.u);
      const inQueue = active && distance < QUEUE_HALF_LENGTH;

      if (vehicle.axis === 'z') {
        const currentWorldZ = vehicle.side * vehicle.u;
        vehicle.targetLaneW =
          currentWorldZ < -2.2
            ? vehicle.laneIndex === 0
              ? 0.58
              : 1.48
            : STREET_LANE_OFFSET;
      }

      let speedFactor = 1;
      if (vehicle.onDetour) {
        speedFactor = 0.65;
      } else if (active) {
        speedFactor = laneBlocked ? (inQueue ? 0.68 : 1) : distance < 9.5 ? 0.72 : 1;
      }

      vehicle.speed += (vehicle.baseSpeed * speedFactor - vehicle.speed) * Math.min(1, dt * 2.5);

      let worldX = 0;
      let worldZ = 0;
      let dx = 1;
      let dz = 0;

      if (!vehicle.onDetour) {
        const prevU = vehicle.u;
        vehicle.u += vehicle.speed * dt;
        const prevW = vehicle.w;
        vehicle.w += (vehicle.targetLaneW - vehicle.w) * Math.min(1, dt * 3.8);
        const dw = (vehicle.w - prevW) / Math.max(dt * vehicle.speed, 0.001);

        const { entryU, exitU, totalLen } = vehicle.detourPath;
        const crossedEntry = prevU <= entryU && vehicle.u >= entryU;
        const insideBlockedSpan = vehicle.u >= entryU && vehicle.u <= exitU;

        if (laneBlocked && (crossedEntry || insideBlockedSpan)) {
          vehicle.onDetour = true;
          if (crossedEntry) {
            vehicle.detourDist = Math.max(0, vehicle.u - entryU);
          } else {
            // Caso o veículo já estivesse no trecho interditado (ex.: na diagonal ao lado da FAESA) quando o Bloqueio Total foi ativado, transfere-o imediatamente para o desvio
            const frac = (vehicle.u - entryU) / Math.max(0.1, exitU - entryU);
            vehicle.detourDist = Math.min(totalLen * 0.95, Math.max(0, frac * totalLen));
          }
        }

        if (vehicle.u > LOOP_HALF_LENGTH) {
          vehicle.u -= LOOP_HALF_LENGTH * 2;
        }

        if (!vehicle.onDetour) {
          if (vehicle.axis === 'x') {
            worldX = vehicle.side * vehicle.u;
            worldZ = vehicle.side * vehicle.w;
            dx = vehicle.side;
            dz = vehicle.side * dw;
          } else {
            worldZ = vehicle.side * vehicle.u;
            const { x: centerOffset, dxDz } = anselmoCenterX(worldZ);
            worldX = centerOffset + vehicle.side * vehicle.w;
            dz = vehicle.side;
            dx = dz * dxDz + vehicle.side * dw;
          }
        }
      }

      if (vehicle.onDetour) {
        const { totalLen, exitU } = vehicle.detourPath;
        vehicle.detourDist += vehicle.speed * dt;
        if (vehicle.detourDist >= totalLen) {
          vehicle.onDetour = false;
          vehicle.u = exitU + (vehicle.detourDist - totalLen);
          vehicle.w = vehicle.targetLaneW;
          if (vehicle.axis === 'x') {
            worldX = vehicle.side * vehicle.u;
            worldZ = vehicle.side * vehicle.w;
            dx = vehicle.side;
            dz = 0;
          } else {
            worldZ = vehicle.side * vehicle.u;
            const { x: centerOffset, dxDz } = anselmoCenterX(worldZ);
            worldX = centerOffset + vehicle.side * vehicle.w;
            dz = vehicle.side;
            dx = dz * dxDz;
          }
        } else {
          const sample = sampleSmoothPath(vehicle.detourPath, vehicle.detourDist);
          worldX = sample.x;
          worldZ = sample.z;
          dx = sample.dx;
          dz = sample.dz;
        }
      }

      const targetHeading = Math.atan2(-dz, dx);
      vehicle.heading = lerpAngle(vehicle.heading, targetHeading, Math.min(1, dt * 12));

      const height = SIZES[vehicle.kind].height;
      const y = ROAD_TOP + height / 2;
      node.position.set(worldX, y, worldZ);
      node.rotation.set(0, vehicle.heading, 0);
    });
  });

  return (
    <group>
      {active && <DetourRoutes level={level} />}
      {vehicles.map((vehicle, index) => {
        const size = SIZES[vehicle.kind];
        return (
          <group
            key={index}
            ref={(node) => {
              nodes.current[index] = node;
            }}
          >
            <mesh castShadow receiveShadow>
              <boxGeometry args={[size.length, size.height, size.width]} />
              <meshStandardMaterial color={vehicle.color} roughness={0.45} metalness={0.1} />
            </mesh>
            {vehicle.kind === 'car' ? (
              <mesh position={[0, size.height / 2 + 0.14, 0]}>
                <boxGeometry args={[size.length * 0.5, 0.28, size.width * 0.86]} />
                <meshStandardMaterial color="#0f172a" roughness={0.2} />
              </mesh>
            ) : (
              <mesh position={[0, size.height * 0.15, 0]}>
                <boxGeometry args={[size.length * 1.01, size.height * 0.28, size.width * 1.02]} />
                <meshStandardMaterial color="#0f172a" roughness={0.2} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
