import { Html } from '@react-three/drei';
import {
  Building2,
  Coffee,
  Croissant,
  GraduationCap,
  Pill,
  ShoppingBag,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { SIDEWALK_TOP, createRandom, getCityParcels } from './cityLayout';

export type CommerceKind = 'faesa' | 'pharmacy' | 'bakery' | 'workshop' | 'market' | 'wholesale' | 'cafe' | 'campus';

interface CommerceSpec {
  kind: CommerceKind;
  name: string;
  categoryLabel: string;
}

interface CityBlock {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  park: boolean;
  commerce?: CommerceSpec;
  facingRotation: number;
  buildingRotation: number;
  inImpactZone: boolean;
}

interface CommerceTheme {
  icon: LucideIcon;
  wallColor: string;
  trimColor: string;
  awningColor: string;
  windowEmissive: string;
  badgeBg: string;
  badgeText: string;
  badgeRing: string;
}

const COMMERCE_THEMES: Record<CommerceKind, CommerceTheme> = {
  faesa: {
    icon: GraduationCap,
    wallColor: '#e7e5e4',
    trimColor: '#0284c7',
    awningColor: '#0369a1',
    windowEmissive: '#38bdf8',
    badgeBg: 'bg-sky-500/30',
    badgeText: 'text-sky-200',
    badgeRing: 'ring-sky-300/60',
  },
  pharmacy: {
    icon: Pill,
    wallColor: '#f1f5f9',
    trimColor: '#ef4444',
    awningColor: '#dc2626',
    windowEmissive: '#fca5a5',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    badgeRing: 'ring-rose-400/40',
  },
  bakery: {
    icon: Croissant,
    wallColor: '#e7e5e4',
    trimColor: '#f59e0b',
    awningColor: '#d97706',
    windowEmissive: '#fcd34d',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    badgeRing: 'ring-amber-400/40',
  },
  workshop: {
    icon: Wrench,
    wallColor: '#475569',
    trimColor: '#3b82f6',
    awningColor: '#2563eb',
    windowEmissive: '#93c5fd',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    badgeRing: 'ring-blue-400/40',
  },
  market: {
    icon: ShoppingBag,
    wallColor: '#e2e8f0',
    trimColor: '#ef4444',
    awningColor: '#dc2626',
    windowEmissive: '#fca5a5',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    badgeRing: 'ring-rose-400/40',
  },
  wholesale: {
    icon: ShoppingBag,
    wallColor: '#cbd5e1',
    trimColor: '#10b981',
    awningColor: '#059669',
    windowEmissive: '#6ee7b7',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    badgeRing: 'ring-emerald-400/40',
  },
  cafe: {
    icon: Coffee,
    wallColor: '#d6d3d1',
    trimColor: '#f43f5e',
    awningColor: '#e11d48',
    windowEmissive: '#fda4af',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    badgeRing: 'ring-rose-400/40',
  },
  campus: {
    icon: Building2,
    wallColor: '#e2e8f0',
    trimColor: '#10b981',
    awningColor: '#059669',
    windowEmissive: '#6ee7b7',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    badgeRing: 'ring-emerald-400/40',
  },
};

// Mapeamento fiel aos arredores da FAESA na Av. Vitória (cruzamento com Av. Mal. Campos / R. Anselmo Serrate)
const COMMERCE_BY_CELL: Record<string, CommerceSpec> = {
  '4,4': { kind: 'faesa', name: 'FAESA | Centro Universitário', categoryLabel: 'Universidade' },
  '4,3': { kind: 'pharmacy', name: 'Drogasil · Av. Mal. Campos', categoryLabel: 'Farmácia' },
  '3,3': { kind: 'workshop', name: 'Autoglass · Av. Vitória', categoryLabel: 'Oficina' },
  '3,4': { kind: 'bakery', name: 'Padaria & Café Universitário', categoryLabel: 'Padaria' },
  '5,3': { kind: 'market', name: 'MiniPreço · Vitória', categoryLabel: 'Mercado' },
  '5,4': { kind: 'wholesale', name: 'Atacado São Paulo', categoryLabel: 'Atacado' },
  '2,4': { kind: 'workshop', name: 'Bremenkamp Construção', categoryLabel: 'Comércio' },
  '4,5': { kind: 'workshop', name: 'Centro de Reparação Auto', categoryLabel: 'Oficina' },
  '3,2': { kind: 'pharmacy', name: 'Farmácia Monte Belo', categoryLabel: 'Farmácia' },
  '5,5': { kind: 'bakery', name: 'Padaria Aluysio Simões', categoryLabel: 'Padaria' },
  '1,3': { kind: 'campus', name: 'Ifes · Campus Vitória', categoryLabel: 'Instituto' },
  '2,5': { kind: 'cafe', name: 'Restaurante & Lanches FAESA', categoryLabel: 'Restaurante' },
};

const PALETTE = ['#94a3b8', '#64748b', '#cbd5e1', '#a8a29e', '#78716c', '#475569', '#7c8b99', '#b8c4cf', '#d6d3d1', '#4f7f7a'];
const PARK_COLOR = '#2f4a40';
const PARK_HEIGHT = 0.2;
const IMPACT_RADIUS = 17;

function computeFacingRotation(cx: number, cz: number): number {
  if (Math.abs(cx) < Math.abs(cz)) {
    return cz > 0 ? Math.PI : 0;
  }
  return cx > 0 ? -Math.PI / 2 : Math.PI / 2;
}

function generateCityBlocks(): CityBlock[] {
  const random = createRandom(2026);
  const parcels = getCityParcels();
  const blocks: CityBlock[] = [];

  for (const parcel of parcels) {
    const { key, cx, cz, w: cellW, d: cellD, buildingRotation } = parcel;
    const commerce = COMMERCE_BY_CELL[key];
    const inImpactZone = Math.hypot(cx, cz) <= IMPACT_RADIUS;
    const facingRotation = buildingRotation !== 0 ? buildingRotation : computeFacingRotation(cx, cz);

    if (commerce) {
      random();
      const theme = COMMERCE_THEMES[commerce.kind];
      const heightByKind: Record<CommerceKind, number> = {
        faesa: 7.4,
        pharmacy: 2.3,
        bakery: 2.1,
        workshop: 1.9,
        market: 2.5,
        wholesale: 2.5,
        cafe: 2.0,
        campus: 3.6,
      };
      blocks.push({
        x: cx,
        z: cz,
        w: Math.min(4.2, cellW * (commerce.kind === 'faesa' ? 0.88 : 0.82)),
        d: Math.min(4.2, cellD * (commerce.kind === 'faesa' ? 0.88 : 0.82)),
        h: heightByKind[commerce.kind],
        color: theme.wallColor,
        park: false,
        commerce,
        facingRotation,
        buildingRotation,
        inImpactZone,
      });
      continue;
    }

    if (random() < 0.12) {
      blocks.push({
        x: cx,
        z: cz,
        w: cellW * 0.82,
        d: cellD * 0.82,
        h: PARK_HEIGHT,
        color: PARK_COLOR,
        park: true,
        facingRotation,
        buildingRotation,
        inImpactZone,
      });
      continue;
    }

    const w = Math.min(4.2, cellW * (0.7 + random() * 0.18));
    const d = Math.min(4.2, cellD * (0.7 + random() * 0.18));
    const h = random() < 0.16 ? 5 + random() * 3.8 : 1.2 + random() * 2.8;
    const color = PALETTE[Math.floor(random() * PALETTE.length)];
    blocks.push({
      x: cx,
      z: cz,
      w,
      d,
      h,
      color,
      park: false,
      facingRotation,
      buildingRotation,
      inImpactZone,
    });
  }

  return blocks;
}

const CITY_BLOCKS = generateCityBlocks();

/**
 * Modelo 3D inspirado nas fotos reais do prédio da FAESA na Av. Vitória:
 * - Torre principal bege/off-white de 8 andares com faixas horizontais de janelas escuras
 * - Fachada frontal em pele de vidro verde-azulada voltada para a Av. Vitória
 * - Grande banner vertical azul "FAESA 50 Anos" na lateral direita (+X)
 * - Bloco lateral baixo cor terracota/salmão e caixas d'água/casa de máquinas terracota no topo
 * - Passarela interna FAESA (estrutura laranja e cobertura azul) + estacionamento universitário
 */
function FaesaCampusLandmark({ block, active }: { block: CityBlock; active: boolean }) {
  const towerW = 1.95;
  const towerD = 2.5;
  const towerH = block.h; // 7.4
  const floorRows = [1.3, 2.1, 2.9, 3.7, 4.5, 5.3, 6.1];
  const mullionCols = [-0.6, -0.3, 0, 0.3, 0.6];

  return (
    <group position={[block.x, SIDEWALK_TOP, block.z]}>
      {/* Pátio / Terreno do Campus FAESA */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[block.w + 0.35, 0.04, block.d + 0.35]} />
        <meshStandardMaterial color={active ? '#3b1d2e' : '#334155'} roughness={0.9} />
      </mesh>

      {/* Torre Principal da FAESA (posicionada próxima à esquina da Av. Vitória) */}
      <group position={[-0.65, 0, -0.25]}>
        {/* Corpo principal em concreto bege claro */}
        <mesh position={[0, towerH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[towerW, towerH, towerD]} />
          <meshStandardMaterial color="#e7e5e4" roughness={0.65} metalness={0.05} />
        </mesh>

        {/* Fachada em Pele de Vidro Verde-Azulada (voltada para a Av. Vitória, face -Z) */}
        <mesh position={[0, towerH / 2 + 0.15, -towerD / 2 - 0.015]}>
          <planeGeometry args={[towerW * 0.78, towerH - 0.7]} />
          <meshStandardMaterial
            color="#134e4a"
            emissive="#0f766e"
            emissiveIntensity={0.35}
            metalness={0.55}
            roughness={0.2}
          />
        </mesh>

        {/* Esquadrias verticais claras na pele de vidro frontal */}
        {mullionCols.map((mx) => (
          <mesh key={mx} position={[mx, towerH / 2 + 0.15, -towerD / 2 - 0.022]}>
            <boxGeometry args={[0.025, towerH - 0.7, 0.01]} />
            <meshBasicMaterial color="#cbd5e1" />
          </mesh>
        ))}

        {/* Faixas horizontais de janelas nas fachadas laterais (7 pavimentos) */}
        {floorRows.map((fy) => (
          <group key={fy}>
            {/* Janelas face oeste (-X) */}
            <mesh position={[-towerW / 2 - 0.012, fy, 0.15]}>
              <boxGeometry args={[0.015, 0.34, towerD * 0.78]} />
              <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.25} />
            </mesh>
            {/* Janelas face leste (+X) */}
            <mesh position={[towerW / 2 + 0.012, fy, 0.15]}>
              <boxGeometry args={[0.015, 0.34, towerD * 0.78]} />
              <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.25} />
            </mesh>
          </group>
        ))}

        {/* Grande Lona / Banner Azul "FAESA Centro Universitário" na lateral direita (+X) próxima à fachada */}
        <mesh position={[towerW / 2 + 0.02, towerH * 0.58, -towerD * 0.24]}>
          <boxGeometry args={[0.02, 3.1, 0.92]} />
          <meshStandardMaterial color="#0284c7" emissive="#0369a1" emissiveIntensity={0.55} roughness={0.3} />
        </mesh>
        {/* Detalhe branco simulando o logo/50 anos no banner azul */}
        <mesh position={[towerW / 2 + 0.032, towerH * 0.68, -towerD * 0.24]}>
          <boxGeometry args={[0.01, 0.55, 0.72]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>

        {/* Marquise / Fachada de entrada azul e laranja no térreo da Av. Vitória */}
        <mesh position={[0, 0.75, -towerD / 2 - 0.14]} castShadow>
          <boxGeometry args={[towerW * 0.88, 0.42, 0.26]} />
          <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[-0.55, 0.75, -towerD / 2 - 0.15]}>
          <boxGeometry args={[0.35, 0.42, 0.27]} />
          <meshStandardMaterial color="#ea580c" />
        </mesh>

        {/* Bloco anexo baixo cor Terracota / Salmão encostado na lateral (como na foto da fachada) */}
        <mesh position={[-towerW / 2 - 0.22, 1.35, 0.35]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 2.7, 1.55]} />
          <meshStandardMaterial color="#d97757" roughness={0.75} />
        </mesh>

        {/* Cobertura / Terraço cinza superior com colunas */}
        <mesh position={[0, towerH + 0.25, 0]} castShadow>
          <boxGeometry args={[towerW * 0.86, 0.5, towerD * 0.86]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>

        {/* Caixas d'água / Casa de Máquinas cor Terracota no topo do edifício (visíveis nas fotos aéreas) */}
        <mesh position={[0.25, towerH + 0.82, -0.35]} castShadow>
          <boxGeometry args={[0.85, 0.75, 0.95]} />
          <meshStandardMaterial color="#c26d53" roughness={0.7} />
        </mesh>
        <mesh position={[-0.35, towerH + 0.75, 0.45]} castShadow>
          <boxGeometry args={[0.68, 0.62, 0.75]} />
          <meshStandardMaterial color="#c26d53" roughness={0.7} />
        </mesh>

        {/* Escada externa azul no topo (detalhe característico da foto aérea) */}
        <mesh position={[0.3, towerH + 0.55, -0.9]} rotation={[0.55, 0, 0]}>
          <boxGeometry args={[0.16, 0.75, 0.08]} />
          <meshStandardMaterial color="#2563eb" emissive="#1d4ed8" emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Passarela Interna FAESA (treliça laranja e teto azul ligando ao bloco anexo) */}
      <group position={[0.55, 3.1, 0.1]}>
        <mesh castShadow>
          <boxGeometry args={[1.35, 0.22, 0.52]} />
          <meshStandardMaterial color="#ea580c" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.26, 0]} castShadow>
          <boxGeometry args={[1.38, 0.1, 0.58]} />
          <meshStandardMaterial color="#0284c7" roughness={0.4} />
        </mesh>
      </group>

      {/* Bloco Anexo do Campus FAESA (prédio branco à esquerda na foto aérea) */}
      <group position={[1.15, 0, 0.25]}>
        <mesh position={[0, 2.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.15, 4.6, 2.0]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.7} />
        </mesh>
        {[1.2, 2.3, 3.4].map((ay) => (
          <mesh key={ay} position={[0, ay, -1.01]}>
            <boxGeometry args={[0.92, 0.28, 0.02]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        ))}
        <mesh position={[0, 4.68, 0]}>
          <boxGeometry args={[1.18, 0.16, 2.04]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>
      </group>

      {/* Carros de alunos/professores no estacionamento da FAESA */}
      {[
        { x: 0.55, z: -1.1, color: '#e2e8f0' },
        { x: 1.05, z: -1.1, color: '#38bdf8' },
        { x: 1.5, z: -1.1, color: '#94a3b8' },
      ].map((car, idx) => (
        <group key={idx} position={[car.x, 0.16, car.z]}>
          <mesh castShadow>
            <boxGeometry args={[0.36, 0.24, 0.72]} />
            <meshStandardMaterial color={car.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[0.3, 0.14, 0.38]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      ))}

      {/* Marcador Principal em Destaque da FAESA */}
      <Html
        position={[-0.65, towerH + 2.1, -0.25]}
        center
        zIndexRange={[8, 0]}
        wrapperClass="pointer-events-none select-none"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={`flex flex-col items-center gap-1 rounded-2xl border px-3.5 py-1.5 shadow-2xl backdrop-blur-md transition-all duration-300 ${
            active
              ? 'border-amber-400/80 bg-slate-950/90 text-slate-100 shadow-amber-950/60 ring-2 ring-amber-400/30'
              : 'border-sky-400/70 bg-slate-950/90 text-slate-100 shadow-sky-950/60 ring-2 ring-sky-400/25'
          }`}
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="grid size-6 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md">
              <GraduationCap size={14} strokeWidth={2.4} />
            </span>
            <div className="text-left leading-tight">
              <p className="text-xs font-bold tracking-tight text-white">FAESA · Centro Universitário</p>
              <p className="text-[10px] font-medium text-sky-300">Campus Av. Vitória</p>
            </div>
          </div>
          {active && (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-500/25 px-2 py-0.5 text-[10px] font-semibold text-rose-200 ring-1 ring-rose-400/50">
              <span className="size-1.5 animate-ping rounded-full bg-rose-400" />
              Acesso e Fluxo Universitário Impactados
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

function PharmacyRoofSign({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.16, 0.4, 0.16]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.75, 0.22, 0.2]} />
        <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.22, 0.75, 0.2]} />
        <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.85} />
      </mesh>
    </group>
  );
}

function BakeryRoofDetails({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[-0.65, 0.4, -0.5]} castShadow>
        <cylinderGeometry args={[0.2, 0.24, 0.8, 12]} />
        <meshStandardMaterial color="#9a3412" roughness={0.85} />
      </mesh>
      <mesh position={[-0.65, 0.82, -0.5]}>
        <cylinderGeometry args={[0.25, 0.25, 0.08, 12]} />
        <meshStandardMaterial color="#431407" />
      </mesh>
      <mesh position={[0.3, 0.28, 0.4]} castShadow>
        <boxGeometry args={[1.1, 0.36, 0.14]} />
        <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function WorkshopDetails({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      {/* Portão metálico de oficina / Autoglass */}
      <mesh position={[0, 0.62, d / 2 + 0.015]}>
        <planeGeometry args={[w * 0.56, 1.15]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.45} roughness={0.5} />
      </mesh>
      {/* Carro estacionado no pátio de atendimento */}
      <group position={[0, 0.22, d / 2 + 0.36]} rotation={[0, Math.PI / 2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.34, 0.52]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.52, 0.2, 0.46]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
      {/* Placa superior azul */}
      <mesh position={[0, h + 0.28, 0]} castShadow>
        <boxGeometry args={[1.3, 0.36, 0.16]} />
        <meshStandardMaterial color="#2563eb" emissive="#1d4ed8" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function CommercialBuilding({ block, active }: { block: CityBlock; active: boolean }) {
  const commerce = block.commerce!;
  if (commerce.kind === 'faesa') {
    return <FaesaCampusLandmark block={block} active={active} />;
  }

  const theme = COMMERCE_THEMES[commerce.kind];
  const Icon = theme.icon;
  const isAffected = active && block.inImpactZone;

  return (
    <group position={[block.x, SIDEWALK_TOP, block.z]}>
      <group rotation={[0, block.facingRotation, 0]}>
        {/* Piso destacado do lote comercial */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[block.w + 0.26, 0.03, block.d + 0.26]} />
          <meshStandardMaterial color={isAffected ? '#4c1d24' : '#475569'} roughness={0.9} />
        </mesh>

        {/* Corpo principal do prédio */}
        <mesh position={[0, block.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[block.w, block.h, block.d]} />
          <meshStandardMaterial color={theme.wallColor} flatShading roughness={0.7} metalness={0.08} />
        </mesh>

        {/* Faixa de topo / platibanda */}
        <mesh position={[0, block.h + 0.07, 0]} castShadow>
          <boxGeometry args={[block.w + 0.08, 0.14, block.d + 0.08]} />
          <meshStandardMaterial color={theme.trimColor} roughness={0.5} />
        </mesh>

        {/* Toldo frontal */}
        <mesh position={[0, 1.15, block.d / 2 + 0.16]} rotation={[0.25, 0, 0]} castShadow>
          <boxGeometry args={[block.w * 0.78, 0.1, 0.38]} />
          <meshStandardMaterial color={theme.awningColor} roughness={0.6} />
        </mesh>

        {/* Vitrine iluminada (quando não for oficina) */}
        {commerce.kind !== 'workshop' && (
          <mesh position={[0, 0.58, block.d / 2 + 0.015]}>
            <planeGeometry args={[block.w * 0.66, 0.82]} />
            <meshStandardMaterial
              color={theme.windowEmissive}
              emissive={theme.windowEmissive}
              emissiveIntensity={0.55}
              roughness={0.2}
            />
          </mesh>
        )}

        {/* Janelas dos pavimentos superiores dos prédios comerciais */}
        <UpperCommercialWindows w={block.w} d={block.d} h={block.h} accent={theme.windowEmissive} />

        {/* Detalhes específicos por tipo de comércio */}
        {commerce.kind === 'pharmacy' && <PharmacyRoofSign y={block.h + 0.14} />}
        {commerce.kind === 'bakery' && <BakeryRoofDetails y={block.h + 0.14} />}
        {commerce.kind === 'workshop' && <WorkshopDetails w={block.w} d={block.d} h={block.h} />}
      </group>

      {/* Marcador flutuante no mapa */}
      <Html
        position={[0, block.h + 1.45, 0]}
        center
        zIndexRange={[5, 0]}
        wrapperClass="pointer-events-none select-none"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-lg backdrop-blur-md transition-colors duration-300 ${
            isAffected
              ? 'border-rose-400/60 bg-rose-950/85 text-rose-100 shadow-rose-950/50'
              : 'border-white/15 bg-slate-950/80 text-slate-100 shadow-black/50'
          }`}
        >
          <span className={`grid size-4 place-items-center rounded-full ring-1 ${theme.badgeBg} ${theme.badgeText} ${theme.badgeRing}`}>
            <Icon size={10} strokeWidth={2.4} />
          </span>
          <span>{commerce.name}</span>
          {isAffected && <span className="size-1.5 animate-pulse rounded-full bg-rose-400" title="Comércio na zona de impacto" />}
        </div>
      </Html>
    </group>
  );
}

function UpperCommercialWindows({ w, d, h, accent }: { w: number; d: number; h: number; accent: string }) {
  const floors: number[] = [];
  for (let y = 1.62; y <= h - 0.28; y += 0.65) {
    floors.push(y);
  }
  const cols = [-0.28, 0, 0.28];

  return (
    <group>
      {floors.map((fy, fIdx) => (
        <group key={fy}>
          {cols.map((c, cIdx) => {
            const lit = (fIdx + cIdx) % 2 === 0;
            return (
              <group key={c}>
                <mesh position={[c * w, fy, 0]}>
                  <boxGeometry args={[w * 0.16, 0.26, d + 0.022]} />
                  <meshStandardMaterial
                    color={lit ? accent : '#1e293b'}
                    emissive={lit ? accent : '#000000'}
                    emissiveIntensity={lit ? 0.35 : 0}
                    roughness={0.25}
                  />
                </mesh>
                <mesh position={[0, fy, c * d]}>
                  <boxGeometry args={[w + 0.022, 0.26, d * 0.16]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.25} metalness={0.4} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function GenericBuilding({ block, seed }: { block: CityBlock; seed: number }) {
  const floors: number[] = [];
  for (let y = 0.52; y <= block.h - 0.32; y += 0.68) {
    floors.push(y);
  }

  const colCountX = Math.max(2, Math.min(4, Math.floor(block.w / 0.72)));
  const colCountZ = Math.max(2, Math.min(4, Math.floor(block.d / 0.72)));
  const spanX = block.w * 0.72;
  const spanZ = block.d * 0.72;
  const paneW = (spanX / colCountX) * 0.62;
  const paneD = (spanZ / colCountZ) * 0.62;

  const colsX = Array.from({ length: colCountX }, (_, i) => -spanX / 2 + ((i + 0.5) / colCountX) * spanX);
  const colsZ = Array.from({ length: colCountZ }, (_, i) => -spanZ / 2 + ((i + 0.5) / colCountZ) * spanZ);

  return (
    <group position={[block.x, SIDEWALK_TOP, block.z]} rotation={[0, block.buildingRotation, 0]}>
      {/* Corpo principal do edifício */}
      <mesh position={[0, block.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[block.w, block.h, block.d]} />
        <meshStandardMaterial color={block.color} flatShading roughness={0.75} metalness={0.05} />
      </mesh>

      {/* Platibanda / acabamento de cobertura */}
      <mesh position={[0, block.h + 0.04, 0]} castShadow>
        <boxGeometry args={[block.w + 0.06, 0.08, block.d + 0.06]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>

      {/* Grade de janelas nas 4 fachadas */}
      {floors.map((fy, fIdx) => (
        <group key={fy}>
          {colsX.map((cx, cIdx) => {
            const hash = (seed * 37 + fIdx * 19 + cIdx * 13) % 11;
            const isWarmLit = hash === 0 || hash === 4;
            const isCoolLit = hash === 2;
            const color = isWarmLit ? '#fde68a' : isCoolLit ? '#bae6fd' : '#0f172a';
            const emissive = isWarmLit ? '#f59e0b' : isCoolLit ? '#38bdf8' : '#000000';
            const emissiveIntensity = isWarmLit ? 0.42 : isCoolLit ? 0.32 : 0;

            return (
              <mesh key={`x-${cIdx}`} position={[cx, fy, 0]}>
                <boxGeometry args={[paneW, 0.28, block.d + 0.022]} />
                <meshStandardMaterial
                  color={color}
                  emissive={emissive}
                  emissiveIntensity={emissiveIntensity}
                  roughness={0.25}
                  metalness={0.45}
                />
              </mesh>
            );
          })}

          {colsZ.map((cz, cIdx) => {
            const hash = (seed * 29 + fIdx * 23 + cIdx * 17) % 11;
            const isWarmLit = hash === 1 || hash === 6;
            const isCoolLit = hash === 3;
            const color = isWarmLit ? '#fde68a' : isCoolLit ? '#bae6fd' : '#0f172a';
            const emissive = isWarmLit ? '#f59e0b' : isCoolLit ? '#38bdf8' : '#000000';
            const emissiveIntensity = isWarmLit ? 0.42 : isCoolLit ? 0.32 : 0;

            return (
              <mesh key={`z-${cIdx}`} position={[0, fy, cz]}>
                <boxGeometry args={[block.w + 0.022, 0.28, paneD]} />
                <meshStandardMaterial
                  color={color}
                  emissive={emissive}
                  emissiveIntensity={emissiveIntensity}
                  roughness={0.25}
                  metalness={0.45}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

interface CityBlocksProps {
  active?: boolean;
}

export function CityBlocks({ active = false }: CityBlocksProps) {
  return (
    <group>
      {CITY_BLOCKS.map((block, index) => {
        if (block.commerce) {
          return <CommercialBuilding key={index} block={block} active={active} />;
        }

        if (block.park) {
          return (
            <mesh
              key={index}
              position={[block.x, SIDEWALK_TOP + PARK_HEIGHT / 2, block.z]}
              rotation={[0, block.buildingRotation, 0]}
              receiveShadow
            >
              <boxGeometry args={[block.w, PARK_HEIGHT, block.d]} />
              <meshStandardMaterial color={block.color} roughness={1} />
            </mesh>
          );
        }

        return <GenericBuilding key={index} block={block} seed={index + 1} />;
      })}
    </group>
  );
}
