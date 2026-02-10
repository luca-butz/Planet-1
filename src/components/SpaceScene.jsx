import React, { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Float, Html } from '@react-three/drei'
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
    uColorSpace: { value: new THREE.Color('#101010') }, // Dark Grey
    uColorClouds: { value: new THREE.Color('#4a4036') }, // Dusty Brown
    uColorLava: { value: new THREE.Color('#ff5500') }, // Burning embers (less intense)
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
      
      // Complex displacement for "swirling" atmosphere shape
      float noiseVal = cnoise(position * 1.5);
      float displacement = noiseVal * 0.05;
      vec3 newPosition = position + normal * displacement;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorSpace;
    uniform vec3 uColorClouds;
    uniform vec3 uColorLava;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    ${noiseGLSL}

    void main() {
      // 1. Base Cloud Noise (Increased frequency for detail)
      float n = cnoise(vPosition * 4.0 + vec3(uTime * 0.05, uTime * 0.02, 0.0));
      float n2 = cnoise(vPosition * 12.0 - vec3(0.0, uTime * 0.08, 0.0));
      float n3 = cnoise(vPosition * 24.0); // Micro details
      float cloudMix = smoothstep(-0.5, 0.8, n + n2 * 0.5 + n3 * 0.1);
      
      // 2. Lava Cracks / Veins (The "Geothermal" aspect)
      // High frequency noise for cracks
      float crackNoise = cnoise(vPosition * 20.0 + uTime * 0.01);
      // Create thin lines by taking absolute value near zero
      float veins = 1.0 - smoothstep(0.02, 0.08, abs(crackNoise));
      // Only show veins in "darker" areas or deep below clouds
      float deepLava = veins * smoothstep(0.2, -0.2, n); 
      
      // 3. Compose Colors
      vec3 base = mix(uColorSpace, uColorClouds, cloudMix);
      
      // Add Lava with intense glow
      vec3 finalColor = mix(base, uColorLava * 4.0, deepLava); // *4.0 for bloom hdr effect

      // 4. Lighting / Shadows (Terminator)
      vec3 lightDir = normalize(vec3(10.0, 5.0, 5.0)); // Match sun direction
      float diff = max(dot(vNormal, lightDir), 0.0);
      
      // Custom shadow ramp - even the dark side has faint lava glow, but clouds are pitch black
      float shadow = smoothstep(-0.2, 0.2, diff);
      
      // On the dark side (night), veins should be MORE visible relatively, 
      // but the clouds should be dark.
      // Actually, lava glows regardless of sun.
      
      vec3 dayColor = finalColor * (0.1 + shadow * 0.9);
      vec3 nightLava = uColorLava * deepLava * 2.0; // Glows in the dark
      
      // Mix based on lighting needed? 
      // Our lava is already emissive in 'finalColor'. 
      // Let's just shadow the non-lava parts.
      
      vec3 lavaComponent = uColorLava * 3.0 * deepLava;
      vec3 rockComponent = base;
      
      finalColor = rockComponent * (0.05 + shadow * 0.95) + lavaComponent;

      // 5. Fresnel / Rim Light (Cold atmosphere edge)
      float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
      vec3 rimColor = vec3(0.1, 0.0, 0.2); // Faint violet rim
      
      finalColor += fresnel * rimColor;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
}

const AtmosphereMaterial = {
  uniforms: {},
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
      // Atmosphere glow
      float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
      gl_FragColor = vec4(0.2, 0.1, 0.4, 1.0) * intensity * 2.0; 
    }
  `
}

function Planet({ onLand }) {
  const meshRef = useRef()
  const atmosphereRef = useRef()
  const [hovered, setHover] = useState(false)
  
  // Create shader materials
  const planetMaterial = useMemo(() => new THREE.ShaderMaterial(PlanetMaterial), [])
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
    }
  })

  return (
    <group>
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.2}>
        {/* Main Planet Mesh - High Resolution */}
        <mesh 
            ref={meshRef}
            onClick={onLand}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; setHover(true) }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; setHover(false) }}
        >
            <sphereGeometry args={[2.5, 512, 512]} />
            <primitive object={planetMaterial} attach="material" />
        </mesh>
        
        {/* Glow / Atmosphere */}
        <mesh scale={[1.2, 1.2, 1.2]} ref={atmosphereRef}>
            <sphereGeometry args={[2.5, 64, 64]} />
            <primitive object={atmosMaterial} attach="material" />
        </mesh>

        {/* Hints */}
        {hovered && (
            <Html position={[0, 0, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
            <div style={{ 
                color: '#ffaa88', 
                background: 'rgba(0,0,0,0.8)', 
                padding: '12px 24px', 
                whiteSpace: 'nowrap', 
                userSelect: 'none',
                fontFamily: 'courier new, monospace',
                textTransform: 'uppercase',
                letterSpacing: '3px',
                border: '1px solid #ff4400',
                boxShadow: '0 0 20px #ff4400',
                textAlign: 'center',
                backdropFilter: 'blur(4px)'
            }}>
                <div style={{ fontSize: '0.8em', color: '#888' }}>Target Locked</div>
                <div>Iniciate Landing</div>
            </div>
            </Html>
        )}
        </Float>
    </group>
  )
}

export default function SpaceScene({ onLand }) {
  const { camera } = useThree()
  
  useEffect(() => {
    // Reset camera position
    camera.position.set(0, 0, 10)
    camera.lookAt(0, 0, 0)
  }, [camera])

  return (
    <>
      <OrbitControls enableZoom={true} minDistance={5} maxDistance={20} enablePan={false} />
      
      {/* Dynamic Lighting for Space */}
      <ambientLight intensity={0.1} />
      
      {/* Main Light Source (Star) */}
      <directionalLight position={[10, 5, 5]} intensity={3} color="#ffeebb" />
      
      {/* Fill Light (cold space reflection) */}
      <directionalLight position={[-10, 0, -5]} intensity={0.5} color="#202040" />

      {/* Backlight used to highlight edges if shader doesn't catch it enough */}
      <spotLight position={[0, 0, -10]} angle={1} penumbra={1} intensity={5} color="#5500ff" />

      <Planet onLand={onLand} />
    </>
  )
}
