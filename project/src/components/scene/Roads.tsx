import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { ExtrudeGeometry, Shape, Vector2 } from 'three';
import {
  AVENUE_HALF_WIDTH,
  BANDS,
  DIAGONAL_ROADS,
  MARECHAL_HALF_WIDTH,
  ROAD_LENGTH,
  ROAD_TOP,
  SIDEWALK_TOP,
  STREET_HALF_WIDTH,
  getCityParcels,
  horizontalHalfWidthOf,
  verticalHalfWidthOf,
  type Pt2,
} from './cityLayout';

const ROAD_COLOR = '#1e293b';
const GROUND_COLOR = '#0a1322';
const AVENUE_LINE_COLOR = '#e2e8f0';
const STREET_LINE_COLOR = '#94a3b8';
const YELLOW_LINE_COLOR = '#facc15';
const CURB_COLOR = '#64748b';
const SIDEWALK_COLOR = '#334155';
const CROSSWALK_BANDS = [-18, -9, 0, 9, 18];

interface StreetLabelSpec {
  name: string;
  position: [number, number, number];
  primary?: boolean;
}

const STREET_LABELS: StreetLabelSpec[] = [
  { name: 'Av. Vitória', position: [-14, ROAD_TOP + 0.15, 0], primary: true },
  { name: 'Av. Vitória', position: [14, ROAD_TOP + 0.15, 0], primary: true },
  { name: 'Av. Mal. Campos', position: [0, ROAD_TOP + 0.15, -13.5], primary: true },
  { name: 'R. Camilo Gianordoli', position: [13.5, ROAD_TOP + 0.15, -9] },
  { name: 'R. Antônio Aleixo', position: [13.5, ROAD_TOP + 0.15, -18] },
  { name: 'R. Aluysio Simões', position: [13.5, ROAD_TOP + 0.15, 9] },
  { name: 'Av. Cezar Hilal', position: [13.5, ROAD_TOP + 0.15, 18] },
  { name: 'R. João Vieira', position: [9, ROAD_TOP + 0.15, 13.5] },
  { name: 'R. Álvaro Sarlo', position: [-18, ROAD_TOP + 0.15, 9] },
  // Rótulos das ruas em diagonal reais do mapa
  ...DIAGONAL_ROADS.filter((r) => r.labelPos).map((r) => ({
    name: r.name,
    position: r.labelPos!,
  })),
];

export function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[240, 240]} />
      <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
    </mesh>
  );
}

function StreetLabels() {
  return (
    <group>
      {STREET_LABELS.map((street, index) => (
        <Html
          key={index}
          position={street.position}
          center
          zIndexRange={[3, 0]}
          wrapperClass="pointer-events-none select-none"
          style={{ pointerEvents: 'none' }}
        >
          <span
            className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide backdrop-blur-sm ${
              street.primary
                ? 'border-sky-400/40 bg-slate-900/85 text-sky-200 shadow-sm'
                : 'border-white/10 bg-slate-900/70 text-slate-300'
            }`}
          >
            {street.name}
          </span>
        </Html>
      ))}
    </group>
  );
}

interface SegmentRange {
  start: number;
  end: number;
  mid: number;
  len: number;
  dashes: number[];
}

function computeHorizontalSegments(): SegmentRange[] {
  const halfRoad = ROAD_LENGTH / 2 - 1.2;
  const stops = [-halfRoad, ...BANDS, halfRoad];
  const segments: SegmentRange[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const padA = i === 0 ? 0.5 : (a === 0 ? MARECHAL_HALF_WIDTH : STREET_HALF_WIDTH) + 0.85;
    const padB = i === stops.length - 2 ? 0.5 : (b === 0 ? MARECHAL_HALF_WIDTH : STREET_HALF_WIDTH) + 0.85;
    const start = a + padA;
    const end = b - padB;
    const len = end - start;
    if (len <= 0.8) continue;

    const count = Math.max(1, Math.round(len / 2.1));
    const step = len / count;
    const dashes: number[] = [];
    for (let j = 0; j < count; j++) {
      dashes.push(start + (j + 0.5) * step);
    }
    segments.push({ start, end, mid: (start + end) / 2, len, dashes });
  }
  return segments;
}

function computeVerticalSegments(): SegmentRange[] {
  const halfRoad = ROAD_LENGTH / 2 - 1.2;
  const stops = [-halfRoad, ...BANDS, halfRoad];
  const segments: SegmentRange[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const padA = i === 0 ? 0.5 : horizontalHalfWidthOf(a) + 0.85;
    const padB = i === stops.length - 2 ? 0.5 : horizontalHalfWidthOf(b) + 0.85;
    const start = a + padA;
    const end = b - padB;
    const len = end - start;
    if (len <= 0.8) continue;

    const count = Math.max(1, Math.round(len / 2.1));
    const step = len / count;
    const dashes: number[] = [];
    for (let j = 0; j < count; j++) {
      dashes.push(start + (j + 0.5) * step);
    }
    segments.push({ start, end, mid: (start + end) / 2, len, dashes });
  }
  return segments;
}

/**
 * Canteiro Central da Av. Vitória:
 * - Divide as duas pistas (sentido Centro ↔ sentido Jucutuquara/Goiabeiras)
 * - Inclui meio-fio, faixa gramada, árvores urbanas e ciclovia central
 */
function AvenueVitoriaMedian({ segments }: { segments: SegmentRange[] }) {
  const medianWidth = 0.44;
  const medianHeight = 0.055;

  return (
    <group>
      {segments.map((seg, idx) => {
        const treePositions =
          Math.abs(seg.mid) < 30 && seg.len >= 3.2
            ? [seg.mid - seg.len * 0.26, seg.mid + seg.len * 0.26]
            : [];

        return (
          <group key={idx}>
            {/* Meio-fio de concreto do canteiro central */}
            <mesh position={[seg.mid, ROAD_TOP + medianHeight / 2, 0]} receiveShadow castShadow>
              <boxGeometry args={[seg.len, medianHeight, medianWidth]} />
              <meshStandardMaterial color={CURB_COLOR} roughness={0.8} />
            </mesh>

            {/* Gramado no topo do canteiro central */}
            <mesh position={[seg.mid, ROAD_TOP + medianHeight + 0.004, 0]} receiveShadow>
              <boxGeometry args={[seg.len - 0.18, 0.008, medianWidth - 0.1]} />
              <meshStandardMaterial color="#1f4d3a" roughness={0.95} />
            </mesh>

            {/* Faixa da Ciclovia no canteiro central da Av. Vitória */}
            <mesh position={[seg.mid, ROAD_TOP + medianHeight + 0.01, 0]}>
              <boxGeometry args={[seg.len - 0.24, 0.006, 0.16]} />
              <meshStandardMaterial color="#b91c1c" roughness={0.75} />
            </mesh>

            {/* Linhas amarelas de bordo junto ao canteiro central */}
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[seg.mid, ROAD_TOP + 0.01, side * (medianWidth / 2 + 0.06)]}
              >
                <boxGeometry args={[seg.len, 0.014, 0.05]} />
                <meshBasicMaterial color={YELLOW_LINE_COLOR} />
              </mesh>
            ))}

            {/* Árvores urbanas do canteiro central da Av. Vitória */}
            {treePositions.map((tx, tIdx) => (
              <group key={tIdx} position={[tx, ROAD_TOP + medianHeight, 0]}>
                <mesh position={[0, 0.22, 0]} castShadow>
                  <cylinderGeometry args={[0.04, 0.055, 0.44, 8]} />
                  <meshStandardMaterial color="#573b26" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.56, 0]} castShadow>
                  <sphereGeometry args={[0.24, 10, 10]} />
                  <meshStandardMaterial color="#15803d" roughness={0.85} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Entroncamento realista da Av. Marechal Campos (Norte) chegando na Av. Vitória
 */
function MarechalCamposDetails({ verticalSegments }: { verticalSegments: SegmentRange[] }) {
  const y = ROAD_TOP + 0.01;
  const northSegments = verticalSegments.filter((seg) => seg.mid < 0);

  return (
    <group>
      {/* Leque / alça de abertura no cruzamento da Av. Mal. Campos com a Av. Vitória */}
      <mesh
        position={[-MARECHAL_HALF_WIDTH - 0.35, ROAD_TOP / 2, -AVENUE_HALF_WIDTH - 0.35]}
        rotation={[0, Math.PI / 4, 0]}
        receiveShadow
      >
        <boxGeometry args={[1.3, ROAD_TOP, 1.3]} />
        <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
      </mesh>
      <mesh
        position={[MARECHAL_HALF_WIDTH + 0.35, ROAD_TOP / 2, -AVENUE_HALF_WIDTH - 0.35]}
        rotation={[0, Math.PI / 4, 0]}
        receiveShadow
      >
        <boxGeometry args={[1.3, ROAD_TOP, 1.3]} />
        <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
      </mesh>

      {northSegments.map((seg, idx) => (
        <group key={idx}>
          {/* Dupla linha amarela contínua dividindo os sentidos da Av. Marechal Campos */}
          {[-0.06, 0.06].map((offset) => (
            <mesh key={offset} position={[offset, y, seg.mid]}>
              <boxGeometry args={[0.055, 0.015, seg.len]} />
              <meshBasicMaterial color={YELLOW_LINE_COLOR} />
            </mesh>
          ))}

          {/* Faixas tracejadas brancas dividindo as pistas internas e externas da Av. Mal. Campos */}
          {[-1.08, 1.08].map((laneX) =>
            seg.dashes.map((pz) => (
              <mesh key={`${laneX}-${pz}`} position={[laneX, y, pz]}>
                <boxGeometry args={[0.09, 0.015, 1.1]} />
                <meshBasicMaterial color={AVENUE_LINE_COLOR} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

/**
 * Ruas em diagonal (asfalto + faixas tracejadas seguindo o ângulo real de cada rua)
 */
function DiagonalRoads() {
  const yDash = ROAD_TOP + 0.011;

  return (
    <group>
      {DIAGONAL_ROADS.map((road) => {
        const dx = road.x2 - road.x1;
        const dz = road.z2 - road.z1;
        const len = Math.hypot(dx, dz);
        const cx = (road.x1 + road.x2) / 2;
        const cz = (road.z1 + road.z2) / 2;
        const angleY = Math.atan2(-dz, dx);

        // Posições dos tracejados ao longo do eixo local da rua diagonal (evitando os cruzamentos nas pontas)
        const pad = 2.1;
        const usableLen = Math.max(0, len - pad * 2);
        const dashCount = Math.max(1, Math.round(usableLen / 2.1));
        const dashOffsets: number[] = [];
        if (usableLen > 1.0) {
          for (let i = 0; i < dashCount; i++) {
            dashOffsets.push(-usableLen / 2 + ((i + 0.5) / dashCount) * usableLen);
          }
        }

        return (
          <group key={road.id} position={[cx, 0, cz]} rotation={[0, angleY, 0]}>
            {/* Pista de asfalto da rua diagonal */}
            <mesh position={[0, ROAD_TOP / 2, 0]} receiveShadow>
              <boxGeometry args={[len + 1.2, ROAD_TOP, road.width]} />
              <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
            </mesh>

            {/* Faixas tracejadas centrais da rua diagonal */}
            {dashOffsets.map((u, idx) => (
              <mesh key={idx} position={[u, yDash, 0]}>
                <boxGeometry args={[1.05, 0.015, 0.1]} />
                <meshBasicMaterial color={STREET_LINE_COLOR} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Verifica se um segmento ortogonal foi substituído pelas vias diagonais reais */
function isReplacedVerticalSegment(bandX: number, midZ: number): boolean {
  // No lado Sul (z > 0), x = 0 e x = -9 dão lugar às diagonais R. Anselmo Serrate e R. Leoni Souza Guedes
  if (bandX === 0 && midZ > 0) return true;
  if (bandX === -9 && midZ > 0 && midZ < 36) return true;
  // No setor Noroeste (-18 < z < 0), x = -9 e x = -18 dão lugar às diagonais R. Prof. Arnaud Cabral, R. Bruno Becacici e R. Gilberto Paixão
  if ((bandX === -9 || bandX === -18) && midZ < 0 && midZ > -18) return true;
  return false;
}

function isReplacedHorizontalDash(bandZ: number, px: number): boolean {
  // Na faixa z = -9 a oeste da R. Gilberto Paixão (-27 < x < -9.5), o traçado é cortado pelas diagonais R. Prof. Arnaud Cabral e R. Bruno Becacici
  if (bandZ === -9 && px > -26 && px < -9.5) return true;
  return false;
}

function RoadDashes({
  horizontalSegments,
  verticalSegments,
}: {
  horizontalSegments: SegmentRange[];
  verticalSegments: SegmentRange[];
}) {
  const y = ROAD_TOP + 0.01;

  return (
    <group>
      {/* 1. Faixas tracejadas nas duas pistas da Av. Vitória (z = 0, duas faixas por sentido) */}
      {horizontalSegments.map((seg, idx) => (
        <group key={`av-vitoria-${idx}`}>
          {[-1.48, 1.48].map((laneZ) =>
            seg.dashes.map((px) => (
              <mesh key={`${laneZ}-${px}`} position={[px, y, laneZ]}>
                <boxGeometry args={[1.35, 0.016, 0.11]} />
                <meshBasicMaterial color={AVENUE_LINE_COLOR} />
              </mesh>
            )),
          )}
        </group>
      ))}

      {/* 2. Faixas tracejadas nas demais ruas horizontais */}
      {BANDS.filter((b) => b !== 0).map((bandZ) => (
        <group key={`hz-${bandZ}`}>
          {horizontalSegments.map((seg, sIdx) =>
            seg.dashes
              .filter((px) => !isReplacedHorizontalDash(bandZ, px))
              .map((px) => (
                <mesh key={`${sIdx}-${px}`} position={[px, y, bandZ]}>
                  <boxGeometry args={[1.05, 0.015, 0.1]} />
                  <meshBasicMaterial color={STREET_LINE_COLOR} />
                </mesh>
              )),
          )}
        </group>
      ))}

      {/* 3. Faixas tracejadas nas ruas verticais (exceto nos trechos substituídos pelas diagonais reais) */}
      {BANDS.filter((b) => b !== 0).map((bandX) => (
        <group key={`vt-${bandX}`}>
          {verticalSegments
            .filter((seg) => !isReplacedVerticalSegment(bandX, seg.mid))
            .map((seg, sIdx) =>
              seg.dashes.map((pz) => (
                <mesh key={`${sIdx}-${pz}`} position={[bandX, y, pz]}>
                  <boxGeometry args={[0.1, 0.015, 1.05]} />
                  <meshBasicMaterial color={STREET_LINE_COLOR} />
                </mesh>
              )),
            )}
        </group>
      ))}
    </group>
  );
}

function Crosswalks() {
  const y = ROAD_TOP + 0.012;
  const avStripes = [-2.2, -1.65, -1.1, -0.55, 0.55, 1.1, 1.65, 2.2];
  const marechalStripes = [-1.6, -1.05, -0.5, 0.5, 1.05, 1.6];

  return (
    <group>
      {/* Faixas de pedestres atravessando a Av. Vitória (z = 0) nos cruzamentos principais */}
      {CROSSWALK_BANDS.map((bandX) => {
        const edgeX = (bandX === 0 ? MARECHAL_HALF_WIDTH : STREET_HALF_WIDTH) + 0.45;
        return (
          <group key={`cw-av-${bandX}`}>
            {[-1, 1].map((dir) => (
              <group key={dir}>
                {avStripes.map((stripeZ) => (
                  <mesh key={stripeZ} position={[bandX + dir * edgeX, y, stripeZ]}>
                    <boxGeometry args={[0.58, 0.015, 0.26]} />
                    <meshBasicMaterial color="#e2e8f0" />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        );
      })}

      {/* Faixas de pedestres atravessando a Av. Marechal Campos (norte, z < 0) */}
      {[-18, -9, 0].map((bandZ) => {
        const edgeZ = horizontalHalfWidthOf(bandZ) + 0.45;
        return (
          <group key={`cw-vt-${bandZ}`}>
            <group>
              {marechalStripes.map((stripeX) => (
                <mesh key={stripeX} position={[stripeX, y, bandZ - edgeZ]}>
                  <boxGeometry args={[0.26, 0.015, 0.58]} />
                  <meshBasicMaterial color="#e2e8f0" />
                </mesh>
              ))}
            </group>
          </group>
        );
      })}
    </group>
  );
}

function extrudePolygon2D(poly: Pt2[], depth: number): ExtrudeGeometry {
  const shape = new Shape(poly.map(([x, z]) => new Vector2(x, -z)));
  const geom = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  return geom;
}

function Sidewalks() {
  const meshes = useMemo(() => {
    const parcels = getCityParcels();
    return parcels.map((parcel) => ({
      key: parcel.key,
      curbGeom: extrudePolygon2D(parcel.curbPoly, SIDEWALK_TOP),
      pavingGeom:
        parcel.pavingPoly.length >= 3 ? extrudePolygon2D(parcel.pavingPoly, 0.008) : null,
    }));
  }, []);

  return (
    <group>
      {meshes.map((item, idx) => (
        <group key={`${item.key}-${idx}`}>
          {/* Meio-fio / Base poligonal da calçada (acompanha perfeitamente as ruas em diagonal) */}
          <mesh geometry={item.curbGeom} receiveShadow>
            <meshStandardMaterial color={CURB_COLOR} roughness={0.85} />
          </mesh>
          {/* Piso interno da calçada */}
          {item.pavingGeom && (
            <mesh geometry={item.pavingGeom} position={[0, SIDEWALK_TOP, 0]} receiveShadow>
              <meshStandardMaterial color={SIDEWALK_COLOR} roughness={0.92} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

interface TrafficLightSpec {
  x: number;
  z: number;
  rotationY: number;
  activeLight: 'red' | 'yellow' | 'green';
}

function SignalBox({
  position,
  activeLight,
}: {
  position: [number, number, number];
  activeLight: 'red' | 'yellow' | 'green';
}) {
  const lamps: Array<{ key: 'red' | 'yellow' | 'green'; y: number; color: string }> = [
    { key: 'red', y: 0.15, color: '#ef4444' },
    { key: 'yellow', y: 0, color: '#f59e0b' },
    { key: 'green', y: -0.15, color: '#10b981' },
  ];

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.52, 0.18]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.3} />
      </mesh>
      {lamps.map((lamp) => {
        const isLit = lamp.key === activeLight;
        return (
          <group key={lamp.key}>
            <mesh position={[0.095, lamp.y, 0]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshStandardMaterial
                color={isLit ? lamp.color : '#1e293b'}
                emissive={isLit ? lamp.color : '#000000'}
                emissiveIntensity={isLit ? 1.8 : 0}
              />
            </mesh>
            <mesh position={[-0.095, lamp.y, 0]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshStandardMaterial
                color={isLit ? lamp.color : '#1e293b'}
                emissive={isLit ? lamp.color : '#000000'}
                emissiveIntensity={isLit ? 1.8 : 0}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function TrafficLights() {
  const lights = useMemo<TrafficLightSpec[]>(() => {
    const list: TrafficLightSpec[] = [];
    const mainIntersections = [-18, -9, 0, 9, 18];

    // Semáforos ao longo da Av. Vitória (z = 0)
    mainIntersections.forEach((ix, idx) => {
      const rxNorth = verticalHalfWidthOf(ix, true) + 0.28;
      const rxSouth = verticalHalfWidthOf(ix, false) + 0.28;
      const rz = AVENUE_HALF_WIDTH + 0.28;
      const lightA: 'red' | 'yellow' | 'green' = idx % 2 === 0 ? 'green' : 'red';
      const lightB: 'red' | 'yellow' | 'green' = idx === 2 ? 'yellow' : idx % 2 === 0 ? 'green' : 'red';

      list.push({ x: ix + rxSouth, z: rz, rotationY: Math.PI / 2, activeLight: lightA });
      list.push({ x: ix - rxNorth, z: -rz, rotationY: -Math.PI / 2, activeLight: lightB });
    });

    // Semáforos na Av. Marechal Campos (norte, z < 0)
    [-18, -9].forEach((iz, idx) => {
      const rx = MARECHAL_HALF_WIDTH + 0.28;
      const rz = horizontalHalfWidthOf(iz) + 0.28;
      const lightState: 'red' | 'yellow' | 'green' = idx % 2 === 0 ? 'red' : 'green';

      list.push({ x: rx, z: iz - rz, rotationY: Math.PI, activeLight: lightState });
      list.push({ x: -rx, z: iz + rz, rotationY: 0, activeLight: lightState });
    });

    // Semáforo do entroncamento da Av. Marechal Campos chegando na Av. Vitória
    list.push({
      x: MARECHAL_HALF_WIDTH + 0.32,
      z: -AVENUE_HALF_WIDTH - 0.32,
      rotationY: Math.PI,
      activeLight: 'red',
    });

    return list;
  }, []);

  return (
    <group>
      {lights.map((item, index) => (
        <group key={index} position={[item.x, SIDEWALK_TOP, item.z]} rotation={[0, item.rotationY, 0]}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.11, 0.24, 10]} />
            <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.35, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 2.6, 10]} />
            <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh position={[0, 2.52, 0.65]} castShadow>
            <boxGeometry args={[0.07, 0.07, 1.35]} />
            <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.35} />
          </mesh>
          <SignalBox position={[0, 2.32, 1.22]} activeLight={item.activeLight} />
          <SignalBox position={[0, 1.48, 0.12]} activeLight={item.activeLight} />
        </group>
      ))}
    </group>
  );
}

export function Roads() {
  const horizontalSegments = useMemo(computeHorizontalSegments, []);
  const verticalSegments = useMemo(computeVerticalSegments, []);
  const halfRoadLen = ROAD_LENGTH / 2;

  return (
    <group>
      {/* 1. Vias Horizontais: Av. Vitória (z = 0, pista dupla larga) + coletoras Leste/Sul */}
      {BANDS.map((bandZ) => {
        const width = horizontalHalfWidthOf(bandZ) * 2;
        // Em z = -9 no quadrante Noroeste (-27..-9), a rua é diagonal (R. Prof. Arnaud Cabral), mas de -9 até +45 conecta R. Gilberto Paixão à Av. Mal. Campos e R. Camilo Gianordoli
        if (bandZ === -9) {
          return (
            <group key={`hz-road-${bandZ}`}>
              <mesh position={[18, ROAD_TOP / 2, bandZ]} receiveShadow>
                <boxGeometry args={[54, ROAD_TOP, width]} />
                <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
              </mesh>
              <mesh position={[-36, ROAD_TOP / 2, bandZ]} receiveShadow>
                <boxGeometry args={[18, ROAD_TOP, width]} />
                <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
              </mesh>
            </group>
          );
        }
        return (
          <mesh key={`hz-road-${bandZ}`} position={[0, ROAD_TOP / 2, bandZ]} receiveShadow>
            <boxGeometry args={[ROAD_LENGTH, ROAD_TOP, width]} />
            <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
          </mesh>
        );
      })}

      {/* 2. Av. Marechal Campos (x = 0, somente ao Norte da Av. Vitória: z de -45 até 0) */}
      <mesh position={[0, ROAD_TOP / 2, -halfRoadLen / 2]} receiveShadow>
        <boxGeometry args={[MARECHAL_HALF_WIDTH * 2, ROAD_TOP, halfRoadLen]} />
        <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
      </mesh>

      {/* 3. Ruas Verticais regulares (pulando os trechos onde existem as diagonais reais) */}
      {BANDS.filter((b) => b !== 0).map((bandX) => {
        if (bandX === -9) {
          // Em x = -9, tanto o trecho -18..0 quanto 0..36 são diagonais; mantém apenas o extremo norte (-45..-18)
          return (
            <mesh key={`vt-road-${bandX}`} position={[bandX, ROAD_TOP / 2, -31.5]} receiveShadow>
              <boxGeometry args={[STREET_HALF_WIDTH * 2, ROAD_TOP, 27]} />
              <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
            </mesh>
          );
        }
        if (bandX === -18) {
          // Em x = -18, mantém ao sul (R. Álvaro Sarlo, z de 0 a +45) e no extremo norte (-45..-18)
          return (
            <group key={`vt-road-${bandX}`}>
              <mesh position={[bandX, ROAD_TOP / 2, halfRoadLen / 2]} receiveShadow>
                <boxGeometry args={[STREET_HALF_WIDTH * 2, ROAD_TOP, halfRoadLen]} />
                <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
              </mesh>
              <mesh position={[bandX, ROAD_TOP / 2, -31.5]} receiveShadow>
                <boxGeometry args={[STREET_HALF_WIDTH * 2, ROAD_TOP, 27]} />
                <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
              </mesh>
            </group>
          );
        }
        return (
          <mesh key={`vt-road-${bandX}`} position={[bandX, ROAD_TOP / 2, 0]} receiveShadow>
            <boxGeometry args={[STREET_HALF_WIDTH * 2, ROAD_TOP, ROAD_LENGTH]} />
            <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
          </mesh>
        );
      })}

      {/* 4. Ruas em Diagonal Reais (R. Anselmo Serrate, R. Leoni Souza Guedes, R. Prof. Arnaud Cabral, R. Bruno Becacici, R. Gilberto Paixão) */}
      <DiagonalRoads />

      <Sidewalks />
      <AvenueVitoriaMedian segments={horizontalSegments} />
      <MarechalCamposDetails verticalSegments={verticalSegments} />
      <RoadDashes horizontalSegments={horizontalSegments} verticalSegments={verticalSegments} />
      <Crosswalks />
      <TrafficLights />
      <StreetLabels />
    </group>
  );
}
