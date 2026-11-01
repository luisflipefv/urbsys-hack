export const ROAD_TOP = 0.1;
export const SIDEWALK_TOP = 0.16;

// Av. Vitória (eixo X, z = 0): avenida arterial de pista dupla com canteiro central
export const AVENUE_HALF_WIDTH = 2.7;

// Av. Marechal Campos (eixo Z norte, x = 0, z < 0): arterial mais larga que nasce na Av. Vitória
export const MARECHAL_HALF_WIDTH = 2.1;

// Demais ruas coletoras e locais
export const STREET_HALF_WIDTH = 1.4;

// Faixas de rolamento na Av. Vitória (duas faixas por sentido separadas pelo canteiro central)
export const LANE_OFFSET = 1.05;
export const LANE_OUTER_OFFSET = 1.92;
export const MARECHAL_LANE_OFFSET = 1.0;
export const STREET_LANE_OFFSET = 0.7;

export const DETOUR_OFFSET = 8.6;
export const CORE_HALF_LENGTH = 9.5;
export const QUEUE_HALF_LENGTH = 15;
export const LOOP_HALF_LENGTH = 33;
export const ROAD_LENGTH = 90;
export const BLOCK_MARGIN = 0.8;
export const BANDS = [-36, -27, -18, -9, 0, 9, 18, 27, 36];

export type Pt2 = [number, number];

export interface DiagonalRoadSpec {
  id: string;
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  labelPos?: [number, number, number];
}

/**
 * Ruas em diagonal fiéis ao print do Google Maps dos arredores da FAESA:
 * 1. R. Anselmo Serrate: sai da esquina da FAESA (0, 0) e desce na diagonal Sudoeste até (-8.4, 18) e (-18, 36)
 * 2. R. Leoni Souza Guedes: paralela diagonal a oeste da R. Anselmo Serrate, de (-6.4, 0) até (-14.8, 18)
 * 3. R. Prof. Arnaud Cabral: sai da Av. Vitória na altura da Autoglass (-18, 0) e sobe a 45° até a Av. Mal. Campos (0, -18)
 * 4. R. Bruno Becacici: diagonal paralela no quadrante Noroeste, de (-27, -4.5) até (-13.5, -18)
 * 5. R. Gilberto Paixão: ligação inclinada entre a Av. Vitória (-7.5, 0) e a R. Prof. Arnaud Cabral (-9, -9)
 */
export const DIAGONAL_ROADS: DiagonalRoadSpec[] = [
  {
    id: 'anselmo-serrate',
    name: 'R. Anselmo Serrate',
    x1: 0,
    z1: 0,
    x2: -8.4,
    z2: 18,
    width: 2.7,
    labelPos: [-3.9, ROAD_TOP + 0.15, 11.2],
  },
  {
    id: 'anselmo-serrate-sul',
    name: 'R. Anselmo Serrate',
    x1: -8.4,
    z1: 18,
    x2: -14.5,
    z2: 36,
    width: 2.5,
  },
  {
    id: 'leoni-souza-guedes',
    name: 'R. Leoni Souza Guedes',
    x1: -7.8,
    z1: 0,
    x2: -15.4,
    z2: 18,
    width: 2.4,
    labelPos: [-12.2, ROAD_TOP + 0.15, 12.2],
  },
  {
    id: 'arnaud-cabral',
    name: 'R. Prof. Arnaud Cabral',
    x1: -18,
    z1: 0,
    x2: 0,
    z2: -18,
    width: 2.6,
    labelPos: [-10.2, ROAD_TOP + 0.15, -10.2],
  },
  {
    id: 'bruno-becacici',
    name: 'R. Bruno Becacici',
    x1: -27,
    z1: -4.5,
    x2: -13.5,
    z2: -18,
    width: 2.3,
    labelPos: [-20.5, ROAD_TOP + 0.15, -11.8],
  },
  {
    id: 'gilberto-paixao',
    name: 'R. Gilberto Paixão',
    x1: -7.8,
    z1: 0,
    x2: -9.0,
    z2: -9.0,
    width: 2.3,
    labelPos: [-8.4, ROAD_TOP + 0.15, -5.2],
  },
];

/** Meia-largura das vias horizontais (paralelas ao eixo X, posicionadas em Z = band) */
export const horizontalHalfWidthOf = (bandZ: number) =>
  bandZ === 0 ? AVENUE_HALF_WIDTH : STREET_HALF_WIDTH;

/** Meia-largura das vias verticais (paralelas ao eixo Z, posicionadas em X = band) */
export const verticalHalfWidthOf = (bandX: number, isNorthOfAvVitoria: boolean) => {
  if (bandX === 0) {
    return isNorthOfAvVitoria ? MARECHAL_HALF_WIDTH : STREET_HALF_WIDTH;
  }
  return STREET_HALF_WIDTH;
};

/** Compatibilidade geral */
export const halfWidthOf = (band: number) => (band === 0 ? AVENUE_HALF_WIDTH : STREET_HALF_WIDTH);

export interface Span {
  min: number;
  max: number;
}

export function blockSpans(): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < BANDS.length - 1; i++) {
    const from = BANDS[i];
    const to = BANDS[i + 1];
    spans.push({
      min: from + horizontalHalfWidthOf(from) + BLOCK_MARGIN,
      max: to - horizontalHalfWidthOf(to) - BLOCK_MARGIN,
    });
  }
  return spans;
}

/** Recorta um polígono 2D pelo semiplano nx * x + nz * z >= c (Sutherland-Hodgman) */
export function clipPolygonHalfPlane(poly: Pt2[], nx: number, nz: number, c: number): Pt2[] {
  const out: Pt2[] = [];
  const n = poly.length;
  if (n < 3) return out;

  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const prev = poly[(i + n - 1) % n];
    const dCur = nx * cur[0] + nz * cur[1] - c;
    const dPrev = nx * prev[0] + nz * prev[1] - c;

    if (dCur >= -1e-6) {
      if (dPrev < -1e-6) {
        const t = dPrev / (dPrev - dCur);
        out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
      }
      out.push(cur);
    } else if (dPrev >= -1e-6) {
      const t = dPrev / (dPrev - dCur);
      out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
    }
  }
  return out;
}

export function polygonAreaAndCentroid(poly: Pt2[]): { area: number; cx: number; cz: number } {
  if (poly.length < 3) return { area: 0, cx: 0, cz: 0 };
  let signedArea2 = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % poly.length];
    const cross = x0 * z1 - x1 * z0;
    signedArea2 += cross;
    cx += (x0 + x1) * cross;
    cz += (z0 + z1) * cross;
  }
  if (Math.abs(signedArea2) < 1e-5) {
    const sx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const sz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    return { area: 0, cx: sx, cz: sz };
  }
  const area = Math.abs(signedArea2) / 2;
  return {
    area,
    cx: cx / (3 * signedArea2),
    cz: cz / (3 * signedArea2),
  };
}

/** Encolhe um polígono convexo deslocando cada aresta para dentro em `inset` unidades */
export function insetConvexPolygon(poly: Pt2[], inset: number): Pt2[] {
  if (poly.length < 3) return [];
  const { cx, cz } = polygonAreaAndCentroid(poly);
  let current = poly;

  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) continue;

    // Normal apontando para o interior (em direção ao centroide)
    let nx = -dz / len;
    let nz = dx / len;
    if (nx * (cx - ax) + nz * (cz - az) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const c = nx * ax + nz * az + inset;
    current = clipPolygonHalfPlane(current, nx, nz, c);
    if (current.length < 3) return [];
  }
  return current;
}

/** Subtrai uma faixa de rua infinita (x1,z1)->(x2,z2) de largura `width` de uma lista de polígonos */
function splitPolygonsByRoad(polys: Pt2[][], road: DiagonalRoadSpec, extraMargin = 0): Pt2[][] {
  const dx = road.x2 - road.x1;
  const dz = road.z2 - road.z1;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const c0 = nx * road.x1 + nz * road.z1;
  const hw = road.width / 2 + extraMargin;

  const result: Pt2[][] = [];
  for (const poly of polys) {
    const sideA = clipPolygonHalfPlane(poly, nx, nz, c0 + hw);
    if (polygonAreaAndCentroid(sideA).area >= 1.8) {
      result.push(sideA);
    }
    const sideB = clipPolygonHalfPlane(poly, -nx, -nz, -c0 + hw);
    if (polygonAreaAndCentroid(sideB).area >= 1.8) {
      result.push(sideB);
    }
  }
  return result;
}

export interface CityParcel {
  key: string;
  /** Polígono externo da calçada (meio-fio) */
  curbPoly: Pt2[];
  /** Polígono interno do piso da calçada */
  pavingPoly: Pt2[];
  /** Polígono útil para edificação */
  lotPoly: Pt2[];
  cx: number;
  cz: number;
  w: number;
  d: number;
  area: number;
  /** Rotação principal sugerida para o prédio neste lote */
  buildingRotation: number;
}

function makeRectPoly(xMin: number, xMax: number, zMin: number, zMax: number): Pt2[] {
  return [
    [xMin, zMin],
    [xMax, zMin],
    [xMax, zMax],
    [xMin, zMax],
  ];
}

let cachedParcels: CityParcel[] | null = null;

/**
 * Constrói todas as quadras (retangulares, trapezoidais e triangulares) da cidade:
 * - No setor Sul-Central (em frente à FAESA), substitui os cortes retos pelas diagonais reais
 *   R. Anselmo Serrate e R. Leoni Souza Guedes.
 * - No setor Noroeste (Autoglass -> Av. Mal. Campos), aplica os cortes diagonais reais da
 *   R. Prof. Arnaud Cabral, R. Bruno Becacici e R. Gilberto Paixão.
 */
export function getCityParcels(): CityParcel[] {
  if (cachedParcels) return cachedParcels;

  const rawCurbPolys: Array<{ tag: string; poly: Pt2[]; diagAngle?: number }> = [];

  // 1. Setor Sul-Central (x de -18 a +9, z de 0 a +18): dividido pelas diagonais R. Anselmo Serrate e R. Leoni Souza Guedes
  for (const iz of [4, 5]) {
    const zFrom = BANDS[iz];
    const zTo = BANDS[iz + 1];
    const zMin = zFrom + horizontalHalfWidthOf(zFrom);
    const zMax = zTo - horizontalHalfWidthOf(zTo);
    const xMin = -18 + STREET_HALF_WIDTH;
    const xMax = 9 - STREET_HALF_WIDTH;

    let pieces = [makeRectPoly(xMin, xMax, zMin, zMax)];
    pieces = splitPolygonsByRoad(pieces, DIAGONAL_ROADS[0]); // R. Anselmo Serrate
    pieces = splitPolygonsByRoad(pieces, DIAGONAL_ROADS[2]); // R. Leoni Souza Guedes

    // Ordena da esquerda (Oeste) para a direita (Leste): 0 = Oeste, 1 = Entre as diagonais, 2 = Leste (FAESA)
    pieces.sort((a, b) => polygonAreaAndCentroid(a).cx - polygonAreaAndCentroid(b).cx);
    pieces.forEach((poly, idx) => {
      const colIdx = idx === 0 ? 2 : idx === 1 ? 3 : 4;
      rawCurbPolys.push({
        tag: `${colIdx},${iz}`,
        poly,
        diagAngle: colIdx === 3 ? Math.atan2(8.4, 18) : 0,
      });
    });
  }

  // 2. Setor Sul-Profundo (x de -18 a 0, z de 18 a 36): dividido pela continuação diagonal da R. Anselmo Serrate
  for (const iz of [6, 7]) {
    const zFrom = BANDS[iz];
    const zTo = BANDS[iz + 1];
    const zMin = zFrom + horizontalHalfWidthOf(zFrom);
    const zMax = zTo - horizontalHalfWidthOf(zTo);
    const xMin = -18 + STREET_HALF_WIDTH;
    const xMax = 0 - STREET_HALF_WIDTH;

    let pieces = [makeRectPoly(xMin, xMax, zMin, zMax)];
    pieces = splitPolygonsByRoad(pieces, DIAGONAL_ROADS[1]); // R. Anselmo Serrate Sul
    pieces.sort((a, b) => polygonAreaAndCentroid(a).cx - polygonAreaAndCentroid(b).cx);
    pieces.forEach((poly, idx) => {
      rawCurbPolys.push({
        tag: `${2 + idx},${iz}`,
        poly,
      });
    });
  }

  // 3. Setor Noroeste (x de -27 a 0, z de -18 a 0): dividido pelas diagonais R. Prof. Arnaud Cabral, R. Bruno Becacici e R. Gilberto Paixão
  for (const iz of [2, 3]) {
    const zFrom = BANDS[iz];
    const zTo = BANDS[iz + 1];
    const zMin = zFrom + horizontalHalfWidthOf(zFrom);
    const zMax = zTo - horizontalHalfWidthOf(zTo);
    const xMin = -27 + STREET_HALF_WIDTH;
    const xMax = 0 - MARECHAL_HALF_WIDTH;

    let pieces = [makeRectPoly(xMin, xMax, zMin, zMax)];
    pieces = splitPolygonsByRoad(pieces, DIAGONAL_ROADS[3]); // R. Prof. Arnaud Cabral
    pieces = splitPolygonsByRoad(pieces, DIAGONAL_ROADS[4]); // R. Bruno Becacici
    if (iz === 3) {
      pieces = splitPolygonsByRoad(pieces, DIAGONAL_ROADS[5]); // R. Gilberto Paixão
    }

    pieces.sort((a, b) => polygonAreaAndCentroid(a).cx - polygonAreaAndCentroid(b).cx);
    pieces.forEach((poly, idx) => {
      // Mapeia o lote junto à esquina da Autoglass (-18..0, z próximo a 0) e Farmácia Monte Belo
      const { cx } = polygonAreaAndCentroid(poly);
      let tag = `nw-${iz}-${idx}`;
      if (iz === 3 && cx < -10 && cx > -19) tag = '3,3'; // Autoglass · Av. Vitória
      else if (iz === 2 && cx > -9) tag = '3,2'; // Farmácia Monte Belo
      rawCurbPolys.push({
        tag,
        poly,
        diagAngle: Math.PI / 4,
      });
    });
  }

  // 4. Demais quadras regulares da cidade (fora dos três setores diagonais acima)
  for (let ix = 0; ix < BANDS.length - 1; ix++) {
    for (let iz = 0; iz < BANDS.length - 1; iz++) {
      // Pula células já geradas nos setores diagonais
      if ((iz === 4 || iz === 5) && ix >= 2 && ix <= 4) continue;
      if ((iz === 6 || iz === 7) && ix >= 2 && ix <= 3) continue;
      if ((iz === 2 || iz === 3) && ix >= 1 && ix <= 3) continue;

      const xFrom = BANDS[ix];
      const xTo = BANDS[ix + 1];
      const zFrom = BANDS[iz];
      const zTo = BANDS[iz + 1];
      const isNorth = zTo <= 0;

      const xMin = xFrom + verticalHalfWidthOf(xFrom, isNorth);
      const xMax = xTo - verticalHalfWidthOf(xTo, isNorth);
      const zMin = zFrom + horizontalHalfWidthOf(zFrom);
      const zMax = zTo - horizontalHalfWidthOf(zTo);

      rawCurbPolys.push({
        tag: `${ix},${iz}`,
        poly: makeRectPoly(xMin, xMax, zMin, zMax),
      });
    }
  }

  const parcels: CityParcel[] = [];
  for (const item of rawCurbPolys) {
    const curbPoly = item.poly;
    const pavingPoly = insetConvexPolygon(curbPoly, 0.14);
    const lotPoly = insetConvexPolygon(curbPoly, BLOCK_MARGIN);
    if (lotPoly.length < 3) continue;

    const { area, cx, cz } = polygonAreaAndCentroid(lotPoly);
    if (area < 1.5) continue;

    let xMin = Infinity;
    let xMax = -Infinity;
    let zMin = Infinity;
    let zMax = -Infinity;
    for (const [px, pz] of lotPoly) {
      if (px < xMin) xMin = px;
      if (px > xMax) xMax = px;
      if (pz < zMin) zMin = pz;
      if (pz > zMax) zMax = pz;
    }

    // Dimensão segura inscrita para posicionar prédios retangulares sem sair da calçada diagonal
    const safeScale = item.diagAngle ? 0.62 : 0.92;
    const w = Math.min(xMax - xMin, Math.sqrt(area) * 1.15) * safeScale;
    const d = Math.min(zMax - zMin, Math.sqrt(area) * 1.15) * safeScale;

    parcels.push({
      key: item.tag,
      curbPoly,
      pavingPoly,
      lotPoly,
      cx,
      cz,
      w: Math.max(1.4, w),
      d: Math.max(1.4, d),
      area,
      buildingRotation: item.diagAngle ?? 0,
    });
  }

  cachedParcels = parcels;
  return parcels;
}

export function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
