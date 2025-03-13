import React, { useState, useEffect, useRef } from "react";
import "./App.css";

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// Handle installation prompt for Android
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  console.log('Install prompt saved');
  
  // Trigger prompt manually (e.g., on button click)
  document.getElementById('install-btn').addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('App installed');
        }
        deferredPrompt = null;
      });
    }
  });
});


/* --- Helper Function --- */
// For drum button placement, new arc starts after 8, 16, and 20 buttons.
// Groups: [8, 8, 4, 4] => max 24 buttons.
function computeDefaultPosition(index, total) {
  // Cap total to 24
  if (total > 24) total = 24;

  const groupSizes = [8, 8, 4, 4];
  let groupIndex = 0;
  let cumulative = 0;
  for (let i = 0; i < groupSizes.length; i++) {
    cumulative += groupSizes[i];
    if (index < cumulative) {
      groupIndex = i;
      break;
    }
  }
  let groupStart = 0;
  for (let i = 0; i < groupIndex; i++) {
    groupStart += groupSizes[i];
  }
  const subIndex = index - groupStart;
  const totalInGroup = groupSizes[groupIndex];

  const areaWidth = Math.min(600, window.innerWidth - 40);
  const centerX = areaWidth / 2;
  
  // Calculate horizontal offset
  let offset = totalInGroup === 2 ? 30 : 30 + Math.floor(subIndex / 2) * 50;
  let x = subIndex % 2 === 0 ? centerX + offset : centerX - offset;
  
  // Base Y shifts for each group
  const baseY = 120 + groupIndex * 80; // Each new arc is 80px lower
  const dx = Math.abs(x - centerX);
  const factor = 0.006;
  const y = baseY + factor * dx * dx;
  return { x: x - 30, y: y - 30 };
}

/* --- Drum Component --- */
function Drum({ drum, toggleNote, handleNoteChange, updateDrumPosition, onDragStart, onDragStop }) {
  const [dragging, setDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const containerRef = useRef(null);
  const lastTapRef = useRef(0);
  const tapTimeoutRef = useRef(null);
  const moveThreshold = 5;

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setDragging(true);
    setHasMoved(false);
    onDragStart();
    setStartMouse({ x: e.clientX, y: e.clientY });
    setStartPos({ x: drum.x, y: drum.y });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startMouse.x;
    const dy = e.clientY - startMouse.y;
    if (!hasMoved && Math.hypot(dx, dy) > moveThreshold) setHasMoved(true);
    updateDrumPosition(drum.id, startPos.x + dx, startPos.y + dy, null, false);
  };

  const handleMouseUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    onDragStop();
    const dx = e.clientX - startMouse.x;
    const dy = e.clientY - startMouse.y;
    const rect = containerRef.current?.getBoundingClientRect() || null;
    updateDrumPosition(drum.id, startPos.x + dx, startPos.y + dy, rect, true);
  };

  useEffect(() => {
    if (dragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, startMouse, startPos, hasMoved]);

  // Close context menu if clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowContextMenu(false);
      }
    };
    if (showContextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showContextMenu]);

  const handleTouchEnd = (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      clearTimeout(tapTimeoutRef.current);
      setShowContextMenu(true);
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        if (!dragging && !showContextMenu && !hasMoved) toggleNote(drum);
      }, 300);
    }
    lastTapRef.current = now;
  };

  const noteOptions = [
    "C5", "B4", "A#4/Bb4", "A4", "G#4/Ab4", "G4",
    "F#4/Gb4", "F4", "E4", "D#4/Eb4", "D4", "C#4/Db4",
    "C4", "B3", "A#3/Bb3", "A3", "G#3/Ab3", "G3",
    "F#4/Gb4", "F3", "E3", "D#4/Eb4", "D3", "C#4/Db4",
    "C3", "B2", "A#2/Bb2", "A2", "G#2/Ab2", "G2",
    "F#2/Gb2", "F2", "E2", "D#2/Eb2", "D2", "C#2/Db2",
    "C2", "B1", "A#1/Bb1", "A1", "G#1/Ab1", "G1",
    "F#1/Gb1", "F1", "E1", "D#1/Eb1", "D1", "C#1/Db1", "C1"
  ];

  let contextMenuStyle = {};
  if (showContextMenu && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    contextMenuStyle = {
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left + rect.width / 2,
      transform: "translateX(-50%)"
    };
  }

  return (
    <div
      ref={containerRef}
      className="drum-container"
      style={{
        position: "absolute",
        left: drum.x,
        top: drum.y,
        width: "60px",
        height: "60px",
        cursor: dragging ? "grabbing" : "grab"
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setShowContextMenu(true);
      }}
      onTouchEnd={handleTouchEnd}
      onClick={() => {
        if (!dragging && !hasMoved && !showContextMenu) toggleNote(drum);
      }}
    >
      <div className="drum-button">
        <div className="drum-circle">{drum.note}</div>
      </div>
      {showContextMenu && (
        <div className="context-menu" style={contextMenuStyle} onClick={(e) => e.stopPropagation()}>
          {noteOptions.map((note) => (
            <div
              key={note}
              className="context-menu-item"
              onClick={() => {
                handleNoteChange(drum, note);
                setShowContextMenu(false);
              }}
            >
              {note}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- ConfigItem Component --- */
function ConfigItem({ config, onLoad, onDelete, onRename, onOverwrite }) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(config.name);

  const toggleRename = () => {
    if (renaming) {
      onRename(config.id, newName);
      setRenaming(false);
    } else {
      setRenaming(true);
    }
  };

  return (
    <li className="config-item">
      {renaming ? (
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename(config.id, newName);
              setRenaming(false);
            }
          }}
          onBlur={() => setRenaming(false)}
          autoFocus
        />
      ) : (
        <button className="load-button" onClick={() => onLoad(config)}>
          {config.name}
        </button>
      )}
      <button className="pencil-button" onClick={toggleRename}>
        ✏️
      </button>
      <button className="overwrite-button" onClick={() => onOverwrite(config.id)}>
        💾
      </button>
      <span className="config-delete" onClick={() => onDelete(config.id)}>
        x
      </span>
    </li>
  );
}

/* --- Tutorial Component --- */
function Tutorial({ onClose }) {
  const tutorialSteps = [
    "Welcome to Tunepani! This app helps you tune your timpani drums.",
    "Drum Management: Click the '+' button to add drum buttons. Drag them anywhere to reposition, or drag them to the trash bin to delete.",
    "Reference Pitch: Tap a drum button to toggle a synthesized reference pitch for that drum.",
    "Changing the Pitch: Double‑click a drum button to open a menu with notes from C5 to C1. Select a note to set the drum's pitch.",
    "Pitch Detection: The app listens via your microphone and shows a gauge indicating whether your note is flat or sharp relative to the reference.",
    "Volume Control: Use the volume slider to adjust the output level of the reference pitch oscillator.",
    "Saving & Loading: In the sidebar, save your drum configuration, load saved pieces, rename them using the pencil icon, or overwrite them with the save icon.",
    "Dark Mode: Toggle Dark Mode from the settings at the bottom of the sidebar to switch themes.",
    "You're all set! Enjoy using Tunepani!"
  ];
  
  const [currentStep, setCurrentStep] = useState(0);
  
  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
      localStorage.setItem("tutorialShown", "true");
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };
  
  return (
    <div className="tutorial-overlay">
      <div className="tutorial-modal">
        <p>{tutorialSteps[currentStep]}</p>
        <div className="tutorial-buttons">
          {currentStep > 0 && <button onClick={prevStep}>Back</button>}
          <button onClick={nextStep}>
            {currentStep === tutorialSteps.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Main Tunepani Component --- */
function Tunepani() {
  const [drums, setDrums] = useState([]);
  const [pitch, setPitch] = useState(0);
  const [closestNote, setClosestNote] = useState("");
  const [volume, setVolume] = useState(0.3);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [configName, setConfigName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const audioContextRef = useRef(null);
  const oscillatorsRef = useRef({});
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const trashBinRef = useRef(null);

  const frequencies = {
    "C2": 65.41, "C#2/Db2": 69.30, "D2": 73.42, "D#2/Eb2": 77.78, "E2": 82.41, "F2": 87.31, "F#2/Gb2": 92.50, "G2": 98.00,
    "G#2/Ab2": 103.83, "A2": 110.00, "A#2/Bb2": 116.54, "B2": 123.47,
    "C3": 130.81, "C#3/Db3": 138.59, "D3": 146.83, "D#3/Eb3": 155.56, "E3": 164.81, "F3": 174.61, "F#3/Gb3": 185.00, "G3": 196.00,
    "G#3/Ab3": 207.65, "A3": 220.00, "A#3/Bb3": 233.08, "B3": 246.94,
    "C4": 261.63, "C#4/Db4": 277.18, "D4": 293.66, "D#4/Eb4": 311.13, "E4": 329.63, "F4": 349.23, "F#4/Gb4": 369.99, "G4": 392.00,
    "G#4/Ab4": 415.30, "A4": 440.00, "A#4/Bb4": 466.16, "B4": 493.88,
    "C5": 523.25,
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 2048;
        microphoneRef.current = audioContext.createMediaStreamSource(stream);
        microphoneRef.current.connect(analyserRef.current);
        detectPitch();
      })
      .catch((error) => console.error("Microphone access error:", error));
    const configs = JSON.parse(localStorage.getItem("tunepaniConfigs")) || [];
    setSavedConfigs(configs);
    if (!localStorage.getItem("tutorialShown")) setShowTutorial(true);
  }, []);

  const detectPitch = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const processPitch = () => {
      analyser.getByteFrequencyData(dataArray);
      const maxVal = Math.max(...dataArray);
      const maxIndex = dataArray.indexOf(maxVal);
      const frequency = maxIndex * (audioContextRef.current.sampleRate / analyser.fftSize);
      setPitch(frequency);
      setClosestNote(findClosestNote(frequency));
      requestAnimationFrame(processPitch);
    };
    processPitch();
  };

  const findClosestNote = (frequency) => {
    if (!frequency || frequency <= 0) return "";
    return Object.keys(frequencies).reduce((closest, note) =>
      Math.abs(frequencies[note] - frequency) < Math.abs(frequencies[closest] - frequency)
        ? note
        : closest
    );
  };

  const addDrum = () => {
    if (drums.length >= 24) return; // Cap at 24 buttons
    const newIndex = drums.length;
    const newPos = computeDefaultPosition(newIndex, drums.length + 1);
    const newDrum = { id: Date.now(), note: "E3", x: newPos.x, y: newPos.y };
    setDrums((prev) => [...prev, newDrum]);
  };

  const removeDrum = (drumId) => {
    setDrums((prev) => prev.filter((drum) => drum.id !== drumId));
    if (oscillatorsRef.current[drumId]) {
      try {
        oscillatorsRef.current[drumId].oscillator.stop(audioContextRef.current.currentTime);
      } catch (e) {
        console.error("Error stopping oscillator", e);
      }
      delete oscillatorsRef.current[drumId];
    }
  };

  const toggleNote = (drum) => {
    if (!frequencies[drum.note]) return;
    const audioContext = audioContextRef.current;
    if (audioContext?.state === "suspended") audioContext.resume();
    if (oscillatorsRef.current[drum.id]) {
      try {
        oscillatorsRef.current[drum.id].oscillator.stop(audioContext.currentTime);
      } catch (e) {
        console.error("Error stopping oscillator", e);
      }
      delete oscillatorsRef.current[drum.id];
    } else {
      const freq = frequencies[drum.note];
      if (!isFinite(freq)) return;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      oscillator.connect(gainNode).connect(audioContext.destination);
      oscillator.start();
      oscillatorsRef.current[drum.id] = { oscillator, gainNode };
    }
  };

  const handleNoteChange = (drum, newNote) => {
    setDrums((prev) =>
      prev.map((d) => (d.id === drum.id ? { ...d, note: newNote } : d))
    );
    if (oscillatorsRef.current[drum.id]) {
      const freq = frequencies[newNote];
      if (isFinite(freq)) {
        oscillatorsRef.current[drum.id].oscillator.frequency.setValueAtTime(
          freq,
          audioContextRef.current.currentTime
        );
      }
    }
  };

  const updateDrumPosition = (drumId, x, y, rect, final = false) => {
    if (isNaN(x) || isNaN(y)) return;
    if (final && trashBinRef.current && rect) {
      const trashRect = trashBinRef.current.getBoundingClientRect();
      if (
        rect.right > trashRect.left &&
        rect.left < trashRect.right &&
        rect.bottom > trashRect.top &&
        rect.top < trashRect.bottom
      ) {
        removeDrum(drumId);
        return;
      }
    }
    setDrums((prev) =>
      prev.map((d) => (d.id === drumId ? { ...d, x, y } : d))
    );
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    Object.values(oscillatorsRef.current).forEach(({ gainNode }) =>
      gainNode.gain.setValueAtTime(newVolume, audioContextRef.current.currentTime)
    );
  };

  const saveConfiguration = () => {
    const name = configName.trim() || "Untitled Piece";
    const newConfig = { id: Date.now(), name, drums };
    const updatedConfigs = [...savedConfigs, newConfig];
    setSavedConfigs(updatedConfigs);
    localStorage.setItem("tunepaniConfigs", JSON.stringify(updatedConfigs));
    setConfigName("");
  };

  const loadConfiguration = (config) => {
    setDrums(config.drums);
    setMenuOpen(false);
  };

  const deleteConfiguration = (configId) => {
    const updatedConfigs = savedConfigs.filter((c) => c.id !== configId);
    setSavedConfigs(updatedConfigs);
    localStorage.setItem("tunepaniConfigs", JSON.stringify(updatedConfigs));
  };

  const handleConfigNameChange = (e) => setConfigName(e.target.value);

  const onDragStart = () => setIsDragging(true);
  const onDragStop = () => setIsDragging(false);

  let markerLeft = 100;
  let gaugeNote = "";
  if (pitch > 0 && closestNote) {
    const ideal = frequencies[closestNote];
    if (ideal) {
      let cents = 1200 * Math.log2(pitch / ideal);
      cents = Math.max(-50, Math.min(50, cents));
      markerLeft = 100 + (cents / 50) * 100;
      gaugeNote = closestNote;
    }
  }

  const closeMenu = () => setMenuOpen(false);
  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const handleRename = (id, newName) => {
    const updated = savedConfigs.map((config) =>
      config.id === id ? { ...config, name: newName } : config
    );
    setSavedConfigs(updated);
    localStorage.setItem("tunepaniConfigs", JSON.stringify(updated));
  };

  const handleOverwrite = (id) => {
    const updated = savedConfigs.map((config) =>
      config.id === id ? { ...config, drums } : config
    );
    setSavedConfigs(updated);
    localStorage.setItem("tunepaniConfigs", JSON.stringify(updated));
  };

  return (
    <div className={`container ${darkMode ? "dark-mode" : ""}`}>
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
      <header className="header">
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>
        <h1 className="title">Tunepani</h1>
        <button className="add-drum-icon" onClick={addDrum}>
          +
        </button>
      </header>

      {menuOpen && <div className="overlay" onClick={closeMenu}></div>}

      {menuOpen && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <button className="menu-button" onClick={() => setMenuOpen(false)}>
              ☰
            </button>
          </div>
          <h3>Save Piece</h3>
          <input
            type="text"
            placeholder="Piece Name"
            value={configName}
            onChange={handleConfigNameChange}
            className="config-input"
          />
          <button className="config-button" onClick={saveConfiguration}>
            Save
          </button>
          <h3>Pieces</h3>
          <ul className="config-list">
            {savedConfigs.map((config) => (
              <ConfigItem
                key={config.id}
                config={config}
                onLoad={loadConfiguration}
                onDelete={deleteConfiguration}
                onRename={handleRename}
                onOverwrite={handleOverwrite}
              />
            ))}
          </ul>
          <div className="settings-menu">
            <h4>Settings</h4>
            <label className="dark-mode-toggle">
              <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
              Dark Mode
            </label>
          </div>
        </aside>
      )}

      <div className="drum-area">
        {drums.map((drum) => (
          <Drum
            key={drum.id}
            drum={drum}
            toggleNote={toggleNote}
            handleNoteChange={handleNoteChange}
            updateDrumPosition={updateDrumPosition}
            onDragStart={onDragStart}
            onDragStop={onDragStop}
          />
        ))}
        {isDragging && (
          <div className="trash-bin" ref={trashBinRef}>
            <span className="trash-icon">🗑️</span>
          </div>
        )}
      </div>

      <main className="main-content">
        <div className="gauge-container">
          <span className="gauge-label">Flat</span>
          <div className="gauge">
            <div className="gauge-marker" style={{ left: markerLeft + "px" }}></div>
          </div>
          <span className="gauge-label">Sharp</span>
        </div>
        <div className="gauge-note">Detected Note: {gaugeNote}</div>
        <div className="volume-control">
          <label htmlFor="volume-slider">Volume:</label>
          <input id="volume-slider" type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} />
        </div>
      </main>
    </div>
  );
}

export default Tunepani;
