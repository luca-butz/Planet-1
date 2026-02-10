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

function Player() {
  const { camera } = useThree()
  const [move, setMove] = useState({ forward: false, backward: false, left: false, right: false })
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch(e.code) {
        case 'KeyW': setMove(m => ({ ...m, forward: true })); break;
        case 'KeyS': setMove(m => ({ ...m, backward: true })); break;
        case 'KeyA': setMove(m => ({ ...m, left: true })); break;
        case 'KeyD': setMove(m => ({ ...m, right: true })); break; 
      }
    }
    const handleKeyUp = (e) => {
        switch(e.code) {
            case 'KeyW': setMove(m => ({ ...m, forward: false })); break;
            case 'KeyS': setMove(m => ({ ...m, backward: false })); break;
            case 'KeyA': setMove(m => ({ ...m, left: false })); break;
            case 'KeyD': setMove(m => ({ ...m, right: false })); break; 
        }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('keyup', handleKeyUp)
    }
  }, [])
  
  useFrame((state, delta) => {
    const speed = 15.0 * delta 
    const direction = new THREE.Vector3()
    const frontVector = new THREE.Vector3(0, 0, Number(move.backward) - Number(move.forward))
    const sideVector = new THREE.Vector3(Number(move.left) - Number(move.right), 0, 0)
    
    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(speed)
      .applyEuler(camera.rotation)
    
    camera.position.x += direction.x
    camera.position.z += direction.z
    
    // Terrain collision
    const groundHeight = getTerrainHeight(camera.position.x, camera.position.z)
    // Smooth adjustment or hard snap? Hard snap is better for walking.
    camera.position.y = groundHeight + 2.5 
  })
  
  return null
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

    const shaderMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uColorA: { value: new THREE.Color('#050505') }, // Black Charred Soil
                uColorB: { value: new THREE.Color('#1a100a') }, // Dark Brown
                uColorC: { value: new THREE.Color('#203020') }, // Faint Toxic Green
            },
            vertexShader: `
                varying vec2 vUv;
                varying float vElevation;
                void main() {
                    vUv = uv;
                    vElevation = position.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                uniform vec3 uColorC;
                varying float vElevation;
                varying vec2 vUv;

                // Simple noise function for texture
                float rand(vec2 co){
                    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
                }

                void main() {
                    // Grit noise
                    float grit = rand(vUv * 500.0) * 0.15;
                    
                    // Mix based on height - tops are charred black, mid is brown
                    vec3 col = mix(uColorA, uColorB, smoothstep(-5.0, 5.0, vElevation + grit * 10.0));
                    
                    // Deep areas are toxic
                    float toxic = smoothstep(-5.0, -8.0, vElevation);
                    col = mix(col, uColorC, toxic * 0.4);

                    gl_FragColor = vec4(col, 1.0);
                }
            `
        })
    }, [])

    return (
        <mesh geometry={geometry} material={shaderMaterial} receiveShadow />
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

export default function SurfaceScene() {
  const { scene } = useThree()
  
  useEffect(() => {
    // Dusty brown/grey fog
    const fogColor = new THREE.Color('#15100e');
    scene.fog = new THREE.FogExp2(fogColor, 0.030);
    scene.background = fogColor;
  }, [scene])

  return (
    <>
      <PointerLockControls selector="#root" />
      <Player />
      
      {/* Dim, diffuse lighting - "Nuclear Winter" sun */}
      <ambientLight intensity={0.1} color="#443322" />
      <directionalLight position={[50, 100, 20]} intensity={1.0} color="#ffaa88" castShadow />
      
      {/* Some ominous glows */}
      <pointLight position={[-30, 10, -30]} intensity={2} distance={50} color="#55ff00" decay={2} /> 
      
      <WastelandGround />
      <TwistedRuins />
      
      {/* The Horror Elements */}
      <Graveyard />
      <CreepyDoll position={[5, -1, 5]} />
      
      <AshParticles />
      
      {/* Oppressive low clouds */}
      <Cloud opacity={0.6} speed={0.2} width={200} depth={20} segments={20} position={[0, 40, 0]} color="#1a1512" />
    </>
  )
}
