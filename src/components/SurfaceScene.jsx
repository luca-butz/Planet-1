import React, { useMemo, useEffect, useState, useRef } from 'react'
import { PointerLockControls, Stars, Cloud, Instance, Instances } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'

// Global noise instance
const noise2D = createNoise2D();

function getTerrainHeight(x, z) {
    let elevation = noise2D(x * 0.01, z * 0.01) * 8; 
    elevation += noise2D(x * 0.03, z * 0.03) * 3;
    
    // War trenches (long winding lows)
    const trenchCheck = noise2D(x * 0.005, z * 0.005);
    if (trenchCheck < -0.3) {
        elevation -= 6.0; // Dig deep trench
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
                            intensity={120}
                            angle={0.55}
                            penumbra={0.85} 
                            distance={65} 
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

function Player() {
  const { camera } = useThree()
  const [move, setMove] = useState({ forward: false, backward: false, left: false, right: false, jump: false })
  const [landed, setLanded] = useState(false)
  const [flashlightOn, setFlashlightOn] = useState(false)
  
  const velocityY = useRef(0)
  
  useEffect(() => {
    // Start high up in the air for landing sequence
    camera.position.set(0, 200, 0)
    // Look at horizon initially
    const target = new THREE.Vector3(0, 200, -100)
    camera.lookAt(target)
    
    // Key handlers
    const handleKeyDown = (e) => {
      // Toggle for single press keys
      if (e.code === 'KeyT') {
          setFlashlightOn(prev => !prev)
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
        }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('keyup', handleKeyUp)
    }
  }, [camera])
  
  useFrame((state, delta) => {

    // Terrain height at current X, Z
    const groundHeight = getTerrainHeight(camera.position.x, camera.position.z)
    const eyeHeight = 2.5

    if (!landed) {
        // Landing descent logic (Free fall with terminal velocity simulation)
        // Move down fast but slow down slightly near ground? No, just drop.
        camera.position.y -= delta * 60.0 // Fast descent
        
        // Safety check to ensure we don't clip through ground in one frame
        if (camera.position.y <= groundHeight + eyeHeight) {
            camera.position.y = groundHeight + eyeHeight
            setLanded(true)
            velocityY.current = 0
        }
        return // Disable player control during landing
    }

    const speed = 15.0 * delta // Movement speed

    // Calculate movement direction relative to camera looking direction, but flatten Y
    const isMoving = move.forward || move.backward || move.left || move.right;
    
    if (isMoving) {
        // Get valid forward and right vectors from camera
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0; // Flatten
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0; // Flatten
        right.normalize();
        
        const moveDir = new THREE.Vector3();
        if (move.forward) moveDir.add(forward);
        if (move.backward) moveDir.sub(forward);
        if (move.right) moveDir.add(right);
        if (move.left) moveDir.sub(right);
        
        // Apply movement
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().multiplyScalar(speed);
            camera.position.x += moveDir.x;
            camera.position.z += moveDir.z;
        }
    }

    // Physics (Gravity & Jump)
    // Apply gravity
    velocityY.current -= 60.0 * delta; 
    
    // Apply vertical velocity
    camera.position.y += velocityY.current * delta;
    
    // Ground collision
    // Recalc ground height at new pos
    const newGroundHeight = getTerrainHeight(camera.position.x, camera.position.z);
    const floor = newGroundHeight + eyeHeight;
    
    if (camera.position.y < floor) {
        // Hit ground
        camera.position.y = floor;
        velocityY.current = 0;
        
        // Jump only if on ground
        if (move.jump) {
            velocityY.current = 20.0; // Jump force
        }
    }
  })
  
  return (
      <FlashlightModel isOn={flashlightOn} />
  )
}

function CreepyDoll({ position }) {
    // A lost, broken teddy bear sitting in the wasteland
    const bearRef = useRef()
    
    useFrame((state) => {
        // The eye blinks randomly
        if (Math.random() > 0.99) {
            bearRef.current.intensity = 0
        } else {
            bearRef.current.intensity = Math.random() * 2 + 1
        }
    })

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
                    <meshBasicMaterial color="red" />
                </mesh>
                <pointLight ref={bearRef} color="red" distance={3} decay={2} />
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
        const count = 400; // lots of debris
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
    const count = 3000;
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
        for(let i=0; i<100; i++) {
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

export default function SurfaceScene() {
  const { scene } = useThree()
  
  useEffect(() => {
    // Dusty brown/grey fog
    const fogColor = new THREE.Color('#050505'); // DARKER for flashlight usage
    scene.fog = new THREE.FogExp2(fogColor, 0.040); // Denser fog
    scene.background = fogColor;
  }, [scene])

  return (
    <>
      <PointerLockControls selector="#root" />
      <Player />
      
      {/* Dim, diffuse lighting - "Nuclear Winter" sun - DARKER */}
      <ambientLight intensity={0.02} color="#222" /> 
      <directionalLight position={[50, 100, 20]} intensity={0.2} color="#334455" />
      
      {/* Some ominous glows */}
      <pointLight position={[-30, 10, -30]} intensity={2} distance={50} color="#55ff00" decay={2} /> 
      
      <WastelandGround />
      <TwistedRuins />
      <DeadTrees />
      <Rubble />
      
      {/* The Horror Elements */}
      <Graveyard />
      <CreepyDoll position={[5, -1, 5]} />
      
      <AshParticles />
      
      {/* Oppressive low clouds */}
      <Cloud opacity={0.3} speed={0.2} width={200} depth={20} segments={20} position={[0, 40, 0]} color="#111" />
    </>
  )
}
