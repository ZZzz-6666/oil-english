// ===== 语音引擎：TTS 朗读 + 语音识别跟读打分 =====
// 策略：
//   - 单词：优先真人音频（uapis.cn）→ TTS 兜底
//   - 句子：TTS 整句朗读 → Google TTS 整句音频 → 单词逐个播放（兜底兜底）
// 修复：句子朗读太慢、听读模式串音、单词乱读

const Speech = {
  synth: window.speechSynthesis || null,
  voice: null,
  voiceReady: false,
  recognition: null,
  isListening: false,
  voicesRetried: 0,
  ttsWorking: true,
  audioCache: {},          // 单词音频缓存（uapis.cn 真人）
  sentenceAudioCache: {},  // 整句音频缓存（Google TTS）
  audioUnlocked: false,
  currentAudio: null,      // 当前正在播放的 Audio 对象（用于 stop）
  currentToken: 0,         // 递增 token，stop 时让旧播放失效
  onSpeakEnd: null,
  speakState: 'idle',

  init() {
    // 首次用户交互解锁音频
    const unlock = () => {
      this.audioUnlocked = true;
      try { const a = new Audio(); a.muted = true; a.play().catch(() => {}); } catch {}
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
    document.addEventListener('touchstart', unlock, { once: true, passive: true });
    document.addEventListener('click', unlock, { once: true, passive: true });

    if (!this.synth) {
      this.ttsWorking = false;
      this._initRecognition();
      return;
    }

    const pick = () => {
      const voices = this.synth.getVoices() || [];
      if (!voices.length) {
        if (this.voicesRetried < 8) { this.voicesRetried++; setTimeout(pick, 400); }
        return;
      }
      // 严格选英语语音
      const prefer = [
        v => v.lang === 'en-US' && v.name && /Google|Samantha|Microsoft|Alex/i.test(v.name),
        v => v.lang === 'en-US',
        v => v.lang === 'en-GB',
        v => v.lang && v.lang.toLowerCase().startsWith('en')
      ];
      for (const fn of prefer) {
        const found = voices.find(fn);
        if (found) { this.voice = found; break; }
      }
      if (!this.voice) this.voice = voices[0];
      this.voiceReady = true;
    };
    pick();
    if (this.synth.onvoiceschanged !== undefined) this.synth.onvoiceschanged = pick;
    this._initRecognition();
  },

  _initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.recognition = null; return; }
    try {
      this.recognition = new SR();
      this.recognition.lang = 'en-US';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
    } catch { this.recognition = null; }
  },

  // 判断是"单词"还是"句子"（含空格视为句子）
  _isWord(text) {
    const t = (text || '').replace(/[^a-zA-Z0-9\s'-]/g, '').trim();
    return t.length > 0 && !/\s/.test(t);
  },

  _firstWord(text) {
    return (text || '').toLowerCase().replace(/[^a-z\s'-]/g, '').trim().split(/\s+/)[0] || '';
  },

  _cacheKey(s) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); },

  // ===== 朗读入口 =====
  speak(text, onend, opts = {}) {
    if (!text) { if (onend) onend(); return false; }
    this.stop();
    const myToken = ++this.currentToken;
    this.onSpeakEnd = onend;
    this.speakState = 'playing';

    const isWord = this._isWord(text);
    if (isWord) return this._speakWordAudio(text, onend, myToken, opts);
    return this._speakSentence(text, onend, myToken, opts);
  },

  // ===== 单词：真人音频优先 =====
  _speakWordAudio(text, onend, token, opts) {
    const word = this._firstWord(text);
    if (!word) { this._speakTTS(text, onend, opts); return true; }
    const cacheKey = this._cacheKey(word);
    if (this.audioCache[cacheKey]) return this._playAudioUrl(this.audioCache[cacheKey], onend, token);

    const audioUrl = `https://uapis.cn/api/v1/dictionary/audio?accent=${opts.accent || 'us'}&word=${encodeURIComponent(word)}`;
    this.audioCache[cacheKey] = audioUrl;
    return this._playAudioUrl(audioUrl, onend, token);
  },

  // ===== 句子：TTS 整句 → Google TTS 整句音频 → 兜底逐词 =====
  _speakSentence(text, onend, token, opts) {
    // 1) 系统 TTS 整句朗读
    if (this.synth && this.ttsWorking) {
      const s = Settings.get();
      try {
        this.synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        if (this.voice) u.voice = this.voice;
        u.rate = opts.rate || s.voiceRate || 0.95;
        u.pitch = s.voicePitch || 1.0;
        u.volume = 1.0;

        let started = false;
        u.onstart = () => { started = true; };
        u.onend = () => {
          if (token !== this.currentToken) return;
          this.speakState = 'idle';
          if (onend) onend();
        };
        u.onerror = (e) => {
          if (token !== this.currentToken) return;
          if (e.error !== 'canceled') {
            this.ttsWorking = false;
            this._speakGoogleTTS(text, onend, token, opts);
          } else if (onend) onend();
        };
        this.synth.speak(u);

        // 1.5s 内没启动就降级到 Google TTS
        setTimeout(() => {
          if (token !== this.currentToken) return;
          if (!started && this.speakState === 'playing') {
            this.ttsWorking = false;
            try { this.synth.cancel(); } catch {}
            this._speakGoogleTTS(text, onend, token, opts);
          }
        }, 1500);
        return true;
      } catch {
        this.ttsWorking = false;
      }
    }

    // 2) 系统 TTS 不可用，用 Google 翻译的整句 TTS
    return this._speakGoogleTTS(text, onend, token, opts);
  },

  // Google Translate 公开 TTS（无需 key），返回整句 MP3
  _speakGoogleTTS(text, onend, token, opts) {
    const cacheKey = this._cacheKey(text);
    if (this.sentenceAudioCache[cacheKey]) return this._playAudioUrl(this.sentenceAudioCache[cacheKey], onend, token);

    const url = 'https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&q=' +
                encodeURIComponent(text) + '&tl=en';
    this.sentenceAudioCache[cacheKey] = url;
    return this._playAudioUrl(url, onend, token);
  },

  // 兜底：单词逐个播放（极短间隔，近似连续）
  _speakByWords(text, onend, token) {
    const words = (text || '').toLowerCase().replace(/[^a-z\s'-]/g, '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) { if (onend) onend(); return false; }
    let i = 0;
    const next = () => {
      if (token !== this.currentToken) return;
      if (i >= words.length) { this.speakState = 'idle'; if (onend) onend(); return; }
      const w = words[i++];
      const a = new Audio('https://uapis.cn/api/v1/dictionary/audio?accent=us&word=' + encodeURIComponent(w));
      a.onended = () => setTimeout(next, 50);
      a.onerror = () => setTimeout(next, 30);
      a.play().catch(() => setTimeout(next, 30));
    };
    next();
    return true;
  },

  _playAudioUrl(url, onend, token) {
    try {
      const a = new Audio();
      a.preload = 'auto';
      a.src = url;
      this.currentAudio = a;
      a.onended = () => {
        if (token !== this.currentToken) return;
        this.speakState = 'idle';
        if (onend) onend();
      };
      a.onerror = () => {
        if (token !== this.currentToken) return;
        this.speakState = 'idle';
        if (onend) onend();
      };
      a.play().catch(err => {
        if (token !== this.currentToken) return;
        console.warn('audio play failed:', err.message);
        this.speakState = 'idle';
        if (onend) onend();
      });
      return true;
    } catch (e) {
      if (onend) onend();
      return false;
    }
  },

  // 彻底停止所有播放
  stop() {
    this.currentToken++;
    this.speakState = 'idle';
    if (this.synth) { try { this.synth.cancel(); } catch {} }
    if (this.currentAudio) {
      try { this.currentAudio.pause(); this.currentAudio.src = ''; } catch {}
      this.currentAudio = null;
    }
  },

  // ===== 语音识别 =====
  supportRecognition() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },

  listen(onInterim) {
    return new Promise((resolve, reject) => {
      if (!this.recognition) this._initRecognition();
      if (!this.recognition) { reject(new Error('no-support')); return; }
      try { this.recognition.abort(); } catch {}
      let finished = false;
      const cleanup = () => { finished = true; this.isListening = false; };
      this.recognition.onresult = (e) => {
        if (finished) return;
        cleanup();
        resolve(e.results[0][0].transcript);
      };
      this.recognition.onerror = (e) => {
        if (finished) return;
        cleanup();
        reject(new Error(e.error));
      };
      this.recognition.onend = () => {
        if (!finished) { cleanup(); reject(new Error('no-speech')); }
      };
      this.isListening = true;
      try { this.recognition.start(); }
      catch (e) { cleanup(); reject(new Error('already-starting')); }
    });
  },

  // ===== 跟读打分 =====
  score(transcript, target) {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
    const tWords = normalize(target).split(/\s+/).filter(Boolean);
    const rWords = normalize(transcript).split(/\s+/).filter(Boolean);
    if (!tWords.length) return 0;
    let cover = 0;
    const rSet = new Set(rWords);
    tWords.forEach(w => { if (rSet.has(w)) cover++; });
    let seq = 0, best = 0;
    let lastIdx = -1;
    for (let i = 0; i < tWords.length; i++) {
      const idx = rWords.indexOf(tWords[i], lastIdx + 1);
      if (idx >= 0) { seq++; best = Math.max(best, seq); lastIdx = idx; }
      else { seq = 0; lastIdx = -1; }
    }
    const score1 = cover / tWords.length;
    const score2 = best / tWords.length;
    const score = Math.round((score1 * 0.7 + score2 * 0.3) * 100);
    return Math.min(100, Math.max(0, score));
  }
};
