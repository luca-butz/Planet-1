import React, { useState, Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Loader } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import SpaceScene from './components/SpaceScene'
import SurfaceScene from './components/SurfaceScene'
import * as THREE from 'three'
import { easing } from 'maath'

function SceneManager({ view, setView }) {
    const [transitioning, setTransitioning] = useState(false);
    
    // We need to move the camera for the zoom effect
    useFrame((state, delta) => {
        if (transitioning) {
            // Smooth zoom to almost 0 - FASTER NOW
            easing.damp3(state.camera.position, [0, 0, 2], 0.15, delta)
            
            // Check closeness to trigger switch
            if (state.camera.position.z < 2.5) {
                setTransitioning(false);
                setView('surface');
            }
        }
    })

    const startTransition = () => {
        setTransitioning(true);
    }

    if (view === 'surface') {
        return <SurfaceScene />
    }

    return <SpaceScene onLand={startTransition} />
}

export default function App() {
  const [view, setView] = useState('space') // 'space' or 'surface'

  return (
    <>
      <div className="overlay">
        <h1>NYXARA</h1>
        <p style={{ color: '#ff4400', fontWeight: 'bold' }}>{view === 'space' ? 'THE SHADOW GARDEN' : 'SURFACE SCAN ACTIVE'}</p>
        
        {view === 'surface' && (
          <div className="hud-controls">
            <button className="back-btn" onClick={() => setView('space')}>
              RETURN TO ORBIT
            </button>
            <div className="instructions">
              CLICK TO EXPLORE • WASD TO WALK
            </div>
          </div>
        )}
      </div>

      <Canvas shadows camera={{ position: [0, 0, 12], fov: 45 }} gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}>
        <color attach="background" args={['#000000']} />
        
        <Suspense fallback={null}>
            {/* Common Environment */}
            <Stars radius={300} depth={50} count={10000} factor={6} saturation={0} fade speed={0.5} />
            
            <SceneManager view={view} setView={setView} />

            <EffectComposer>
              <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} height={300} intensity={1.0} />
              <Vignette eskil={false} offset={0.1} darkness={1.1} />
              <Noise opacity={0.15} />
            </EffectComposer>
        </Suspense>
      </Canvas>
      <Loader />
    </>
  )
}
