import { Canvas } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import type { BlockLevel, WorkId } from '@/lib/interventions';
import { CityBlocks } from './CityBlocks';
import { Pedestrians } from './Pedestrians';
import { Ground, Roads } from './Roads';
import { Traffic } from './Traffic';
import { WorkSite } from './WorkSite';

interface CitySceneProps {
  activeWork: WorkId | null;
  level: BlockLevel;
}

export function CityScene({ activeWork, level }: CitySceneProps) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#050914']} />
      <OrthographicCamera makeDefault position={[38, 38, 38]} zoom={24} near={0.1} far={1000} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#dbeafe', '#0f172a', 0.5]} />
      <directionalLight
        position={[30, 50, 20]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={150}
      />
      <Ground />
      <Roads />
      <CityBlocks active={activeWork !== null} />
      <Pedestrians active={activeWork !== null} level={level} />
      <Traffic active={activeWork !== null} level={level} />
      {activeWork && <WorkSite key={activeWork} workId={activeWork} level={level} />}
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
        minZoom={14}
        maxZoom={60}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
        enablePan
        screenSpacePanning={false}
      />
    </Canvas>
  );
}
