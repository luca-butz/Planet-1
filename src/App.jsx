import React, { useState, Suspense, useEffect, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars, Loader } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import SpaceScene from './components/SpaceScene'
import SurfaceScene from './components/SurfaceScene'
import * as THREE from 'three'

/*
  Mission stages:
  0  = Landed, intro text
  1  = Follow signal to bunker
  2  = At bunker entrance
  3  = Inside bunker - Entry Hall (T1 active)
  4  = T1 read, find T2 in Lab Alpha
  5  = T2 read, find T3 in Bio Lab
  6  = T3 read, find T4 in Server Room
  7  = T4 read → collect 4 subsystems
  8  = All systems collected, reactor ready
  11 = Time reversal cinematic
  12 = Timeline restored - futuristic world
*/

const MISSION_TEXTS = {
  "-2": {
    title: 'ORBITAL-SCAN LÄUFT...',
    text: 'Du kehrst nach Jahren von einer Deep-Space-Mission zur Erde zurück. Doch die Sensoren zeigen massive Anomalien. Die Kontinente sind aschegrau, die Ozeane toxisch. Kein Funkkontakt. Steuere das Schiff (W/S für Schub, A/D & Pfeiltasten für Drehung) näher an den Planeten heran, um Scans durchzuführen.',
    hint: 'Fliege näher an die Erde heran (W-Taste für Schub)',
    duration: 15000
  },
  "-1": {
    title: 'VERBINDUNG HERGESTELLT',
    text: 'Scans abgeschlossen. Ein globaler Nuklearkrieg hat die Biosphäre ausgelöscht. Die Oberfläche ist ein ewiger nuklearer Winter. Aber wir empfangen ein schwaches, sich wiederholendes Notsignal aus der nördlichen Hemisphäre! Dringe in die Atmosphäre ein, um am Ursprungsort zu landen.',
    hint: 'Fliege weiter auf den Planeten zu, um die Landung einzuleiten',
    duration: 15000
  },
  0: {
    title: 'KEINE ANTWORT VON DER ERDE...',
    text: 'Du warst Jahre auf einer Deep-Space-Mission. Jetzt bist du zurück. Aber die Erde, die du kanntest, gibt es nicht mehr. Ein globaler Nuklearkrieg hat die Welt in Asche gelegt. Dichte Rauchwolken blockieren die Sonne — ein ewiger nuklearer Winter. Die Oberfläche ist dunkel, kalt, zerstört. Aber die Sensoren erfassen ein schwaches elektromagnetisches Signal in der Nähe. Vielleicht gibt es noch Überlebende in den alten Bunkern...',
    hint: 'Drücke E, um das Schiff zu verlassen. Erkunde das Ödland.',
    duration: 15000
  },
  1: {
    title: 'NOTSIGNAL DETEKTIERT',
    text: 'Analyse abgeschlossen: Das Signal stammt aus einer unterirdischen Einrichtung — ein Bunker. Es tritt eine massive radioaktive Strahlung aus, die in der Ferne den Himmel giftgrün erleuchtet. Wenn du dieser Strahlungsquelle folgst, solltest du den Eingang finden.',
    hint: 'Folge dem grünen radioaktiven Leuchten in der Ferne zum Bunker',
    duration: 12000
  },
  2: {
    title: 'BUNKEREINGANG GEFUNDEN',
    text: 'Eine massive Stahltür, halb verschüttet unter Trümmern. Warnschilder überall: "PROJEKT AURA — ZUGANG NUR MIT AUTORISIERUNG". Die Tür scheint noch funktionsfähig zu sein — ein schwaches grünes Licht blinkt am Schloss. Das Notsignal kommt eindeutig von hier drinnen.',
    hint: 'Drücke E um den Bunker zu betreten',
    duration: 12000
  },
  3: {
    title: 'BUNKER — EINGANGSHALLE',
    text: 'Du betrittst den Bunker. Die Luft ist abgestanden, aber atembar. Notbeleuchtung wirft schwaches Licht auf sterile Wände. Links und rechts stehen aufgerissene Schränke, am Boden liegen verstreute Dokumente. Ein Terminal an der Wand blinkt noch — es scheint Strom zu haben.',
    hint: 'Gehe zum blinkenden Terminal und drücke E',
    duration: 12000
  },
  4: {
    title: 'TERMINAL 1 — VORWARNUNG',
    text: '"Logbuch, Dr. Elena Voss.\n\nDie Spannungen zwischen den Nationen eskalieren weiter. Die Drohungen mit Nuklearwaffen sind kein leeres Gerede mehr. Wir haben beschlossen, nicht länger zu warten.\n\nWir beginnen heute offiziell mit dem Bau des Notfallreaktors tief unter der Erde. Wenn das Schlimmste passiert, wird dieser Reaktor in der Lage sein, die Atmosphäre zu filtern. Er kann gewaltige Mengen an Staub und radioaktiver Asche aus der Luft ziehen und den nuklearen Winter stoppen, bevor er die gesamte Biosphäre dauerhaft zerstört.\\n\\nHoffentlich brauchen wir ihn nie."',
    hint: 'Gehe tiefer — finde Terminal 2 im Labor Alpha',
    duration: 25000
  },
  5: {
    title: 'TERMINAL 2 — DER KRIEG',
    text: '"Es ist passiert.\n\nDie Meldungen kamen vor drei Stunden rein. Raketenstarts auf der ganzen Welt. Das globale Stromnetz ist zusammengebrochen. Die Satellitenverbindungen brechen nacheinander ab.\n\nWir konnten den Schild gerade noch rechtzeitig aktivieren. Die Erschütterungen der Oberfläche reichten bis hier unten, 200 Meter tief. Einige der Korridore wurden beschädigt. Wir sind von der Welt dort oben abgeschnitten.\\n\\nWir wissen nicht, wie viel von der Menschheit noch übrig ist. Aber wir müssen unseren Plan fortsetzen. Der Reaktor ist unsere einzige Priorität."',
    hint: 'Finde Terminal 3 im Serverraum (Folge dem Korridor)',
    duration: 30000
  },
  6: {
    title: 'TERMINAL 3 — LETZTE HOFFNUNG',
    text: '"Tag 842 seit dem Fall.\n\nDie Sensoren an der Oberfläche bestätigen unsere schlimmsten Befürchtungen. Die Aschewolken sind so dicht, dass absolut kein Sonnenlicht mehr durchdringt. Die globale Temperatur fällt auf ein lebensfeindliches Minimum. Ein endloser, nuklearer Winter.\n\nWir haben den Reaktor fast fertig. Er ist die letzte Chance der Menschheit, die Atmosphäre wiederherzustellen.\n\nAber wir können ihn noch nicht aktivieren. Eine Erschütterung hat das Kühlsystem im Bio-Labor beschädigt und die Hauptantenne im Serverraum ist offline gegangen. Ohne diese Systeme überlastet der Reaktor beim Start."',
    hint: 'Weiter in die Reaktorkammer — finde Terminal 4',
    duration: 30000
  },
  7: {
    title: 'TERMINAL 4 — AKTIVIERUNGSANLEITUNG',
    text: '"Automatisches Sicherheitsprotokoll.\n\nWARNUNG: Reaktorkern im Standby-Modus.\nUm die atmosphärische Reinigung zu initiieren, müssen folgende 4 Subsysteme manuell reaktiviert werden:\n\n1. ENERGIEZELLEN (Ersatzbatterien im Labor Alpha finden)\n2. ANTENNEN (Satellitenkontakt im Serverraum herstellen)\n3. KÜHLUNG (Ventile im Bio-Labor reparieren)\n4. SICHERHEITSPROTOKOLL (Code aus dem Vault abrufen)\n\nErst danach kann der Reaktor in der Hauptkammer gestartet werden. Handle mit Vorsicht."',
    hint: 'Aktiviere die 4 Systeme (Labor, Serverraum, Bio-Labor, Vault)',
    duration: 35000
  },
  8: {
    title: 'REAKTOR BEREIT',
    text: 'Alle vier Systeme sind online. Die Energiezellen versorgen den Kern, die Antennen haben die atmosphärischen Ziele kalibriert, die Kühlung stabilisiert die Temperaturen und die Sicherheitsprotokolle sind autorisiert.\n\nDer Notfallreaktor ist bereit für die Zündung.\n\nZeit, den Himmel zu reinigen. Zeit, die ewige Nacht zu beenden.',
    hint: 'Kehre zur Reaktorkammer zurück und drücke E an der Hauptkonsole',
    duration: 30000
  },
  11: { title: 'REAKTOR-ZÜNDUNG AKTIV', text: '', duration: 0 },
  12: {
    title: 'ATMOSPHÄRE GEREINIGT',
    text: 'Der Reaktor hat seinen Dienst verrichtet. Die gewaltigen Filtereinrichtungen haben in einer Kettenreaktion den Fallout aus der Atmosphäre gespalten. Zum ersten Mal seit Jahrzehnten durchbricht Sonnenlicht die Aschewolken.\n\nDie Zivilisation liegt zwar in Trümmern, aber der nukleare Winter ist vorbei. Wir haben eine Zukunft.',
    duration: 15000
  },
}

function SceneManager({ view, setView, missionStage, setMissionStage, dialogVisible, coresCollected, setCoresCollected }) {
    const [transitioning, setTransitioning] = useState(false)

    const startTransition = () => {
        setTransitioning(true)
    }

    const finishTransition = () => {
        setTransitioning(false)
        setView('surface')
        setMissionStage(0)
    }

    if (view === 'surface') {
        return <SurfaceScene missionStage={missionStage} setMissionStage={setMissionStage} dialogVisible={dialogVisible} coresCollected={coresCollected} setCoresCollected={setCoresCollected} />
    }

    return <SpaceScene onLand={startTransition} transitioning={transitioning} onTransitionComplete={finishTransition} missionStage={missionStage} setMissionStage={setMissionStage} />
}

export default function App() {
  const [view, setView] = useState('space')
  const [missionStage, setMissionStage] = useState(-2)
  const [showMissionText, setShowMissionText] = useState(false)
  const [missionFade, setMissionFade] = useState(false)
  const [timeReversalActive, setTimeReversalActive] = useState(false)
  const [timeReversalPhase, setTimeReversalPhase] = useState(0)
  const [coresCollected, setCoresCollected] = useState([false, false, false, false])
  const prevStageRef = useRef(-2)

  // E key to dismiss mission dialog
  const dismissDialog = useCallback(() => {
    if (showMissionText) {
      setShowMissionText(false)
      setMissionFade(false)
    }
  }, [showMissionText])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'KeyE' && showMissionText && missionStage >= 3 && missionStage <= 10) {
        dismissDialog()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showMissionText, missionStage, dismissDialog])

  // Show mission text when stage changes
  useEffect(() => {
    if (missionStage !== prevStageRef.current) {
      prevStageRef.current = missionStage
      if (missionStage === 11) {
        // Time reversal cinematic
        setTimeReversalActive(true)
        setTimeReversalPhase(0)
        const interval = setInterval(() => {
          setTimeReversalPhase(prev => {
            if (prev >= 100) {
              clearInterval(interval)
              setTimeReversalActive(false)
              setMissionStage(12)
              return 100
            }
            return prev + 1
          })
        }, 120) // Slower for more drama
        return () => clearInterval(interval)
      }
      const mission = MISSION_TEXTS[missionStage]
      if (mission) {
        const duration = mission.duration || 6000
        setShowMissionText(true)
        setMissionFade(false)
        const fadeTimer = setTimeout(() => setMissionFade(true), duration - 1000)
        const hideTimer = setTimeout(() => setShowMissionText(false), duration)
        return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
      }
    }
  }, [missionStage])

  // Auto-advance from stage 0 to 1 after landing (only when the player has exited the cockpit)
  // Therefore, removing this auto-advance entirely and leaving it to the 'E' press in SurfaceScene to advance from 0 to 1.

  const currentMission = MISSION_TEXTS[missionStage]

  return (
    <>
      {/* Cinematic Full-Screen Effect */}
      {timeReversalActive && (
        <div className="time-reversal-overlay" style={{ opacity: timeReversalPhase / 100 }}>
          <div className="time-reversal-flash" />
          <div className="time-reversal-text">
            <div className="chrono-glitch">REAKTOR ZÜNDUNG PROZEDUR</div>
            <div className="chrono-counter">{timeReversalPhase}%</div>
            <div className="chrono-sub">Atmosphärische Reinigung läuft...</div>
          </div>
        </div>
      )}

      {/* Mission Restored Overlay */}
      {missionStage === 12 && (
        <div className="restored-overlay">
          <div className="restored-content">
            <h2>NUKLEARER WINTER BEENDET</h2>
            <p>Die Atmosphäre klärt sich. Die Sonne berührt wieder die Oberfläche.</p>
            <p className="restored-sub">Die Erde hat eine zweite Chance.</p>
            <button className="back-btn restored-btn" onClick={() => { setView('space'); setMissionStage(0); }}>
              NEUSTART
            </button>
          </div>
        </div>
      )}

      <div className="overlay">
        <h1>ERDE</h1>
        <p style={{ color: '#ff4400', fontWeight: 'bold' }}>
          {view === 'space' ? 'EWIGE NACHT' : (
            missionStage >= 12 ? 'ATMOSPHÄRE KLAR' :
            missionStage >= 3 ? 'BUNKER INTERIOR' : 'EWIGE NACHT'
          )}
        </p>
        
        {view === 'surface' && missionStage < 11 && (
          <div className="hud-controls">
            <button className="back-btn" onClick={() => { setView('space'); setMissionStage(0); }}>
              RETURN TO ORBIT
            </button>
            <div className="instructions">
              CLICK TO EXPLORE • WASD TO WALK • T FLASHLIGHT {missionStage >= 2 ? '• E INTERAGIEREN' : ''}
            </div>
          </div>
        )}

        {view === 'space' && currentMission && currentMission.hint && missionStage < 0 && (
          <div className="mission-objective">
            <div className="mission-label">MISSION</div>
            <div className="mission-hint">{currentMission.hint}</div>
          </div>
        )}

        {/* Mission Objective HUD */}
        {view === 'surface' && currentMission && currentMission.hint && missionStage < 11 && (
          <div className="mission-objective">
            <div className="mission-label">MISSION</div>
            <div className="mission-hint">{currentMission.hint}</div>
          </div>
        )}

        {/* Energy Core HUD */}
        {view === 'surface' && missionStage === 7 && (
          <div className="core-hud">
            <div className="core-hud-title">SYSTEME AKTIVIEREN</div>
            <div className="core-hud-items">
              <span className={coresCollected[0] ? 'core-found' : 'core-missing'}>◆ ENERGIEZELLEN (Labor)</span>
              <span className={coresCollected[1] ? 'core-found' : 'core-missing'}>◆ ANTENNEN (Serverraum)</span>
              <span className={coresCollected[2] ? 'core-found' : 'core-missing'}>◆ KÜHLUNG (Bio-Labor)</span>
              <span className={coresCollected[3] ? 'core-found' : 'core-missing'}>◆ SICHERHEITSCODE (Vault)</span>
            </div>
          </div>
        )}
      </div>

      {/* Story Dialog Popup */}
      {showMissionText && currentMission && currentMission.text && missionStage < 11 && (
        <div className={`mission-dialog ${missionFade ? 'fade-out' : 'fade-in'}`}>
          <div className="mission-dialog-header">{currentMission.title}</div>
          <div className="mission-dialog-text">{currentMission.text}</div>
          {missionStage >= 3 && missionStage <= 10 && (
            <div className="mission-dialog-close">[E] SCHLIEẞEN</div>
          )}
        </div>
      )}

      <Canvas shadows camera={{ position: [0, 0, 12], fov: 45 }} gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}>
        <color attach="background" args={[missionStage === 12 ? '#0a182a' : '#000000']} />
        
        <Suspense fallback={null}>
            <Stars radius={300} depth={50} count={10000} factor={6} saturation={0} fade speed={0.5} />
            
            <SceneManager view={view} setView={setView} missionStage={missionStage} setMissionStage={setMissionStage} dialogVisible={showMissionText} coresCollected={coresCollected} setCoresCollected={setCoresCollected} />

            <EffectComposer>
              <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} height={300} intensity={missionStage === 12 ? 0.3 : 1.0} />
              <Vignette eskil={false} offset={0.1} darkness={missionStage === 12 ? 0.3 : 1.1} />
              <Noise opacity={missionStage === 12 ? 0.02 : 0.15} />
            </EffectComposer>
        </Suspense>
      </Canvas>
      <Loader />
    </>
  )
}
