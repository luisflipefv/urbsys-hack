import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import type { BlockLevel } from '@/lib/interventions';
import {
  BANDS,
  CORE_HALF_LENGTH,
  LOOP_HALF_LENGTH,
  ROAD_TOP,
  SIDEWALK_TOP,
  createRandom,
  horizontalHalfWidthOf,
  verticalHalfWidthOf,
} from './cityLayout';

type Axis = 'x' | 'z';
type Side = 1 | -1;

interface Pedestrian {
  axis: Axis;
  band: number;
  side: Side;
  dir: Side;
  pos: number;
  jitter: number;
  speed: number;
  phase: number;
  shirtColor: string;
  pantsColor: string;
  skinColor: string;
}

const SHIRT_COLORS = [
  '#38bdf8',
  '#fbbf24',
  '#34d399',
  '#f472b6',
  '#a78bfa',
  '#fb7185',
  '#f8fafc',
  '#fb923c',
  '#2dd4bf',
];
const PANTS_COLORS = ['#1e293b', '#334155', '#1e3a8a', '#3f3f46', '#0f172a'];
const SKIN_COLORS = ['#fde68a', '#fed7aa', '#f59e0b', '#d97706', '#92400e'];
const WALK_BANDS = [-18, -9, 0, 9, 18];

function isCrossingRoad(axis: Axis, pos: number, lateral: number): boolean {
  for (const b of BANDS) {
    const hw =
      axis === 'x'
        ? verticalHalfWidthOf(b, lateral < 0)
        : horizontalHalfWidthOf(b);
    if (Math.abs(pos - b) < hw) {
      return true;
    }
  }
  return false;
}

function computeLateral(axis: Axis, band: number, side: Side, pos: number, jitter: number): number {
  if (axis === 'x') {
    const hw = horizontalHalfWidthOf(band);
    return band + side * (hw + 0.42) + jitter;
  }
  const hw = verticalHalfWidthOf(band, pos < 0);
  return band + side * (hw + 0.42) + jitter;
}

function createPedestrians(): Pedestrian[] {
  const random = createRandom(31415);
  const list: Pedestrian[] = [];
  const axes: Axis[] = ['x', 'z'];
  const sides: Side[] = [-1, 1];

  for (const axis of axes) {
    for (const band of WALK_BANDS) {
      const countPerSide = band === 0 ? 6 : 2;
      for (const side of sides) {
        for (let i = 0; i < countPerSide; i++) {
          const dir: Side = random() < 0.5 ? 1 : -1;
          const jitter = (random() - 0.5) * 0.2;
          list.push({
            axis,
            band,
            side,
            dir,
            pos: (random() * 2 - 1) * (LOOP_HALF_LENGTH - 2),
            jitter,
            speed: 1.05 + random() * 0.55,
            phase: random() * Math.PI * 2,
            shirtColor: SHIRT_COLORS[Math.floor(random() * SHIRT_COLORS.length)],
            pantsColor: PANTS_COLORS[Math.floor(random() * PANTS_COLORS.length)],
            skinColor: SKIN_COLORS[Math.floor(random() * SKIN_COLORS.length)],
          });
        }
      }
    }
  }

  return list;
}

interface PedestriansProps {
  active: boolean;
  level: BlockLevel;
}

export function Pedestrians({ active }: PedestriansProps) {
  const pedestrians = useMemo(createPedestrians, []);
  const groupRefs = useRef<(Group | null)[]>([]);
  const leftLegRefs = useRef<(Mesh | null)[]>([]);
  const rightLegRefs = useRef<(Mesh | null)[]>([]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;

    pedestrians.forEach((ped, index) => {
      const node = groupRefs.current[index];
      if (!node) return;

      const nearWork = active && ped.band === 0 && Math.abs(ped.pos) < CORE_HALF_LENGTH * 0.82;
      if (nearWork && Math.abs(ped.pos) > 5.5) {
        if ((ped.pos > 0 && ped.dir === -1) || (ped.pos < 0 && ped.dir === 1)) {
          ped.dir = (ped.dir === 1 ? -1 : 1) as Side;
        }
      }

      const speedMult = nearWork ? 0.65 : 1;
      ped.pos += ped.dir * ped.speed * speedMult * dt;

      if (ped.pos > LOOP_HALF_LENGTH) ped.pos -= LOOP_HALF_LENGTH * 2;
      if (ped.pos < -LOOP_HALF_LENGTH) ped.pos += LOOP_HALF_LENGTH * 2;

      const lateral = computeLateral(ped.axis, ped.band, ped.side, ped.pos, ped.jitter);
      const onRoad = isCrossingRoad(ped.axis, ped.pos, lateral);
      const baseY = onRoad ? ROAD_TOP : SIDEWALK_TOP;

      const strideAngle = t * ped.speed * 7.5 + ped.phase;
      const bounce = Math.abs(Math.sin(strideAngle)) * 0.035;

      if (ped.axis === 'x') {
        node.position.set(ped.pos, baseY + bounce, lateral);
        node.rotation.y = ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        // Quando o pedestre caminha na faixa central (band === 0) ao sul da Av. Vitória (pos > 0), acompanha a calçada diagonal da R. Anselmo Serrate ao lado da FAESA
        let worldX = lateral;
        let yaw = ped.dir === 1 ? 0 : Math.PI;
        if (ped.band === 0 && ped.pos > 0) {
          const slope = ped.pos <= 18 ? -8.4 / 18 : (-14.5 - -8.4) / 18;
          const diagOffset = ped.pos <= 18 ? ped.pos * slope : -8.4 + (ped.pos - 18) * slope;
          worldX += diagOffset;
          const diagAngle = Math.atan2(slope, 1);
          yaw = ped.dir === 1 ? diagAngle : diagAngle + Math.PI;
        }
        node.position.set(worldX, baseY + bounce, ped.pos);
        node.rotation.y = yaw;
      }

      const legSwing = Math.sin(strideAngle) * 0.5;
      const leftLeg = leftLegRefs.current[index];
      const rightLeg = rightLegRefs.current[index];
      if (leftLeg) leftLeg.rotation.x = legSwing;
      if (rightLeg) rightLeg.rotation.x = -legSwing;
    });
  });

  return (
    <group>
      {pedestrians.map((ped, index) => (
        <group
          key={index}
          ref={(node) => {
            groupRefs.current[index] = node;
          }}
        >
          {/* Perna esquerda */}
          <mesh
            ref={(mesh) => {
              leftLegRefs.current[index] = mesh;
            }}
            position={[-0.055, 0.12, 0]}
            castShadow
          >
            <boxGeometry args={[0.07, 0.22, 0.07]} />
            <meshStandardMaterial color={ped.pantsColor} roughness={0.8} />
          </mesh>

          {/* Perna direita */}
          <mesh
            ref={(mesh) => {
              rightLegRefs.current[index] = mesh;
            }}
            position={[0.055, 0.12, 0]}
            castShadow
          >
            <boxGeometry args={[0.07, 0.22, 0.07]} />
            <meshStandardMaterial color={ped.pantsColor} roughness={0.8} />
          </mesh>

          {/* Tronco / Roupa */}
          <mesh position={[0, 0.34, 0]} castShadow>
            <boxGeometry args={[0.2, 0.26, 0.13]} />
            <meshStandardMaterial color={ped.shirtColor} roughness={0.6} />
          </mesh>

          {/* Cabeça */}
          <mesh position={[0, 0.56, 0]} castShadow>
            <sphereGeometry args={[0.095, 10, 10]} />
            <meshStandardMaterial color={ped.skinColor} roughness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
