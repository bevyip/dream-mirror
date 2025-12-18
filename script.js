import AudioAnalyzer from "./src/audioAnalyzer.js";
import SimplexNoise from "https://cdn.jsdelivr.net/npm/simplex-noise@3.0.1/+esm";
// import DreamMirrorSpeechProcessor from "./src/speechProcessor.js"; // COMMENTED OUT - sentient processing disabled for now

function initThreeJS() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  document.body.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0xffffff, 1, 100);
  pointLight1.position.set(0, 0, 10);
  pointLight1.castShadow = true;
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x2f0000, 1, 100);
  pointLight2.position.set(12, 0, -2);
  pointLight2.castShadow = true;
  scene.add(pointLight2);

  const pointLight3 = new THREE.PointLight(0x00002f, 1, 100);
  pointLight3.position.set(-12, 0, -2);
  pointLight3.castShadow = true;
  scene.add(pointLight3);

  const hLight1 = new THREE.HemisphereLight(0x1047f2, 0xef10f2);
  hLight1.position.set(1.2, 0, 0);
  hLight1.lookAt(0, 0, 0);
  scene.add(hLight1);

  // Mid Light
  const mLight = new THREE.PointLight(0xffffff, 1, 0.3);
  mLight.position.set(0, 0, 0);
  mLight.castShadow = true;
  scene.add(mLight);

  // Torus Geometry
  let geometries = [
    new THREE.TorusGeometry(8, 2, 40, 150),
    new THREE.TorusGeometry(8, 2, 40, 150),
    new THREE.TorusGeometry(8, 2, 40, 150),
  ];

  // add color attributes to the geometry
  let colors = [];
  geometries.forEach((geometry) =>
    colors.push(new Float32Array(geometry.attributes.position.count * 3))
  );
  colors.forEach((cs, i) =>
    geometries[i].setAttribute("color", new THREE.BufferAttribute(cs, 3))
  );

  let materials = [
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 2,
      metalness: 0.4,
    }),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 2,
      metalness: 0.4,
    }),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 2,
      metalness: 0.4,
    }),
  ];

  let spheres = [];
  geometries.forEach((g, i) => spheres.push(new THREE.Mesh(g, materials[i])));
  spheres.forEach((sphere) => scene.add(sphere));

  camera.position.z = 3;

  const simplex = new SimplexNoise();
  const audioAnalyzer = new AudioAnalyzer();

  // Speech processor for real-time emotion detection - COMMENTED OUT for now
  // Valence (emotion) system with smooth easing interpolation
  let valence = 0.0; // Current valence value (-1 to 1)
  let targetValence = 0.0; // Target valence to smoothly transition to
  const valenceLerpSpeed = 0.08; // How fast to interpolate (0.08 = smooth but responsive transition)

  // Easing function for smooth slider-like transitions (easeOutCubic)
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // COMMENTED OUT - sentient processing disabled for now
  // // Callback to update valence when emotions are detected
  // const updateValenceFromSpeech = (newValence) => {
  //   // Set target valence - will smoothly interpolate in animation loop
  //   targetValence = THREE.MathUtils.clamp(newValence, -1, 1);
  // };

  // const speechProcessor = new DreamMirrorSpeechProcessor(
  //   updateValenceFromSpeech
  // );

  // // Expose speechProcessor globally for testing
  // window.speechProcessor = speechProcessor;

  // // Initialize speech processor (loads emotion model)
  // speechProcessor.initialize().catch((error) => {
  //   console.error("Failed to initialize speech processor:", error);
  // });

  /**
   * Convert valence (-1 to 1) to HSL color for smooth continuous gradient
   * Maps: -1 (red/dark) → 0 (Siri-like multi-color mix) → +1 (yellow/gold/bright)
   * @param {number} valenceValue - Valence value from -1 to 1
   * @param {number} noiseValue - Optional noise value for neutral multi-color variation (0-1)
   * @returns {THREE.Color} - Color in HSL space
   */
  function getValenceColor(valenceValue, noiseValue = 0) {
    const clampedValence = THREE.MathUtils.clamp(valenceValue, -1, 1);
    const color = new THREE.Color();

    // Special handling for neutral (valence near 0) - Siri-like multi-color mix
    const neutralThreshold = 0.1; // Consider values within ±0.1 as neutral
    if (Math.abs(clampedValence) < neutralThreshold) {
      // Siri-like color palette: blues, teals, purples, pinks
      // Use noise to create variation across the surface
      const normalizedNoise = (noiseValue + 1) / 2; // Normalize noise from -1,1 to 0,1

      // Create a color wheel through blues, teals, purples, and pinks
      // Hue range: 200° (blue) → 280° (purple) → 320° (pink) → 200° (wrap around)
      const hueRange = 120; // 200° to 320° (120 degrees)
      const baseHue = 200; // Start at blue
      const hue = (baseHue + normalizedNoise * hueRange) % 360;

      // High saturation for vibrant colors
      const saturation = 70 + normalizedNoise * 20; // 70% to 90%

      // Medium to high lightness for that bright, glowing effect
      const lightness = 60 + normalizedNoise * 20; // 60% to 80%

      color.setHSL(hue / 360, saturation / 100, lightness / 100);
      return color;
    }

    // Map valence to HSL color space for smooth continuous gradient
    // Hue: -1 (red ~0°) → 0 (blue ~240°) → +1 (yellow ~60°)
    let hue, saturation, lightness;

    if (clampedValence < 0) {
      // Negative range (-1 to -0.1): Red → Purple → Blue
      // Hue: 0° (red) to 240° (blue)
      const t = (clampedValence + 1) / (1 - neutralThreshold); // Normalize to account for neutral zone
      hue = 0 + t * 240; // Red (0°) to Blue (240°)
      saturation = 70 + t * 20; // 70% to 90% saturation
      lightness = 30 + t * 20; // 30% to 50% lightness (darker for negative)
    } else {
      // Positive range (0.1 to +1): Blue → Cyan → Yellow/Gold
      // Hue: 240° (blue) to 60° (yellow) - going the long way through cyan
      const t = (clampedValence - neutralThreshold) / (1 - neutralThreshold); // Normalize
      hue = 240 - t * 180; // Blue (240°) to Yellow (60°) via cyan
      saturation = 90 - t * 10; // 90% to 80% saturation
      lightness = 50 + t * 30; // 50% to 80% lightness (brighter for positive)
    }

    // Convert HSL to RGB using Three.js Color
    color.setHSL(hue / 360, saturation / 100, lightness / 100);

    return color;
  }

  // Audio-reactive variables
  let audioIntensity = 0;
  let smoothedAudioIntensity = 0;
  let audioFrequency = 0;
  let audioAnalysisInterval = null;

  let time = 0;
  let cnt = 0;
  function animate() {
    // Smooth audio intensity for smoother visual transitions
    smoothedAudioIntensity += (audioIntensity - smoothedAudioIntensity) * 0.1;

    // Smoothly interpolate valence towards target valence with easing (slider-like transition)
    // Easing creates smooth acceleration and deceleration, like dragging a slider
    const valenceDistance = targetValence - valence;
    if (Math.abs(valenceDistance) > 0.001) {
      // Calculate progress (0 to 1) based on remaining distance
      // Apply easing for smooth, natural transitions that feel like dragging a slider
      const progress = Math.min(Math.abs(valenceDistance) / 2, 1); // Normalize distance
      const easedSpeed = easeOutCubic(progress) * valenceLerpSpeed;
      valence +=
        Math.sign(valenceDistance) *
        Math.max(easedSpeed, valenceLerpSpeed * 0.3);
    }

    // Audio-reactive maxChange - increases with audio intensity
    // Use non-linear mapping for more gradual response and wider range
    const baseMaxChange = 0.15; // Higher base - more active at quiet levels
    const maxMaxChange = 0.5; // Maximum cap - waves never exceed this

    // Use exponential curve for more gradual scaling (intensity^2 gives smoother curve)
    // This creates more variety: small changes = small flares, loud sounds = big flares
    const intensityCurve = Math.pow(smoothedAudioIntensity, 1.5); // Power curve for gradual scaling
    const audioBoost = intensityCurve * (maxMaxChange - baseMaxChange);
    const maxChange = Math.min(baseMaxChange + audioBoost, maxMaxChange); // Cap at maximum
    geometries.forEach((geometry, index) => {
      const positions = geometry.attributes.position.array;
      const colors = geometry.attributes.color.array;
      const vertex = new THREE.Vector3();

      for (let i = 0; i < positions.length; i += 3) {
        vertex.set(positions[i], positions[i + 1], positions[i + 2]);

        // Get original vertex position for color variation (before displacement)
        const originalVertex = vertex.clone().normalize();

        // Use a different noise sample for color variation (spatial pattern)
        const colorNoise = simplex.noise4D(
          originalVertex.x * 2,
          originalVertex.y * 2,
          originalVertex.z * 2,
          time * 0.5 + index * 10 // Slower, different pattern
        );

        const noiseValue = simplex.noise4D(
          vertex.x,
          vertex.y,
          vertex.z,
          time + index
        );
        const displacement = maxChange * noiseValue;
        vertex.normalize().multiplyScalar(1 + displacement);

        positions[i] = vertex.x;
        positions[i + 1] = vertex.y;
        positions[i + 2] = vertex.z;

        // Valence-based colors with displacement variation
        // Use colorNoise for neutral multi-color effect (Siri-like)
        const baseValenceColor = getValenceColor(valence, colorNoise);
        const displacedValenceColor = getValenceColor(
          valence + 0.2,
          colorNoise
        ); // Slight variation for displacement

        // Blend based on displacement amount
        const color = baseValenceColor
          .clone()
          .lerp(displacedValenceColor, Math.abs(displacement) / maxChange);

        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    });

    // Audio-reactive speed - faster with audio (more gradual curve)
    const baseSpeed = 0.01;
    const maxSpeedBoost = 0.03; // Maximum speed boost cap
    const speedIntensityCurve = Math.pow(smoothedAudioIntensity, 1.5); // Same gradual curve
    const audioSpeedBoost = speedIntensityCurve * maxSpeedBoost;
    time += baseSpeed + audioSpeedBoost;

    // Audio-reactive scaling of toruses - use same non-linear curve
    const baseScale = 1.0;
    const maxScale = 1.2; // Maximum scale cap
    const scaleIntensityCurve = Math.pow(smoothedAudioIntensity, 1.5); // Same curve as displacement
    const audioScale = Math.min(
      baseScale + scaleIntensityCurve * (maxScale - baseScale),
      maxScale
    );
    spheres.forEach((sphere, i) => {
      const targetScale = audioScale;
      const currentScale = sphere.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * 0.1;
      sphere.scale.set(newScale, newScale, newScale);
    });

    renderer.render(scene, camera);

    requestAnimationFrame(animate);
  }

  // Audio controls UI
  function setupAudioControls() {
    const audioContainer = document.createElement("div");
    audioContainer.style.position = "absolute";
    audioContainer.style.top = "20px";
    audioContainer.style.left = "50%";
    audioContainer.style.transform = "translateX(-50%)";
    audioContainer.style.zIndex = "1000";
    audioContainer.style.display = "flex";
    audioContainer.style.gap = "10px";
    audioContainer.style.alignItems = "center";

    const micButton = document.createElement("button");
    micButton.textContent = "🎤 Start Audio";
    micButton.style.padding = "12px 24px";
    micButton.style.fontSize = "16px";
    micButton.style.fontWeight = "600";
    micButton.style.color = "white";
    micButton.style.backgroundColor = "#3b82f6";
    micButton.style.border = "none";
    micButton.style.borderRadius = "8px";
    micButton.style.cursor = "pointer";
    micButton.style.transition = "all 0.3s";
    micButton.style.fontFamily = "Satoshi, sans-serif";

    micButton.addEventListener("mouseenter", () => {
      if (!audioAnalyzer.isListening) {
        micButton.style.backgroundColor = "#2563eb";
        micButton.style.transform = "scale(1.05)";
      }
    });

    micButton.addEventListener("mouseleave", () => {
      if (!audioAnalyzer.isListening) {
        micButton.style.backgroundColor = "#3b82f6";
        micButton.style.transform = "scale(1)";
      }
    });

    // Waveform visualization
    const waveformContainer = document.createElement("div");
    waveformContainer.style.width = "200px";
    waveformContainer.style.height = "40px";
    waveformContainer.style.marginLeft = "15px";
    waveformContainer.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
    waveformContainer.style.borderRadius = "8px";
    waveformContainer.style.padding = "8px";
    waveformContainer.style.display = "flex";
    waveformContainer.style.alignItems = "center";
    waveformContainer.style.justifyContent = "center";

    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 24;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    waveformContainer.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const waveformCanvas = canvas;
    const waveformContext = ctx;

    function drawWaveform() {
      if (!waveformContext || !waveformCanvas) return;

      const width = waveformCanvas.width;
      const height = waveformCanvas.height;
      const centerY = height / 2;

      waveformContext.clearRect(0, 0, width, height);

      if (
        audioAnalyzer.isListening &&
        audioAnalyzer.dataArray &&
        audioAnalyzer.analyser
      ) {
        const dataArray = audioAnalyzer.dataArray;
        audioAnalyzer.analyser.getByteFrequencyData(dataArray);

        const barCount = 32;
        const barWidth = width / barCount;

        waveformContext.fillStyle = "#3b82f6";
        waveformContext.strokeStyle = "#60a5fa";

        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * dataArray.length);
          const frequency = dataArray[dataIndex] || 0;
          const normalized = frequency / 255;
          const barHeight = normalized * (height * 0.9);

          const x = i * barWidth;
          const barY = centerY - barHeight / 2;

          waveformContext.fillRect(x, barY, barWidth - 1, barHeight);

          if (normalized > 0.3) {
            waveformContext.shadowBlur = 5;
            waveformContext.shadowColor = "#60a5fa";
            waveformContext.fillRect(x, barY, barWidth - 1, barHeight);
            waveformContext.shadowBlur = 0;
          }
        }

        waveformContext.strokeStyle = "rgba(255, 255, 255, 0.1)";
        waveformContext.lineWidth = 1;
        waveformContext.beginPath();
        waveformContext.moveTo(0, centerY);
        waveformContext.lineTo(width, centerY);
        waveformContext.stroke();
      } else {
        waveformContext.fillStyle = "rgba(107, 114, 128, 0.5)";
        waveformContext.fillRect(0, centerY - 2, width, 4);
      }
    }

    let isListening = false;

    micButton.addEventListener("click", async () => {
      if (!isListening) {
        const success = await audioAnalyzer.setupMicrophone();
        if (success) {
          isListening = true;
          micButton.textContent = "🔴 Stop Audio";
          micButton.style.backgroundColor = "#ef4444";
          waveformContainer.style.backgroundColor = "rgba(239, 68, 68, 0.2)";

          // COMMENTED OUT - sentient processing disabled for now
          // // Start speech recognition for emotion detection
          // speechProcessor.startRecording();

          // Start audio analysis
          audioAnalysisInterval = setInterval(() => {
            if (audioAnalyzer.isListening) {
              const { frequency, volume, intensity, peak } =
                audioAnalyzer.analyze();
              // Only react to audio if intensity is above minimum threshold
              const minIntensity = 0.5; // Minimum intensity threshold
              if (intensity >= minIntensity) {
                audioIntensity = intensity;
              } else {
                audioIntensity = 0; // No reaction below threshold
              }
              audioFrequency = frequency;
              drawWaveform();
            }
          }, 50);

          // Draw waveform continuously
          const waveformInterval = setInterval(() => {
            if (!audioAnalyzer.isListening) {
              clearInterval(waveformInterval);
            } else {
              drawWaveform();
            }
          }, 50);
        }
      } else {
        if (audioAnalysisInterval) {
          clearInterval(audioAnalysisInterval);
          audioAnalysisInterval = null;
        }
        audioAnalyzer.stop();

        // COMMENTED OUT - sentient processing disabled for now
        // // Stop speech recognition and get accumulated text
        // const accumulatedText = speechProcessor.stopRecording();

        // // Reset valence to neutral (0) when recording stops
        // targetValence = 0.0;

        // // TODO: Send accumulatedText to AI for dream interpretation
        // // This will be used to generate multi-cultural dream interpretations

        isListening = false;
        audioIntensity = 0;
        smoothedAudioIntensity = 0;
        audioFrequency = 0;
        micButton.textContent = "🎤 Start Audio";
        micButton.style.backgroundColor = "#3b82f6";
        waveformContainer.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
        waveformContext.clearRect(
          0,
          0,
          waveformCanvas.width,
          waveformCanvas.height
        );
      }
    });

    audioContainer.appendChild(micButton);
    audioContainer.appendChild(waveformContainer);
    document.body.appendChild(audioContainer);

    // Initial waveform draw
    setTimeout(() => drawWaveform(), 100);
  }

  // Emotion/Valence controls - COMMENTED OUT (using real-time speech processing instead)
  // function setupColorControls() {
  //   // Create wrapper container using flexbox for bottom controls
  //   const bottomWrapper = document.createElement("div");
  //   bottomWrapper.className = "bottom-controls-wrapper";

  //   // Add color labels using flexbox
  //   const colorLabels = document.createElement("div");
  //   colorLabels.className = "color-labels";
  //   colorLabels.innerHTML = `
  //     <span style="color: #7f1d1d;">Scary</span>
  //     <span style="color: #9333ea;">Negative</span>
  //     <span style="color: #3b82f6;">Neutral</span>
  //     <span style="color: #f59e0b;">Positive</span>
  //     <span style="color: #fef3c7;">Happy</span>
  //   `;

  //   // Create controls container using flexbox
  //   const controlsContainer = document.createElement("div");
  //   controlsContainer.className = "controls-container";

  //   const label = document.createElement("label");
  //   label.textContent = "Emotion";
  //   label.className = "emotion-label";

  //   const sliderContainer = document.createElement("div");
  //   sliderContainer.className = "slider-container";

  //   const slider = document.createElement("input");
  //   slider.type = "range";
  //   slider.min = "-1";
  //   slider.max = "1";
  //   slider.step = "0.01";
  //   slider.value = "0";
  //   slider.className = "emotion-slider";

  //   // Update on slider change
  //   slider.addEventListener("input", (e) => {
  //     valence = THREE.MathUtils.clamp(parseFloat(e.target.value), -1, 1);
  //   });

  //   // Assemble components using flexbox structure
  //   sliderContainer.appendChild(slider);
  //   controlsContainer.appendChild(label);
  //   controlsContainer.appendChild(sliderContainer);

  //   bottomWrapper.appendChild(colorLabels);
  //   bottomWrapper.appendChild(controlsContainer);

  //   document.body.appendChild(bottomWrapper);
  // }

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // setupColorControls(); // COMMENTED OUT - using real-time speech processing instead
  setupAudioControls();
  animate();
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initThreeJS);
} else {
  initThreeJS();
}
