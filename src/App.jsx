import React, { useState, Suspense, useEffect, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars, Html, Loader } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import SpaceScene from './components/SpaceScene'
import SurfaceScene from './components/SurfaceScene'
import * as THREE from 'three'

import IntroAnimation from './components/IntroAnimation';

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
    text: 'Du warst Jahre auf einer Deep-Space-Mission. Jetzt bist du zurück. Aber die Erde, die du kanntest, gibt es nicht mehr. Ein globaler Nuklearkrieg hat die Welt in Asche gelegt. Dichte Rauchwolken blockieren die Sonne — ein ewiger nuklearer Winter. Die Sensoren erfassen ein schwaches elektromagnetisches Signal in der Ferne. Vielleicht gibt es noch Überlebende in den alten Bunkern...',
    hint: 'Drücke E, um das Schiff zu verlassen. Finde den Bunker (Zeitlimit!).',
    duration: 15000
  },
  1: {
    title: 'LANDUNG ERFOLGREICH — SAUERSTOFF-LIMIT',
    text: 'Du hast auf der aschebedeckten Oberfläche aufgesetzt. Die Toxizität der Außenluft korrodiert die Filter deines Anzugs — du hast nicht viel Zeit! Das Notsignal stammt aus einer unterirdischen Einrichtung. Suche nach grüner Strahlung in der Ferne und einem Zugangscode in den Trümmern davor.',
    hint: 'Finde den Bunker! (Tipp: In der Nähe des Raumschiffes lädt sich der Sauerstoff wieder auf)',
    duration: 18000
  },
  2: {
    title: 'BUNKEREINGANG GEFUNDEN',
    text: 'Eine massive Stahltür, halb verschüttet unter Trümmern. Warnschilder überall: "PROJEKT HELIOS — ZUGANG NUR MIT AUTORISIERUNG". Die Tür scheint noch funktionsfähig zu sein — ein schwaches grünes Licht blinkt am Keypad.',
    hint: 'Finde den 4-stelligen Zugangscode in der Nähe der Trümmer und gib ihn ein',
    duration: 15000
  },
  3: {
    title: 'BUNKER — SICHERHEITSZONE',
    text: 'Du betrittst den Bunker. Die Luft ist abgestanden, aber atembar. Notbeleuchtung wirft schwaches Licht auf sterile Wände. Die internen Sicherheitssysteme sind noch aktiv. Bevor du weiter vordringst, solltest du dir die EMP-Waffe weiter hinten im Korridor beschaffen. Pass auf die Sicherheitsdrohne auf!',
    hint: 'Schleiche dich an der Drohne vorbei zur EMP-Waffe (nicht in den Suchscheinwerfer geraten!)',
    duration: 12000
  },
  4: {
    title: 'EMP-WAFFE EINGESAMMELT',
    text: 'Waffe online. Drücke Q, um sie auszurüsten. Die Waffe hat eine eigene Taschenlampe integriert. Die Terminals geben nun den Zugriff frei.',
    hint: 'Kehre zum blinkenden Terminal 1 in der Eingangshalle zurück und drücke E',
    duration: 12000
  },
  5: {
    title: 'TERMINAL 1 — VORWARNUNG',
    text: '"Logbuch, Dr. Elena Voss.\n\nDie Spannungen zwischen den Nationen eskalieren weiter. Die Drohungen mit Nuklearwaffen sind kein leeres Gerede mehr. Wir haben beschlossen, nicht länger zu warten.\n\nWir beginnen heute offiziell mit dem Bau des Notfallreaktors tief unter der Erde. Wenn das Schlimmste passiert, wird dieser Reaktor in der Lage sein, die Atmosphäre zu filtern. Er kann gewaltige Mengen an Staub und radioaktiver Asche aus der Luft ziehen und den nuklearen Winter stoppen, bevor er die gesamte Biosphäre dauerhaft zerstört.\\n\\nHoffentlich brauchen wir ihn nie."',
    hint: 'Gehe tiefer — finde Terminal 2 im Labor Alpha',
    duration: 25000
  },
  6: {
    title: 'TERMINAL 2 — DER KRIEG',
    text: '"Es ist passiert.\n\nDie Meldungen kamen vor drei Stunden rein. Raketenstarts auf der ganzen Welt. Das globale Stromnetz ist zusammengebrochen. Die Satellitenverbindungen brechen nacheinander ab.\n\nWir konnten den Schild gerade noch rechtzeitig aktivieren. Die Erschütterungen der Oberfläche reichten bis hier unten, 200 Meter tief. Einige der Korridore wurden beschädigt. Wir sind von der Welt dort oben abgeschnitten.\\n\\nWir wissen nicht, wie viel von der Menschheit noch übrig ist. Aber wir müssen unseren Plan fortsetzen. Der Reaktor ist unsere einzige Priorität."',
    hint: 'Finde Terminal 3 im Serverraum (Folge dem Korridor)',
    duration: 30000
  },
  7: {
    title: 'TERMINAL 3 — LETZTE HOFFNUNG',
    text: '"Tag 842 seit dem Fall.\n\nDie Sensoren an der Oberfläche bestätigen unsere schlimmsten Befürchtungen. Die Aschewolken sind so dicht, dass absolut kein Sonnenlicht mehr durchdringt. Die globale Temperatur fällt auf ein lebensfeindliches Minimum. Ein endloser, nuklearer Winter.\n\nWir haben den Reaktor fast fertig. Er ist die letzte Chance der Menschheit, die Atmosphäre wiederherzustellen.\n\nAber wir können ihn noch nicht aktivieren. Eine Erschütterung hat das Kühlsystem im Bio-Labor beschädigt und die Hauptantenne im Serverraum ist offline gegangen. Ohne diese Systeme überlastet der Reaktor beim Start."',
    hint: 'Weiter in die Reaktorkammer — finde Terminal 4',
    duration: 30000
  },
  8: {
    title: 'TERMINAL 4 — AKTIVIERUNGSANLEITUNG',
    text: '"Automatisches Sicherheitsprotokoll.\n\nWARNUNG: Reaktorkern im Standby-Modus.\nUm die atmosphärische Reinigung zu initiieren, müssen folgende 4 Subsysteme manuell reaktiviert werden:\n\n1. ENERGIEZELLEN (Ersatzbatterien im Labor Alpha finden)\n2. ANTENNEN (Satellitenkontakt im Serverraum herstellen)\n3. KÜHLUNG (Ventile im Bio-Labor reparieren)\n4. SICHERHEITSPROTOKOLL (Code aus dem Vault abrufen)\n\nErst danach kann der Reaktor in der Hauptkammer gestartet werden. Handle mit Vorsicht."',
    hint: 'Aktiviere die 4 Systeme (Labor, Serverraum, Bio-Labor, Vault)',
    duration: 35000
  },
  9: {
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


function KeypadUI({ code, onSolve, onCancel }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9' && !error) {
        setInput(prev => {
          if (prev.length >= 4) return prev;
          const nextInput = prev + e.key;
          if (nextInput.length === 4) {
            if (nextInput === code) {
              setTimeout(onSolve, 300);
            } else {
              setTimeout(() => { setError(true); setInput(''); }, 500);
            }
          }
          return nextInput;
        });
      } else if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, onSolve, onCancel, error]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(5, 5, 8, 0.95)', backdropFilter: 'blur(15px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, pointerEvents: 'auto'
    }}>
      <div style={{
        background: '#111', border: '4px solid #333', padding: '40px', borderRadius: '15px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        boxShadow: '0 0 50px rgba(0,255,150,0.1)', width: '350px'
      }}>
        <div style={{ color: '#aaa', marginBottom: '20px', fontSize: '22px', textAlign: 'center', fontWeight: 'bold', letterSpacing: '2px' }}>
          PROJEKT HELIOS<br/><span style={{ fontSize: '14px', color: '#666', letterSpacing: '1px' }}>SYSTEMZUGANG</span>
        </div>
        <div style={{
          background: error ? '#500' : '#1a221a', color: error ? '#f00' : '#0f0',
          width: '100%', height: '70px', display: 'flex', justifyContent: 'center',
          alignItems: 'center', fontSize: '40px', fontFamily: 'monospace',
          marginBottom: '30px', letterSpacing: '10px', border: 'inset 3px #000',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.9)'
        }}>
          {error ? 'ERR' : input.padEnd(4, '_')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', width: '100%' }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <div key={n} style={{
              padding: '15px 0', fontSize: '24px', fontWeight: 'bold', textAlign: 'center',
              background: '#222', color: '#ddd', border: '2px solid #444', borderRadius: '8px',
              fontFamily: 'monospace'
            }}>
              {n}
            </div>
          ))}
          <div style={{
            gridColumn: '1 / span 3', padding: '12px 0', fontSize: '16px', background: '#301818',
            color: '#ff8888', border: '2px solid #602020', textAlign: 'center', borderRadius: '8px',
            fontFamily: 'monospace', marginTop: '10px'
          }}>
            ABBRUCH (ESC / E)
          </div>
        </div>
      </div>
    </div>
  )
}

function SceneManager({ view, setView, missionStage, setMissionStage, dialogVisible, coresCollected, setCoresCollected, isGameEntering, setIsGameEntering, setOxygen, keypadActive, setKeypadActive }) {
    const [transitioning, setTransitioning] = useState(false)

    useEffect(() => {
        if (keypadActive) {
            // document.exitPointerLock();
        }
    }, [keypadActive]);

    const startTransition = () => {
        setTransitioning(true)
    }

    const finishTransition = () => {
        setTransitioning(false)
        setView('surface')
        setMissionStage(1)
    }

    if (view === 'surface') {
        return (
            <>
               <SurfaceScene missionStage={missionStage} setMissionStage={setMissionStage} dialogVisible={dialogVisible} coresCollected={coresCollected} setCoresCollected={setCoresCollected} setOxygen={setOxygen} setKeypadActive={setKeypadActive} keypadActive={keypadActive} />
            </>
        )
    }

    return <SpaceScene onLand={startTransition} transitioning={transitioning} onTransitionComplete={finishTransition} missionStage={missionStage} setMissionStage={setMissionStage} isEntering={isGameEntering} setIsEntering={setIsGameEntering} />
}

export default function App() {
  const [view, setView] = useState('start')
  const [missionStage, setMissionStage] = useState(-2)
  const [showMissionText, setShowMissionText] = useState(false)
  const [missionFade, setMissionFade] = useState(false)
  const [timeReversalActive, setTimeReversalActive] = useState(false)
  const [timeReversalPhase, setTimeReversalPhase] = useState(0)
  const [coresCollected, setCoresCollected] = useState([false, false, false, false])
  const [isGameEntering, setIsGameEntering] = useState(false)
  const [oxygen, setOxygen] = useState(100)
  const [keypadActive, setKeypadActive] = useState(false)
  const prevStageRef = useRef(-2)

  // Oxygen depletion interval
  useEffect(() => {
    let interval;
    if (view === 'surface' && (missionStage === 1 || missionStage === 2)) {
        interval = setInterval(() => {
            setOxygen(prev => {
                if (prev <= 1) {
                    alert("SAUERSTOFF AUFGEBRAUCHT! DEIN ANZUG HAT VERSAGT.");
                    window.location.reload();
                    return 0;
                }
                return prev - 1;
            });
        }, 1200); // 120 seconds total inside radiation
    } else {
        setOxygen(100);
    }
    return () => { if (interval) clearInterval(interval); }
  }, [view, missionStage]);

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

  if (view === 'start') {
    return (
      <div style={{
          width: '100vw', height: '100vh', 
          backgroundColor: 'black', 
          display: 'flex', flexDirection: 'column', 
          justifyContent: 'center', alignItems: 'center',
          color: 'white', fontFamily: 'monospace'
      }}>
        <h1 style={{ fontSize: '4rem', letterSpacing: '0.2em', marginBottom: '20px' }}>PROJEKT HELIOS</h1>
        <p style={{ color: '#888', marginBottom: '50px' }}>A post-apocalyptic narrative experience</p>
        <button 
          onClick={() => setView('intro')}
          style={{
            padding: '15px 40px', fontSize: '1.5rem', 
            background: 'transparent', color: 'white', 
            border: '2px solid white', cursor: 'pointer',
            transition: 'background 0.3s, color 0.3s'
          }}
          onMouseEnter={(e) => { e.target.style.background = 'white'; e.target.style.color = 'black'; }}
          onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'white'; }}
        >
          START MISSION
        </button>
      </div>
    )
  }

  if (view === 'intro') {
    return <IntroAnimation onComplete={() => { setIsGameEntering(true); setView('space'); }} />
  }

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

      {/* Gameplay Stats HUD (Oxygen & Flashlight & Geiger) */}
      {view === 'surface' && (missionStage >= 0 && missionStage < 11) && (
        <div style={{ position: 'absolute', bottom: '30px', left: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div id="oxygen-hud" style={{ display: 'none', flexDirection: 'column', gap: '5px' }}>
                <div style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>ANZUG-INTEGRITÄT (O2)</div>
                <div style={{ width: '200px', height: '10px', background: '#333', border: '1px solid #555' }}>
                    <div id="oxygen-bar" style={{ width: '100%', height: '100%', background: '#00aaff', transition: 'width 1s linear, background 0.3s' }}></div>
                </div>
            </div>
            
            <div id="flashlight-hud" style={{ display: 'none', flexDirection: 'column', gap: '5px' }}>
                <div style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>TASCHENLAMPE BATTERIE</div>
                <div style={{ width: '200px', height: '10px', background: '#333', border: '1px solid #555' }}>
                    <div id="flashlight-bar" style={{ width: '100%', height: '100%', background: '#ffcc00', transition: 'width 0.2s linear' }}></div>
                </div>
            </div>

            <div id="geiger-hud" style={{ display: 'none', color: '#0f0', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.2rem', textShadow: '0 0 5px #0f0' }}>
               RAD: <span id="geiger-value">0.1</span> mSv/h
            </div>
        </div>
      )}

      {/* Game Over Screen */}
      <div id="gameover-screen" style={{ 
          display: 'none', position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: 'rgba(0,0,0,0.9)', zIndex: 9999, flexDirection: 'column', 
          justifyContent: 'center', alignItems: 'center', color: 'red', fontFamily: 'monospace'
      }}>
          <h1 style={{ fontSize: '4rem', letterSpacing: '5px' }}>ANZUG VERSAGT</h1>
          <p style={{ fontSize: '1.5rem', color: '#aaa', marginBottom: '40px' }}>Die toxische Strahlung hat dich überwältigt.</p>
          <button style={{ padding: '15px 30px', background: 'transparent', color: 'red', border: '2px solid red', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => window.location.reload()}>NEUSTART</button>
      </div>

      {/* Interaction Prompts handled natively or via HTML */}
      <div id="keypad-container" style={{ display: keypadActive ? 'block' : 'none', zIndex: 1000, position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)' }}>
          {keypadActive && (
              <KeypadUI 
                  code="7341" 
                  onSolve={() => { setKeypadActive(false); setMissionStage(3); }} 
                  onCancel={() => setKeypadActive(false)} 
              />
          )}
      </div>

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
              CLICK TO EXPLORE • WASD TO WALK • T FLASHLIGHT • Q WAFFE {missionStage >= 2 ? '• E INTERAGIEREN' : ''}
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

      {/* Oxygen Meter Overlay */}
      {view === 'surface' && (missionStage === 1 || missionStage === 2) && (
        <div style={{
          position: 'absolute', top: '20px', right: '20px',
          background: 'rgba(0,0,0,0.8)', padding: '15px 20px', 
          border: '1px solid #555', color: 'white', fontFamily: 'monospace',
          zIndex: 100, borderRadius: '5px'
        }}>
           <div style={{ marginBottom: '8px', color: oxygen < 30 ? '#f00' : '#888' }}>
              ANZUG-SAUERSTOFF Level kritisch
           </div>
           <div style={{ width: '200px', height: '15px', background: '#222', border: '1px solid #111' }}>
              <div style={{ 
                  width: `${oxygen}%`, height: '100%', 
                  background: oxygen < 30 ? '#f00' : '#0f0',
                  transition: 'width 1s linear',
                  boxShadow: oxygen < 30 ? '0 0 10px #f00' : '0 0 10px #0f0'
              }} />
           </div>
           <div style={{ marginTop: '8px', fontSize: '14px', textAlign: 'right', color: oxygen < 30 ? '#f00' : '#ddd', fontWeight: 'bold' }}>
              {Math.floor(oxygen)}% VERBLEIBEND
           </div>
        </div>
      )}

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

      <Canvas shadows dpr={[1, 1.5]} performance={{ min: 0.5 }} camera={{ position: [0, 0, 12], fov: 45 }} gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}>
        <color attach="background" args={[missionStage === 12 ? '#0a182a' : '#000000']} />
        
        <Suspense fallback={null}>
            <Stars radius={300} depth={50} count={10000} factor={6} saturation={0} fade speed={0.5} />
            
            <SceneManager view={view} setView={setView} missionStage={missionStage} setMissionStage={setMissionStage} dialogVisible={showMissionText} coresCollected={coresCollected} setCoresCollected={setCoresCollected} isGameEntering={isGameEntering} setIsGameEntering={setIsGameEntering} setOxygen={setOxygen} keypadActive={keypadActive} setKeypadActive={setKeypadActive} />

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
