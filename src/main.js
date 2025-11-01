import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import AudioAnalyzer from "./audioAnalyzer.js";

class DreamGlobe {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock(); // Use Three.js Clock for accurate timing

    // Rotation speed - adjustable variable
    this.rotationSpeed = { x: 0.0005, y: 0.001 };

    // Color system - valence-based
    this.valence = 0.0; // -1 (negative) to 1 (positive)
    this.targetColor = new THREE.Color(0x3b82f6); // Default blue
    this.currentColor = new THREE.Color(0x3b82f6);

    // Audio system
    this.audioAnalyzer = new AudioAnalyzer();
    this.audioAnalysisInterval = null;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e27); // Dark blue background 0x0a0e27

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    // Create sphere
    this.createSphere();

    // Setup lighting
    this.setupLighting();

    // Setup OrbitControls for camera rotation
    this.setupOrbitControls();

    // Setup interactive controls for testing
    this.setupColorControls();

    // Setup audio controls (this also initializes waveform canvas)
    this.setupAudioControls();

    // Draw initial waveform (idle state)
    // Small delay to ensure canvas is ready
    setTimeout(() => {
      if (this.drawWaveform) {
        this.drawWaveform();
      }
    }, 100);

    // Handle window resize
    this.handleResize();

    // Start animation loop
    this.animate();
  }

  createSphere() {
    // Use IcosahedronGeometry for smooth sphere with 64 subdivisions
    const geometry = new THREE.IcosahedronGeometry(1, 64);

    // Get shaders from script tags in HTML (like the example)
    const vertexShader = document.getElementById("vertexshader").textContent;
    const fragmentShader =
      document.getElementById("fragmentshader").textContent;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uFrequency: { value: 0.0 }, // Audio frequency (0-255), ready for audio integration
        uColor: { value: new THREE.Color(0x3b82f6) }, // Blue
        uValence: { value: 0.0 }, // Valence for wave complexity control
      },
      side: THREE.DoubleSide,
      transparent: true, // Enable transparency
      depthWrite: false, // Prevent z-fighting with transparency
      blending: THREE.NormalBlending, // Normal blending for realistic glass transparency
    });

    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);
    this.material = material;
  }

  setupLighting() {
    // Increased external lighting for better visibility
    // Main directional light for specular highlights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // Stronger fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-5, -3, -5);
    this.scene.add(fillLight);

    // Increased ambient light for overall brightness
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Point light at center of orb - brightens interior when camera is inside
    const innerPointLight = new THREE.PointLight(0xffffff, 2.0, 3.0);
    innerPointLight.position.set(0, 0, 0); // Center of orb
    this.scene.add(innerPointLight);
  }

  setupOrbitControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // Configure controls for smooth interaction
    this.controls.enableDamping = true; // Smooth camera movement
    this.controls.dampingFactor = 0.05;

    // Set limits for zoom - allow camera to go inside the orb (radius = 1.0)
    this.controls.minDistance = 0.3; // Allow camera inside orb to see inner waves and lines
    this.controls.maxDistance = 5;

    // Target the center of the scene (where the globe is)
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // Allow rotation from any angle
    this.controls.enablePan = false; // Disable panning (keeping camera focused on globe)
    this.controls.autoRotate = false; // We have our own rotation system
  }

  // Color mapping constants - stored as Three.js Color objects for smooth interpolation
  static VALENCE_COLORS = {
    veryNegative: new THREE.Color(0x7f1d1d),
    negative: new THREE.Color(0x9333ea),
    neutral: new THREE.Color(0x3b82f6),
    positive: new THREE.Color(0xf59e0b),
    veryPositive: new THREE.Color(0xfef3c7),
  };

  // Get smooth interpolated color based on valence
  getValenceColor(valence) {
    // Clamp valence between -1 and 1
    const clampedValence = THREE.MathUtils.clamp(valence, -1, 1);
    const color = new THREE.Color();

    // Map valence (-1 to 1) to color transitions with smooth interpolation
    // Breakpoints: -1, -0.5, 0, 0.3, 0.7, 1
    if (clampedValence < -0.5) {
      // -1 to -0.5: veryNegative (full at -1)
      const t = (clampedValence + 1) / 0.5; // 0 to 1 from -1 to -0.5
      color.lerpColors(
        DreamGlobe.VALENCE_COLORS.veryNegative,
        DreamGlobe.VALENCE_COLORS.negative,
        t
      );
    } else if (clampedValence < 0) {
      // -0.5 to 0: negative to neutral
      const t = (clampedValence + 0.5) / 0.5; // 0 to 1 from -0.5 to 0
      color.lerpColors(
        DreamGlobe.VALENCE_COLORS.negative,
        DreamGlobe.VALENCE_COLORS.neutral,
        t
      );
    } else if (clampedValence < 0.3) {
      // 0 to 0.3: neutral (full at 0, transitioning to positive)
      const t = clampedValence / 0.3; // 0 to 1 from 0 to 0.3
      color.lerpColors(
        DreamGlobe.VALENCE_COLORS.neutral,
        DreamGlobe.VALENCE_COLORS.positive,
        t
      );
    } else if (clampedValence < 0.7) {
      // 0.3 to 0.7: positive (full at 0.3, transitioning to veryPositive)
      const t = (clampedValence - 0.3) / 0.4; // 0 to 1 from 0.3 to 0.7
      color.lerpColors(
        DreamGlobe.VALENCE_COLORS.positive,
        DreamGlobe.VALENCE_COLORS.veryPositive,
        t
      );
    } else {
      // 0.7 to 1: veryPositive (full at 0.7+)
      // At 0.7+, we're already at veryPositive, but we can make it slightly brighter
      const t = (clampedValence - 0.7) / 0.3; // 0 to 1 from 0.7 to 1
      const brightened = DreamGlobe.VALENCE_COLORS.veryPositive.clone();
      brightened.lerp(new THREE.Color(1.0, 1.0, 0.95), t * 0.2); // Slight brightening at max
      color.copy(brightened);
    }

    return color;
  }

  // Get valence color hex string for UI display (with smooth interpolation)
  getValenceColorHex(valence) {
    const color = this.getValenceColor(valence);
    return "#" + color.getHexString();
  }

  updateColor(valence) {
    // Clamp valence between -1 and 1
    this.valence = THREE.MathUtils.clamp(valence, -1, 1);

    // Get smoothly interpolated color
    const targetColor = this.getValenceColor(this.valence);
    this.targetColor.copy(targetColor);
  }

  setupColorControls() {
    // Create wrapper container using flexbox for bottom controls
    const bottomWrapper = document.createElement("div");
    bottomWrapper.className = "bottom-controls-wrapper";

    // Add color labels using flexbox
    const colorLabels = document.createElement("div");
    colorLabels.className = "color-labels";
    colorLabels.innerHTML = `
      <span style="color: #7f1d1d;">Scary</span>
      <span style="color: #9333ea;">Negative</span>
      <span style="color: #3b82f6;">Neutral</span>
      <span style="color: #f59e0b;">Positive</span>
      <span style="color: #fef3c7;">Happy</span>
    `;

    // Create controls container using flexbox
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "controls-container";

    const label = document.createElement("label");
    label.textContent = "Emotion";
    label.className = "emotion-label";

    const sliderContainer = document.createElement("div");
    sliderContainer.className = "slider-container";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "-1";
    slider.max = "1";
    slider.step = "0.01";
    slider.value = "0";
    slider.className = "emotion-slider";

    // Update on slider change
    slider.addEventListener("input", (e) => {
      const valence = parseFloat(e.target.value);
      this.updateColor(valence);
    });

    // Assemble components using flexbox structure
    sliderContainer.appendChild(slider);
    controlsContainer.appendChild(label);
    controlsContainer.appendChild(sliderContainer);

    bottomWrapper.appendChild(colorLabels);
    bottomWrapper.appendChild(controlsContainer);

    document.body.appendChild(bottomWrapper);
  }

  setupAudioControls() {
    // Create audio controls container
    const audioContainer = document.createElement("div");
    audioContainer.style.position = "absolute";
    audioContainer.style.top = "20px";
    audioContainer.style.left = "50%";
    audioContainer.style.transform = "translateX(-50%)";
    audioContainer.style.zIndex = "1000";
    audioContainer.style.display = "flex";
    audioContainer.style.gap = "10px";
    audioContainer.style.alignItems = "center";

    // Create microphone button
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
      micButton.style.backgroundColor = "#2563eb";
      micButton.style.transform = "scale(1.05)";
    });

    micButton.addEventListener("mouseleave", () => {
      if (!this.audioAnalyzer.isListening) {
        micButton.style.backgroundColor = "#3b82f6";
      }
      micButton.style.transform = "scale(1)";
    });

    // Audio waveform visualization
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
    this.waveformCanvas = canvas;
    this.waveformContext = ctx;
    this.waveformContainer = waveformContainer;

    let isListening = false;

    micButton.addEventListener("click", async () => {
      if (!isListening) {
        // Start listening
        await this.startAudioListening();
        if (this.audioAnalyzer.isListening) {
          isListening = true;
          micButton.textContent = "🔴 Stop Audio";
          micButton.style.backgroundColor = "#ef4444";
          waveformContainer.style.backgroundColor = "rgba(239, 68, 68, 0.2)"; // Red tint when active
        }
      } else {
        // Stop listening
        this.stopAudioListening();
        isListening = false;
        micButton.textContent = "🎤 Start Audio";
        micButton.style.backgroundColor = "#3b82f6";
        waveformContainer.style.backgroundColor = "rgba(0, 0, 0, 0.3)"; // Back to dark when inactive
        // Clear waveform
        if (this.waveformContext) {
          this.waveformContext.clearRect(
            0,
            0,
            this.waveformCanvas.width,
            this.waveformCanvas.height
          );
        }
      }
    });

    audioContainer.appendChild(micButton);
    audioContainer.appendChild(waveformContainer);

    document.body.appendChild(audioContainer);
  }

  drawWaveform() {
    if (!this.waveformContext || !this.waveformCanvas) {
      return;
    }

    const ctx = this.waveformContext;
    const canvas = this.waveformCanvas;
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get frequency data if listening
    if (
      this.audioAnalyzer.isListening &&
      this.audioAnalyzer.dataArray &&
      this.audioAnalyzer.analyser
    ) {
      const dataArray = this.audioAnalyzer.dataArray;
      this.audioAnalyzer.analyser.getByteFrequencyData(dataArray);

      // Draw frequency bars (audio visualization)
      const barCount = 32; // Number of bars to display
      const barWidth = width / barCount;

      ctx.fillStyle = "#3b82f6"; // Blue color when active
      ctx.strokeStyle = "#60a5fa"; // Lighter blue for stroke

      for (let i = 0; i < barCount; i++) {
        // Sample frequency data (use every nth bin for bars)
        const dataIndex = Math.floor((i / barCount) * dataArray.length);
        const frequency = dataArray[dataIndex] || 0;

        // Normalize to 0-1 and scale to bar height
        const normalized = frequency / 255;
        const barHeight = normalized * (height * 0.9); // 90% of canvas height max

        // Draw bar
        const x = i * barWidth;
        const barY = centerY - barHeight / 2;

        // Draw filled bar
        ctx.fillRect(x, barY, barWidth - 1, barHeight);

        // Add glow effect for active bars
        if (normalized > 0.3) {
          ctx.shadowBlur = 5;
          ctx.shadowColor = "#60a5fa";
          ctx.fillRect(x, barY, barWidth - 1, barHeight);
          ctx.shadowBlur = 0;
        }
      }

      // Draw center line (baseline)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    } else {
      // No audio - show idle state (flat line)
      ctx.fillStyle = "rgba(107, 114, 128, 0.5)"; // Gray when inactive
      ctx.fillRect(0, centerY - 2, width, 4);
    }
  }

  handleResize() {
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  updateFrequency(frequency, intensity, peak) {
    // PEAK-BASED ABRUPT RESPONSE
    // Focus on peak spikes rather than averages for maximum distinction

    // MUCH HIGHER threshold - only react to clear speech, not ambient noise
    // Speech typically has peaks in the 100-200+ range, ambient noise is lower
    const peakThreshold = 110;
    const intensityThreshold = 0.3;

    // Additional check: require BOTH peak AND intensity to be high
    // This filters out single spike events and requires sustained speech
    const hasSignificantPeak =
      (peak > peakThreshold && intensity > intensityThreshold) ||
      peak > peakThreshold * 1.5; // Very loud peaks can still trigger alone

    if (hasSignificantPeak) {
      // INSTANTANEOUS response to peaks - almost no smoothing
      const currentFreq = this.material.uniforms.uFrequency.value;

      // Use peak value directly for maximum abrupt response
      // Peak-based boost creates dramatic spikes (but smaller/more controlled)
      const peakBoost = intensity * 80; // Reduced boost for thinner spikes (was 120)
      const targetFreq = peak * 0.05 + peakBoost; // Reduced peak influence for skinnier spikes (was 0.8)

      // Almost NO smoothing - instant response to peaks
      const smoothFactor = 0.2;
      this.material.uniforms.uFrequency.value +=
        (targetFreq - currentFreq) * smoothFactor;

      // DRAMATIC scaling - orb jumps in size immediately with peaks
      const scaleTarget = 1.0 + intensity;
      const currentScale = this.sphere.scale.x;
      const scaleSmooth = 0.7;
      const newScale =
        currentScale + (scaleTarget - currentScale) * scaleSmooth;
      this.sphere.scale.set(newScale, newScale, newScale);
    } else {
      // When quiet - SMOOTH return to calm state
      const currentFreq = this.material.uniforms.uFrequency.value;
      if (currentFreq > 0.1) {
        // Smooth fade out - gradual return to calm
        this.material.uniforms.uFrequency.value *= 0.85; // Slower, smoother decay (was 0.3)
      } else {
        this.material.uniforms.uFrequency.value = 0;
      }

      // SMOOTH return to normal size when quiet - no abrupt changes
      const currentScale = this.sphere.scale.x;
      if (Math.abs(currentScale - 1.0) > 0.01) {
        const scaleSmooth = 0.15; // Much smoother return to calm (was 0.3 - too abrupt)
        const newScale = currentScale + (1.0 - currentScale) * scaleSmooth;
        this.sphere.scale.set(newScale, newScale, newScale);
      }
    }
  }

  async startAudioListening() {
    const success = await this.audioAnalyzer.setupMicrophone();
    if (!success) return;

    // Start analysis loop - analyze 20 times per second (like the guide)
    this.audioAnalysisInterval = setInterval(() => {
      if (this.audioAnalyzer.isListening) {
        const { frequency, volume, intensity, peak } =
          this.audioAnalyzer.analyze();

        // Update blob deformation based on PEAK detection
        // Pass peak value for abrupt spike detection
        // The shader uses: (uFrequency / 30.0) * (noise / 10.0)
        this.updateFrequency(frequency, intensity, peak);

        // Update waveform visualization
        this.drawWaveform();

        // Optional: You can also update other visual properties based on volume/intensity
        // For example, increase rotation speed with volume
        // this.rotationSpeed.x = 0.0005 + volume * 0.002;
      }
    }, 50); // 50ms = 20fps analysis rate

    // Draw initial waveform (inactive state)
    this.drawWaveform();

    console.log("🎤 Audio listening started - speak into your microphone!");
  }

  stopAudioListening() {
    if (this.audioAnalysisInterval) {
      clearInterval(this.audioAnalysisInterval);
      this.audioAnalysisInterval = null;
    }
    this.audioAnalyzer.stop();

    // Gradually fade frequency back to 0
    const fadeInterval = setInterval(() => {
      const currentFreq = this.material.uniforms.uFrequency.value;
      if (Math.abs(currentFreq) < 0.1) {
        this.material.uniforms.uFrequency.value = 0;
        clearInterval(fadeInterval);
      } else {
        this.material.uniforms.uFrequency.value *= 0.9; // Fade out
      }

      // Also fade scale back to 1.0
      const currentScale = this.sphere.scale.x;
      if (Math.abs(currentScale - 1.0) < 0.01) {
        this.sphere.scale.set(1.0, 1.0, 1.0);
      } else {
        const newScale = currentScale + (1.0 - currentScale) * 0.1;
        this.sphere.scale.set(newScale, newScale, newScale);
      }
    }, 50);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Update OrbitControls (required for damping)
    this.controls.update();

    // Update time for shader animation using Clock (handles frame rate variations)
    const elapsedTime = this.clock.getElapsedTime();
    this.material.uniforms.uTime.value = elapsedTime;

    // Smoothly interpolate colors toward target using Three.js lerp
    const lerpFactor = 0.05; // Smooth color transition
    this.currentColor.lerp(this.targetColor, lerpFactor);

    // Update shader uniforms with current colors and valence
    this.material.uniforms.uColor.value.copy(this.currentColor);
    this.material.uniforms.uValence.value = this.valence;

    // Apply rotation with fixed speed
    this.sphere.rotation.x += this.rotationSpeed.x;
    this.sphere.rotation.y += this.rotationSpeed.y;

    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize DreamGlobe when DOM is ready
const container = document.getElementById("app");
const globe = new DreamGlobe(container);
