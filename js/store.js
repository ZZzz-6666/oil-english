// ===== 数据层：本地存储 + 间隔重复算法（艾宾浩斯） =====
const Store = {
  get(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
};
// 单词学习进度
// 结构: { [word]: { level, nextReview, correct, wrong } }
// level 0-5, 复习间隔: [0, 1天, 2天, 4天, 7天, 15天]
const REVIEW_INTERVALS = [0, 1, 2, 4, 7, 15];

const Progress = {
  getWordProgress() { return Store.get('word_progress', {}); },
  saveWordProgress(p) { Store.set('word_progress', p); },

  // 记录一次记忆结果: word, remembered(bool)
  markWord(word, remembered) {
    const p = this.getWordProgress();
    const cur = p[word] || { level: 0, nextReview: Date.now(), correct: 0, wrong: 0 };
    if (remembered) {
      cur.level = Math.min(5, cur.level + 1);
      cur.correct = (cur.correct || 0) + 1;
    } else {
      cur.level = Math.max(0, cur.level - 1);
      cur.wrong = (cur.wrong || 0) + 1;
    }
    const days = REVIEW_INTERVALS[cur.level];
    cur.nextReview = Date.now() + days * 24 * 3600 * 1000;
    p[word] = cur;
    this.saveWordProgress(p);
    Streak.bump();
    return cur;
  },

  // 获取今日应复习的单词
  getDueWords() {
    const p = this.getWordProgress();
    const now = Date.now();
    const all = this.getAllWords();
    return all.filter(w => {
      const r = p[w.word];
      if (!r) return true; // 未学过的默认为"待学"
      return r.nextReview <= now;
    });
  },

  // 统计
  getStats() {
    const p = this.getWordProgress();
    const total = WORD_BANK.length + this.getCustomWords().length;
    const learned = Object.keys(p).length;
    const mastered = Object.values(p).filter(r => r.level >= 3).length;
    return { total, learned, mastered };
  },

  // === 自定义（联网学到的）单词 ===
  getCustomWords() { return Store.get('custom_words', []); },
  addCustomWord(w) {
    const list = this.getCustomWords();
    if (list.find(x => x.word === w.word)) return false;
    list.push(w);
    Store.set('custom_words', list);
    return true;
  },
  getAllWords() {
    return [...WORD_BANK, ...this.getCustomWords()];
  }
};

// 口语跟读记录
const Speaking = {
  getRecords() { return Store.get('speaking_records', {}); },
  record(sentenceEn, score) {
    const r = this.getRecords();
    const cur = r[sentenceEn] || { best: 0, times: 0, last: null };
    cur.times += 1;
    cur.best = Math.max(cur.best, score);
    cur.last = Date.now();
    r[sentenceEn] = cur;
    Store.set('speaking_records', r);
    Streak.bump();
    return cur;
  },
  getStats() {
    const r = this.getRecords();
    const entries = Object.values(r);
    const total = entries.reduce((s, e) => s + e.times, 0);
    const avgBest = entries.length ? Math.round(entries.reduce((s, e) => s + e.best, 0) / entries.length) : 0;
    return { practiced: Object.keys(r).length, total, avgBest };
  }
};

// 学习设置
const Settings = {
  get() {
    return Store.get('settings', {
      fontSize: 'large',      // large | xlarge
      dailyGoal: 10,          // 每日单词目标
      voiceRate: 0.95,        // 语速 0.5-1.2
      voicePitch: 1.0,
      autoPlay: false         // 开车听读模式自动播放
    });
  },
  save(s) { Store.set('settings', s); }
};

// 连续学习天数（streak）
const Streak = {
  get() {
    return Store.get('streak', { count: 0, lastDate: null, todayCount: 0, todayDate: null });
  },
  // 每次学习（markWord/record）后调用，更新连续天数
  bump() {
    const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
    const s = this.get();
    if (s.todayDate === today) {
      s.todayCount = (s.todayCount || 0) + 1;
    } else {
      // 跨日
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (s.lastDate === yesterday) {
        s.count = (s.count || 0) + 1;  // 连续
      } else {
        s.count = 1;  // 重新开始
      }
      s.lastDate = today;
      s.todayCount = 1;
      s.todayDate = today;
    }
    Store.set('streak', s);
    return s;
  }
};
