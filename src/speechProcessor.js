import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

/**
 * Hybrid Emotion Analyzer for Dream Mirror
 * Combines keyword-based real-time updates with periodic full-text analysis
 */
class HybridEmotionAnalyzer {
  constructor(onValenceUpdate = null) {
    this.classifier = null;
    this.accumulatedText = "";
    this.lastAnalyzedEmotion = "neutral";
    this.lastValence = 0.0; // Track last valence to maintain color when no match found
    this.analysisTimeout = null;
    this.analysisInterval = 400; // Analyze every 400ms for faster, more responsive feedback
    this.onValenceUpdate = onValenceUpdate; // Callback for valence updates

    // Keyword dictionary will be loaded asynchronously
    this.keywordEmotions = {};
    this.keywordsLoaded = false;
  }

  /**
   * Load keyword emotions from JSON file
   */
  async loadKeywordEmotions() {
    try {
      // Use import.meta.url to resolve path relative to this module file
      const moduleUrl = new URL(import.meta.url);
      const jsonUrl = new URL("./keywordEmotions.json", moduleUrl);
      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to load keyword emotions: ${response.statusText}`
        );
      }
      const keywordEmotionsData = await response.json();
      this.keywordEmotions = keywordEmotionsData.keywords;
      this.keywordsLoaded = true;
      console.log("✅ [KEYWORDS] Loaded keyword emotions dictionary");
    } catch (error) {
      console.error("❌ [KEYWORDS] Failed to load keyword emotions:", error);
      // Continue with empty dictionary if load fails
      this.keywordEmotions = {};
      this.keywordsLoaded = false;
    }
  }

  /**
   * Initialize the emotion classification model
   */
  async initialize() {
    // Load keyword emotions first
    await this.loadKeywordEmotions();

    try {
      // Use Hugging Face Transformers for English sentiment analysis
      // ONNX-exported for browser use, using quantized model (q8) for better performance
      this.classifier = await pipeline(
        "text-classification",
        "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
        {
          return_all_scores: true,
          dtype: "q8", // 8-bit quantization for faster loading and inference
        }
      );
    } catch (error) {
      console.error(
        "❌ [MODEL] Failed to initialize emotion classifier:",
        error
      );
      // Continue with keyword-only mode if model fails to load
    }
  }

  /**
   * Process a word as it's spoken - hybrid approach
   * @param {string} word - The word that was spoken
   * @returns {number|null} - Valence value if keyword detected, null otherwise
   */
  onWordSpoken(word) {
    const lowerWord = word.toLowerCase().trim();
    if (!lowerWord) return null;

    // IMMEDIATE: Check for strong emotional keywords
    const keywordEmotion = this.keywordEmotions[lowerWord];
    if (keywordEmotion) {
      // Instant visual feedback
      const valence = this.emotionToValence(keywordEmotion);

      // Call callback immediately for instant visual feedback
      if (this.onValenceUpdate) {
        this.onValenceUpdate(valence);
      }

      return valence;
    }

    // Accumulate text for periodic analysis
    this.accumulatedText += " " + word;

    // PERIODIC: Schedule full model analysis
    this.scheduleFullAnalysis();

    return null;
  }

  /**
   * Process a full phrase/sentence
   * @param {string} text - The text to process
   */
  onTextReceived(text) {
    if (!text || text.trim().length === 0) return;

    // Add to accumulated text for future AI interpretation
    // TODO: Store accumulatedText for AI dream interpretation
    this.accumulatedText += " " + text.trim();

    // Process individual words for keyword detection
    const words = text.trim().split(/\s+/);
    words.forEach((word) => {
      const valence = this.onWordSpoken(word);
      // If keyword detected, it will be returned and can be used immediately
    });

    // Schedule full analysis
    this.scheduleFullAnalysis();
  }

  /**
   * Schedule full model analysis with debouncing
   * Triggers immediately if enough text is already accumulated, otherwise waits for debounce
   */
  scheduleFullAnalysis() {
    // Clear existing timeout
    if (this.analysisTimeout) {
      clearTimeout(this.analysisTimeout);
    }

    // If we already have enough text, analyze immediately (no delay)
    // Otherwise, wait for the debounce interval to accumulate more text
    const textLength = this.accumulatedText.trim().length;
    const hasEnoughText = textLength >= 20;
    const delay = hasEnoughText ? 0 : this.analysisInterval;

    // Schedule analysis (immediate if enough text, otherwise debounced)
    this.analysisTimeout = setTimeout(async () => {
      await this.analyzeAndUpdateColor();
    }, delay);
  }

  /**
   * Analyze accumulated text with emotion model
   * @returns {Promise<number>} - Valence value based on detected emotion
   */
  async analyzeAndUpdateColor() {
    if (!this.classifier) {
      console.warn(
        "⚠️ [MODEL] Classifier not initialized, using keyword-only mode"
      );
      return null;
    }

    const textToAnalyze = this.accumulatedText.trim();
    if (textToAnalyze.length < 20) {
      // Not enough text for meaningful analysis
      return null;
    }

    try {
      // Analyze the accumulated text
      const results = await this.classifier(textToAnalyze);

      // Handle different result structures
      // Results can be: [{label: '...', score: ...}] or [[{label: '...', score: ...}, ...]]
      let allScores;
      if (Array.isArray(results) && results.length > 0) {
        // If results[0] is an array, it contains all scores
        if (Array.isArray(results[0])) {
          allScores = results[0];
        } else {
          // If results is directly an array of scores
          allScores = results;
        }
      } else {
        console.warn("⚠️ [MODEL] Unexpected results structure:", results);
        return null;
      }

      // Get the dominant emotion (highest score)
      const dominant = allScores.reduce((a, b) => (a.score > b.score ? a : b));

      this.lastAnalyzedEmotion = dominant.label;
      const valence = this.emotionToValence(dominant.label);

      // Call callback if provided
      if (this.onValenceUpdate) {
        this.onValenceUpdate(valence);
      }

      return valence;
    } catch (error) {
      console.error("❌ [MODEL] Error analyzing text:", error);
      return null;
    }
  }

  /**
   * Convert emotion label to valence value (-1 to 1)
   * Emotions are evenly spaced for distinct color mapping:
   * anger (red) → fear (purple) → sadness (blue) → neutral → surprise (orange) → joy (yellow)
   * @param {string} emotion - Emotion label
   * @returns {number} - Valence value, or previous valence if no match found
   */
  emotionToValence(emotion) {
    // Normalize emotion label to lowercase for case-insensitive matching
    const normalizedEmotion = emotion.toLowerCase();

    // Handle star ratings (1-5 stars) from sentiment models
    // Extract number from patterns like "5 stars", "5 star", "5-star", etc.
    const starMatch = normalizedEmotion.match(/(\d+)\s*star/i);
    if (starMatch) {
      const stars = parseInt(starMatch[1], 10);
      if (stars >= 1 && stars <= 5) {
        // Map 1-5 stars to -1 to +1 valence (evenly spaced)
        // 1 star = -1.0, 2 stars = -0.5, 3 stars = 0, 4 stars = 0.5, 5 stars = 1.0
        const valence = (stars - 3) / 2;
        this.lastValence = valence; // Update last valence
        return valence;
      }
    }

    // Emotion mapping with evenly spaced valence values for distinct colors
    // Negative: anger (red) → fear (purple) → sadness (blue)
    // Positive: surprise (orange) → joy (yellow)
    const map = {
      anger: -1.0, // Most negative - red
      fear: -0.6, // Purple
      sadness: -0.2, // Blue
      neutral: 0, // Center
      surprise: 0.6, // Orange
      joy: 1.0, // Most positive - yellow
      // Handle disgust as similar to anger
      disgust: -1.0,
    };

    // Try exact match first
    if (map[normalizedEmotion] !== undefined) {
      const valence = map[normalizedEmotion];
      this.lastValence = valence; // Update last valence
      return valence;
    }

    // Try partial matching for labels with spaces or variations
    for (const [key, value] of Object.entries(map)) {
      if (normalizedEmotion.includes(key) || key.includes(normalizedEmotion)) {
        this.lastValence = value; // Update last valence
        return value;
      }
    }

    // Maintain previous color if no match found (don't reset to neutral)
    return this.lastValence;
  }

  /**
   * Get accumulated text for future AI interpretation
   * TODO: This will be used to send to AI for dream interpretation
   * @returns {string} - The full accumulated text
   */
  getAccumulatedText() {
    return this.accumulatedText.trim();
  }

  /**
   * Clear accumulated text (e.g., when starting a new dream recording)
   */
  clearAccumulatedText() {
    this.accumulatedText = "";
    this.lastAnalyzedEmotion = "neutral";
  }
}

/**
 * Speech Recognition Processor for Dream Mirror
 * Integrates Web Speech API with Hybrid Emotion Analyzer
 */
class DreamMirrorSpeechProcessor {
  constructor(onValenceUpdate) {
    this.onValenceUpdate = onValenceUpdate; // Callback to update valence in main app
    this.analyzer = new HybridEmotionAnalyzer(onValenceUpdate); // Pass callback to analyzer
    this.recognition = null;
    this.isListening = false;

    // Check if Speech Recognition is available
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      console.error("❌ Speech Recognition API not supported in this browser");
      return;
    }

    this.recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    this.setupSpeechRecognition();
  }

  /**
   * Initialize the speech processor (load emotion model)
   */
  async initialize() {
    await this.analyzer.initialize();
  }

  /**
   * Setup Web Speech API recognition
   */
  setupSpeechRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          // Final result - process the text

          // Process text through analyzer
          this.analyzer.onTextReceived(transcript);

          // Check for immediate keyword matches
          const words = transcript.split(/\s+/);
          words.forEach((word) => {
            const valence = this.analyzer.onWordSpoken(word);
            if (valence !== null && this.onValenceUpdate) {
              // Immediate update for keyword detection
              this.onValenceUpdate(valence);
            }
          });
        } else {
          // Interim result - show but don't analyze yet
          interimTranscript += transcript;
        }
      }

      // TODO: Display live transcript in UI if needed
      // updateTranscriptDisplay(this.analyzer.getAccumulatedText() + interimTranscript);
    };

    this.recognition.onerror = (event) => {
      console.error("❌ Speech recognition error:", event.error);
      if (event.error === "no-speech") {
        // User stopped speaking, trigger final analysis
        this.analyzer.analyzeAndUpdateColor().then((valence) => {
          if (valence !== null && this.onValenceUpdate) {
            this.onValenceUpdate(valence);
          }
        });
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        // Automatically restart if still listening
        try {
          this.recognition.start();
        } catch (error) {
          console.error("Error restarting recognition:", error);
        }
      }
    };
  }

  /**
   * Start speech recognition
   */
  startRecording() {
    if (!this.recognition) {
      console.error("❌ Speech Recognition not available");
      return false;
    }

    try {
      this.analyzer.clearAccumulatedText();
      this.isListening = true;
      this.recognition.start();
      return true;
    } catch (error) {
      console.error("❌ Error starting speech recognition:", error);
      return false;
    }
  }

  /**
   * Stop speech recognition
   * @returns {string} - The accumulated text for AI interpretation
   */
  stopRecording() {
    if (!this.recognition) return "";

    this.isListening = false;
    this.recognition.stop();

    // Get final accumulated text for AI interpretation
    // TODO: Send this to AI for dream interpretation
    const finalText = this.analyzer.getAccumulatedText();

    return finalText;
  }

  /**
   * Get accumulated text (for AI interpretation)
   * TODO: This will be used to send to AI for dream interpretation
   * @returns {string} - The full accumulated text
   */
  getAccumulatedText() {
    return this.analyzer.getAccumulatedText();
  }

  /**
   * Manually trigger full analysis (useful for testing)
   */
  async triggerAnalysis() {
    const valence = await this.analyzer.analyzeAndUpdateColor();
    if (valence !== null && this.onValenceUpdate) {
      this.onValenceUpdate(valence);
    }
    return valence;
  }

  /**
   * Test the model with custom text (for debugging)
   * Call from console: speechProcessor.testModel("I was walking through a beautiful garden")
   * @param {string} testText - Text to test with the model
   */
  async testModel(testText) {
    if (!this.analyzer.classifier) {
      console.error("❌ [TEST] Model not initialized!");
      return null;
    }

    // Temporarily set accumulated text to test text
    const originalText = this.analyzer.accumulatedText;
    this.analyzer.accumulatedText = testText;

    // Run analysis
    const valence = await this.analyzer.analyzeAndUpdateColor();

    // Restore original text
    this.analyzer.accumulatedText = originalText;

    return valence;
  }
}

export default DreamMirrorSpeechProcessor;
