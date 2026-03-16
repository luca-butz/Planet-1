import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { PointerLockControls, Stars, Cloud, Instance, Instances, Html, Text } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'

// Global noise instance
const noise2D = createNoise2D();

// Bunker configuration - placed further away for longer exploration
const BUNKER_POS = [70, 0, -60];
const BUNKER_ENTRANCE = [70, 0, -54];
const BUNKER_INSIDE = [70, -8, -62];

// Bunker room layout (z-offsets relative to BUNKER_INSIDE[2])
const BUNKER_ROOMS = [
    { zStart: 0, zEnd: -12, hw: 4.5, name: 'EINGANGSHALLE' },
    { zStart: -12, zEnd: -18, hw: 1.5, name: '' },
    { zStart: -18, zEnd: -30, hw: 4.5, name: 'LABOR ALPHA' },
    { zStart: -30, zEnd: -36, hw: 1.5, name: '' },
    { zStart: -36, zEnd: -48, hw: 4.5, name: 'BIO-LABOR' },
    { zStart: -48, zEnd: -54, hw: 1.5, name: '' },
    { zStart: -54, zEnd: -66, hw: 4.5, name: 'SERVERRAUM' },
    { zStart: -66, zEnd: -72, hw: 1.5, name: '' },
    { zStart: -72, zEnd: -86, hw: 5.5, name: 'REAKTORKAMMER' },
    { zStart: -86, zEnd: -96, hw: 3.5, name: 'VAULT' },
];

// Terminal config: position offsets from BUNKER_INSIDE, active at which stage
const TERMINAL_CONFIG = [
    { xOff: -3, zOff: -6, activeStage: 3, color: '#00ff44', darkColor: '#003300' },
    { xOff: 3, zOff: -24, activeStage: 4, color: '#ff4400', darkColor: '#330000' },
    { xOff: -3, zOff: -42, activeStage: 5, color: '#ffaa00', darkColor: '#332200' },
    { xOff: 3, zOff: -60, activeStage: 6, color: '#ff00ff', darkColor: '#330033' },
];

function getBunkerHalfWidth(z) {
    const rz = z - BUNKER_INSIDE[2];
    if (rz > 1 || rz < -97) return 0;
    if (rz > -12) return 4.5;
    if (rz > -18) return 1.5;
    if (rz > -30) return 4.5;
    if (rz > -36) return 1.5;
    if (rz > -48) return 4.5;
    if (rz > -54) return 1.5;
    if (rz > -66) return 4.5;
    if (rz > -72) return 1.5;
    if (rz > -86) return 5.5;
    if (rz > -96) return 3.5;
    return 0;
}

function getTerrainHeight(x, z) {
    const distToBunker = Math.sqrt((x - BUNKER_POS[0])**2 + (z - BUNKER_POS[2])**2);
    if (distToBunker < 15) {
        const flatHeight = -1;
        if (distToBunker < 10) return flatHeight;
        const t = (distToBunker - 10) / 5;
        const naturalHeight = _rawTerrainHeight(x, z);
        return flatHeight * (1 - t) + naturalHeight * t;
    }
    return _rawTerrainHeight(x, z);
}

function _rawTerrainHeight(x, z) {
    let elevation = noise2D(x * 0.01, z * 0.01) * 8; 
    elevation += noise2D(x * 0.03, z * 0.03) * 3;
    
    const trenchCheck = noise2D(x * 0.005, z * 0.005);
    if (trenchCheck < -0.3) {
        elevation -= 6.0;
    }
    
    return elevation;
}

function FlashlightModel({ isOn }) {
    const groupRef = useRef()
    const { camera } = useThree()
    
    // Separate ref for the light so it follows camera directly
    const lightGroupRef = useRef()
    const targetRef = useRef()
    const lightRef = useRef()
    
    useFrame(() => {
        if (!groupRef.current) return;
        
        // === Flashlight 3D model position ===
        // At FOV 45, z=-0.6: visible half-height = tan(22.5)*0.6 = 0.249
        // So y=-0.16 and x=0.28 are safely within the frustum
        groupRef.current.position.copy(camera.position)
        groupRef.current.quaternion.copy(camera.quaternion)
        
        groupRef.current.translateX(0.28)    // right side
        groupRef.current.translateY(-0.16)   // bottom area (within 0.249 limit)
        groupRef.current.translateZ(-0.6)    // far enough for wide frustum
        
        // Tilt the flashlight slightly forward
        groupRef.current.rotateX(0.1)
        groupRef.current.rotateY(0.05)
        
        // === Light source follows camera direction exactly ===
        if (lightGroupRef.current) {
            lightGroupRef.current.position.copy(camera.position)
            lightGroupRef.current.quaternion.copy(camera.quaternion)
            lightGroupRef.current.translateZ(-0.5)
        }
        
        // Update spotlight target - far ahead in camera look direction
        if (lightRef.current && targetRef.current) {
            targetRef.current.position.copy(camera.position)
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
            targetRef.current.position.addScaledVector(forward, 60)
            lightRef.current.target = targetRef.current
        }
    })

    return (
        <>
            {/* === FLASHLIGHT 3D MODEL (visible in viewport) === */}
            <group ref={groupRef} scale={1.5}>
                {/* Main body tube */}
                <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.06]}>
                    <cylinderGeometry args={[0.018, 0.024, 0.18, 12]} />
                    <meshStandardMaterial color="#222222" metalness={0.95} roughness={0.2} />
                </mesh>
                
                {/* Grip ridges */}
                <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.09]}>
                    <cylinderGeometry args={[0.026, 0.026, 0.08, 6]} />
                    <meshStandardMaterial color="#111111" metalness={0.3} roughness={0.95} />
                </mesh>
                
                {/* Head / bezel */}
                <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, -0.03]}>
                    <cylinderGeometry args={[0.032, 0.022, 0.05, 12]} />
                    <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.15} />
                </mesh>
                
                {/* Chrome bezel ring */}
                <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, -0.055]}>
                    <cylinderGeometry args={[0.034, 0.034, 0.004, 16]} />
                    <meshStandardMaterial color="#555555" metalness={1.0} roughness={0.1} />
                </mesh>
                
                {/* Lens */}
                <mesh position={[0, 0, -0.057]}>
                    <circleGeometry args={[0.03, 20]} />
                    <meshBasicMaterial color={isOn ? "#ccddff" : "#0a0a0a"} />
                </mesh>
                
                {/* Glow ring when on */}
                {isOn && (
                    <mesh position={[0, 0, -0.056]}>
                        <ringGeometry args={[0.025, 0.033, 20]} />
                        <meshBasicMaterial color="#88aadd" transparent opacity={0.5} />
                    </mesh>
                )}
                
                {/* Button */}
                <mesh position={[0, 0.022, 0.04]}>
                    <sphereGeometry args={[0.006, 6, 6]} />
                    <meshStandardMaterial color="#444" metalness={0.5} roughness={0.5} />
                </mesh>
                
                {/* End cap */}
                <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.16]}>
                    <cylinderGeometry args={[0.02, 0.015, 0.015, 12]} />
                    <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
                </mesh>
                
                {/* Visible soft light cone emanating from lens */}
                {isOn && (
                    <mesh position={[0, 0, -0.2]} rotation={[Math.PI/2, 0, 0]}>
                        <coneGeometry args={[0.12, 0.5, 32, 8, true]} />
                        <shaderMaterial
                            transparent
                            depthWrite={false}
                            blending={THREE.AdditiveBlending}
                            side={THREE.DoubleSide}
                            vertexShader={`
                                varying vec3 vPos;
                                varying vec2 vUv;
                                void main() {
                                    vPos = position;
                                    vUv = uv;
                                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                                }
                            `}
                            fragmentShader={`
                                varying vec3 vPos;
                                varying vec2 vUv;
                                void main() {
                                    // Distance from center axis (radial)
                                    float r = length(vPos.xz);
                                    // How far along the cone (0 = tip/source, 1 = wide end)
                                    float t = (vPos.y + 0.25) / 0.5;
                                    t = clamp(t, 0.0, 1.0);
                                    
                                    // Max radius at this height
                                    float maxR = mix(0.0, 0.12, t);
                                    // Normalized radial distance (0=center, 1=edge)
                                    float nr = maxR > 0.0 ? r / maxR : 1.0;
                                    
                                    // Soft radial falloff - bright center, fades to edge
                                    float radial = 1.0 - smoothstep(0.0, 1.0, nr * nr);
                                    
                                    // Fade along length - bright near source, fading out
                                    float lengthFade = 1.0 - smoothstep(0.0, 1.0, t);
                                    lengthFade = pow(lengthFade, 2.0);
                                    
                                    float alpha = radial * lengthFade * 0.12;
                                    
                                    vec3 col = mix(vec3(0.85, 0.92, 1.0), vec3(0.6, 0.75, 0.95), t);
                                    gl_FragColor = vec4(col, alpha);
                                }
                            `}
                        />
                    </mesh>
                )}
            </group>
            
            {/* === REAL SPOTLIGHT - illuminates surfaces realistically === */}
            {isOn && (
                <>
                    <group ref={lightGroupRef}>
                        <spotLight 
                            ref={lightRef}
                            position={[0, 0, 0]} 
                            intensity={400}
                            angle={0.55}
                            penumbra={0.85} 
                            distance={100} 
                            color="#ddeaf4" 
                            castShadow
                            decay={1.5}
                            shadow-mapSize-width={1024}
                            shadow-mapSize-height={1024}
                            shadow-bias={-0.002}
                        />
                    </group>
                    <object3D ref={targetRef} />
                </>
            )}
        </>
    )
}

// Simulated 1st Person Cockpit Interior for after landing
function LandedCockpit() {
    const group = useRef()
    const alertRef = useRef()
    const { camera } = useThree()

    useFrame((state) => {
        if (!group.current) return
        group.current.position.copy(camera.position)
        group.current.quaternion.copy(camera.quaternion)

        if (alertRef.current) {
            alertRef.current.opacity = 0.5 + Math.sin(state.clock.getElapsedTime() * 10) * 0.5
        }
    })

    return (
        <group ref={group}>
            {/* Main Console Dashboard (moved down to not block the window) */}
            <mesh position={[0, -1.2, -2.5]} rotation={[-0.6, 0, 0]}>
                <boxGeometry args={[5, 1.8, 0.6]} />
                <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.4} />
            </mesh>

            {/* Left Radar Screen */}
            <mesh position={[-1.2, -0.9, -2.4]} rotation={[-0.6, 0, 0]}>
                <planeGeometry args={[1.2, 1.2]} />
                <meshBasicMaterial color="#002200" />
            </mesh>
            <mesh position={[-1.2, -0.89, -2.38]} rotation={[-0.6, 0, 0]}>
                <planeGeometry args={[1.0, 1.0]} />
                <meshBasicMaterial color="#00ffaa" transparent opacity={0.2} wireframe />
            </mesh>

            {/* Center Main Warning Screen (This replaces the HTML popup!) */}
            <mesh position={[0, -0.8, -2.45]} rotation={[-0.6, 0, 0]}>
                <planeGeometry args={[2.6, 1.4]} />
                <meshBasicMaterial color="#2a0000" />
            </mesh>
            <group position={[0, -0.79, -2.43]} rotation={[-0.6, 0, 0]}>
                <Text position={[0, 0.45, 0]} fontSize={0.12} color="#ff3333" anchorX="center">
                    !!! SYSTEM-WARNUNG !!!
                </Text>
                <Text position={[0, 0.2, 0]} fontSize={0.06} color="#ff6666" anchorX="center">
                    Nuklearer Winter / Toxische Atmosphäre
                </Text>
                <Text position={[-1.1, -0.1, 0]} fontSize={0.05} color="#cccccc" anchorX="left" anchorY="top" maxWidth={2.2} lineHeight={1.5}>
                    ERDE: NICHT REKONSTRUIERBAR. Ein globaler Nuklearkrieg hat die Welt in Asche gelegt. Dichte Rauchwolken blockieren die Sonne. Die Oberfläche ist zerstört.
                </Text>
                <Text position={[-1.1, -0.4, 0]} fontSize={0.05} color="#00ffaa" anchorX="left" anchorY="top" maxWidth={2.2} lineHeight={1.5}>
                    SENSOR-UPDATE: Schwaches Notfall-Signal nordöstlich detektiert.
                </Text>
                <Text position={[0, -0.6, 0]} fontSize={0.06} color="#ffffff" anchorX="center">
                    [ DRÜCKE E UM AUSZUSTEIGEN ]
                </Text>
            </group>
            
            {/* Blinking red caution light on right side */}
            <mesh position={[1.5, -0.6, -2.4]} rotation={[-0.6, 0, 0]}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial ref={alertRef} color="#ff0000" />
            </mesh>
            <Text position={[1.5, -1.0, -2.3]} rotation={[-0.6, 0, 0]} fontSize={0.08} color="#ff0000" anchorX="center">
                HAZARD
            </Text>

            {/* Window frames (thin, so you can see out) */}
            <mesh position={[0, 1.2, -3.5]} rotation={[-0.1, 0, 0]}>
                <boxGeometry args={[6, 0.2, 0.2]} />
                <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[-2.8, 0, -3.2]} rotation={[0, 0, -0.15]}>
                <boxGeometry args={[0.2, 3.5, 0.2]} />
                <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[2.8, 0, -3.2]} rotation={[0, 0, 0.15]}>
                <boxGeometry args={[0.2, 3.5, 0.2]} />
                <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, -3.6]}>
                <boxGeometry args={[0.05, 3, 0.05]} />
                <meshStandardMaterial color="#111" metalness={0.9} roughness={0.3} />
            </mesh>

            {/* Roof / Ceiling block above head */}
            <mesh position={[0, 2.5, -1]}>
                <boxGeometry args={[6, 0.5, 5]} />
                <meshStandardMaterial color="#0a0a0a" metalness={0.8} />
            </mesh>
            {/* Side walls (pushed further back) */}
            <mesh position={[-3.5, 0, -1]}>
                <boxGeometry args={[0.5, 5, 5]} />
                <meshStandardMaterial color="#0a0a0a" metalness={0.8} />
            </mesh>
            <mesh position={[3.5, 0, -1]}>
                <boxGeometry args={[0.5, 5, 5]} />
                <meshStandardMaterial color="#0a0a0a" metalness={0.8} />
            </mesh>
        </group>
    )
}

function Player({ missionStage, setMissionStage, isInsideBunker, dialogVisible, coresCollected, setCoresCollected }) {
  const { camera } = useThree()
  const [move, setMove] = useState({ forward: false, backward: false, left: false, right: false, jump: false })
  const [landed, setLanded] = useState(false)
  const [flashlightOn, setFlashlightOn] = useState(false)
  const [inCockpit, setInCockpit] = useState(missionStage === 0)
  
  const velocityY = useRef(0)
  const startY = useMemo(() => getTerrainHeight(0, 15), [])
  const spawnY = useMemo(() => getTerrainHeight(5, 12), [])
  
  useEffect(() => {
    if (inCockpit) {
        camera.position.set(0, startY + 4.1, 12.4)
        camera.lookAt(new THREE.Vector3(0, startY + 4.1, -100))
    } else if (missionStage === 0) {
        // Safe spawn outside the ship mesh
        camera.position.set(5, spawnY + 1.85, 12)
        camera.lookAt(new THREE.Vector3(0, spawnY + 1.85, -50))
    }
    
    // Key handlers
    const handleKeyDown = (e) => {
      if (inCockpit) {
          if (e.code === 'KeyE') {
              setInCockpit(false)
              setLanded(true)
              if (missionStage === 0) setMissionStage(1)
              const sy = getTerrainHeight(5, 12)
              camera.position.set(5, sy + 1.85, 12)
              camera.lookAt(new THREE.Vector3(0, sy + 1.85, -50))
          }
          return;
      }
      
      // Toggle for single press keys
      if (e.code === 'KeyT') {
          setFlashlightOn(prev => !prev)
      }
      if (e.code === 'KeyE') {
          // Interaction key - handled by proximity checks in useFrame
          setMove(m => ({ ...m, interact: true }))
      }

      switch(e.code) {
        case 'KeyW': setMove(m => ({ ...m, forward: true })); break;
        case 'KeyS': setMove(m => ({ ...m, backward: true })); break;
        case 'KeyA': setMove(m => ({ ...m, left: true })); break;
        case 'KeyD': setMove(m => ({ ...m, right: true })); break;
        case 'Space': setMove(m => ({ ...m, jump: true })); break;
      }
    }
    const handleKeyUp = (e) => {
        switch(e.code) {
            case 'KeyW': setMove(m => ({ ...m, forward: false })); break;
            case 'KeyS': setMove(m => ({ ...m, backward: false })); break;
            case 'KeyA': setMove(m => ({ ...m, left: false })); break;
            case 'KeyD': setMove(m => ({ ...m, right: false })); break;
            case 'Space': setMove(m => ({ ...m, jump: false })); break;
            case 'KeyE': setMove(m => ({ ...m, interact: false })); break;
        }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('keyup', handleKeyUp)
    }
  }, [camera, inCockpit])
  
  useFrame((state, delta) => {
        if (inCockpit) return;
        const eyeHeight = isInsideBunker ? 1.8 : 1.85

    // Terrain height at current X, Z
    const groundHeight = (missionStage >= 12) ? 0 : getTerrainHeight(camera.position.x, camera.position.z)

    // Freeze during cinematic
    if (missionStage === 11) return;

    // Teleport to surface when restored
    if (missionStage === 12 && camera.position.y < -2) {
        camera.position.set(0, eyeHeight, 0);
        velocityY.current = 0;
    }

    if (!landed) {
        camera.position.y -= delta * 60.0
        if (camera.position.y <= groundHeight + eyeHeight) {
            camera.position.y = groundHeight + eyeHeight
            setLanded(true)
            velocityY.current = 0
        }
        return
    }

    // Slower movement in bunker for more exploration time
    const baseSpeed = isInsideBunker ? 8.0 : 15.0;
    const speed = baseSpeed * delta

    const isMoving = move.forward || move.backward || move.left || move.right;
    
    if (isMoving) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();
        
        const moveDir = new THREE.Vector3();
        if (move.forward) moveDir.add(forward);
        if (move.backward) moveDir.sub(forward);
        if (move.right) moveDir.add(right);
        if (move.left) moveDir.sub(right);
        
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().multiplyScalar(speed);
            camera.position.x += moveDir.x;
            camera.position.z += moveDir.z;
        }
    }

    // Physics
    velocityY.current -= 60.0 * delta; 
    camera.position.y += velocityY.current * delta;
    
    const newGroundHeight = (missionStage >= 12) ? 0 : getTerrainHeight(camera.position.x, camera.position.z);
    const floor = newGroundHeight + eyeHeight;
    
    if (camera.position.y < floor) {
        camera.position.y = floor;
        velocityY.current = 0;
        if (move.jump) {
            velocityY.current = 20.0;
        }
    }

    // === MISSION PROXIMITY CHECKS ===
    const px = camera.position.x;
    const pz = camera.position.z;
    
    const distToEntrance = Math.sqrt((px - BUNKER_ENTRANCE[0])**2 + (pz - BUNKER_ENTRANCE[2])**2);
    
    if (missionStage === 1 && distToEntrance < 6) {
        setMissionStage(2);
    }
    
    if (missionStage === 2 && move.interact && distToEntrance < 5) {
        camera.position.set(BUNKER_INSIDE[0], BUNKER_INSIDE[1] + eyeHeight, BUNKER_INSIDE[2]);
        velocityY.current = 0;
        setMissionStage(3);
        setMove(m => ({ ...m, interact: false }));
    }
    
    // Inside bunker: terminal interactions
    if (isInsideBunker && move.interact && !dialogVisible) {
        for (const term of TERMINAL_CONFIG) {
            if (missionStage === term.activeStage) {
                const tz = BUNKER_INSIDE[2] + term.zOff;
                const tx = BUNKER_INSIDE[0] + term.xOff;
                const d = Math.sqrt((px - tx)**2 + (pz - tz)**2);
                if (d < 3.5) {
                    setMissionStage(term.activeStage + 1);
                    break;
                }
            }
        }
        
        // Reaktor activation
        if (missionStage === 8) {
            const tmZ = BUNKER_INSIDE[2] - 79; // Reactor
            const d = Math.sqrt((px - BUNKER_INSIDE[0])**2 + (pz - tmZ)**2);
            if (d < 3.5) {
                setMissionStage(11);
            }
        }

        // Energy core collection (stage 7)
        if (missionStage === 7) {
            const corePositions = [
                { idx: 0, x: BUNKER_INSIDE[0], z: BUNKER_INSIDE[2] - 24 },  // Energiezellen (Lab Alpha)
                { idx: 1, x: BUNKER_INSIDE[0], z: BUNKER_INSIDE[2] - 60 },  // Antenne (Serverraum)
                { idx: 2, x: BUNKER_INSIDE[0], z: BUNKER_INSIDE[2] - 42 },  // Kühlung (Bio Lab)
                { idx: 3, x: BUNKER_INSIDE[0], z: BUNKER_INSIDE[2] - 91 },  // Sicherheitscode (Vault)
            ];
            for (const core of corePositions) {
                if (!coresCollected[core.idx]) {
                    const d = Math.sqrt((px - core.x)**2 + (pz - core.z)**2);
                    if (d < 3.5) {
                        const newCores = [...coresCollected];
                        newCores[core.idx] = true;
                        setCoresCollected(newCores);
                    }
                }
            }
        }
        
        setMove(m => ({ ...m, interact: false }));
    }

    // Bunker wall collision when inside
    if (isInsideBunker) {
        const bx = BUNKER_INSIDE[0];
        const bz = BUNKER_INSIDE[2];
        // Clamp Z to bunker bounds
        camera.position.z = Math.max(bz - 96, Math.min(bz + 1, camera.position.z));
        // Get corridor width at current Z and clamp X
        const hw = getBunkerHalfWidth(camera.position.z);
        if (hw > 0) {
            camera.position.x = Math.max(bx - hw + 0.3, Math.min(bx + hw - 0.3, camera.position.x));
        }
        // Lock Y to bunker floor
                camera.position.y = BUNKER_INSIDE[1] + eyeHeight;
    }
  })
  
  return (
      <>
          <FlashlightModel isOn={flashlightOn} />
          {inCockpit && <LandedCockpit />}
      </>
  )
}

function CreepyDoll({ position }) {
    // A lost, broken teddy bear sitting in the wasteland
    const eyeMaterialRef = useRef()
    
    useFrame((state) => {
        if (!eyeMaterialRef.current) return
        const pulse = 0.55 + Math.sin(state.clock.getElapsedTime() * 5.5) * 0.25
        eyeMaterialRef.current.opacity = pulse
        eyeMaterialRef.current.color.setRGB(0.8 + pulse * 0.2, 0.05, 0.05)
        }
    )

    return (
        <group position={position} rotation={[0, 0.5, 0]}>
            {/* Body */}
            <mesh position={[0, 0.4, 0]}>
                <capsuleGeometry args={[0.3, 0.4, 4, 8]} />
                <meshStandardMaterial color="#3a2510" roughness={1} />
            </mesh>
            {/* Head (Missing an ear) */}
            <mesh position={[0, 0.9, 0]}>
                <sphereGeometry args={[0.35, 16, 16]} />
                <meshStandardMaterial color="#3a2510" roughness={1} />
            </mesh>
            {/* One Ear */}
            <mesh position={[-0.25, 1.15, 0]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshStandardMaterial color="#3a2510" roughness={1} />
            </mesh>
            {/* Limbs (One arm ripped off) */}
            <mesh position={[0.3, 0.5, 0.2]} rotation={[0.5, 0, -0.5]}>
                <capsuleGeometry args={[0.1, 0.4, 4, 8]} />
                <meshStandardMaterial color="#3a2510" roughness={1} />
            </mesh>
            <mesh position={[-0.2, 0.1, 0.3]} rotation={[-1.5, 0, 0]}>
                <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
                <meshStandardMaterial color="#3a2510" roughness={1} />
            </mesh>
             <mesh position={[0.2, 0.1, 0.3]} rotation={[-1.5, 0, 0]}>
                <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
                <meshStandardMaterial color="#3a2510" roughness={1} />
            </mesh>
            
            {/* Glowing Evil Eye */}
            <group position={[0.12, 0.95, 0.3]}>
                <mesh>
                    <sphereGeometry args={[0.05, 8, 8]} />
                    <meshBasicMaterial ref={eyeMaterialRef} color="red" transparent opacity={0.75} />
                </mesh>
            </group>
            
            {/* Missing Eye (Black hole) */}
             <mesh position={[-0.12, 0.95, 0.32]}>
                <circleGeometry args={[0.04]} />
                <meshBasicMaterial color="black" />
            </mesh>
        </group>
    )
}

function Graveyard() {
    // Procedural graveyard of simple crosses
    const crosses = useMemo(() => {
        const temp = []
        for(let i=0; i<30; i++) {
            const x = (Math.random() - 0.5) * 40 + 30; // Cluster them a bit away
            const z = (Math.random() - 0.5) * 40 + 30;
            const rotY = (Math.random() - 0.5) * 0.5; // Slightly crooked
            const tilt = (Math.random() - 0.5) * 0.4; // Fallen over
            const scale = 0.8 + Math.random() * 0.5;
            // Get ground height
            const y = getTerrainHeight(x, z);
            
            temp.push({ position: [x, y, z], rotation: [tilt, rotY, tilt], scale })
        }
        return temp;
    }, [])

    return (
        <group>
            {crosses.map((c, i) => (
                <group key={i} position={c.position} rotation={c.rotation} scale={c.scale}>
                    {/* Vertical post */}
                    <mesh position={[0, 1, 0]}>
                        <boxGeometry args={[0.15, 2, 0.15]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={1} />
                    </mesh>
                    {/* Horizontal bar */}
                    <mesh position={[0, 1.4, 0]}>
                        <boxGeometry args={[1.2, 0.15, 0.15]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={1} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

function TwistedRuins() {
    // Replaces simple blocks with twisted metal beams and concrete slabs
    const beams = useMemo(() => {
        const temp = [];
        const count = 280;
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 200; // Farther out
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            const type = Math.random() > 0.7 ? 'slab' : 'beam';
            const y = getTerrainHeight(x, z);
            
            const scale = type === 'slab' 
                ? [2 + Math.random()*5, 0.5 + Math.random(), 2 + Math.random()*5]
                : [0.1 + Math.random()*0.2, 4 + Math.random()*10, 0.1 + Math.random()*0.2];

            const rotation = [Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI];
            
            temp.push({ 
                position: [x, y + scale[1]/2, z], 
                rotation, 
                scale,
                type 
            });
        }
        return temp;
    }, [])
    
    // Split into two instance meshes for performance (one for beams, one for slabs)
    const slabData = beams.filter(b => b.type === 'slab');
    const beamData = beams.filter(b => b.type === 'beam');

    return (
        <group>
            {/* Concrete Slabs */}
            <Instances range={slabData.length}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#222" roughness={0.9} />
                {slabData.map((d, i) => (
                    <Instance key={i} position={d.position} rotation={d.rotation} scale={d.scale} />
                ))}
            </Instances>
            
            {/* Rusted Beams */}
            <Instances range={beamData.length}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#301510" roughness={0.7} metalness={0.6} />
                {beamData.map((d, i) => (
                    <Instance key={i} position={d.position} rotation={d.rotation} scale={d.scale} />
                ))}
            </Instances>
        </group>
    )
}

function WastelandGround() {
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(1000, 1000, 180, 180); 
        geo.rotateX(-Math.PI / 2);
        
        const posAttribute = geo.attributes.position;
        const vertex = new THREE.Vector3();
        
        for (let i = 0; i < posAttribute.count; i++) {
            vertex.fromBufferAttribute(posAttribute, i);
            vertex.y = getTerrainHeight(vertex.x, vertex.z);
            posAttribute.setY(i, vertex.y);
        }
        
        geo.computeVertexNormals();
        return geo;
    }, []);

    const groundMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardMaterial({
            color: '#111111',
            roughness: 0.95,
            metalness: 0.0,
        })
        
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uColorA = { value: new THREE.Color('#050505') }
            shader.uniforms.uColorB = { value: new THREE.Color('#1a100a') }
            shader.uniforms.uColorC = { value: new THREE.Color('#203020') }
            
            // Add varyings to vertex shader
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                varying float vElevation;
                varying vec2 vUv2;`
            )
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                vElevation = position.y;
                vUv2 = uv;`
            )
            
            // Override the color in fragment shader
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                uniform vec3 uColorC;
                varying float vElevation;
                varying vec2 vUv2;
                
                float rand2(vec2 co){
                    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
                }`
            )
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `#include <color_fragment>
                float grit = rand2(vUv2 * 500.0) * 0.15;
                vec3 groundCol = mix(uColorA, uColorB, smoothstep(-5.0, 5.0, vElevation + grit * 10.0));
                float toxic = smoothstep(-5.0, -8.0, vElevation);
                groundCol = mix(groundCol, uColorC, toxic * 0.4);
                diffuseColor.rgb = groundCol;`
            )
        }
        
        return mat
    }, [])

    return (
        <mesh geometry={geometry} material={groundMaterial} receiveShadow />
    )
}

function AshParticles() {
    const count = 1800;
    const [positions] = useState(() => {
        const pos = new Float32Array(count * 3);
        const color = new Float32Array(count * 3);
        for(let i=0; i<count; i++) {
            pos[i*3] = (Math.random() - 0.5) * 200;
            pos[i*3+1] = Math.random() * 60; 
            pos[i*3+2] = (Math.random() - 0.5) * 200;
        }
        return pos;
    });

    const particlesRef = useRef();
    
    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        if(particlesRef.current) {
             particlesRef.current.rotation.y = time * 0.05;
             particlesRef.current.position.y = Math.sin(time * 0.1) * 2;
        }
    })

    return (
        <points ref={particlesRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.15} color="#888888" transparent opacity={0.6} />
        </points>
    )
}

function DeadTrees() {
    // Generates dead trees
    const trees = useMemo(() => {
        const temp = []
        for(let i=0; i<64; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 250;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            const y = getTerrainHeight(x, z);
            const height = 4 + Math.random() * 6;
            const rotY = Math.random() * Math.PI;
            const lean = (Math.random() - 0.5) * 0.3;
            
            temp.push({ position: [x, y + height/2 - 0.5, z], height, rotation: [lean, rotY, lean] })
        }
        return temp;
    }, [])

    return (
        <group>
            {trees.map((t, i) => (
                <group key={i} position={t.position} rotation={t.rotation}>
                    {/* Trunk */}
                    <mesh>
                         <cylinderGeometry args={[0.1, 0.4, t.height, 6]} />
                         <meshStandardMaterial color="#111" roughness={1} />
                    </mesh>
                    {/* Bare branches - simple rotated cylinders */}
                    <mesh position={[0, t.height * 0.2, 0]} rotation={[0.5, 0, 1]}>
                         <cylinderGeometry args={[0.05, 0.1, 2, 4]} />
                         <meshStandardMaterial color="#111" roughness={1} />
                    </mesh>
                    <mesh position={[0, t.height * 0.3, 0]} rotation={[-0.5, 2, -1]}>
                         <cylinderGeometry args={[0.05, 0.1, 1.5, 4]} />
                         <meshStandardMaterial color="#111" roughness={1} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

function Rubble() {
    // Scattered small rocks logic...
    const stones = useMemo(() => {
        const temp = [];
        for(let i=0; i<500; i++) {
            const x = (Math.random() - 0.5) * 500;
            const z = (Math.random() - 0.5) * 500;
            if (Math.abs(x) < 10 && Math.abs(z) < 10) continue; // Clear spawn
            // Also keep bunker area clear
            if (Math.abs(x - BUNKER_POS[0]) < 15 && Math.abs(z - BUNKER_POS[2]) < 15) continue;

            const y = getTerrainHeight(x, z);
            const scale = Math.random() * 0.5 + 0.1;
            temp.push({ position: [x, y, z], scale, rotation: [Math.random()*3, Math.random()*3, Math.random()*3] });
        }
        return temp;
    }, []);

    return (
        <Instances range={stones.length}>
            <dodecahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial color="#333" roughness={0.8} />
            {stones.map((s, i) => (
                <Instance key={i} position={s.position} scale={s.scale} rotation={s.rotation} />
            ))}
        </Instances>
    )
}

function ParkedSpaceship() {
    const y = getTerrainHeight(0, 15);
    return (
        <group position={[0, y + 2.2, 15]} scale={5}>
            <group>
                <mesh position={[0, 0, 0.35]}>
                    <boxGeometry args={[1.05, 0.55, 3.3]} />
                    <meshStandardMaterial color="#22262f" roughness={0.35} metalness={0.82} />
                </mesh>
                <mesh position={[0, 0.28, -0.45]}>
                    <coneGeometry args={[0.55, 1.15, 6]} />
                    <meshStandardMaterial color="#2b313d" roughness={0.28} metalness={0.8} />
                </mesh>
                
                {/* Landing legs */}
                <mesh position={[0.5, -0.4, 1.5]} rotation={[0, 0, -0.2]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.8]} />
                    <meshStandardMaterial color="#444" />
                </mesh>
                <mesh position={[-0.5, -0.4, 1.5]} rotation={[0, 0, 0.2]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.8]} />
                    <meshStandardMaterial color="#444" />
                </mesh>
                <mesh position={[0, -0.4, -0.5]} rotation={[0.2, 0, 0]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.8]} />
                    <meshStandardMaterial color="#444" />
                </mesh>

                <mesh position={[1.55, -0.2, 0.9]}>
                    <boxGeometry args={[2.2, 0.1, 1.6]} />
                    <meshStandardMaterial color="#353b48" roughness={0.4} metalness={0.72} />
                </mesh>
                <mesh position={[-1.55, -0.2, 0.9]}>
                    <boxGeometry args={[2.2, 0.1, 1.6]} />
                    <meshStandardMaterial color="#353b48" roughness={0.4} metalness={0.72} />
                </mesh>
                <mesh position={[0.95, 0, 2.15]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.28, 0.42, 1.1, 12]} />
                    <meshStandardMaterial color="#12161d" roughness={0.4} metalness={0.9} />
                </mesh>
                <mesh position={[-0.95, 0, 2.15]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.28, 0.42, 1.1, 12]} />
                    <meshStandardMaterial color="#12161d" roughness={0.4} metalness={0.9} />
                </mesh>
                <mesh position={[0, 0.42, -0.52]}>
                    <boxGeometry args={[0.86, 0.42, 1.05]} />
                    <meshStandardMaterial color="#00aaff" transparent opacity={0.3} roughness={0.06} metalness={0.92} side={THREE.DoubleSide} />
                </mesh>

                {/* Cockpit Interior */}
                <group position={[0, 0.35, -0.5]}>
                    {/* Seat */}
                    <mesh position={[0, -0.1, 0.2]}>
                        <boxGeometry args={[0.4, 0.3, 0.4]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>
                    {/* Glowing Command Console */}
                    <mesh position={[0, -0.05, -0.2]} rotation={[0.4, 0, 0]}>
                        <boxGeometry args={[0.6, 0.2, 0.1]} />
                        <meshBasicMaterial color="#111" />
                    </mesh>
                    <Html position={[0, 0.05, -0.18]} rotation={[0.4, 0, 0]} transform distanceFactor={1.5}>
                        <div style={{ color: '#ff3300', fontFamily: 'monospace', fontSize: '12px', width: '250px', textAlign: 'center', background: 'rgba(20,0,0,0.8)', padding: '5px', border: '1px solid #ff3300', textShadow: '0 0 5px #ff3300' }}>
                            <span style={{ fontWeight: 'bold' }}>SYSTEMWARNUNG</span><br/>
                            KEINE ANTWORT VON DER ERDE...<br/>
                            <span style={{ fontSize: '10px' }}>Umfeld: Nuklearer Winter / Toxisch</span>
                        </div>
                    </Html>
                    <pointLight position={[0, 0.1, -0.1]} color="#ff3300" intensity={0.5} distance={1.5} />
                    
                    {/* Emergency red blinking light */}
                    <mesh position={[-0.3, 0.15, -0.3]}>
                        <sphereGeometry args={[0.02, 8, 8]} />
                        <meshBasicMaterial color="#ff0000" />
                    </mesh>
                    <pointLight position={[-0.3, 0.15, -0.3]} color="#ff0000" intensity={1} distance={1.5} />
                </group>
            </group>
        </group>
    )
}

// ============= MISSION COMPONENTS =============

function SignalBeacon({ missionStage }) {
    const beaconRef = useRef()
    const glowRef = useRef()
    
    if (missionStage < 1 || missionStage > 2) return null;
    
    const beaconY = getTerrainHeight(BUNKER_ENTRANCE[0], BUNKER_ENTRANCE[2]) + 8;
    
    return (
        <group position={[BUNKER_ENTRANCE[0], beaconY, BUNKER_ENTRANCE[2]]}>
            {/* Pulsing beacon light */}
            <mesh ref={beaconRef}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshBasicMaterial color="#00ff88" transparent opacity={0.8} />
            </mesh>
            {/* Glow sphere */}
            <mesh ref={glowRef} scale={2}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial color="#00ff44" transparent opacity={0.15} />
            </mesh>
            {/* Vertical beam */}
            <mesh position={[0, 15, 0]}>
                <cylinderGeometry args={[0.05, 0.2, 30, 8]} />
                <meshBasicMaterial color="#00ff66" transparent opacity={0.3} />
            </mesh>
            {/* Prompt panel */}
            <mesh position={[0, 2.3, 0]}>
                <planeGeometry args={[2.2, 0.55]} />
                <meshBasicMaterial color="#00ff88" transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2.3, 0.01]}>
                <planeGeometry args={[2.35, 0.7]} />
                <meshBasicMaterial color="#00ff88" transparent opacity={0.14} wireframe side={THREE.DoubleSide} />
            </mesh>
        </group>
    )
}

function Bunker({ missionStage }) {
    const bunkerY = getTerrainHeight(BUNKER_POS[0], BUNKER_POS[2]);
    const doorGlowRef = useRef()
    
    useFrame((state) => {
        if (doorGlowRef.current && missionStage >= 1 && missionStage <= 2) {
            doorGlowRef.current.intensity = 2 + Math.sin(state.clock.getElapsedTime() * 3) * 1;
        }
    })
    
    return (
        <group position={[BUNKER_POS[0], bunkerY, BUNKER_POS[2]]}>
            {/* Main bunker structure - half-buried concrete block */}
            <mesh position={[0, 1, -4]} castShadow receiveShadow>
                <boxGeometry args={[10, 4, 12]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.95} metalness={0.1} />
            </mesh>
            
            {/* Roof (slightly angled) */}
            <mesh position={[0, 3.2, -4]} rotation={[0.05, 0, 0]} castShadow>
                <boxGeometry args={[11, 0.4, 13]} />
                <meshStandardMaterial color="#111" roughness={0.9} metalness={0.2} />
            </mesh>
            
            {/* Door frame */}
            <mesh position={[0, 1.5, 1.8]}>
                <boxGeometry args={[3, 3.5, 0.5]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.8} metalness={0.4} />
            </mesh>
            
            {/* Door opening (dark void) */}
            <mesh position={[0, 1.2, 2.05]}>
                <planeGeometry args={[2, 2.8]} />
                <meshBasicMaterial color="#000000" />
            </mesh>
            
            {/* Door glow when mission is active */}
            {missionStage >= 1 && missionStage <= 2 && (
                <pointLight 
                    ref={doorGlowRef}
                    position={[0, 1.5, 3]} 
                    color="#00ff66" 
                    distance={8} 
                    decay={2} 
                />
            )}
            
            {/* Warning signs */}
            <mesh position={[3.5, 2, 2]} rotation={[0, -0.1, 0]}>
                <planeGeometry args={[1.5, 1]} />
                <meshBasicMaterial color="#ff4400" transparent opacity={0.6} />
            </mesh>
            
            {/* Rubble around entrance */}
            {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const dist = 5 + Math.random() * 3;
                return (
                    <mesh key={i} position={[Math.cos(angle) * dist, 0.2, Math.sin(angle) * dist + -2]} 
                          rotation={[Math.random(), Math.random(), Math.random()]}>
                        <dodecahedronGeometry args={[0.3 + Math.random() * 0.5, 0]} />
                        <meshStandardMaterial color="#222" roughness={0.9} />
                    </mesh>
                )
            })}
            
            {/* Rusted pipes on exterior */}
            <mesh position={[-5.2, 2, -2]} rotation={[0, 0, 0.1]}>
                <cylinderGeometry args={[0.15, 0.15, 5, 8]} />
                <meshStandardMaterial color="#301510" roughness={0.7} metalness={0.6} />
            </mesh>
            <mesh position={[5.2, 1.5, -6]} rotation={[0.2, 0, -0.1]}>
                <cylinderGeometry args={[0.1, 0.1, 4, 8]} />
                <meshStandardMaterial color="#301510" roughness={0.7} metalness={0.6} />
            </mesh>
        </group>
    )
}

function BunkerInterior({ missionStage, setMissionStage, coresCollected }) {
    if (missionStage < 3 || missionStage >= 12) return null;
    
    const bx = BUNKER_INSIDE[0];
    const by = BUNKER_INSIDE[1];
    const bz = BUNKER_INSIDE[2];
    
    // Generate wall segments from room layout
    const wallSegments = useMemo(() => {
        const segs = [];
        BUNKER_ROOMS.forEach((room, idx) => {
            const length = Math.abs(room.zEnd - room.zStart);
            const midZ = (room.zStart + room.zEnd) / 2;
            // Left wall
            segs.push({ pos: [bx - room.hw - 0.25, by + 2, bz + midZ], size: [0.5, 4, length] });
            // Right wall
            segs.push({ pos: [bx + room.hw + 0.25, by + 2, bz + midZ], size: [0.5, 4, length] });
            // Transition walls at boundaries
            if (idx < BUNKER_ROOMS.length - 1) {
                const next = BUNKER_ROOMS[idx + 1];
                if (next.hw < room.hw) {
                    const gap = room.hw - next.hw;
                    segs.push({ pos: [bx - next.hw - gap/2, by + 2, bz + room.zEnd], size: [gap, 4, 0.5] });
                    segs.push({ pos: [bx + next.hw + gap/2, by + 2, bz + room.zEnd], size: [gap, 4, 0.5] });
                }
                if (room.hw < next.hw) {
                    const gap = next.hw - room.hw;
                    segs.push({ pos: [bx - room.hw - gap/2, by + 2, bz + room.zEnd], size: [gap, 4, 0.5] });
                    segs.push({ pos: [bx + room.hw + gap/2, by + 2, bz + room.zEnd], size: [gap, 4, 0.5] });
                }
            }
        });
        return segs;
    }, []);
    
    return (
        <group>
            {/* Floor - entire bunker */}
            <mesh position={[bx, by, bz - 48]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                <planeGeometry args={[14, 100]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.95} />
            </mesh>
            {/* Ceiling */}
            <mesh position={[bx, by + 4, bz - 48]} rotation={[Math.PI/2, 0, 0]}>
                <planeGeometry args={[14, 100]} />
                <meshStandardMaterial color="#080808" roughness={0.95} />
            </mesh>
            {/* Back wall */}
            <mesh position={[bx, by + 2, bz - 96]}>
                <boxGeometry args={[8, 4, 0.5]} />
                <meshStandardMaterial color="#111" roughness={0.9} metalness={0.1} />
            </mesh>
            {/* Front wall with entrance */}
            <mesh position={[bx - 3.5, by + 2, bz + 0.5]}>
                <boxGeometry args={[3, 4, 0.5]} />
                <meshStandardMaterial color="#111" roughness={0.9} metalness={0.1} />
            </mesh>
            <mesh position={[bx + 3.5, by + 2, bz + 0.5]}>
                <boxGeometry args={[3, 4, 0.5]} />
                <meshStandardMaterial color="#111" roughness={0.9} metalness={0.1} />
            </mesh>
            
            {/* All wall segments */}
            {wallSegments.map((w, i) => (
                <mesh key={i} position={w.pos}>
                    <boxGeometry args={w.size} />
                    <meshStandardMaterial color="#111" roughness={0.9} metalness={0.1} />
                </mesh>
            ))}
            
            {/* === LIGHTING === */}
            {/* Combined room lights - fewer for performance */}
            <pointLight position={[bx, by + 3.5, bz - 12]} color="#334455" intensity={1.0} distance={28} decay={2} />
            <pointLight position={[bx, by + 3.5, bz - 40]} color="#223322" intensity={0.8} distance={28} decay={2} />
            <pointLight position={[bx, by + 3.5, bz - 62]} color="#222244" intensity={0.8} distance={28} decay={2} />
            <pointLight position={[bx, by + 3.5, bz - 82]} color="#442222" intensity={1.0} distance={24} decay={2} />
            
            {/* === 6 TERMINALS === */}
            {TERMINAL_CONFIG.map((tc, i) => {
                const isActive = missionStage === tc.activeStage;
                return (
                    <group key={i} position={[bx + tc.xOff, by + 1.2, bz + tc.zOff]}>
                        {/* Desk */}
                        <mesh position={[0, -0.5, 0]}>
                            <boxGeometry args={[2, 0.1, 1]} />
                            <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.5} />
                        </mesh>
                        {/* Screen frame */}
                        <mesh position={[0, 0.3, -0.3]} rotation={[-0.2, 0, 0]}>
                            <boxGeometry args={[1.5, 1.1, 0.08]} />
                            <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.4} />
                        </mesh>
                        {/* Screen */}
                        <mesh position={[0, 0.3, -0.26]} rotation={[-0.2, 0, 0]}>
                            <planeGeometry args={[1.3, 0.9]} />
                            <meshBasicMaterial color={isActive ? tc.darkColor : '#050505'} />
                        </mesh>
                        {/* Screen glow overlay */}
                        <mesh position={[0, 0.3, -0.255]} rotation={[-0.2, 0, 0]}>
                            <planeGeometry args={[1.2, 0.8]} />
                            <meshBasicMaterial color={isActive ? tc.color : tc.darkColor} transparent opacity={isActive ? 0.4 : 0.05} />
                        </mesh>
                        {/* Chair */}
                        <mesh position={[0, -0.3, 0.8]}>
                            <boxGeometry args={[0.5, 0.08, 0.5]} />
                            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                        </mesh>
                        {/* Terminal light - only for active terminal */}
                        {isActive && (
                            <pointLight position={[0, 0.5, 0.5]} color={tc.color} distance={5} decay={2} intensity={2.5} />
                        )}
                        {/* 3D Interaction prompt - no Html DOM */}
                        {isActive && (
                            <mesh position={[0, 1.6, 0]}>
                                <planeGeometry args={[1.4, 0.3]} />
                                <meshBasicMaterial color={tc.color} transparent opacity={0.6} />
                            </mesh>
                        )}
                    </group>
                );
            })}
            
            {/* === 4 MISSION TASKS === */}
            {missionStage === 7 && (
                <>
                    {/* Energiezelle (Lab Alpha) */}
                    {!coresCollected[0] && (
                        <group position={[bx, by + 1.5, bz - 24]}>
                            <pointLight color="#ffaa00" distance={4} intensity={2} />
                            <mesh rotation={[0, Math.PI/4, 0]}>
                                <boxGeometry args={[0.4, 0.8, 0.4]} />
                                <meshBasicMaterial color="#ffaa00" />
                            </mesh>
                        </group>
                    )}
                    {/* Antenne (Serverraum) */}
                    {!coresCollected[1] && (
                        <group position={[bx, by + 2, bz - 60]}>
                            <pointLight color="#00aaff" distance={4} intensity={2} />
                            <mesh>
                                <cylinderGeometry args={[0.1, 0.1, 1.5, 8]} />
                                <meshBasicMaterial color="#00aaff" />
                            </mesh>
                        </group>
                    )}
                    {/* Kühlung (Bio-Labor) */}
                    {!coresCollected[2] && (
                        <group position={[bx, by + 1.2, bz - 42]}>
                            <pointLight color="#00ffaa" distance={4} intensity={2} />
                            <mesh rotation={[Math.PI/2, 0, 0]}>
                                <torusGeometry args={[0.3, 0.1, 8, 16]} />
                                <meshBasicMaterial color="#00ffaa" />
                            </mesh>
                        </group>
                    )}
                    {/* Sicherheitscode (Vault) */}
                    {!coresCollected[3] && (
                        <group position={[bx, by + 1.2, bz - 91]}>
                            <pointLight color="#ff00aa" distance={4} intensity={2} />
                            <mesh>
                                <boxGeometry args={[0.6, 0.1, 0.4]} />
                                <meshBasicMaterial color="#ff00aa" />
                            </mesh>
                        </group>
                    )}
                </>
            )}
            
            {/* === ROOM DECORATIONS === */}
            
            {/* Entry Hall: Reception desk, filing cabinets */}
            <mesh position={[bx + 2, by + 0.6, bz - 3]}>
                <boxGeometry args={[3, 1.2, 0.8]} />
                <meshStandardMaterial color="#1a1510" roughness={0.9} />
            </mesh>
            {/* Scattered papers on floor */}
            {[...Array(8)].map((_, i) => (
                <mesh key={`paper-${i}`} position={[bx + (Math.random()-0.5)*6, by + 0.01, bz - 2 - Math.random()*8]} 
                      rotation={[-Math.PI/2, 0, Math.random()*3]}>
                    <planeGeometry args={[0.3, 0.4]} />
                    <meshStandardMaterial color="#ddd" roughness={0.9} />
                </mesh>
            ))}
            
            {/* Lab Alpha: Lab tables with equipment */}
            <mesh position={[bx, by + 0.5, bz - 21]}>
                <boxGeometry args={[4, 1, 1.2]} />
                <meshStandardMaterial color="#222" metalness={0.3} roughness={0.6} />
            </mesh>
            {/* Beakers/flasks */}
            {[...Array(5)].map((_, i) => (
                <mesh key={`flask-${i}`} position={[bx - 1.5 + i * 0.8, by + 1.2, bz - 21]}>
                    <cylinderGeometry args={[0.05, 0.08, 0.3, 8]} />
                    <meshStandardMaterial color="#445566" transparent opacity={0.6} metalness={0.1} roughness={0.2} />
                </mesh>
            ))}
            
            {/* Bio Lab: Containment pods */}
            {[-2, 2].map((xOff, i) => (
                <group key={`pod-${i}`} position={[bx + xOff, by + 1.2, bz - 44]}>
                    <mesh>
                        <cylinderGeometry args={[0.6, 0.6, 2.2, 12]} />
                        <meshStandardMaterial color="#112211" transparent opacity={0.4} metalness={0.3} roughness={0.2} />
                    </mesh>
                    <mesh position={[0, -1.2, 0]}>
                        <cylinderGeometry args={[0.7, 0.7, 0.2, 12]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
                    </mesh>
                </group>
            ))}
            
            {/* Server Room: Server racks */}
            {[-3, -1.5, 0, 1.5, 3].map((xOff, i) => (
                <group key={`rack-${i}`} position={[bx + xOff, by + 1.5, bz - 58]}>
                    <mesh>
                        <boxGeometry args={[0.8, 3, 0.6]} />
                        <meshStandardMaterial color="#0a0a0a" metalness={0.7} roughness={0.3} />
                    </mesh>
                    {/* LED dot instead of PointLight */}
                    <mesh position={[0, 0.5, 0.31]}>
                        <circleGeometry args={[0.04, 6]} />
                        <meshBasicMaterial color={i % 2 === 0 ? '#00ff00' : '#ff0000'} />
                    </mesh>
                </group>
            ))}
            
            {/* Reactor Chamber: Central reactor core */}
            <group position={[bx, by + 0.5, bz - 79]}>
                <mesh position={[0, 1.5, 0]}>
                    <cylinderGeometry args={[1.2, 1.5, 3, 16]} />
                    <meshStandardMaterial color="#1a0a0a" metalness={0.8} roughness={0.3} />
                </mesh>
                <mesh position={[0, 1.5, 0]}>
                    <cylinderGeometry args={[0.8, 0.8, 3.5, 12]} />
                    <meshBasicMaterial color={missionStage >= 8 ? "#ffaa00" : "#220000"} />
                </mesh>
                <pointLight position={[0, 1.5, 0]} color={missionStage >= 8 ? "#ffaa00" : "#ff2200"} distance={8} decay={2} intensity={missionStage >= 8 ? 5 : 1.5} />
                
                {/* Reaktor zündung prompt glow */}
                {missionStage === 8 && (
                    <mesh position={[0, 3.8, 0]}>
                        <planeGeometry args={[2, 0.4]} />
                        <meshBasicMaterial color="#ffaa00" transparent opacity={0.5} side={THREE.DoubleSide} />
                    </mesh>
                )}
                {/* Pipes from reactor */}
                {[0, 1, 2, 3].map(i => (
                    <mesh key={`pipe-${i}`} position={[Math.cos(i*Math.PI/2)*2, 1.5, Math.sin(i*Math.PI/2)*2]} 
                          rotation={[0, 0, Math.PI/2]}>
                        <cylinderGeometry args={[0.1, 0.1, 2, 8]} />
                        <meshStandardMaterial color="#301510" roughness={0.7} metalness={0.6} />
                    </mesh>
                ))}
            </group>
            
            {/* Vault: Clean, minimal - just the time machine */}
            {/* === TIME MACHINE === */}
            <group position={[bx, by + 0.5, bz - 94]}>
                {/* Base platform */}
                <mesh position={[0, 0, 0]}>
                    <cylinderGeometry args={[2, 2.2, 0.3, 16]} />
                    <meshStandardMaterial color="#111" metalness={0.8} roughness={0.3} />
                </mesh>
                {/* Central column */}
                <mesh position={[0, 1.5, 0]}>
                    <cylinderGeometry args={[0.3, 0.5, 3, 12]} />
                    <meshStandardMaterial color="#1a1a2a" metalness={0.9} roughness={0.2} />
                </mesh>
                {/* Energy ring horizontal */}
                <mesh position={[0, 2.5, 0]} rotation={[Math.PI/2, 0, 0]}>
                    <torusGeometry args={[1.2, 0.08, 8, 32]} />
                    <meshBasicMaterial color={"#001133"} />
                </mesh>
                {/* Energy ring vertical */}
                <mesh position={[0, 2.5, 0]} rotation={[0, 0, 0]}>
                    <torusGeometry args={[1.2, 0.08, 8, 32]} />
                    <meshBasicMaterial color={"#001133"} />
                </mesh>
                {/* Core orb */}
                <mesh position={[0, 2.5, 0]}>
                    <sphereGeometry args={[0.4, 32, 32]} />
                    <meshBasicMaterial color={"#0a0a1a"} />
                </mesh>
                <pointLight position={[0, 2.5, 0]} color="#00aaff" distance={10} decay={2} intensity={0.1} />
                
                {/* Side panels */}
                {[0, 1, 2, 3].map(i => (
                    <mesh key={i} position={[Math.cos(i * Math.PI/2) * 1.5, 0.8, Math.sin(i * Math.PI/2) * 1.5]} 
                          rotation={[0, -i * Math.PI/2, 0]}>
                        <boxGeometry args={[0.8, 1.5, 0.1]} />
                        <meshStandardMaterial color="#0a0a1a" metalness={0.7} roughness={0.3} 
                            emissive={missionStage >= 10 ? "#001a33" : "#000000"} />
                    </mesh>
                ))}
            </group>
            
            {/* Cable runs on ceiling throughout */}
            {[-3, 3].map((xOff, ci) => (
                <mesh key={`cable-${ci}`} position={[bx + xOff, by + 3.9, bz - 48]} rotation={[Math.PI/2, 0, 0]}>
                    <cylinderGeometry args={[0.03, 0.03, 96, 4]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
            ))}
            
            {/* Scattered crates throughout */}
            {[
                [bx - 3.5, by + 0.4, bz - 9, 0.8],
                [bx + 3, by + 0.3, bz - 15, 0.6],
                [bx - 3, by + 0.5, bz - 28, 1],
                [bx + 3.5, by + 0.35, bz - 35, 0.7],
                [bx - 3, by + 0.4, bz - 50, 0.8],
                [bx + 4, by + 0.3, bz - 65, 0.6],
                [bx - 4, by + 0.5, bz - 75, 1],
                [bx + 2, by + 0.4, bz - 88, 0.8],
            ].map(([x, y, z, s], i) => (
                <mesh key={`crate-${i}`} position={[x, y, z]}>
                    <boxGeometry args={[s, s * 0.8, s]} />
                    <meshStandardMaterial color="#1a1510" roughness={0.9} />
                </mesh>
            ))}

            {/* === ENERGY CORES (Stage 9 - collect 3) === */}
            {missionStage === 9 && (
                <>
                    {/* Core 1: Lab Alpha */}
                    {!coresCollected[0] && (
                        <group position={[bx, by + 1.8, bz - 24]}>
                            <mesh>
                                <octahedronGeometry args={[0.35, 1]} />
                                <meshBasicMaterial color="#00ffaa" transparent opacity={0.9} />
                            </mesh>
                            <mesh>
                                <octahedronGeometry args={[0.5, 1]} />
                                <meshBasicMaterial color="#00ffaa" transparent opacity={0.15} wireframe />
                            </mesh>
                            <pointLight color="#00ffaa" distance={8} decay={2} intensity={3} />
                        </group>
                    )}
                    {/* Core 2: Bio Lab */}
                    {!coresCollected[1] && (
                        <group position={[bx, by + 1.8, bz - 42]}>
                            <mesh>
                                <octahedronGeometry args={[0.35, 1]} />
                                <meshBasicMaterial color="#ffaa00" transparent opacity={0.9} />
                            </mesh>
                            <mesh>
                                <octahedronGeometry args={[0.5, 1]} />
                                <meshBasicMaterial color="#ffaa00" transparent opacity={0.15} wireframe />
                            </mesh>
                            <pointLight color="#ffaa00" distance={8} decay={2} intensity={3} />
                        </group>
                    )}
                    {/* Core 3: Reactor Chamber */}
                    {!coresCollected[2] && (
                        <group position={[bx, by + 1.8, bz - 79]}>
                            <mesh>
                                <octahedronGeometry args={[0.35, 1]} />
                                <meshBasicMaterial color="#ff44aa" transparent opacity={0.9} />
                            </mesh>
                            <mesh>
                                <octahedronGeometry args={[0.5, 1]} />
                                <meshBasicMaterial color="#ff44aa" transparent opacity={0.15} wireframe />
                            </mesh>
                            <pointLight color="#ff44aa" distance={8} decay={2} intensity={3} />
                        </group>
                    )}
                </>
            )}
        </group>
    )
}

function BunkerBarrier({ missionStage }) {
    if (missionStage >= 3) return null;
    
    const bunkerY = getTerrainHeight(BUNKER_POS[0], BUNKER_POS[2]);
    
    return (
        <group position={[BUNKER_POS[0], bunkerY, BUNKER_POS[2]]}>
            {[...Array(20)].map((_, i) => {
                const angle = (i / 20) * Math.PI * 2;
                const dist = 11 + Math.random() * 2;
                const height = 1 + Math.random() * 3;
                return (
                    <mesh key={i} 
                        position={[Math.cos(angle) * dist, height/2, Math.sin(angle) * dist]}
                        rotation={[Math.random() * 0.3, angle, Math.random() * 0.3]}>
                        <boxGeometry args={[1.5 + Math.random(), height, 0.5 + Math.random()]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.2} />
                    </mesh>
                )
            })}
        </group>
    )
}

// ============= RESTORED WORLD (after time reversal) =============

function ModernGround() {
    return (
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[800, 800]} />
            <meshStandardMaterial color="#1a2e19" roughness={0.8} metalness={0.05} />
        </mesh>
    )
}

function ModernRoads() {
    const roadLines = [-80, 0, 80];
    return (
        <group>
            {roadLines.map((pos) => (
                <group key={`z-${pos}`}>
                    <mesh position={[pos, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
                        <planeGeometry args={[14, 600]} />
                        <meshStandardMaterial color="#222" roughness={0.9} />
                    </mesh>
                    {[...Array(60)].map((_, i) => (
                        <mesh key={`z-mark-${i}`} position={[pos, 0.04, -290 + i * 10]} rotation={[-Math.PI/2, 0, 0]}>
                            <planeGeometry args={[0.3, 4]} />
                            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
                        </mesh>
                    ))}
                    {[-7.5, 7.5].map((off, j) => (
                        <mesh key={`z-edge-${j}`} position={[pos + off, 0.03, 0]} rotation={[-Math.PI/2, 0, 0]}>
                            <planeGeometry args={[1.5, 600]} />
                            <meshStandardMaterial color="#555" roughness={0.95} />
                        </mesh>
                    ))}
                </group>
            ))}
            {roadLines.map((pos) => (
                <group key={`x-${pos}`}>
                    <mesh position={[0, 0.02, pos]} rotation={[-Math.PI/2, 0, 0]}>
                        <planeGeometry args={[600, 14]} />
                        <meshStandardMaterial color="#222" roughness={0.9} />
                    </mesh>
                    {[...Array(60)].map((_, i) => (
                        <mesh key={`x-mark-${i}`} position={[-290 + i * 10, 0.04, pos]} rotation={[-Math.PI/2, 0, 0]}>
                            <planeGeometry args={[4, 0.3]} />
                            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
                        </mesh>
                    ))}
                    {[-7.5, 7.5].map((off, j) => (
                        <mesh key={`x-edge-${j}`} position={[0, 0.03, pos + off]} rotation={[-Math.PI/2, 0, 0]}>
                            <planeGeometry args={[600, 1.5]} />
                            <meshStandardMaterial color="#555" roughness={0.95} />
                        </mesh>
                    ))}
                </group>
            ))}
            {roadLines.map(x => roadLines.map(z => (
                <mesh key={`int-${x}-${z}`} position={[x, 0.05, z]} rotation={[-Math.PI/2, 0, 0]}>
                    <planeGeometry args={[14, 14]} />
                    <meshStandardMaterial color="#222" roughness={0.9} />
                </mesh>
            )))}
        </group>
    )
}

function ModernBuildings() {
    const buildings = useMemo(() => {
        const temp = [];
        for(let i = 0; i < 150; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 220;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            // Check if on any road (-80, 0, 80)
            const onRoad = [-80, 0, 80].some(r => Math.abs(x - r) < 16 || Math.abs(z - r) < 16);
            if (onRoad) continue;

            const height = 15 + Math.random() * 60;
            const width = 6 + Math.random() * 8;
            const depth = 6 + Math.random() * 8;
            temp.push({ x, z, height, width, depth, rotY: Math.floor(Math.random() * 4) * (Math.PI/2) });
        }
        return temp;
    }, []);

    return (
        <group>
            {buildings.map((b, i) => (
                <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rotY, 0]}>
                    <mesh position={[0, b.height / 2, 0]}>
                        <boxGeometry args={[b.width, b.height, b.depth]} />
                        <meshStandardMaterial color="#22252a" metalness={0.1} roughness={0.9} />
                    </mesh>
                    {/* Glowing windows */}
                    {[0.2, 0.4, 0.6, 0.8].map((frac, wi) => (
                        <mesh key={wi} position={[0, b.height * frac, b.depth / 2 + 0.05]}>
                            <boxGeometry args={[b.width * 0.7, b.height * 0.08, 0.1]} />
                            <meshBasicMaterial color="#ffccaa" />
                        </mesh>
                    ))}
                    {[0.3, 0.5, 0.7, 0.9].map((frac, wi) => (
                        <mesh key={`b-${wi}`} position={[0, b.height * frac, -b.depth / 2 - 0.05]}>
                            <boxGeometry args={[b.width * 0.7, b.height * 0.08, 0.1]} />
                            <meshBasicMaterial color="#ffccaa" />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    )
}

function NormalTrees() {
    const trees = useMemo(() => {
        const temp = [];
        for (let i = 0; i < 42; i++) {
            const x = (Math.random() - 0.5) * 400;
            const z = (Math.random() - 0.5) * 400;
            if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
            temp.push({
                x, z,
                height: 5 + Math.random() * 8,
                canopy: 1.5 + Math.random() * 2
            });
        }
        return temp;
    }, []);

    return (
        <group>
            {trees.map((t, i) => (
                <group key={i} position={[t.x, 0, t.z]}>
                    <mesh position={[0, t.height / 2, 0]}>
                        <cylinderGeometry args={[0.2, 0.4, t.height, 8]} />
                        <meshStandardMaterial color="#3a2512" roughness={0.9} />
                    </mesh>
                    <mesh position={[0, t.height + t.canopy * 0.2, 0]}>
                        <dodecahedronGeometry args={[t.canopy, 1]} />
                        <meshStandardMaterial color="#2d5e23" roughness={0.8} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

function NPC({ cx, cz, radius, speed, phase, shirt }) {
    const groupRef = useRef();
    const leftLegRef = useRef();
    const rightLegRef = useRef();
    const leftArmRef = useRef();
    const rightArmRef = useRef();
    
    useFrame((state) => {
        if (!groupRef.current) return;
        const t = state.clock.getElapsedTime() * speed + phase;
        groupRef.current.position.x = cx + Math.cos(t) * radius;
        groupRef.current.position.z = cz + Math.sin(t) * radius;
        groupRef.current.rotation.y = t + Math.PI/2;
        const legSwing = Math.sin(t * 8) * 0.4;
        if (leftLegRef.current) leftLegRef.current.rotation.x = legSwing;
        if (rightLegRef.current) rightLegRef.current.rotation.x = -legSwing;
        if (leftArmRef.current) leftArmRef.current.rotation.x = -legSwing * 0.8;
        if (rightArmRef.current) rightArmRef.current.rotation.x = legSwing * 0.8;
    });

    return (
        <group ref={groupRef} position={[cx, 0, cz]} scale={1.1}>
            <mesh position={[0, 1.1, 0]}>
                <capsuleGeometry args={[0.26, 0.72, 4, 8]} />
                <meshStandardMaterial color={shirt} metalness={0.3} roughness={0.5} />
            </mesh>
            <mesh position={[0, 1.82, 0]}>
                <sphereGeometry args={[0.22, 10, 10]} />
                <meshStandardMaterial color="#deb887" />
            </mesh>
            <group ref={leftArmRef} position={[0.34, 1.2, 0]}>
                <mesh>
                    <capsuleGeometry args={[0.06, 0.52, 4, 8]} />
                    <meshStandardMaterial color="#d9b28c" roughness={0.7} />
                </mesh>
            </group>
            <group ref={rightArmRef} position={[-0.34, 1.2, 0]}>
                <mesh>
                    <capsuleGeometry args={[0.06, 0.52, 4, 8]} />
                    <meshStandardMaterial color="#d9b28c" roughness={0.7} />
                </mesh>
            </group>
            <group ref={leftLegRef} position={[0.12, 0.48, 0]}>
                <mesh>
                    <capsuleGeometry args={[0.08, 0.62, 4, 8]} />
                    <meshStandardMaterial color="#1a2030" metalness={0.4} />
                </mesh>
            </group>
            <group ref={rightLegRef} position={[-0.12, 0.48, 0]}>
                <mesh>
                    <capsuleGeometry args={[0.08, 0.62, 4, 8]} />
                    <meshStandardMaterial color="#1a2030" metalness={0.4} />
                </mesh>
            </group>
        </group>
    );
}

function NormalNPCs() {
    const npcs = useMemo(() => {
        const shirts = ['#2244aa', '#aa2255', '#22aa88', '#7733cc', '#cc8822', '#2288cc', '#55cc33', '#cc6633',
                        '#3355cc', '#cc3366', '#33cc88', '#6633cc', '#cc6622', '#4488cc', '#88cc33', '#cc7744'];
        const temp = [];
        const lanes = [
            [-34, -18], [34, 18], [-22, 22], [22, -22],
            [-12, 36], [12, -36], [-40, 0], [40, 0],
        ];
        for(let i = 0; i < 8; i++) {
            temp.push({
                cx: lanes[i][0], cz: lanes[i][1],
                radius: 6 + Math.random() * 10, speed: 0.12 + Math.random() * 0.12,
                phase: Math.random() * Math.PI * 2, shirt: shirts[i]
            });
        }
        return temp;
    }, []);
    return npcs.map((npc, i) => <NPC key={i} {...npc} />);
}

function StreetLamps() {
    const posts = useMemo(() => {
        const temp = [];
        const roads = [-80, 0, 80];
        roads.forEach(r => {
            // Along Z axis roads
            for (let z = -200; z <= 200; z += 40) {
                if (z === 0 || Math.abs(z) === 80) continue; // skip intersections
                temp.push({ x: r + 8, z });
                temp.push({ x: r - 8, z });
            }
            // Along X axis roads
            for (let x = -200; x <= 200; x += 40) {
                if (x === 0 || Math.abs(x) === 80) continue; // skip intersections
                temp.push({ x, z: r + 8 });
                temp.push({ x, z: r - 8 });
            }
        });
        return temp;
    }, []);

    return (
        <group>
            {posts.map((p, i) => (
                <group key={i} position={[p.x, 0, p.z]}>
                    <mesh position={[0, 3.5, 0]}>
                        <cylinderGeometry args={[0.06, 0.08, 7, 6]} />
                        <meshStandardMaterial color="#222" roughness={0.9} />
                    </mesh>
                    <mesh position={[0, 6.9, 0]}>
                        <sphereGeometry args={[0.2, 8, 8]} />
                        <meshBasicMaterial color="#ffcc88" />
                    </mesh>
                </group>
            ))}
            {/* Added 9 lights at intersections for general performance-friendly lighting */}
            {[-80, 0, 80].map(x => [-80, 0, 80].map(z => (
                <pointLight key={`light-${x}-${z}`} position={[x, 10, z]} color="#ffcc88" distance={60} intensity={1} decay={2} />
            )))}
        </group>
    )
}

function CityTraffic() {
    const roads = [-80, 0, 80];
    const vehicles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < 20; i++) {
            const axis = Math.random() > 0.5 ? 'x' : 'z';
            const roadPos = roads[Math.floor(Math.random() * roads.length)];
            const dir = Math.random() > 0.5 ? 1 : -1;
            temp.push({
                axis, roadPos, dir,
                offset: dir * 3.5, // 3.5m from center for lane
                pos: (Math.random() - 0.5) * 400,
                speed: 15 + Math.random() * 15,
                color: ['#cc2222', '#22cc22', '#2222cc', '#cccccc', '#ffffff'][Math.floor(Math.random() * 5)]
            });
        }
        return temp;
    }, []);

    const groupRefs = useRef([]);

    useFrame((state, delta) => {
        vehicles.forEach((v, i) => {
            const ref = groupRefs.current[i];
            if (!ref) return;
            v.pos += v.speed * v.dir * delta;
            if (v.pos > 300) v.pos = -300;
            if (v.pos < -300) v.pos = 300;
            
            if (v.axis === 'z') {
                ref.position.set(v.roadPos + v.offset, 0.4, v.pos);
                ref.rotation.y = v.dir === 1 ? 0 : Math.PI;
            } else {
                ref.position.set(v.pos, 0.4, v.roadPos + v.offset);
                ref.rotation.y = v.dir === 1 ? Math.PI/2 : -Math.PI/2;
            }
        });
    });

    return (
        <group>
            {vehicles.map((v, i) => (
                <group key={i} ref={el => groupRefs.current[i] = el}>
                    <mesh position={[0, 0.5, 0]}>
                        <boxGeometry args={[1.8, 1, 4]} />
                        <meshStandardMaterial color={v.color} roughness={0.2} metalness={0.6}/>
                    </mesh>
                    <mesh position={[0, 1.2, 0]}>
                        <boxGeometry args={[1.6, 0.8, 2]} />
                        <meshStandardMaterial color="#111" roughness={0.1} />
                    </mesh>
                    {/* Headlights */}
                    <mesh position={[0.6, 0.5, 2.05]}>
                        <planeGeometry args={[0.4, 0.3]} />
                        <meshBasicMaterial color="#ffffee" />
                    </mesh>
                    <mesh position={[-0.6, 0.5, 2.05]}>
                        <planeGeometry args={[0.4, 0.3]} />
                        <meshBasicMaterial color="#ffffee" />
                    </mesh>
                    {/* Taillights */}
                    <mesh position={[0.6, 0.5, -2.05]} rotation={[0, Math.PI, 0]}>
                        <planeGeometry args={[0.4, 0.3]} />
                        <meshBasicMaterial color="#ff1111" />
                    </mesh>
                    <mesh position={[-0.6, 0.5, -2.05]} rotation={[0, Math.PI, 0]}>
                        <planeGeometry args={[0.4, 0.3]} />
                        <meshBasicMaterial color="#ff1111" />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

function AdsPanels() {
    const panels = useMemo(() => {
        const temp = [];
        const colors = ['#fff', '#eeddcc', '#ddffee'];
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 80;
            temp.push({
                x: Math.cos(angle) * dist,
                z: Math.sin(angle) * dist,
                y: 8 + Math.random() * 12,
                rotY: Math.random() * Math.PI * 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                w: 3 + Math.random() * 4,
                h: 2 + Math.random() * 3
            });
        }
        return temp;
    }, []);

    return (
        <group>
            {panels.map((p, i) => (
                <group key={i} position={[p.x, p.y, p.z]} rotation={[0, p.rotY, 0]}>
                    <mesh>
                        <planeGeometry args={[p.w, p.h]} />
                        <meshBasicMaterial color={p.color} side={THREE.DoubleSide} />
                    </mesh>
                    <mesh position={[0, 0, -0.05]}>
                        <boxGeometry args={[p.w + 0.2, p.h + 0.2, 0.1]} />
                        <meshStandardMaterial color="#222" roughness={0.9} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

function RestoredWorld() {
    return (
        <group>
            <ModernGround />
            <ModernRoads />
            <ModernBuildings />
            <NormalTrees />
            <NormalNPCs />
            <StreetLamps />
            <CityTraffic />
            <AdsPanels />
        </group>
    )
}

export default function SurfaceScene({ missionStage, setMissionStage, dialogVisible, coresCollected, setCoresCollected }) {
  const { scene } = useThree()
  const isInsideBunker = missionStage >= 3 && missionStage <= 11;
  const isRestored = missionStage === 12;
  
  useEffect(() => {
    if (isInsideBunker) {
      scene.fog = new THREE.FogExp2(new THREE.Color('#020202'), 0.06);
      scene.background = new THREE.Color('#020202');
    } else if (isRestored) {
      scene.fog = new THREE.FogExp2(new THREE.Color('#0a182a'), 0.003); // clear dark blue night sky
      scene.background = new THREE.Color('#0a182a');
    } else {
      const fogColor = new THREE.Color('#030303');
      scene.fog = new THREE.FogExp2(fogColor, 0.04);
      scene.background = fogColor;
    }
  }, [scene, isInsideBunker, isRestored, missionStage])

  // Auto advance from stage 7 to 8 when all 4 systems are activated
  useEffect(() => {
    if (missionStage === 7 && coresCollected[0] && coresCollected[1] && coresCollected[2] && coresCollected[3]) {
      const timer = setTimeout(() => setMissionStage(8), 1500);
      return () => clearTimeout(timer);
    }
  }, [missionStage, coresCollected, setMissionStage])

  return (
    <>
      <PointerLockControls selector="#root" />
      <Player missionStage={missionStage} setMissionStage={setMissionStage} isInsideBunker={isInsideBunker} dialogVisible={dialogVisible} coresCollected={coresCollected} setCoresCollected={setCoresCollected} />
      
      {/* Wasteland lighting */}
      {!isInsideBunker && !isRestored && (
        <>
          <ambientLight intensity={0.015} color="#222" />
          <directionalLight position={[50, 100, 20]} intensity={0.05} color="#111115" />
          {/* Distant nuclear fire glow */}
          <pointLight position={[-150, -5, -80]} intensity={50} distance={400} color="#ff3300" decay={2} />
        </>
      )}
      
      {/* Restored world lighting */}
      {isRestored && (
        <>
          <ambientLight intensity={0.4} color="#152540" />
          <directionalLight position={[60, 120, 30]} intensity={1.2} color="#ccddff" />
          <hemisphereLight skyColor="#0a182a" groundColor="#0f1510" intensity={0.6} />
        </>
      )}

      {/* Outdoor wasteland - hidden when inside bunker or restored */}
      {!isInsideBunker && !isRestored && (
        <>
          <WastelandGround />
          <TwistedRuins />
          <DeadTrees />
          <Rubble />
          <Graveyard />
          <CreepyDoll position={[5, -1, 5]} />
          <AshParticles />
          <Cloud opacity={0.4} speed={0.16} width={250} depth={25} segments={20} position={[0, 30, 0]} color="#0a0a0a" />
          <Cloud opacity={0.3} speed={0.2} width={200} depth={20} segments={15} position={[50, 45, -50]} color="#110d0a" />
          
          <ParkedSpaceship />
          <SignalBeacon missionStage={missionStage} />
          <Bunker missionStage={missionStage} />
          <BunkerBarrier missionStage={missionStage} />
        </>
      )}
      
      {/* Restored world */}
      {isRestored && <RestoredWorld />}
      
      {/* Bunker interior - only when inside */}
      <BunkerInterior missionStage={missionStage} setMissionStage={setMissionStage} coresCollected={coresCollected} />
    </>
  )
}
