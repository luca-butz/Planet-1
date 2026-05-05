import React, { useMemo, useEffect, useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Same noise functions from SpaceScene
const noiseGLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

  float cnoise(vec3 P) {
    vec3 Pi0 = floor(P); // Integer part for indexing
    vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
    Pi0 = mod289(Pi0);
    Pi1 = mod289(Pi1);
    vec3 Pf0 = fract(P); // Fractional part for interpolation
    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.y, Pi0.y, Pi1.y, Pi1.y);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 * (1.0 / 7.0);
    vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 * (1.0 / 7.0);
    vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.y, Pf0.z));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.x, Pf1.y, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.x, Pf0.y, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.y, Pf1.z));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
  }
`

const TransitionPlanetMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uTransition: { value: 0.0 }, // 0.0: Healthy, 1.0: Destroyed
    tWater: { value: null },
    // Healthy colors
    uColorOceanH: { value: new THREE.Color('#0f4f96') },
    uColorLandH: { value: new THREE.Color('#287a2c') },
    uColorCloudH: { value: new THREE.Color('#ffffff') },
    // Destroyed colors
    uColorOceanD: { value: new THREE.Color('#0a2b0c') },
    uColorLandD: { value: new THREE.Color('#38281c') },
    uColorScorchedD: { value: new THREE.Color('#080504') },
    uColorCloudD: { value: new THREE.Color('#4c4f4a') },
    uColorFires: { value: new THREE.Color('#ff4400') }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    ${noiseGLSL}

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      
      float noiseVal = cnoise(position * 2.0);
      float displacement = noiseVal * 0.015;
      vec3 newPosition = position + normal * displacement;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uTransition;
    uniform sampler2D tWater;
    
    uniform vec3 uColorOceanH;
    uniform vec3 uColorLandH;
    uniform vec3 uColorCloudH;
    
    uniform vec3 uColorOceanD;
    uniform vec3 uColorLandD;
    uniform vec3 uColorScorchedD;
    uniform vec3 uColorCloudD;
    uniform vec3 uColorFires;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    ${noiseGLSL}

    void main() {
      // 1. Continental Texture
      float specularMap = texture2D(tWater, vec2(vUv.x + uTime*0.01, vUv.y)).r;
      float landMask = 1.0 - smoothstep(0.1, 0.4, specularMap);

      // 2. Mix Healthy & Destroyed Surface
      vec3 ocean = mix(uColorOceanH, uColorOceanD, uTransition);
      vec3 land = mix(uColorLandH, uColorLandD, uTransition);
      
      float scorchedNoise = cnoise(vPosition * 3.0);
      // More transition -> more scorched
      float scorchedMask = smoothstep(0.1, 0.6, scorchedNoise) * landMask * uTransition;

      vec3 surfaceColor = mix(ocean, land, landMask);
      surfaceColor = mix(surfaceColor, uColorScorchedD, scorchedMask);

      // 3. Radioactive Fires / Burning Cities (appear during transition)
      float fireNoise = cnoise(vPosition * 15.0 + uTime * 0.05);
      float fires = smoothstep(0.5, 0.6, fireNoise) * landMask * (1.0 - scorchedMask * 0.5) * smoothstep(0.2, 0.8, uTransition);

      // 4. Ash/White Clouds
      float cloudVal1 = cnoise(vPosition * 3.0 + vec3(uTime * 0.02, 0.0, uTime * 0.01));
      float cloudVal2 = cnoise(vPosition * 6.0 - vec3(0.0, uTime * 0.03, 0.0));
      float cloudMix = smoothstep(0.2, 0.8, cloudVal1 + cloudVal2 * 0.4);
      
      vec3 cloudsColor = mix(uColorCloudH, uColorCloudD, uTransition);

      // 5. Lighting
      vec3 lightPos = normalize(vec3(1.0, 1.0, 1.0));
      float diff = max(dot(vNormal, lightPos), 0.0);
      float shadow = smoothstep(0.0, 0.5, diff);

      vec3 fireComponent = uColorFires * fires * 1.5;
      vec3 base = mix(surfaceColor, cloudsColor, cloudMix * 0.5);
      
      // Healthy needs slightly brighter overall, destroyed is darker
      float globalBright = mix(1.2, 0.6, uTransition);
      vec3 finalColor = base * (0.1 + shadow * globalBright) + fireComponent;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
}

function CinematicEarthMesh({ transitionVal }) {
  const meshRef = useRef()
  const matRef = useRef()
  const [earthMap, setEarthMap] = useState(null)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        setEarthMap(texture)
      },
      undefined,
      () => {
        const c = document.createElement('canvas'); c.width=2; c.height=2;
        setEarthMap(new THREE.CanvasTexture(c))
      }
    )
  }, [])

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial(TransitionPlanetMaterial)
    if (earthMap) mat.uniforms.tWater.value = earthMap
    return mat
  }, [earthMap])

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.getElapsedTime() * 0.5
      // Smoothly approach transitionVal
      matRef.current.uniforms.uTransition.value += (transitionVal - matRef.current.uniforms.uTransition.value) * 0.02
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001
      meshRef.current.rotation.x = 0.2
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.5, 64, 64]} />
      {earthMap && <primitive object={material} ref={matRef} attach="material" />}
    </mesh>
  )
}

function Missile({ startPos, targetPos, launchTime }) {
  const group = useRef()
  const impactRef = useRef()
  const capRef = useRef()
  const ringRef = useRef()
  const [hit, setHit] = useState(false)

  const flightDuration = 2.5

  useEffect(() => {
    if (impactRef.current) {
      impactRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), targetPos.clone().normalize())
    }
  }, [targetPos])

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime() - launchTime
    if (elapsed < 0) {
      if (group.current) group.current.visible = false
      return
    }

    if (elapsed > flightDuration) {
      if (!hit) setHit(true)
      if (group.current) group.current.visible = false

      // Explosion animation
      const expTime = elapsed - flightDuration
      if(expTime > 0 && expTime < 2) {
        const easeOut = 1 - Math.pow(1 - (expTime/2), 3)
        if(capRef.current) {
           capRef.current.position.y = easeOut * 0.5
           capRef.current.scale.setScalar(0.05 + easeOut * 0.5)
           capRef.current.material.opacity = Math.max(0, 1 - (expTime/2))
        }
        if(ringRef.current) {
           ringRef.current.scale.setScalar(0.01 + easeOut * 2)
           ringRef.current.material.opacity = Math.max(0, 1 - (expTime/2))
        }
      }
      return
    }

    if (group.current) {
      group.current.visible = true
      const progress = elapsed / flightDuration
      
      const basePos = new THREE.Vector3().lerpVectors(startPos, targetPos, progress)
      const outDir = basePos.clone().normalize()
      
      // Parabolic arc pushing it into space, peaking at progress = 0.5
      const arcHeight = 3.0; // Goes ~3 units into space
      const arc = Math.sin(progress * Math.PI) * arcHeight;
      const currentPos = basePos.add(outDir.multiplyScalar(arc))

      group.current.position.copy(currentPos)
      
      if(progress < 0.99) { // Look ahead
         const nextBase = new THREE.Vector3().lerpVectors(startPos, targetPos, progress + 0.01)
         const nextOutDir = nextBase.clone().normalize()
         const nextArc = Math.sin((progress+0.01) * Math.PI) * arcHeight;
         const nextPos = nextBase.add(nextOutDir.multiplyScalar(nextArc))
         group.current.lookAt(nextPos)
      }
    }
  })

  return (
    <>
      <group ref={group}>
        {/* Sleek missile body */}
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.02, 0.2]} />
          <meshStandardMaterial color="#444" metalness={0.8} />
        </mesh>
        {/* Exhaust */}
        <mesh position={[0, 0, 0.1]}>
          <pointLight color="#ff8800" intensity={0.5} distance={1} />
          <sphereGeometry args={[0.03]} />
          <meshBasicMaterial color="#ffaa00" />
        </mesh>
      </group>

      <group ref={impactRef} position={targetPos}>
        {hit && (
          <>
            <mesh ref={capRef}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshBasicMaterial color="#ff4400" transparent opacity={0.8} />
            </mesh>
            <mesh ref={ringRef} rotation={[Math.PI/2, 0, 0]}>
              <torusGeometry args={[1, 0.1, 16, 32]} />
              <meshBasicMaterial color="#ff8800" transparent opacity={0.6} />
            </mesh>
          </>
        )}
      </group>
    </>
  )
}

function MegaBomb({ startPos, targetPos, launchTime }) {
  const group = useRef()
  const impactRef = useRef()
  const capRef = useRef()
  const stemRef = useRef()
  const ringRef = useRef()
  const greenGlowRef = useRef()

  const [hit, setHit] = useState(false)
  const flightDuration = 3.0

  useEffect(() => {
    if (impactRef.current) {
       impactRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), targetPos.clone().normalize())
    }
  }, [targetPos])

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime() - launchTime
    if (elapsed < 0) {
      if (group.current) group.current.visible = false
      return
    }
    if (elapsed > flightDuration) {
      if (!hit) setHit(true)
      if (group.current) group.current.visible = false

      // Explosion animation
      const expTime = elapsed - flightDuration
      if (expTime > 0 && expTime < 6) {
        const easeOut = 1 - Math.pow(1 - (expTime/6), 3)

        if (capRef.current) {
           capRef.current.position.y = 0.5 + easeOut * 3.5
           capRef.current.scale.setScalar(0.1 + easeOut * 4.5)
           capRef.current.material.opacity = Math.max(0, 1 - (expTime / 6))
        }
        if (stemRef.current) {
           stemRef.current.scale.set(0.1 + easeOut*2.5, easeOut * 3.5, 0.1 + easeOut*2.5)
           stemRef.current.position.y = (easeOut * 3.5) / 2
           stemRef.current.material.opacity = Math.max(0, 1 - (expTime / 6))
        }
        if (ringRef.current) {
           const ringProg = Math.min(expTime / 2.5, 1)
           const ringEaseOut = 1 - Math.pow(1 - ringProg, 4)
           ringRef.current.scale.setScalar(0.1 + ringEaseOut * 15)
           ringRef.current.material.opacity = Math.max(0, 1 - ringProg)
        }
        if (greenGlowRef.current) {
           greenGlowRef.current.scale.setScalar(0.1 + easeOut * 6)
           greenGlowRef.current.material.opacity = Math.max(0, (1 - (expTime / 5)) * 0.7)
        }
      }
      return
    }

    if (group.current) {
      group.current.visible = true
      const progress = elapsed / flightDuration
      
      const basePos = new THREE.Vector3().lerpVectors(startPos, targetPos, progress)
      const outDir = basePos.clone().normalize()
      
      // Giant parabolic arc into outer space
      const arcHeight = 5.0;
      const arc = Math.sin(progress * Math.PI) * arcHeight;
      const currentPos = basePos.add(outDir.multiplyScalar(arc))

      group.current.position.copy(currentPos)
      
      if(progress < 0.99) { // Look ahead
         const nextBase = new THREE.Vector3().lerpVectors(startPos, targetPos, progress + 0.01)
         const nextOutDir = nextBase.clone().normalize()
         const nextArc = Math.sin((progress+0.01) * Math.PI) * arcHeight;
         const nextPos = nextBase.add(nextOutDir.multiplyScalar(nextArc))
         group.current.lookAt(nextPos)
      }
      
      // Rotate around Z to make it look active
      group.current.rotation.z = elapsed * 10
    }
  })

  return (
    <>
      <group ref={group}>
        {/* MegaBomb Body (10x smaller) */}
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <capsuleGeometry args={[0.03, 0.3, 16]} />
          <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Green glowing core parts */}
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.1, 16]} />
          <meshBasicMaterial color="#00ff00" transparent opacity={0.9} />
        </mesh>
        {/* Exhaust (longer proportionally to be visible) */}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI/2, 0, 0]}>
          <coneGeometry args={[0.05, 0.3, 16]} />
          <meshBasicMaterial color="#ff2200" />
        </mesh>
        <pointLight position={[0, 0, 0.2]} color="#ff2200" intensity={3} distance={5} />
      </group>

      <group ref={impactRef} position={targetPos}>
        {hit && (
          <>
            <mesh ref={capRef}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshBasicMaterial color="#333" transparent opacity={0.9} />
            </mesh>
            <mesh ref={stemRef}>
              <cylinderGeometry args={[0.4, 0.2, 1, 16]} />
              <meshBasicMaterial color="#ff4400" transparent opacity={0.9} />
            </mesh>
            {/* Thick Shockwave Ring */}
            <mesh ref={ringRef} rotation={[Math.PI/2, 0, 0]}>
              <torusGeometry args={[1, 0.15, 16, 64]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
            {/* Green Radioactive Flash */}
            <mesh ref={greenGlowRef}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshBasicMaterial color="#00ff55" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
            </mesh>
            {/* Massive impact point light */}
            <pointLight color="#aaff00" intensity={5} distance={20} decay={2} />
          </>
        )}
      </group>
    </>
  )
}

export default function CinematicEarth({ isDestroyed, showMissiles }) {
  const { missiles, megaBomb } = useMemo(() => {
    if (!showMissiles) return { missiles: [], megaBomb: null }
    const m = []
    // Generate small missiles launching from earth, returning to earth
    for(let i=0; i<30; i++){
      const target = new THREE.Vector3(
        (Math.random()-0.5)*2,
        (Math.random()-0.5)*2,
        (Math.random()-0.5)*2
      ).normalize().multiplyScalar(2.5)
      
      const start = new THREE.Vector3(
        (Math.random()-0.5)*2,
        (Math.random()-0.5)*2,
        (Math.random()-0.5)*2
      ).normalize().multiplyScalar(2.5)
      
      // Launch slightly before impact window (total window is ~3.5s phase duration)
      // Small scattered launches
      m.push({ id: i, start, target, launchTime: Math.random() * 0.5 }) 
    }
    
    // Mega Bomb: starts side of earth, hits front
    const mbTarget = new THREE.Vector3(0.3, 0.3, 2.5).normalize().multiplyScalar(2.5)
    const mbStart = new THREE.Vector3(-2.5, -1, -0.5).normalize().multiplyScalar(2.5)
    
    return { missiles: m, megaBomb: { start: mbStart, target: mbTarget, launchTime: 0.2 } }
  }, [showMissiles])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 3, 5]} intensity={1.5} />
        <CinematicEarthMesh transitionVal={isDestroyed ? 1.0 : 0.0} />
        {showMissiles && missiles.map(m => (
          <Missile key={m.id} startPos={m.start} targetPos={m.target} launchTime={m.launchTime} />
        ))}
        {showMissiles && megaBomb && (
          <MegaBomb startPos={megaBomb.start} targetPos={megaBomb.target} launchTime={megaBomb.launchTime} />
        )}
      </Canvas>
    </div>
  )
}
