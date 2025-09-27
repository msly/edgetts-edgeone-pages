/**
 * 共享配置文件
 * 集中管理项目的所有配置常量
 */

// OpenAI 语音映射到 Microsoft 语音
export const OPENAI_VOICE_MAP = {
  "shimmer": "zh-CN-XiaoxiaoNeural",    // 温柔女声 -> 晓晓
  "alloy": "zh-CN-YunyangNeural",       // 专业男声 -> 云扬
  "fable": "zh-CN-YunjianNeural",       // 激情男声 -> 云健
  "onyx": "zh-CN-XiaoyiNeural",         // 活泼女声 -> 晓伊
  "nova": "zh-CN-YunxiNeural",          // 阳光男声 -> 云希
  "echo": "zh-CN-liaoning-XiaobeiNeural" // 东北女声 -> 晓北
};

// 扩展的语音支持（可以直接指定的微软语音）
export const MICROSOFT_VOICES = {
  // 中文普通话
  "zh-CN-XiaoxiaoNeural": { name: "晓晓", gender: "female", region: "zh-CN" },
  "zh-CN-YunyangNeural": { name: "云扬", gender: "male", region: "zh-CN" },
  "zh-CN-YunjianNeural": { name: "云健", gender: "male", region: "zh-CN" },
  "zh-CN-XiaoyiNeural": { name: "晓伊", gender: "female", region: "zh-CN" },
  "zh-CN-YunxiNeural": { name: "云希", gender: "male", region: "zh-CN" },
  "zh-CN-liaoning-XiaobeiNeural": { name: "晓北", gender: "female", region: "zh-CN" },
  "zh-CN-XiaochenNeural": { name: "晓辰", gender: "female", region: "zh-CN" },
  "zh-CN-XiaohanNeural": { name: "晓涵", gender: "female", region: "zh-CN" },
  "zh-CN-XiaomengNeural": { name: "晓梦", gender: "female", region: "zh-CN" },
  "zh-CN-XiaomoNeural": { name: "晓墨", gender: "female", region: "zh-CN" },
  "zh-CN-XiaoqiuNeural": { name: "晓秋", gender: "female", region: "zh-CN" },
  "zh-CN-XiaoruiNeural": { name: "晓睿", gender: "female", region: "zh-CN" },
  "zh-CN-XiaoshuangNeural": { name: "晓双", gender: "female", region: "zh-CN" },
  "zh-CN-XiaoxuanNeural": { name: "晓萱", gender: "female", region: "zh-CN" },
  "zh-CN-XiaoyanNeural": { name: "晓颜", gender: "female", region: "zh-CN" },
  "zh-CN-XiaoyouNeural": { name: "晓悠", gender: "female", region: "zh-CN" },
  "zh-CN-XiaozhenNeural": { name: "晓甄", gender: "female", region: "zh-CN" },
  "zh-CN-YunfengNeural": { name: "云枫", gender: "male", region: "zh-CN" },
  "zh-CN-YunhaoNeural": { name: "云皓", gender: "male", region: "zh-CN" },
  "zh-CN-YunyeNeural": { name: "云野", gender: "male", region: "zh-CN" },
  "zh-CN-YunzeNeural": { name: "云泽", gender: "male", region: "zh-CN" },

  // 英语
  "en-US-JennyNeural": { name: "Jenny", gender: "female", region: "en-US" },
  "en-US-GuyNeural": { name: "Guy", gender: "male", region: "en-US" },
  "en-US-AriaNeural": { name: "Aria", gender: "female", region: "en-US" },
  "en-US-DavisNeural": { name: "Davis", gender: "male", region: "en-US" },
  "en-US-AmberNeural": { name: "Amber", gender: "female", region: "en-US" },
  "en-US-AnaNeural": { name: "Ana", gender: "female", region: "en-US" },
  "en-US-AshleyNeural": { name: "Ashley", gender: "female", region: "en-US" },
  "en-US-BrandonNeural": { name: "Brandon", gender: "male", region: "en-US" },
  "en-US-ChristopherNeural": { name: "Christopher", gender: "male", region: "en-US" },
  "en-US-CoraNeural": { name: "Cora", gender: "female", region: "en-US" },
};

// 默认配置
export const DEFAULT_CONFIG = {
  // TTS 参数
  CONCURRENCY: 10,          // 默认并发数
  CHUNK_SIZE: 300,         // 默认文本分块大小
  MAX_TEXT_LENGTH: 120000, // 最大文本长度
  OUTPUT_FORMAT: "audio-24khz-48kbitrate-mono-mp3",

  // Token 管理
  TOKEN_REFRESH_BEFORE_EXPIRY: 5 * 60, // 提前5分钟刷新Token
  TOKEN_RETRY_ATTEMPTS: 3,              // Token获取重试次数
  TOKEN_RETRY_DELAY: 1000,              // 重试延迟(ms)

  // 请求限制
  MAX_CONCURRENT_REQUESTS: 50,          // 最大并发请求数
  REQUEST_TIMEOUT: 30000,               // 请求超时时间(ms)

  // 缓存配置
  AUDIO_CACHE_TTL: 3600,               // 音频缓存TTL(秒)
  TOKEN_CACHE_TTL: 3600,               // Token缓存TTL(秒)
};

// API 端点配置
export const API_ENDPOINTS = {
  MICROSOFT_TRANSLATOR: "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0",
  TTS_BASE: "tts.speech.microsoft.com/cognitiveservices/v1",
};

// 默认文本清理选项
export const DEFAULT_CLEANING_OPTIONS = {
  remove_markdown: true,
  remove_emoji: true,
  remove_urls: true,
  remove_line_breaks: true,
  remove_citation_numbers: true,
  custom_keywords: "",
};

// 支持的音频格式
export const SUPPORTED_FORMATS = [
  "audio-24khz-48kbitrate-mono-mp3",
  "audio-24khz-96kbitrate-mono-mp3",
  "audio-48khz-96kbitrate-mono-mp3",
  "audio-48khz-192kbitrate-mono-mp3",
  "riff-24khz-16bit-mono-pcm",
  "riff-48khz-16bit-mono-pcm",
];

// 错误码定义
export const ERROR_CODES = {
  INVALID_REQUEST: "invalid_request_error",
  INVALID_API_KEY: "invalid_api_key",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  TTS_GENERATION_ERROR: "tts_generation_error",
  INTERNAL_SERVER_ERROR: "internal_server_error",
  TOKEN_ACQUISITION_FAILED: "token_acquisition_failed",
  VALIDATION_ERROR: "validation_error",
};

// 硬编码密钥移至环境变量的默认值（用于向后兼容）
export const FALLBACK_SIGNING_KEY = "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==";