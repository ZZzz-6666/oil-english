// 口语跟读句子库
// 分类: oil 石油工作场景 | daily 日常交流 | smalltalk 寒暄
const SENTENCE_BANK = [
  // ===== 石油工作场景 =====
  { en: "The drilling operation is progressing smoothly.", cn: "钻井作业进展顺利。", cat: "oil", tip: "progressing 进行中" },
  { en: "We need to increase the injection rate to maintain pressure.", cn: "我们需要提高注入量来保持压力。", cat: "oil", tip: "injection rate 注入量" },
  { en: "Please check the casing pressure before starting the job.", cn: "开始作业前请检查套管压力。", cat: "oil", tip: "casing pressure 套管压力" },
  { en: "Safety is the top priority on every rig.", cn: "安全是每个井场的首要任务。", cat: "oil", tip: "top priority 首要任务" },
  { en: "The well has been producing for five years.", cn: "这口井已经生产五年了。", cat: "oil", tip: "producing 生产" },
  { en: "We detected a leak in the pipeline yesterday.", cn: "我们昨天在管线检测到泄漏。", cat: "oil", tip: "detect a leak 检测到泄漏" },
  { en: "The new completion technique improves recovery.", cn: "新的完井技术提高了采收率。", cat: "oil", tip: "recovery 采收率" },
  { en: "Could you send me the well logging report?", cn: "你能把测井报告发给我吗？", cat: "oil", tip: "well logging report 测井报告" },
  { en: "We will shut in the well for a workover.", cn: "我们将关井进行修井作业。", cat: "oil", tip: "shut in 关井" },
  { en: "The reservoir pressure is declining gradually.", cn: "地层压力正在逐渐下降。", cat: "oil", tip: "reservoir pressure 地层压力" },

  // ===== 日常交流 =====
  { en: "Could you please speak a little slower?", cn: "您能说慢一点吗？", cat: "daily", tip: "常用，用于听不懂时" },
  { en: "I didn't catch that. Could you repeat it?", cn: "我没听清，能再说一遍吗？", cat: "daily", tip: "没听清时的万能句" },
  { en: "Let's schedule a meeting for tomorrow morning.", cn: "我们安排明天上午开会吧。", cat: "daily", tip: "schedule a meeting 安排会议" },
  { en: "I will send you the details by email.", cn: "我会通过邮件把详情发给你。", cat: "daily", tip: "by email 通过邮件" },
  { en: "Thank you for your help, I really appreciate it.", cn: "谢谢你的帮助，我非常感激。", cat: "daily", tip: "appreciate 感激" },
  { en: "Could we postpone the meeting to next week?", cn: "我们能把会议推迟到下周吗？", cat: "daily", tip: "postpone 推迟" },
  { en: "I'm afraid I'm not available this afternoon.", cn: "恐怕我今天下午没空。", cat: "daily", tip: "I'm afraid 委婉表达" },
  { en: "What time is convenient for you?", cn: "你什么时间方便？", cat: "daily", tip: "convenient 方便" },
  { en: "Let me think about it and get back to you.", cn: "让我想想，稍后回复你。", cat: "daily", tip: "get back to you 回复你" },
  { en: "That sounds like a good idea.", cn: "听起来是个好主意。", cat: "daily", tip: "sounds like 听起来像" },

  // ===== 寒暄/社交 =====
  { en: "How was your weekend?", cn: "你周末过得怎么样？", cat: "smalltalk", tip: "常见寒暄" },
  { en: "It's been a while. How have you been?", cn: "好久不见，你最近怎么样？", cat: "smalltalk", tip: "It's been a while 好久不见" },
  { en: "Long time no see, how's everything going?", cn: "好久不见，一切都好吗？", cat: "smalltalk", tip: "Long time no see 好久不见" },
  { en: "Have a safe trip back.", cn: "一路平安。", cat: "smalltalk", tip: "safe trip 一路平安" },
  { en: "Take care and stay in touch.", cn: "保重，保持联系。", cat: "smalltalk", tip: "stay in touch 保持联系" }
];
