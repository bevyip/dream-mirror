class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.stream = null;
    this.isListening = false;
  }

  async setupMicrophone() {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Get microphone stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048; // Higher FFT size for better frequency resolution
      this.analyser.smoothingTimeConstant = 0.3; // LESS smoothing to catch peaks better (was 0.8)

      // Connect microphone to analyser
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);

      // Create data array for frequency data
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.isListening = true;
      return true;
    } catch (error) {
      console.error("Error setting up microphone:", error);
      alert(
        "Could not access microphone. Please allow microphone permissions and try again."
      );
      return false;
    }
  }

  analyze() {
    if (!this.analyser || !this.dataArray) {
      return { frequency: 0, volume: 0, intensity: 0, peak: 0 };
    }

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);

    // PEAK DETECTION APPROACH - Focus on spikes rather than averages
    // Filter for speech-range frequencies (human voice is roughly 85-255 Hz fundamental,
    // but harmonics extend much higher in the frequency spectrum)

    // Find the highest peak (top 5% of frequency bins)
    const sortedData = [...this.dataArray].sort((a, b) => b - a);
    const topPercentile = Math.ceil(this.dataArray.length * 0.05); // Top 5%
    const peakFrequency = sortedData[0] || 0; // Absolute max

    // Focus on upper range frequencies for speech (reduce low-frequency ambient noise sensitivity)
    // Human speech has energy across many frequency bins, so we look at top peaks
    const topPeaksAverage =
      sortedData.slice(0, topPercentile).reduce((a, b) => a + b, 0) /
      topPercentile;

    // Additional filtering: ignore very low-frequency peaks (likely ambient noise/hum)
    // Speech typically doesn't have strong peaks below threshold
    const filteredPeak = peakFrequency > 20 ? peakFrequency : 0;

    // Calculate peak intensity - focus on the highest spikes
    // This gives us much more abrupt responses
    const peakIntensity = peakFrequency / 255; // Normalized peak

    // Volume/RMS for context (but we primarily use peaks)
    const rms = Math.sqrt(
      this.dataArray.reduce((sum, val) => sum + val * val, 0) /
        this.dataArray.length
    );

    // Average for fallback (but peaks are primary)
    const average =
      this.dataArray.reduce((a, b) => a + b, 0) / this.dataArray.length;

    return {
      frequency: topPeaksAverage, // Focus on peak frequencies, not average
      volume: rms / 255, // Normalized 0-1
      intensity: peakIntensity, // Peak-based intensity for abrupt spikes
      peak: filteredPeak, // Filtered peak value (ignores low-frequency ambient noise)
    };
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isListening = false;
  }
}

export default AudioAnalyzer;
