// ===== 联网更新：实时获取英语学习内容与行业动态 =====
// 主 API: uapis.cn（国内服务，返回中文释义+音标+词组+同义词+例句）
// 备用 API: dictionaryapi.dev（国际，通用）
// 所有方法都有离线降级兜底

const LiveFeed = {
  // === 离线兜底数据 ===
  offlineSentences: [
    { en: "Consistent daily practice leads to steady progress.", cn: "每天坚持练习才能稳步进步。" },
    { en: "The global energy industry is shifting toward cleaner fuels.", cn: "全球能源行业正转向更清洁的燃料。" },
    { en: "Improving your listening helps you speak more naturally.", cn: "提高听力能让你说得更自然。" },
    { en: "Repetition is the key to long-term memory.", cn: "重复是长期记忆的关键。" },
    { en: "Field experience is the best teacher for a petroleum engineer.", cn: "现场经验是石油工程师最好的老师。" }
  ],

  // ===== 主：uapis.cn 词典（国内，返回中文释义）=====
  async lookupWord(word) {
    word = (word || '').trim().toLowerCase();
    if (!word) return { found: false, word };
    // 主
    const r1 = await this._uapis(word);
    if (r1.found) return r1;
    // 备
    const r2 = await this._dictionaryapi(word);
    if (r2.found) return r2;
    return { found: false, word };
  },

  _absUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    return 'https://uapis.cn' + (url.startsWith('/') ? '' : '/') + url;
  },

  async _uapis(word) {
    try {
      const url = `https://uapis.cn/api/v1/dictionary/lookup?word=${encodeURIComponent(word)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { found: false, word };
      const data = await res.json();
      if (!data.found || !data.entry) return { found: false, word };
      const e = data.entry;
      const phonetic = e.phonetics ? (e.phonetics.us?.text || e.phonetics.uk?.text || '') : '';
      const audio = this._absUrl(e.phonetics ? (e.phonetics.us?.audio || e.phonetics.uk?.audio || '') : '');

      // 优先用 english_definitions（结构化词性+英文释义）
      let def = null, meaning = '', pos = '';
      if (e.english_definitions && e.english_definitions.length) {
        def = e.english_definitions[0];
        pos = def.part_of_speech || '';
        meaning = `[${pos}] ${def.definition || ''}`;
      }
      // 兜底：definitions 数组里的 "n. 释义"
      if (!meaning && e.definitions && e.definitions.length) {
        def = e.definitions[0];
        const raw = def.meaning || '';
        const m = raw.match(/^([a-z]+\.)\s*(.+)$/);
        if (m) { pos = m[1]; meaning = m[2]; }
        else { meaning = raw; }
      }

      // 例句
      let example = '', exampleCn = '';
      if (e.examples && e.examples.length) {
        const ex = e.examples[0];
        example = ex.source || '';
        exampleCn = ex.translation || '';
      }

      return {
        found: true, source: 'uapis',
        word: e.word, phonetic, pos, meaning, example, exampleCn, audio
      };
    } catch (err) {
      console.warn('uapis lookup failed:', word, err.message || err);
      return { found: false, word };
    }
  },

  async _dictionaryapi(word) {
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { found: false, word };
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return { found: false, word };
      const e = data[0];
      const phonetic = e.phonetic || (e.phonetics && e.phonetics.find(p => p.text) && e.phonetics.find(p => p.text).text) || '';
      let audio = (e.phonetics && e.phonetics.find(p => p.audio) && e.phonetics.find(p => p.audio).audio) || '';
      if (audio.startsWith('//')) audio = 'https:' + audio;
      const m = e.meanings && e.meanings[0];
      const def = m && m.definitions && m.definitions[0];
      return {
        found: true, source: 'dictionaryapi',
        word: e.word, phonetic, pos: m ? m.partOfSpeech : '',
        meaning: def ? def.definition : '',
        example: def ? (def.example || '') : '',
        exampleCn: '',
        audio
      };
    } catch (err) {
      console.warn('dictionaryapi lookup failed:', word, err.message || err);
      return { found: false, word };
    }
  },

  // ===== 获取每日一词 =====
  async fetchWordOfDay() {
    // 候选词列表（覆盖通用 + 石油）
    const candidates = [
      'serendipity', 'resilience', 'pristine', 'robust', 'leverage', 'innovate',
      'petroleum', 'reservoir', 'fracturing', 'perforation', 'casing', 'workover',
      'catharsis', 'ephemeral', 'euphoria', 'nostalgia', 'solitude', 'integrity'
    ];
    const word = candidates[Math.floor(Math.random() * candidates.length)];
    const r = await this.lookupWord(word);
    if (r.found) return r;
    // 兜底
    const w = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    return { word: w.word, phonetic: w.phonetic, pos: w.pos, meaning: w.meaning, example: w.example, exampleCn: w.exampleCn, audio: '' };
  },

  // ===== 获取英语学习名言/例句 =====
  async fetchEnglishQuote() {
    try {
      const res = await fetch('https://api.quotable.io/random?maxLength=80', { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error('http');
      const data = await res.json();
      return { en: data.content, cn: '（实时英语句子，跟读练习）', source: 'quotable' };
    } catch {
      return this.offlineSentences[Math.floor(Math.random() * this.offlineSentences.length)];
    }
  },

  // ===== 石油/能源行业新闻 =====
  async fetchOilNews() {
    const feeds = [
      'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://oilprice.com/rss/main'),
      'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://www.rigzone.com/news/rss/rigzone_latest.aspx')
    ];
    for (const url of feeds) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === 'ok' && data.items && data.items.length) {
          return data.items.slice(0, 10).map(it => ({
            title: it.title,
            link: it.link,
            pubDate: it.pubDate,
            desc: (it.description || '').replace(/<[^>]+>/g, '').slice(0, 180)
          }));
        }
      } catch { continue; }
    }
    return null;
  },

  // ===== 批量获取多个词条 =====
  async lookupBatch(words) {
    const results = [];
    // 限流：一次 2 个并发，避免被 API 限速或移动端网络不稳定
    for (let i = 0; i < words.length; i += 2) {
      const batch = words.slice(i, i + 2);
      const r = await Promise.all(batch.map(w => this.lookupWord(w).catch(() => ({ found: false, word: w }))));
      results.push(...r);
    }
    return results.filter(r => r.found);
  },

  // ===== 石油主题词组（按场景）=====
  getOilThemeWords() {
    return [
      'petroleum', 'reservoir', 'drilling', 'fracturing', 'perforation', 'casing',
      'blowout', 'workover', 'production', 'pipeline', 'refinery', 'seismic',
      'porosity', 'permeability', 'upstream', 'downstream', 'completion',
      'wellhead', 'separator', 'LNG', 'LPG', 'H2S', 'OPEC',
      'barrel', 'crude oil', 'natural gas', 'condensate', 'shale', 'sandstone',
      'carbonate', 'core', 'logging', 'liner', 'packer',
      'BOP', 'drill string', 'drill bit', 'drilling mud',
      'top drive', 'sidetrack', 'stuck pipe', 'lost circulation',
      'kick', 'shut in', 'well kill', 'choke', 'flow rate',
      'pumpjack', 'gas lift', 'EOR', 'water cut',
      'storage tank', 'gathering station', 'pigging', 'distillation',
      'cracking', 'reforming', 'desulfurization', 'gasoline', 'diesel',
      'kerosene', 'asphalt', 'midstream',
      'proven reserves', 'probable reserves', 'royalty', 'concession',
      'block', 'spill', 'flare', 'PPE', 'ESD', 'HSE',
      'directional drilling', 'horizontal well', 'coiled tubing', 'wireline',
      'slickline', 'perforating gun', 'hydraulic fracturing', 'proppant'
    ];
  },

  getDailyThemeWords() {
    return [
      'schedule', 'confirm', 'available', 'urgent', 'deadline', 'feedback',
      'postpone', 'appreciate', 'recommend', 'convenient', 'experience',
      'equipment', 'safety', 'inspection', 'maintenance', 'supervise',
      'procedure', 'document', 'report', 'coordinate', 'estimate',
      'approve', 'priority', 'conclusion', 'solution', 'meeting',
      'project', 'contract', 'company', 'department', 'manager',
      'colleague', 'client', 'customer', 'negotiation', 'agreement',
      'proposal', 'presentation', 'strategy', 'goal', 'target',
      'achieve', 'improve', 'increase', 'reduce', 'optimize',
      'monitor', 'analyze', 'evaluate', 'implement', 'execute',
      'arrange', 'organize', 'prepare', 'review', 'finalize',
      'announce', 'communicate', 'collaborate', 'support', 'assist',
      'efficiency', 'productivity', 'innovation', 'sustainable', 'competitive'
    ];
  },

  isOnline() { return navigator.onLine !== false; }
};
