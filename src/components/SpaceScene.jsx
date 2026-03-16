import React, { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Float, Instances, Instance, useTexture } from '@react-three/drei'
import * as THREE from 'three'

// GLSL Noise function
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

const PlanetMaterial = {
  uniforms: {
    uTime: { value: 0 },
    tWater: { value: null }, // Will be set in component
    uColorOcean: { value: new THREE.Color('#0a2b0c') }, // Toxic dark radioactive green ocean
    uColorLand: { value: new THREE.Color('#38281c') }, // Dead reddish-brown land
    uColorScorched: { value: new THREE.Color('#080504') }, // Charred, darkened terrain
    uColorClouds: { value: new THREE.Color('#4c4f4a') }, // Sickly grey-ash clouds
    uColorFires: { value: new THREE.Color('#ff4400') }, // Firestorms
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
      
      // Slight displacement for atmospheric variations/craters
      float noiseVal = cnoise(position * 2.0);
      float craterVal = smoothstep(0.45, 0.5, cnoise(position * 1.2)); // deeper craters
      float displacement = noiseVal * 0.02 - craterVal * 0.08;
      vec3 newPosition = position + normal * displacement;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform sampler2D tWater;
    
    uniform vec3 uColorOcean;
    uniform vec3 uColorLand;
    uniform vec3 uColorScorched;
    uniform vec3 uColorClouds;
    uniform vec3 uColorFires;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    ${noiseGLSL}

    void main() {
      // 1. Continental Texture (Actual Earth Map)
      // Specular map: water is bright, land is dark.
      float specularMap = texture2D(tWater, vUv).r;
      float landMask = 1.0 - smoothstep(0.1, 0.4, specularMap);

      // 2. Scorched Earth & Craters
      float scorchedNoise = cnoise(vPosition * 3.0);
      float scorchedMask = smoothstep(0.1, 0.6, scorchedNoise) * landMask;

      float craterNoise = cnoise(vPosition * 1.2);
      float craters = smoothstep(0.45, 0.5, craterNoise) * landMask;

      vec3 surfaceColor = mix(uColorOcean, uColorLand, landMask);
      surfaceColor = mix(surfaceColor, uColorScorched, scorchedMask);
      surfaceColor = mix(surfaceColor, vec3(0.01, 0.01, 0.01), craters);

      // 3. Radioactive Fires / Burning Cities (only on land)
      float fireNoise = cnoise(vPosition * 15.0 + uTime * 0.05);
      float fires = smoothstep(0.5, 0.6, fireNoise) * landMask * (1.0 - scorchedMask * 0.5);
      float craterFires = smoothstep(0.4, 0.45, craterNoise) * (1.0 - craters) * landMask;
      fires = max(fires, craterFires * 0.8);

      // 4. Ash Clouds
      float cloudVal1 = cnoise(vPosition * 2.5 + vec3(uTime * 0.02, 0.0, uTime * 0.01));
      float cloudVal2 = cnoise(vPosition * 8.0 - vec3(0.0, uTime * 0.04, 0.0));
      float cloudMix = smoothstep(0.1, 0.9, cloudVal1 + cloudVal2 * 0.4);

      // 5. Lighting / Shadows (Crucial to make the planet a physical dark sphere)
      vec3 lightPos = normalize(vec3(1.0, 1.0, 1.0)); // Adjust to an angle
      float diff = max(dot(vNormal, lightPos), 0.0);
      float shadow = smoothstep(0.0, 0.5, diff); // Hard shadowing

      vec3 fireComponent = uColorFires * fires * 1.5 * (1.0 - shadow * 0.2); // Fires less affected by shadow
      vec3 base = mix(surfaceColor, uColorClouds, cloudMix * 0.4); // Less opaque clouds
      
      vec3 finalColor = base * (0.05 + shadow * 1.2) + fireComponent;

      // 6. Fresnel / Rim Light
      float fresnel = pow(max(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
      vec3 rimColor = vec3(0.6, 0.1, 0.0); // Slight burnt orange glow
      finalColor += fresnel * rimColor * shadow * 0.4; // Only on sun-lit side

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
}

const AtmosphereMaterial = {
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      // Much softer and transparent atmosphere
      float fresnel = max(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
      float intensity = pow(fresnel, 4.0) * 0.3; // Only 30% alpha
      gl_FragColor = vec4(0.4, 0.1, 0.0, intensity); 
    }
  `
}

function Spaceship({ transitionProgress, transitioning }) {
  const group = useRef()
  const { camera } = useThree()
  const startPos = useRef(new THREE.Vector3())
  const startQuat = useRef(new THREE.Quaternion())

  useEffect(() => {
    if (transitioning && group.current) {
      startPos.current.copy(group.current.position)
      startQuat.current.copy(group.current.quaternion)
    }
  }, [transitioning])

  useFrame((state) => {
    if (!group.current) return

    const t = state.clock.getElapsedTime()
    const landingBoost = THREE.MathUtils.smoothstep(transitionProgress, 0.0, 1.0)

    if (!transitioning) {
      group.current.position.copy(camera.position)
      group.current.quaternion.copy(camera.quaternion)
      group.current.translateZ(-3.2)
      group.current.translateY(-1.2)
      group.current.position.y += Math.sin(t * 2.1) * 0.05
      group.current.rotation.z += Math.cos(t * 1.5) * 0.02
    } else {
      group.current.position.copy(startPos.current)
      group.current.quaternion.copy(startQuat.current)
      // Fly forward into the atmosphere (braking maneuver)
      group.current.translateZ(-landingBoost * 25)
      
      // Add wobble and pitch up slightly to simulate aerodynamic braking
      group.current.rotation.x += landingBoost * 0.2
      group.current.rotation.z += Math.sin(t * 14) * 0.02 * landingBoost
      group.current.position.x += Math.sin(t * 18) * 0.05 * landingBoost
      group.current.position.y += Math.cos(t * 16) * 0.04 * landingBoost
    }
  })

  const engineColor = transitionProgress > 0 ? '#ffb347' : '#00ddff'
  const trailOpacity = 0.28 + transitionProgress * 0.45

  return (
    <group ref={group}>
      <group rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0, 0.35]}>
          <boxGeometry args={[1.05, 0.55, 3.3]} />
          <meshStandardMaterial color="#22262f" roughness={0.35} metalness={0.82} />
        </mesh>
        <mesh position={[0, 0.28, -0.45]}>
          <coneGeometry args={[0.55, 1.15, 6]} />
          <meshStandardMaterial color="#2b313d" roughness={0.28} metalness={0.8} />
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
        {/* Main Engines */}
        <mesh position={[0.95, 0, 2.8]}>
          <circleGeometry args={[0.34, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
        <mesh position={[-0.95, 0, 2.8]}>
          <circleGeometry args={[0.34, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
        
        {/* Engine Trails */}
        <mesh position={[0.95, 0, 3.8]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.2 + transitionProgress * 0.2, 2.5 + transitionProgress * 2.5, 16]} />
          <meshBasicMaterial color={engineColor} transparent opacity={trailOpacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh position={[-0.95, 0, 3.8]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.2 + transitionProgress * 0.2, 2.5 + transitionProgress * 2.5, 16]} />
          <meshBasicMaterial color={engineColor} transparent opacity={trailOpacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        
        {/* Inner bright core for trails */}
        <mesh position={[0.95, 0, 3.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 1.2 + transitionProgress * 1.0, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[-0.95, 0, 3.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 1.2 + transitionProgress * 1.0, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[0, 0.42, -0.52]}>
          <boxGeometry args={[0.86, 0.42, 1.05]} />
          <meshStandardMaterial color="#00aaff" transparent opacity={0.3} roughness={0.06} metalness={0.92} side={THREE.DoubleSide} />
        </mesh>
        
        {/* Reentry heat effect */}
        {transitioning && (
          <group position={[0, 0, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
            {/* Outer red/orange plasma shield */}
            <mesh position={[0, -0.6, 0]} scale={[1, 1.4, 1]}>
              <sphereGeometry args={[2.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshBasicMaterial 
                color="#ff2200" 
                transparent 
                opacity={transitionProgress < 0.8 ? transitionProgress * 0.6 : (1.0 - transitionProgress) * 3} 
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Inner bright yellow-white core */}
            <mesh position={[0, 0.2, 0]} scale={[1, 1.2, 1]}>
              <sphereGeometry args={[2.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshBasicMaterial 
                color="#ffcc00" 
                transparent 
                opacity={transitionProgress < 0.8 ? transitionProgress * 0.8 : (1.0 - transitionProgress) * 4} 
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Front bright hot spot */}
            <mesh position={[0, 1.5, 0]}>
              <sphereGeometry args={[1.5, 32, 16]} />
              <meshBasicMaterial 
                color="#ffffff" 
                transparent 
                opacity={transitionProgress < 0.8 ? transitionProgress * 0.9 : (1.0 - transitionProgress) * 4} 
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            {/* Plasma trail tail */}
            <mesh position={[0, -2.5, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[2.9, 10, 16]} />
              <meshBasicMaterial 
                color="#ff5500" 
                transparent 
                opacity={transitionProgress < 0.8 ? transitionProgress * 0.4 : (1.0 - transitionProgress) * 2} 
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        )}
      </group>
    </group>
  )
}

function OrbitalDebris() {
  const debrisConfig = useMemo(() => {
    const temp = []
    for (let i = 0; i < 400; i++) {
        const distance = 110 + Math.random() * 40;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        
        const x = distance * Math.sin(phi) * Math.cos(theta);
        const y = distance * Math.sin(phi) * Math.sin(theta) * 0.3; // Flattened orbit ring
        const z = distance * Math.cos(phi);

        temp.push({
            position: [x, y, z],
            rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
            scale: 0.2 + Math.random() * 0.8,
            speed: (Math.random() - 0.5) * 0.02
        });
    }
    return temp;
  }, [])

  const groupRef = useRef();

  useFrame((state, delta) => {
      if (groupRef.current) {
          groupRef.current.rotation.y += delta * 0.015;
          groupRef.current.rotation.z += delta * 0.005;
      }
  })

  return (
    <group ref={groupRef}>
      <Instances range={debrisConfig.length}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#222" roughness={0.9} metalness={0.5} />
        {debrisConfig.map((d, i) => (
            <Instance key={i} position={d.position} rotation={d.rotation} scale={d.scale} />
        ))}
      </Instances>
    </group>
  )
}

function Planet({ onLand, transitioning }) {
  const meshRef = useRef()
  const atmosphereRef = useRef()
  const [hovered, setHover] = useState(false)
  const [earthSpecularMap, setEarthSpecularMap] = useState(null)

  useEffect(() => {
    // Manually load texture to avoid React Suspense crashing if the URL fails
    const loader = new THREE.TextureLoader()
    // Using a reliable CORS-friendly github raw URL
    loader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
      (texture) => {
        setEarthSpecularMap(texture)
      },
      undefined,
      (err) => {
        console.error('Failed to load earth texture', err)
        // Set a fallback to avoid shader errors if it fails
        const canvas = document.createElement('canvas')
        canvas.width = 2
        canvas.height = 2
        setEarthSpecularMap(new THREE.CanvasTexture(canvas))
      }
    )
  }, [])

  const planetMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial(PlanetMaterial)
    if (earthSpecularMap) {
      mat.uniforms.tWater.value = earthSpecularMap
    } else {
      // Dummy texture during loading to prevent GLSL crash
      const canvas = document.createElement('canvas')
      canvas.width = 2
      canvas.height = 2
      mat.uniforms.tWater.value = new THREE.CanvasTexture(canvas)
    }
    return mat
  }, [earthSpecularMap])

  const atmosMaterial = useMemo(() => new THREE.ShaderMaterial({
      ...AtmosphereMaterial,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
  }), [])

  useFrame((state, delta) => {
    if (meshRef.current) {
        meshRef.current.rotation.y += delta * 0.05
        planetMaterial.uniforms.uTime.value += delta
        atmosMaterial.uniforms.uTime.value += delta
    }
  })

  return (
    <group>
      <Float speed={1.5} rotationIntensity={transitioning ? 0.06 : 0.2} floatIntensity={transitioning ? 0.06 : 0.2}>
        <mesh
          ref={meshRef}
          onClick={() => !transitioning && onLand()}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; setHover(true) }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; setHover(false) }}
        >
          <sphereGeometry args={[100, 160, 160]} />
          <primitive object={planetMaterial} attach="material" />
        </mesh>

        <mesh scale={[1.08, 1.08, 1.08]} ref={atmosphereRef}>
          <sphereGeometry args={[100, 32, 32]} />
          <primitive object={atmosMaterial} attach="material" />
        </mesh>

        <OrbitalDebris />

        {hovered && !transitioning && (
          <group>
          </group>
        )}
      </Float>
    </group>
  )
}

function ApproachCorridor({ transitionProgress }) {
  const rings = useMemo(
    () => Array.from({ length: 7 }, (_, index) => ({
      z: 7 - index * 1.45,
      radius: 0.85 + index * 0.18,
      hue: index % 2 === 0 ? '#59c7ff' : '#ff8d47'
    })),
    []
  )

  if (transitionProgress <= 0) return null

  return (
    <group>
      {rings.map((ring, index) => (
        <mesh
          key={index}
          position={[0, Math.sin(index) * 0.22, ring.z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[ring.radius, 0.035, 8, 24]} />
          <meshBasicMaterial color={ring.hue} transparent opacity={Math.max(0, 0.55 - index * 0.06)} />
        </mesh>
      ))}
    </group>
  )
}

function FlightControls({ active, onTriggerLanding }) {
  const { camera } = useThree()
  const keys = useRef({ w: false, s: false, a: false, d: false, q: false, e: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false })
  const speed = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase()
      if (keys.current.hasOwnProperty(key)) keys.current[key] = true
    }
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase()
      if (keys.current.hasOwnProperty(key)) keys.current[key] = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((state, delta) => {
    if (!active) return

    if (keys.current.w) speed.current += delta * 15
    if (keys.current.s) speed.current -= delta * 15
    
    speed.current *= 0.98
    speed.current = Math.max(0, Math.min(30, speed.current))

    let pitch = 0
    let yaw = 0
    let roll = 0

    if (keys.current.arrowup) pitch += 1
    if (keys.current.arrowdown) pitch -= 1
    if (keys.current.a || keys.current.arrowleft) yaw += 1
    if (keys.current.d || keys.current.arrowright) yaw -= 1
    if (keys.current.q) roll += 1
    if (keys.current.e) roll -= 1

    camera.rotateZ(roll * delta * 1.5)
    camera.rotateY(-yaw * delta * 1.5)
    camera.rotateX(pitch * delta * 1.5)

    camera.translateZ(-speed.current * delta)

    // Trigger distance to planet (planet is at 0,0,0) with radius 100 + atmosphere
    if (camera.position.length() < 130) {
      onTriggerLanding()
    }
  })

  return null
}

export default function SpaceScene({ onLand, transitioning, onTransitionComplete }) {
  const { camera } = useThree()
  const [transitionProgress, setTransitionProgress] = useState(0)
  const startPositionRef = useRef(new THREE.Vector3(0, 0, 10))
  const targetPositionRef = useRef(new THREE.Vector3(0, 0.65, 4.35))
  const lookTargetRef = useRef(new THREE.Vector3())
  const shipDirRef = useRef(new THREE.Vector3(0, 0, -1))
  const completionRef = useRef(false)

  useEffect(() => {
    camera.position.set(0, 0, 400)
    camera.lookAt(0, 0, 0)
    setTransitionProgress(0)
    completionRef.current = false
  }, [camera])

  useEffect(() => {
    if (transitioning) {
      startPositionRef.current.copy(camera.position)
      // Camera moves back, up, and to the side for an epic landing shot
      const dir = camera.position.clone().normalize()
      shipDirRef.current.copy(camera.getWorldDirection(new THREE.Vector3()))
      
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
      if (right.lengthSq() < 0.1) right.set(1, 0, 0)
      targetPositionRef.current.copy(camera.position).add(dir.multiplyScalar(15)).add(right.multiplyScalar(15)).setY(camera.position.y + 8)
      setTransitionProgress(0)
      completionRef.current = false
    }
  }, [transitioning, camera])

  useFrame((state, delta) => {
    if (!transitioning) return

    setTransitionProgress((prev) => {
      const progress = Math.min(1, prev + delta / 8.0)
      const eased = THREE.MathUtils.smootherstep(progress, 0, 1)
      const wobble = (1 - eased) * 0.06

      camera.position.lerpVectors(startPositionRef.current, targetPositionRef.current, eased)
      camera.position.x += Math.sin(state.clock.getElapsedTime() * 7.5) * wobble
      camera.position.y += Math.cos(state.clock.getElapsedTime() * 6.5) * wobble * 0.8

      // Track the ship as it flies forward (approx -20 units along its forward vector)
      lookTargetRef.current.copy(startPositionRef.current)
        .add(shipDirRef.current.clone().multiplyScalar(eased * 25))
        .add(new THREE.Vector3(0, -eased * 2, 0)) // slight dip
        
      camera.lookAt(lookTargetRef.current)

      if (progress >= 1 && !completionRef.current) {
        completionRef.current = true
        onTransitionComplete()
      }

      return progress
    })
  })

  return (
    <>
      <FlightControls active={!transitioning} onTriggerLanding={onLand} />

      <ambientLight intensity={0.1} />
      <directionalLight position={[10, 5, 5]} intensity={3} color="#ffeebb" />
      <directionalLight position={[-10, 0, -5]} intensity={0.5} color="#202040" />
      <spotLight position={[0, 0, -10]} angle={1} penumbra={1} intensity={5} color="#5500ff" />

      <Spaceship transitionProgress={transitionProgress} transitioning={transitioning} />
      <Planet onLand={onLand} transitioning={transitioning} />
    </>
  )
}
