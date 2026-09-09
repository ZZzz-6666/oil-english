// ===== 主应用逻辑 =====
const App = {
  wordFilter: 'all',
  sentenceFilter: 'all',
  currentWords: [],       // 当前复习队列
  currentIndex: 0,
  currentSentences: [],   // 当前口语练习队列
  currentSIndex: 0,
  studyMode: 'review',    // review | industry

  init() {
    Speech.init();
    this.applySettings();
    this.updateNetStatus();
    this.refreshStats();
    this.refreshQuote();
    this.loadWordOfDay();
    this.loadHomeWordOfDay();
    this.updateGreeting();
    this.updateStreak();
    this.renderWordList();
    this.renderSentenceList();
    this.updateDailyGoalUI();
    this.updateSettingsUI();

    // 网络状态监听
    window.addEventListener('online', () => this.updateNetStatus());
    window.addEventListener('offline', () => this.updateNetStatus());

    // 注册 Service Worker（PWA 离线）
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  // 首页问候语（按当地时间）
  updateGreeting() {
    const h = new Date().getHours();
    let g = '您好';
    if (h < 6) g = '夜深了';
    else if (h < 9) g = '早上好';
    else if (h < 12) g = '上午好';
    else if (h < 14) g = '中午好';
    else if (h < 18) g = '下午好';
    else if (h < 22) g = '晚上好';
    else g = '夜深了';
    const el = document.getElementById('heroGreet');
    if (el) el.textContent = g + ' 👋';
  },
  updateStreak() {
    const s = Streak.get();
    const el = document.getElementById('streakNum');
    if (el) el.textContent = s.count || 0;
  },
  async loadHomeWordOfDay() {
    const el = document.getElementById('homeWordOfDay');
    if (el) el.innerHTML = '<div class="spinner"></div>';
    const w = await LiveFeed.fetchWordOfDay();
    if (!el) return;
    if (!w) { el.innerHTML = '<div class="empty">获取失败</div>'; return; }
    el.innerHTML =
      '<div class="word-card" style="padding:10px 0 0;">' +
        '<div class="word">' + this.escHtml(w.word) + '</div>' +
        '<div class="phonetic">' + this.escHtml(w.phonetic || '') + '</div>' +
        '<div class="meaning">' + this.escHtml(w.meaning) + '</div>' +
        (w.example ? '<div class="example">' + this.escHtml(w.example) + '</div>' : '') +
        '<div style="margin-top:10px;">' +
          '<button class="speak-btn" onclick="Speech.speak(\'' + this.esc(w.word) + '\')">🔊</button>' +
          (w.example ? '<button class="speak-btn" style="margin-left:8px;" onclick="Speech.speak(\'' + this.esc(w.example) + '\')">📢</button>' : '') +
          '<button class="btn btn-primary" style="margin-left:12px;min-height:40px;padding:6px 14px;" onclick="App.openWord(\'' + this.esc(w.word) + '\')">开始学习</button>' +
        '</div>' +
      '</div>';
  },

  // ===== 导航 =====
  switchTab(page, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.tabbar .tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    this.refreshStats();
    if (page === 'words') this.renderWordList();
    if (page === 'speaking') this.renderSentenceList();
    window.scrollTo(0, 0);
  },

  // ===== 网络状态 =====
  updateNetStatus() {
    const el = document.getElementById('netStatus');
    const txt = document.getElementById('netText');
    if (navigator.onLine) {
      el.className = 'net-status online';
      txt.textContent = '在线';
    } else {
      el.className = 'net-status offline';
      txt.textContent = '离线';
    }
  },

  // ===== 设置 =====
  applySettings() {
    const s = Settings.get();
    document.body.dataset.font = s.fontSize || 'large';
  },
  setFont(size) {
    const s = Settings.get(); s.fontSize = size; Settings.save(s);
    this.applySettings(); this.updateSettingsUI();
  },
  setRate(rate) {
    const s = Settings.get(); s.voiceRate = rate; Settings.save(s);
    this.updateSettingsUI();
  },
  setGoal(n) {
    const s = Settings.get(); s.dailyGoal = n; Settings.save(s);
    this.updateDailyGoalUI(); this.updateSettingsUI();
  },
  updateSettingsUI() {
    const s = Settings.get();
    document.getElementById('fontLargeBtn').classList.toggle('active', s.fontSize !== 'xlarge');
    document.getElementById('fontXlargeBtn').classList.toggle('active', s.fontSize === 'xlarge');
    document.getElementById('rateSlowBtn').classList.toggle('active', s.voiceRate === 0.7);
    document.getElementById('rateNormalBtn').classList.toggle('active', s.voiceRate === 0.85);
    document.getElementById('rateFastBtn').classList.toggle('active', s.voiceRate === 1.0);
    document.getElementById('goal10Btn').classList.toggle('active', s.dailyGoal === 10);
    document.getElementById('goal20Btn').classList.toggle('active', s.dailyGoal === 20);
    document.getElementById('goal30Btn').classList.toggle('active', s.dailyGoal === 30);
    document.getElementById('goalDesc').textContent = '每天 ' + s.dailyGoal + ' 个';
  },
  updateDailyGoalUI() {
    const s = Settings.get();
    const due = Progress.getDueWords().length;
    const streak = Streak.get();
    const today = new Date().toISOString().slice(0, 10);
    const learnedToday = (streak.todayDate === today ? streak.todayCount : 0);
    document.getElementById('dailyText').textContent =
      '今日已学 ' + learnedToday + ' / ' + s.dailyGoal + ' 词' + (due > 0 ? '（待复习 ' + due + '）' : '（已完成 ✓）');
    const pct = Math.min(100, (learnedToday / s.dailyGoal) * 100);
    document.getElementById('dailyProgress').style.width = pct + '%';
  },

  // ===== 统计 =====
  refreshStats() {
    const w = Progress.getStats();
    const sp = Speaking.getStats();
    const els = {
      statLearned: w.learned, statMastered: w.mastered, statSpeaking: sp.total,
      pLearned: w.learned, pMastered: w.mastered, pSpeaking: sp.total
    };
    Object.entries(els).forEach(([id, v]) => {
      const e = document.getElementById(id); if (e) e.textContent = v;
    });
    const masteryBar = document.getElementById('masteryBar');
    if (masteryBar) masteryBar.style.width = w.total ? Math.round(w.mastered / w.total * 100) + '%' : '0%';
    const mt = document.getElementById('masteryText');
    if (mt) mt.textContent = '掌握进度 ' + w.mastered + ' / ' + w.total + ' 词';
    this.updateStreak();
    this.updateDailyGoalUI();
  },

  // ===== 首页实时内容 =====
  async refreshQuote() {
    const el = document.getElementById('homeQuote');
    el.innerHTML = '<div class="spinner"></div>';
    const q = await LiveFeed.fetchEnglishQuote();
    el.innerHTML = '<div style="font-size:var(--font-md);font-style:normal;color:var(--text);">' + q.en + '</div>' +
      '<div style="font-size:var(--font-sm);color:var(--text-dim);margin-top:6px;">' + (q.cn || '') + '</div>' +
      '<button class="btn btn-ghost" style="margin-top:10px;min-height:44px;" onclick="Speech.speak(\'' + this.esc(q.en) + '\')">🔊 朗读</button>';
  },
  esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); },

  // ===== 单词列表 =====
  setWordFilter(tag, btn) {
    this.wordFilter = tag;
    document.querySelectorAll('#wordFilter .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.renderWordList();
  },
  renderWordList() {
    const all = Progress.getAllWords();
    const list = all.filter(w => this.wordFilter === 'all' || w.tag === this.wordFilter);
    const el = document.getElementById('wordList');
    const p = Progress.getWordProgress();
    // 顶部操作栏：联网扩充 + 查词
    const headerHtml =
      '<div class="card" style="background:linear-gradient(135deg,rgba(45,212,191,0.1),rgba(14,165,233,0.1));border-color:rgba(45,212,191,0.3);">' +
        '<h3><span class="ico">🌐</span> 联网扩充词库</h3>' +
        '<p style="font-size:var(--font-sm);color:var(--text-dim);margin-bottom:12px;">点击下方按钮，联网下载更多石油行业/日常交流主题词汇（共 100+ 词），保存到本地供反复学习。已自动获取最新音标和释义。</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">' +
          '<button class="btn btn-primary" style="flex:1;min-width:140px;" onclick="App.downloadTheme(\'oil\')">🛢️ 下载石油主题</button>' +
          '<button class="btn btn-accent" style="flex:1;min-width:140px;" onclick="App.downloadTheme(\'daily\')">💬 下载日常主题</button>' +
        '</div>' +
        '<div style="margin-top:10px;display:flex;gap:10px;align-items:center;">' +
          '<input id="searchInput" type="text" placeholder="🔍 输入任何英语单词查询（联网）" ' +
            'style="flex:1;background:var(--bg-card2);border:1px solid var(--border);color:var(--text);padding:12px;border-radius:10px;font-size:var(--font-md);" ' +
            'onkeydown="if(event.key===\'Enter\') App.searchWord()" />' +
          '<button class="btn btn-ghost" style="min-height:48px;padding:10px 18px;" onclick="App.searchWord()">查询</button>' +
        '</div>' +
        '<div id="searchResult"></div>' +
      '</div>';
    if (!list.length) { el.innerHTML = headerHtml + '<div class="empty">暂无单词</div>'; return; }
    el.innerHTML = headerHtml + list.map(w => {
      const r = p[w.word];
      const tagName = { oil: '🛢️石油', daily: '💬日常', driving: '🚗开车', custom: '🌐联网' }[w.tag] || '📚';
      const status = r ? (r.level >= 3 ? '✅ 已掌握' : '🔄 学习中') : '🆕 未学';
      const isCustom = w._custom ? ' <span style="color:var(--accent);">⭐</span>' : '';
      return '<div class="list-item" onclick="App.openWord(\'' + this.esc(w.word) + '\')">' +
        '<div class="left"><div class="title">' + w.word + isCustom + '</div>' +
        '<div class="sub">' + w.meaning + '</div></div>' +
        '<div class="right" style="font-size:var(--font-sm);text-align:right;"><div>' + status + '</div><div style="color:var(--text-dim);font-size:11px;margin-top:2px;">' + tagName + '</div></div></div>';
    }).join('');
  },

  // ===== 联网下载主题词卡 =====
  async downloadTheme(theme) {
    const words = theme === 'oil' ? LiveFeed.getOilThemeWords() : LiveFeed.getDailyThemeWords();
    const existing = new Set(Progress.getAllWords().map(w => w.word.toLowerCase()));
    const toFetch = words.filter(w => !existing.has(w.toLowerCase()));
    if (!toFetch.length) {
      this._showSearchMsg('✅ 该主题词卡已全部下载完成！', 'info');
      return;
    }
    this._showSearchMsg('⏳ 正在下载 ' + toFetch.length + ' 个新词（分批获取最新音标/释义）...', 'info');
    this._downloadProgress(0, toFetch.length);

    const batchSize = 4;
    let done = 0;
    let failed = 0;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      let results = [];
      try {
        results = await LiveFeed.lookupBatch(batch);
      } catch (e) {
        console.warn('lookupBatch failed', e);
      }
      results.forEach(r => {
        Progress.addCustomWord({
          word: r.word, phonetic: r.phonetic || '', pos: r.pos || '',
          meaning: r.meaning || '', example: r.example || '',
          exampleCn: r.exampleCn || '', tag: theme, _custom: true
        });
      });
      done += batch.length;
      failed += batch.length - results.length;
      this._downloadProgress(Math.min(done, toFetch.length), toFetch.length);
      // 每批后让出主线程，避免卡顿
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const failMsg = failed ? '（' + failed + ' 个因网络失败，可稍后重试）' : '';
    this._showSearchMsg('🎉 主题下载完成！新增 ' + (toFetch.length - failed) + ' 个词。' + failMsg, 'info');
    this.renderWordList();
    this.refreshStats();
  },
  _downloadProgress(done, total) {
    const pct = total ? Math.round(done / total * 100) : 0;
    const el = document.getElementById('searchResult');
    if (el) el.innerHTML = '<div class="banner info">⏳ 下载进度：' + done + ' / ' + total + ' (' + pct + '%)</div>';
  },

  // ===== 联网查任意单词 =====
  async searchWord() {
    const input = document.getElementById('searchInput');
    const word = (input && input.value || '').trim().toLowerCase();
    if (!word) return;
    const el = document.getElementById('searchResult');
    el.innerHTML = '<div class="spinner"></div>';
    const r = await LiveFeed.lookupWord(word);
    if (!r.found) {
      el.innerHTML = '<div class="banner warn">⚠️ 未找到单词 "' + this.escHtml(word) + '"，可能拼写错误或词典未收录。</div>';
      return;
    }
    Progress.addCustomWord({
      word: r.word, phonetic: r.phonetic, pos: r.pos, meaning: r.meaning,
      example: r.example, exampleCn: r.exampleCn || '', tag: 'custom', _custom: true
    });
    const tagName = r.pos ? '<span class="pos">' + this.escHtml(r.pos) + '</span>' : '';
    const audio = r.audio ? '<button class="speak-btn" onclick="new Audio(\'' + this.esc(r.audio) + '\').play()">🔔</button>' : '';
    el.innerHTML =
      '<div class="card" style="margin-top:14px;">' +
        '<div class="word-card" style="padding:14px 0;">' +
          '<div class="word">' + this.escHtml(r.word) + '</div>' +
          '<div class="phonetic">' + this.escHtml(r.phonetic || '') + '</div>' +
          tagName +
          '<div class="meaning">' + this.escHtml(r.meaning) + '</div>' +
          (r.example ? '<div class="example">' + this.escHtml(r.example) + '</div>' : '') +
          '<div class="tag-badge" style="color:var(--accent);border-color:var(--accent);">⭐ 已加入词库</div>' +
          '<div style="margin-top:10px;">' +
            '<button class="speak-btn" onclick="Speech.speak(\'' + this.esc(r.word) + '\')">🔊</button>' +
            '<button class="speak-btn" style="margin-left:8px;" onclick="Speech.speak(\'' + this.esc(r.example || r.word) + '\')">📢</button>' +
            audio +
            '<button class="btn btn-primary" style="margin-left:14px;min-height:40px;padding:6px 14px;" onclick="App.openWord(\'' + this.esc(r.word) + '\')">开始学习</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    this.refreshStats();
    input.value = '';
  },
  _showSearchMsg(msg, type) {
    const el = document.getElementById('searchResult');
    if (el) el.innerHTML = '<div class="banner ' + type + '">' + msg + '</div>';
  },

  // ===== Toast 提示（替代 alert）=====
  toast(msg, type = 'info', duration = 2200) {
    let t = document.getElementById('toastBox');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toastBox';
      t.className = 'toast-box';
      document.body.appendChild(t);
    }
    const item = document.createElement('div');
    item.className = 'toast ' + type;
    item.textContent = msg;
    t.appendChild(item);
    setTimeout(() => {
      item.classList.add('toast-out');
      setTimeout(() => item.remove(), 250);
    }, duration);
  },

  // ===== 复习学习流程 =====
  goReview() {
    this.studyMode = 'review';
    // 待学/待复习：未学过的 + 已到复习时间的（包含联网学到的）
    const all = Progress.getAllWords();
    const p = Progress.getWordProgress();
    const now = Date.now();
    this.currentWords = all.filter(w => {
      const r = p[w.word];
      if (!r) return true;
      return r.nextReview <= now;
    });
    this.currentIndex = 0;
    if (!this.currentWords.length) {
      alert('太棒了！今日复习已完成，暂无待学单词。');
      return;
    }
    this.currentWords = this.shuffle(this.currentWords);
    this.showStudy();
  },
  goIndustryStudy() {
    this.studyMode = 'industry';
    this.currentWords = this.shuffle(Progress.getAllWords().filter(w => w.tag === 'oil'));
    this.currentIndex = 0;
    if (!this.currentWords.length) { alert('暂无石油行业词汇，请先去「单词」页下载主题词卡。'); return; }
    this.showStudy();
  },
  showStudy() {
    document.getElementById('studyModal').style.display = 'block';
    this.renderStudyCard();
  },
  renderStudyCard() {
    const w = this.currentWords[this.currentIndex];
    const total = this.currentWords.length;
    document.getElementById('studyCount').textContent = (this.currentIndex + 1) + ' / ' + total;
    const tagName = { oil: '🛢️石油专业', daily: '💬日常交流', driving: '🚗开车场景', custom: '🌐联网查询' }[w.tag] || '';
    document.getElementById('studyBody').innerHTML =
      '<div class="card word-card">' +
        '<div class="word">' + w.word + '</div>' +
        '<div class="phonetic">' + (w.phonetic || '') + '</div>' +
        '<span class="pos">' + (w.pos || '') + '</span>' +
        '<div class="meaning">' + w.meaning + '</div>' +
        '<div class="example">' + (w.example || '') + '</div>' +
        '<div class="example-cn">' + (w.exampleCn || '') + '</div>' +
        (tagName ? '<div class="tag-badge">' + tagName + '</div>' : '') +
        '<div style="margin-top:14px;">' +
          '<button class="speak-btn" onclick="Speech.speak(\'' + this.esc(w.word) + '\')">🔊</button>' +
          '<button class="speak-btn" style="margin-left:10px;" onclick="Speech.speak(\'' + this.esc(w.example || w.word) + '\')">📢</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;">' +
        '<button class="btn btn-ghost btn-lg" style="flex:1;" onclick="App.answerWord(false)">😵 不认识</button>' +
        '<button class="btn btn-primary btn-lg" style="flex:1;" onclick="App.answerWord(true)">😊 认识</button>' +
      '</div>';
    Speech.speak(w.word);
  },
  answerWord(remembered) {
    const w = this.currentWords[this.currentIndex];
    Progress.markWord(w.word, remembered);
    this.currentIndex++;
    if (this.currentIndex >= this.currentWords.length) {
      this.closeStudy();
      this.refreshStats();
      this.updateDailyGoalUI();
      alert('🎉 本轮复习完成！共 ' + this.currentWords.length + ' 个单词。');
      return;
    }
    this.renderStudyCard();
  },
  closeStudy() {
    document.getElementById('studyModal').style.display = 'none';
    Speech.stop();
    this.refreshStats();
    this.updateDailyGoalUI();
    this.renderWordList();
  },
  openWord(word) {
    const w = Progress.getAllWords().find(x => x.word === word);
    if (!w) return;
    this.currentWords = [w];
    this.currentIndex = 0;
    this.studyMode = 'review';
    this.showStudy();
  },

  // ===== 口语练习 =====
  setSentenceFilter(cat, btn) {
    this.sentenceFilter = cat;
    document.querySelectorAll('#sentenceFilter .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.renderSentenceList();
  },
  renderSentenceList() {
    const list = SENTENCE_BANK.filter(s => this.sentenceFilter === 'all' || s.cat === this.sentenceFilter);
    const el = document.getElementById('sentenceList');
    const records = Speaking.getRecords();
    const catName = { oil: '🛢️石油', daily: '💬日常', smalltalk: '👋寒暄' };
    el.innerHTML = list.map(s => {
      const r = records[s.en];
      const best = r ? r.best : 0;
      const bestTag = r ? '<span style="color:var(--success);font-size:var(--font-sm);">最佳 ' + best + ' 分</span>' : '';
      return '<div class="list-item" onclick="App.openSpeak(\'' + this.esc(s.en) + '\')">' +
        '<div class="left"><div class="title">' + s.en + '</div>' +
        '<div class="sub">' + s.cn + ' <span style="color:var(--accent);">' + (catName[s.cat] || '') + '</span></div></div>' +
        '<div class="right">' + bestTag + '</div></div>';
    }).join('');
  },
  goIndustrySpeaking() {
    this.currentSentences = SENTENCE_BANK.filter(s => s.cat === 'oil');
    this.currentSIndex = 0;
    if (!this.currentSentences.length) { alert('暂无内容'); return; }
    this.showSpeak();
  },
  openSpeak(sentenceEn) {
    const s = SENTENCE_BANK.find(x => x.en === sentenceEn);
    if (!s) return;
    this.currentSentences = [s];
    this.currentSIndex = 0;
    this.showSpeak();
  },
  showSpeak() {
    document.getElementById('speakModal').style.display = 'block';
    this.renderSpeakCard();
  },
  renderSpeakCard() {
    const s = this.currentSentences[this.currentSIndex];
    const total = this.currentSentences.length;
    document.getElementById('speakBody').innerHTML =
      '<div class="card">' +
        '<div style="font-size:var(--font-xl);font-weight:700;margin-bottom:10px;">' + s.en + '</div>' +
        '<div style="font-size:var(--font-md);color:var(--text-dim);margin-bottom:8px;">' + s.cn + '</div>' +
        (s.tip ? '<div class="banner info">💡 ' + s.tip + '</div>' : '') +
        '<div style="display:flex;gap:10px;margin-bottom:16px;">' +
          '<button class="btn btn-ghost" style="flex:1;" onclick="Speech.speak(\'' + this.esc(s.en) + '\')">🔊 听一遍</button>' +
          '<button class="btn btn-ghost" style="flex:1;" onclick="Speech.speak(\'' + this.esc(s.en) + '\', App.speakSlow)">🐢 慢速</button>' +
        '</div>' +
        '<div id="scoreArea"></div>' +
        '<button id="micBtn" class="btn btn-accent btn-block btn-lg" onclick="App.startListen()">🎙️ 开始跟读</button>' +
        (this.currentSentences.length > 1 ? '<button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="App.nextSentence()">下一句 →</button>' : '') +
      '</div>';
  },
  speakSlow() {
    const orig = Settings.get().voiceRate;
    const s = Settings.get(); s.voiceRate = 0.6; Settings.save(s);
    const cur = this.currentSentences[this.currentSIndex];
    Speech.speak(cur.en, () => { s.voiceRate = orig; Settings.save(s); });
  },
  nextSentence() {
    this.currentSIndex = (this.currentSIndex + 1) % this.currentSentences.length;
    this.renderSpeakCard();
  },
  async startListen() {
    if (!Speech.supportRecognition()) {
      this.showScore(-1, '', '当前浏览器不支持语音识别。请用 Chrome 或 Edge，并允许麦克风权限。');
      return;
    }
    const btn = document.getElementById('micBtn');
    btn.textContent = '🎙️ 请朗读...';
    btn.classList.add('mic-pulse');
    btn.disabled = true;
    try {
      const transcript = await Speech.listen();
      const target = this.currentSentences[this.currentSIndex].en;
      const score = Speech.score(transcript, target);
      Speaking.record(target, score);
      this.showScore(score, transcript, '');
      this.refreshStats();
      this.renderSentenceList();
    } catch (e) {
      let msg = '识别失败，请重试。';
      if (e.message === 'no-speech') msg = '没有听到声音，请靠近麦克风再试一次。';
      else if (e.message === 'not-allowed') msg = '麦克风权限被拒绝。请在浏览器设置里允许麦克风后重试。';
      else if (e.message === 'network') msg = '语音识别需要联网，请检查网络后重试。';
      else if (e.message === 'no-support') msg = '当前浏览器不支持语音识别，请用 Chrome 或 Edge。';
      else if (e.message === 'already-starting') msg = '识别正在启动，请稍等 1 秒再试。';
      this.showScore(-1, '', msg);
    } finally {
      btn.textContent = '🎙️ 开始跟读';
      btn.classList.remove('mic-pulse');
      btn.disabled = false;
    }
  },
  showScore(score, transcript, errMsg) {
    const area = document.getElementById('scoreArea');
    if (errMsg) {
      area.innerHTML = '<div class="banner warn">⚠️ ' + errMsg + '</div>';
      return;
    }
    let cls = 'low', txt = '继续加油';
    if (score >= 80) { cls = 'good'; txt = '非常棒！'; }
    else if (score >= 60) { cls = 'mid'; txt = '不错，再练练！'; }
    area.innerHTML =
      '<div class="score-display">' +
        '<div class="score-ring ' + cls + '">' + score + '</div>' +
        '<div style="font-size:var(--font-lg);font-weight:600;">' + txt + '</div>' +
      '</div>' +
      '<div class="transcript-box"><div class="label">你的朗读：</div>' + this.escHtml(transcript) + '</div>';
  },
  escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  closeSpeak() {
    document.getElementById('speakModal').style.display = 'none';
    Speech.stop();
  },

  // ===== 听读模式（开车） =====
  listenQueue: [],
  listenIndex: 0,
  listenPlaying: false,
  listenAuto: true, // 自动播放下一条
  goListening() {
    // 队列：优先待学单词（含联网学到的）+ 口语句子交替
    const all = Progress.getAllWords();
    const p = Progress.getWordProgress();
    const now = Date.now();
    const dueWords = all.filter(w => {
      const r = p[w.word];
      if (!r) return true;
      return r.nextReview <= now;
    }).slice(0, 8);
    const sentences = this.shuffle(SENTENCE_BANK).slice(0, 8);
    this.listenQueue = [];
    const maxLen = Math.max(dueWords.length, sentences.length);
    for (let i = 0; i < maxLen; i++) {
      if (dueWords[i]) this.listenQueue.push({ type: 'word', data: dueWords[i] });
      if (sentences[i]) this.listenQueue.push({ type: 'sentence', data: sentences[i] });
    }
    if (!this.listenQueue.length) {
      this.toast('听读队列为空，先去「单词」页下载主题词卡或学习几个单词。', 'warn');
      return;
    }
    this.listenIndex = 0;
    // 关键：先彻底清空之前所有的音频，避免"另一个声音"
    Speech.stop();
    document.getElementById('listenModal').style.display = 'block';
    this.renderListenCard();
  },
  renderListenCard() {
    const el = document.getElementById('listenBody');
    const item = this.listenQueue[this.listenIndex];
    if (!item) {
      el.innerHTML = '<div class="card"><h3>🎉 听读完成</h3><p style="color:var(--text-dim);">本轮内容播放完毕。</p>' +
        '<button class="btn btn-primary btn-block" onclick="App.goListening()">再来一轮</button></div>';
      return;
    }
    let content = '';
    if (item.type === 'word') {
      const w = item.data;
      content = '<div class="card word-card">' +
        '<div class="word">' + w.word + '</div>' +
        '<div class="phonetic">' + (w.phonetic || '') + '</div>' +
        '<div class="meaning">' + w.meaning + '</div>' +
        '<div class="example">' + (w.example || '') + '</div>' +
        '<div class="example-cn">' + (w.exampleCn || '') + '</div></div>';
    } else {
      const s = item.data;
      content = '<div class="card word-card">' +
        '<div style="font-size:var(--font-lg);font-weight:700;">' + s.en + '</div>' +
        '<div style="font-size:var(--font-md);color:var(--text-dim);margin-top:8px;">' + s.cn + '</div></div>';
    }
    el.innerHTML = content +
      '<div style="text-align:center;font-size:var(--font-sm);color:var(--text-dim);margin-bottom:16px;">' +
        (this.listenIndex + 1) + ' / ' + this.listenQueue.length + '</div>' +
      '<div style="display:flex;gap:12px;">' +
        '<button class="btn btn-ghost btn-lg" style="flex:1;" id="listenPrev" onclick="App.listenPrev()">⏮</button>' +
        '<button class="btn btn-primary btn-lg" style="flex:1;font-size:28px;" id="listenPlay" onclick="App.listenToggle()">▶️</button>' +
        '<button class="btn btn-ghost btn-lg" style="flex:1;" id="listenNext" onclick="App.listenNext()">⏭</button>' +
      '</div>' +
      '<div style="margin-top:14px;display:flex;gap:10px;align-items:center;justify-content:center;font-size:var(--font-sm);color:var(--text-dim);">' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">' +
        '<input type="checkbox" id="listenAuto" ' + (this.listenAuto ? 'checked' : '') + ' onchange="App.listenAuto=this.checked"> 自动播放</label>' +
      '</div>' +
      '<div class="banner info" style="margin-top:14px;">🚗 开车时请使用耳机，专注前方道路。<br>单词→停顿 0.6s→例句→停顿 2.2s 跟读→下一条</div>';
    // 自动播放
    this.listenPlay();
  },
  listenToggle() {
    if (Speech.speakState === 'playing') this.listenPause();
    else this.listenPlay();
  },
  listenPlay() {
    const item = this.listenQueue[this.listenIndex];
    if (!item) return;
    const btn = document.getElementById('listenPlay');
    if (btn) btn.textContent = '⏸️';

    const onDone = () => {
      // 完整播放完成后停顿 2 秒供跟读
      setTimeout(() => {
        if (document.getElementById('listenModal').style.display === 'none') return;
        if (this.listenAuto) this.listenNext();
      }, 2200);
    };

    if (item.type === 'word') {
      // 单词：先单独读单词，停顿 0.6s 后再读例句（如果有）
      const w = item.data;
      Speech.speak(w.word, () => {
        if (w.example) {
          setTimeout(() => {
            Speech.speak(w.example, onDone);
          }, 600);
        } else {
          onDone();
        }
      });
    } else {
      // 句子：整句一次性朗读
      Speech.speak(item.data.en, onDone);
    }
  },
  listenPause() {
    Speech.stop();
    const btn = document.getElementById('listenPlay');
    if (btn) btn.textContent = '▶️';
  },
  listenNext() {
    if (this.listenIndex < this.listenQueue.length - 1) {
      this.listenIndex++;
      this.renderListenCard();
    } else {
      this.listenIndex = this.listenQueue.length;
      this.renderListenCard();
    }
  },
  listenPrev() {
    if (this.listenIndex > 0) {
      this.listenIndex--;
      this.renderListenCard();
    }
  },
  closeListen() {
    document.getElementById('listenModal').style.display = 'none';
    Speech.stop();
  },

  // ===== 行业动态 =====
  async loadOilNews() {
    const el = document.getElementById('oilNewsList');
    el.innerHTML = '<div class="spinner"></div>';
    const news = await LiveFeed.fetchOilNews();
    if (!news || !news.length) {
      el.innerHTML = '<div class="banner warn">⚠️ 网络获取失败，请检查网络连接后重试。</div>';
      return;
    }
    el.innerHTML = news.map(n => {
      return '<a class="list-item" href="' + n.link + '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">' +
        '<div class="left"><div class="title">' + this.escHtml(n.title) + '</div>' +
        '<div class="sub">' + this.escHtml(n.desc || '') + '</div></div>' +
        '<div class="right">↗</div></a>';
    }).join('');
  },
  async loadWordOfDay() {
    const el = document.getElementById('wordOfDay');
    el.innerHTML = '<div class="spinner"></div>';
    const w = await LiveFeed.fetchWordOfDay();
    el.innerHTML =
      '<div style="font-size:var(--font-xl);font-weight:800;">' + this.escHtml(w.word) + '</div>' +
      (w.phonetic ? '<div style="font-size:var(--font-md);color:var(--accent);">' + this.escHtml(w.phonetic) + '</div>' : '') +
      '<div style="font-size:var(--font-md);margin-top:8px;">' + this.escHtml(w.meaning || '') + '</div>' +
      (w.example ? '<div style="font-size:var(--font-sm);color:var(--text-dim);margin-top:6px;font-style:italic;">' + this.escHtml(w.example) + '</div>' : '') +
      '<button class="btn btn-ghost" style="margin-top:10px;min-height:44px;" onclick="Speech.speak(\'' + this.esc(w.word) + '\')">🔊 朗读</button>';
  },

  // ===== 工具 =====
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  resetAll() {
    if (!confirm('确定要清除所有学习进度吗？此操作不可恢复。')) return;
    localStorage.clear();
    this.refreshStats();
    this.updateDailyGoalUI();
    this.renderWordList();
    this.renderSentenceList();
    alert('已重置所有学习数据。');
  },

  // ===== 声音诊断 =====
  async testTTS() {
    const diag = document.getElementById('audioDiag');
    diag.innerHTML = '<div class="banner info">⏳ 正在测试 TTS...</div>';
    const synth = window.speechSynthesis;
    if (!synth) { diag.innerHTML = '<div class="banner warn">⚠️ 当前浏览器不支持 Web Speech API TTS。</div>'; return; }
    const voices = synth.getVoices();
    const enVoices = voices.filter(v => v.lang && v.lang.startsWith('en'));
    let info = '✓ TTS 可用。';
    info += '<br>英语语音数：' + enVoices.length + ' / 总数：' + voices.length;
    if (enVoices.length) info += '<br>当前使用：' + (Speech.voice ? Speech.voice.name : '默认') + ' (' + (Speech.voice ? Speech.voice.lang : 'en-US') + ')';
    if (Speech.ttsWorking === false) info += '<br>⚠️ 系统已检测到 TTS 不工作，将自动用真人音频兜底';

    let started = false;
    const u = new SpeechSynthesisUtterance('Hello, this is a test.');
    u.lang = 'en-US';
    if (Speech.voice) u.voice = Speech.voice;
    u.onstart = () => { started = true; };
    u.onerror = (e) => { diag.innerHTML = '<div class="banner warn">❌ TTS 报错：' + e.error + '<br>' + info + '</div>'; };
    u.onend = () => { diag.innerHTML = '<div class="banner info">✅ TTS 成功朗读！<br>' + info + '</div>'; };
    synth.cancel();
    synth.speak(u);
    setTimeout(() => {
      if (!started) {
        diag.innerHTML = '<div class="banner warn">⚠️ TTS 启动超时（1.5s 内未启动），可能手机未装 TTS 引擎。<br>' + info + '<br>👉 建议：去「设置 → 系统 → 语言 → 文字转语音输出」安装 Google TTS 引擎，或用下方「测试真人音频」验证。</div>';
      }
    }, 1500);
  },
  async testAudio() {
    const diag = document.getElementById('audioDiag');
    diag.innerHTML = '<div class="banner info">⏳ 正在测试真人音频（uapis.cn 源）...</div>';
    const url = 'https://uapis.cn/api/v1/dictionary/audio?accent=us&word=hello';
    try {
      const a = new Audio();
      a.src = url;
      a.onended = () => { diag.innerHTML = '<div class="banner info">✅ 真人音频播放成功！如果能听到 "hello" 的发音，说明手机音频工作正常。</div>'; };
      a.onerror = () => { diag.innerHTML = '<div class="banner warn">❌ 音频加载失败，可能是网络问题或浏览器拦截。</div>'; };
      await a.play();
    } catch (e) {
      diag.innerHTML = '<div class="banner warn">❌ 音频播放失败：' + e.message + '<br>可能需要先点击屏幕任意位置解锁音频（浏览器安全限制）。</div>';
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
