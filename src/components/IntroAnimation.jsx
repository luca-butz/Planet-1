import React, { useState, useEffect } from 'react';
import CinematicEarth from './CinematicEarth';
import './IntroAnimation.css';

export default function IntroAnimation({ onComplete }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timeline = [
      { duration: 4000, next: 1 }, // 0: space launch
      { duration: 2500, next: 2 }, // 1: 5 years later
      { duration: 3500, next: 3 }, // 2: politicians
      { duration: 4000, next: 4 }, // 3: button press
      { duration: 3500, next: 5 }, // 4: nukes launch (flight time)
      { duration: 4000, next: 6 }, // 5: nukes hit, earth destroyed
      { duration: 3500, next: 7 }, // 6: 10 years later
    ];

    let currentTimer;

    const runTimeline = (currentIndex) => {
      if (currentIndex >= timeline.length) {
        onComplete();
        return;
      }
      
      const step = timeline[currentIndex];
      currentTimer = setTimeout(() => {
        setPhase(step.next);
        runTimeline(currentIndex + 1);
      }, step.duration);
    };

    runTimeline(0);

    return () => clearTimeout(currentTimer);
  }, [onComplete]);

  const showEarth = phase === 0 || phase >= 4;
  const isDestroyedEarth = phase >= 5;
  const showMissiles = phase >= 4 && phase <= 5;

  return (
    <div className="intro-container">
      {showEarth && <CinematicEarth isDestroyed={isDestroyedEarth} showMissiles={showMissiles} />}

      {phase === 0 && (
        <div className="scene scene-launch fade-in">
          <div className="intro-text-top">JAHR 2040: START ZUR DEEP-SPACE-MISSION</div>
          <div className="spaceship-launching-3d"></div>
        </div>
      )}

      {phase === 1 && (
        <div className="scene scene-black fade-in">
          <div className="time-skip-text">5 JAHRE SPÄTER...</div>
        </div>
      )}

      {phase === 2 && (
        <div className="scene scene-grid fade-in">
          <div className="intro-text-top red-text blink">KRIEGSERKLÄRUNG BESTÄTIGT</div>
          <div className="split-screen">
            <div className="screen-panel left-panel flash-bg">
              <div className="silhouette-person angry-left"></div>
            </div>
            <div className="screen-panel right-panel flash-bg-delay">
              <div className="silhouette-person angry-right"></div>
            </div>
            <div className="screen-panel bottom-panel static-noise">
              <div className="warning-text">DER KRIEG IST AUSGEBROCHEN</div>
            </div>
          </div>
        </div>
      )}

      {/* NEW: War Scene Removed as per user request */}

      {phase === 3 && (
        <div className="scene scene-red-button fade-in desk-bg">
          <div className="intro-text-top red-text">AUTORISIERUNG BESTÄTIGT</div>
          <div className="hq-desk">
            <div className="military-panel">
              <div className="keypad-lights"></div>
              <div className="button-enclosure">
                <div className="hq-red-button"></div>
              </div>
            </div>
            <div className="hq-hand-pressing"></div>
          </div>
        </div>
      )}

      {phase >= 4 && phase <= 5 && (
        <div className="scene scene-destruction-overlay fade-in">
          {phase === 4 && <div className="intro-text-top red-text blink">RAKETENSTART ERKANNT</div>}
          {phase === 5 && <div className="intro-text-top red-text">ATOMARER SCHLAG</div>}
          {phase === 5 && <div className="flash-overlay"></div>}
        </div>
      )}

      {phase === 6 && (
        <div className="scene scene-black fade-in">
          <div className="time-skip-text">10 JAHRE SPÄTER...</div>
        </div>
      )}

      <button className="skip-button" onClick={onComplete}>Überspringen</button>
    </div>
  );
}
