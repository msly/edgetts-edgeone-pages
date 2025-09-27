/**
 * EdgeOne Pages Edge Function - Microsoft Edge TTS 服务代理
 *
 * @version 3.0.0 (重构优化版 - 单文件)
 * @description 整合重构优化后的代码，兼容 EdgeOne Pages 部署要求
 *
 * @features
 * - 增强的错误处理和日志记录
 * - 统一的配置管理
 * - 更好的安全性和性能
 * - 兼容 OpenAI TTS API 格式
 * - 支持更多语音模型
 * - 智能文本处理和分块
 */

// =================================================================================
// 配置常量
// =================================================================================

// OpenAI 语音映射到 Microsoft 语音
const OPENAI_VOICE_MAP = {
  "shimmer": "zh-CN-XiaoxiaoNeural",    // 温柔女声 -> 晓晓
  "alloy": "zh-CN-YunyangNeural",       // 专业男声 -> 云扬
  "fable": "zh-CN-YunjianNeural",       // 激情男声 -> 云健
  "onyx": "zh-CN-XiaoyiNeural",         // 活泼女声 -> 晓伊
  "nova": "zh-CN-YunxiNeural",          // 阳光男声 -> 云希
  "echo": "zh-CN-liaoning-XiaobeiNeural" // 东北女声 -> 晓北
};

// 扩展的语音支持
const MICROSOFT_VOICES = {
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
const DEFAULT_CONFIG = {
  CONCURRENCY: 10,
  CHUNK_SIZE: 300,
  MAX_TEXT_LENGTH: 120000,
  OUTPUT_FORMAT: "audio-24khz-48kbitrate-mono-mp3",
  TOKEN_REFRESH_BEFORE_EXPIRY: 5 * 60,
  TOKEN_RETRY_ATTEMPTS: 3,
  TOKEN_RETRY_DELAY: 1000,
  MAX_CONCURRENT_REQUESTS: 50,
  REQUEST_TIMEOUT: 30000,
};

// API 端点配置
const API_ENDPOINTS = {
  MICROSOFT_TRANSLATOR: "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0",
  TTS_BASE: "tts.speech.microsoft.com/cognitiveservices/v1",
};

// 错误码定义
const ERROR_CODES = {
  INVALID_REQUEST: "invalid_request_error",
  INVALID_API_KEY: "invalid_api_key",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  TTS_GENERATION_ERROR: "tts_generation_error",
  INTERNAL_SERVER_ERROR: "internal_server_error",
  TOKEN_ACQUISITION_FAILED: "token_acquisition_failed",
  VALIDATION_ERROR: "validation_error",
};

// 默认文本清理选项
const DEFAULT_CLEANING_OPTIONS = {
  remove_markdown: true,
  remove_emoji: true,
  remove_urls: true,
  remove_line_breaks: true,
  remove_citation_numbers: true,
  custom_keywords: "",
};

// 硬编码密钥（向后兼容）
const FALLBACK_SIGNING_KEY = "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==";

// =================================================================================
// 错误处理和响应辅助函数
// =================================================================================

/**
 * 自定义错误类
 */
class TTSError extends Error {
  constructor(message, code = ERROR_CODES.INTERNAL_SERVER_ERROR, status = 500, details = null) {
    super(message);
    this.name = 'TTSError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 生成 CORS 头
 */
function makeCORSHeaders(allowedHeaders = "Content-Type, Authorization") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * 处理 CORS 预检请求
 */
function handleOptions(allowedHeaders = "Content-Type, Authorization") {
  return new Response(null, {
    status: 204,
    headers: makeCORSHeaders(allowedHeaders)
  });
}

/**
 * 生成标准化错误响应
 */
function errorResponse(error, status = 500, type = ERROR_CODES.INTERNAL_SERVER_ERROR, details = null) {
  let message, code, errorDetails;

  if (error instanceof TTSError) {
    message = error.message;
    status = error.status;
    code = error.code;
    errorDetails = error.details;
  } else if (error instanceof Error) {
    message = error.message;
    code = type;
    errorDetails = details || { stack: error.stack };
  } else {
    message = String(error);
    code = type;
    errorDetails = details;
  }

  const errorBody = {
    error: {
      message,
      type: code,
      code: null,
      ...(errorDetails && { details: errorDetails })
    }
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...makeCORSHeaders()
    }
  });
}

/**
 * 日志记录辅助函数
 */
function log(level, message, meta = {}) {
  const logEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };

  console[level === 'error' ? 'error' : 'log'](`[TTS ${level.toUpperCase()}]:`, logEntry);
}

/**
 * 参数验证辅助函数
 */
function validateParams(params, rules) {
  const errors = [];

  for (const [key, rule] of Object.entries(rules)) {
    const value = params[key];

    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(`参数 '${key}' 是必需的`);
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (rule.type && typeof value !== rule.type) {
      errors.push(`参数 '${key}' 类型错误，期望 ${rule.type}，实际 ${typeof value}`);
      continue;
    }

    if (rule.maxLength && String(value).length > rule.maxLength) {
      errors.push(`参数 '${key}' 长度超过限制 ${rule.maxLength}`);
    }

    if (rule.minLength && String(value).length < rule.minLength) {
      errors.push(`参数 '${key}' 长度不足 ${rule.minLength}`);
    }

    if (rule.min !== undefined && Number(value) < rule.min) {
      errors.push(`参数 '${key}' 值过小，最小值为 ${rule.min}`);
    }

    if (rule.max !== undefined && Number(value) > rule.max) {
      errors.push(`参数 '${key}' 值过大，最大值为 ${rule.max}`);
    }
  }

  if (errors.length > 0) {
    throw new TTSError("参数验证失败", ERROR_CODES.VALIDATION_ERROR, 400, { validationErrors: errors });
  }
}

// =================================================================================
// Token 缓存和认证模块
// =================================================================================

let tokenCache = {
  endpoint: null,
  token: null,
  expiredAt: null,
  retryCount: 0
};

/**
 * 获取微软 TTS 服务端点和 Token
 */
async function getEndpoint(env = {}) {
  const now = Date.now() / 1000;

  // 检查 Token 是否仍然有效
  if (tokenCache.token && tokenCache.expiredAt &&
    now < tokenCache.expiredAt - DEFAULT_CONFIG.TOKEN_REFRESH_BEFORE_EXPIRY) {
    log('info', 'Using cached token', { expiredAt: tokenCache.expiredAt });
    return tokenCache.endpoint;
  }

  if (tokenCache.expiredAt && now >= tokenCache.expiredAt) {
    tokenCache.retryCount = 0;
  }

  if (tokenCache.retryCount >= DEFAULT_CONFIG.TOKEN_RETRY_ATTEMPTS) {
    throw new TTSError(
      `Token获取失败，已达到最大重试次数 ${DEFAULT_CONFIG.TOKEN_RETRY_ATTEMPTS}`,
      ERROR_CODES.TOKEN_ACQUISITION_FAILED,
      503
    );
  }

  try {
    const endpoint = await fetchNewToken(env);
    tokenCache.retryCount = 0;
    log('info', 'Successfully acquired new token', { region: endpoint.r });
    return endpoint;
  } catch (error) {
    tokenCache.retryCount++;
    log('error', 'Token acquisition failed', {
      attempt: tokenCache.retryCount,
      maxAttempts: DEFAULT_CONFIG.TOKEN_RETRY_ATTEMPTS,
      error: error.message
    });

    if (tokenCache.retryCount < DEFAULT_CONFIG.TOKEN_RETRY_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, DEFAULT_CONFIG.TOKEN_RETRY_DELAY));
      return getEndpoint(env);
    }

    throw error;
  }
}

/**
 * 获取新的Token
 */
async function fetchNewToken(env) {
  let clientId;
  try {
    clientId = crypto.randomUUID().replace(/-/g, "");
  } catch (e) {
    clientId = generateRandomId();
    log('warn', 'crypto.randomUUID not available, using fallback method');
  }

  try {
    const signature = await sign(API_ENDPOINTS.MICROSOFT_TRANSLATOR, env);

    const response = await fetch(API_ENDPOINTS.MICROSOFT_TRANSLATOR, {
      method: "POST",
      headers: {
        "Accept-Language": "zh-Hans",
        "X-ClientVersion": "4.0.530a 5fe1dc6c",
        "X-UserId": "0f04d16a175c411e",
        "X-HomeGeographicRegion": "zh-Hans-CN",
        "X-ClientTraceId": clientId,
        "X-MT-Signature": signature,
        "User-Agent": "okhttp/4.5.0",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": "0",
        "Accept-Encoding": "gzip"
      },
      signal: AbortSignal.timeout(DEFAULT_CONFIG.REQUEST_TIMEOUT)
    });

    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
      } catch (textError) {
        errorText = `无法读取错误响应: ${textError.message}`;
      }
      throw new TTSError(
        `获取端点失败: ${response.status} ${response.statusText} - ${errorText}`,
        ERROR_CODES.TOKEN_ACQUISITION_FAILED,
        response.status
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      let responseText;
      try {
        responseText = await response.text();
      } catch (textError) {
        responseText = `无法读取响应文本: ${textError.message}`;
      }
      throw new TTSError(
        `端点响应解析失败: ${jsonError.message}. 响应内容: ${responseText.substring(0, 200)}`,
        ERROR_CODES.TOKEN_ACQUISITION_FAILED,
        response.status
      );
    }

    if (!data || !data.t || !data.r) {
      throw new TTSError(
        `端点响应格式错误: 缺少必要字段 t 或 r. 响应: ${JSON.stringify(data)}`,
        ERROR_CODES.TOKEN_ACQUISITION_FAILED,
        400
      );
    }

    const expiredAt = parseJWTExpiration(data.t);

    tokenCache = {
      endpoint: data,
      token: data.t,
      expiredAt,
      retryCount: 0
    };

    log('info', 'Token acquired successfully', {
      region: data.r,
      expiredAt: new Date(expiredAt * 1000).toISOString()
    });

    return data;
  } catch (error) {
    if (error instanceof TTSError) {
      throw error;
    }
    throw new TTSError(
      `端点获取失败: ${error.message}`,
      ERROR_CODES.TOKEN_ACQUISITION_FAILED,
      503,
      { originalError: error.message }
    );
  }
}

/**
 * 解析JWT Token的过期时间
 */
function parseJWTExpiration(token) {
  try {
    const jwt = token.split(".")[1];
    let decoded;

    if (typeof atob !== 'undefined') {
      decoded = atob(jwt);
    } else {
      decoded = base64Decode(jwt);
    }

    try {
      const decodedJwt = JSON.parse(decoded);
      return decodedJwt.exp || (Date.now() / 1000 + 3600);
    } catch (jsonError) {
      log('warn', 'JWT JSON parsing failed', {
        error: jsonError.message,
        decoded: decoded.substring(0, 50)
      });
      return Date.now() / 1000 + 3600;
    }
  } catch (e) {
    log('warn', 'JWT parsing failed, using default expiration', { error: e.message });
    return Date.now() / 1000 + 3600;
  }
}

/**
 * 生成微软 Translator 签名
 */
async function sign(urlStr, env = {}) {
  const url = urlStr.split("://")[1];
  const encodedUrl = encodeURIComponent(url);

  let uuidStr;
  try {
    uuidStr = crypto.randomUUID().replace(/-/g, "");
  } catch (e) {
    uuidStr = generateRandomId();
  }

  const formattedDate = new Date().toUTCString().replace(/GMT/, "").trim() + " GMT";
  const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();

  const signingKey = env.MS_SIGNING_KEY || FALLBACK_SIGNING_KEY;

  if (env.MS_SIGNING_KEY) {
    log('info', 'Using signing key from environment variable');
  } else {
    log('warn', 'Using fallback signing key, consider setting MS_SIGNING_KEY environment variable');
  }

  const keyBytes = await base64ToBytes(signingKey);
  const signData = await hmacSha256(keyBytes, bytesToSign);
  const signBase64 = await bytesToBase64(signData);

  return `MSTranslatorAndroidApp::${signBase64}::${formattedDate}::${uuidStr}`;
}

/**
 * HMAC-SHA256 签名
 */
async function hmacSha256(key, data) {
  if (!crypto || !crypto.subtle) {
    throw new TTSError(
      "crypto.subtle API 不可用，EdgeOne Pages 环境可能不支持此功能",
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      500
    );
  }

  try {
    const keyBuffer = key instanceof Uint8Array ? key : new Uint8Array(key);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const dataBuffer = new TextEncoder().encode(data);
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);

    return new Uint8Array(signature);
  } catch (e) {
    throw new TTSError(
      `HMAC 签名失败: ${e.message}`,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      500,
      { stack: e.stack }
    );
  }
}

/**
 * Base64 字符串转字节数组
 */
async function base64ToBytes(base64) {
  try {
    const padding = 4 - (base64.length % 4);
    const paddedBase64 = base64 + "=".repeat(padding % 4);

    if (typeof atob !== 'undefined') {
      const binary = atob(paddedBase64);
      return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)));
    } else {
      return new Uint8Array(base64Decode(paddedBase64).split('').map(char => char.charCodeAt(0)));
    }
  } catch (e) {
    throw new TTSError(
      `Base64 解码失败: ${e.message}`,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      500
    );
  }
}

/**
 * 字节数组转 Base64 字符串
 */
async function bytesToBase64(bytes) {
  try {
    if (typeof btoa !== 'undefined') {
      const binary = String.fromCharCode(...bytes);
      return btoa(binary);
    } else {
      return base64Encode(String.fromCharCode(...bytes));
    }
  } catch (e) {
    throw new TTSError(
      `Base64 编码失败: ${e.message}`,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      500
    );
  }
}

/**
 * 生成随机ID
 */
function generateRandomId() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * 手动 Base64 解码
 */
function base64Decode(base64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let buffer = 0;
  let bufferLength = 0;

  for (const char of base64) {
    if (char === '=') break;

    const index = chars.indexOf(char);
    if (index === -1) continue;

    buffer = (buffer << 6) | index;
    bufferLength += 6;

    if (bufferLength >= 8) {
      result += String.fromCharCode((buffer >> (bufferLength - 8)) & 0xFF);
      bufferLength -= 8;
    }
  }

  return result;
}

/**
 * 手动 Base64 编码
 */
function base64Encode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let buffer = 0;
  let bufferLength = 0;

  for (const char of str) {
    buffer = (buffer << 8) | char.charCodeAt(0);
    bufferLength += 8;

    while (bufferLength >= 6) {
      result += chars[(buffer >> (bufferLength - 6)) & 0x3F];
      bufferLength -= 6;
    }
  }

  if (bufferLength > 0) {
    result += chars[(buffer << (6 - bufferLength)) & 0x3F];
  }

  while (result.length % 4 !== 0) {
    result += '=';
  }

  return result;
}

// =================================================================================
// 文本处理工具
// =================================================================================

/**
 * 智能文本分块
 */
function smartChunkText(text, maxChunkLength = DEFAULT_CONFIG.CHUNK_SIZE) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  if (text.length <= maxChunkLength) {
    return [text];
  }

  log('info', 'Starting smart text chunking', {
    textLength: text.length,
    maxChunkLength,
    estimatedChunks: Math.ceil(text.length / maxChunkLength)
  });

  const chunks = [];
  let currentChunk = "";

  const sentenceBoundaries = /([.?!,;:\n。？！，；：\r]+)/g;
  const parts = text.split(sentenceBoundaries).filter(part => part.length > 0);

  for (const part of parts) {
    if (part.length > maxChunkLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      const forcedChunks = forceChunkLongText(part, maxChunkLength);
      chunks.push(...forcedChunks);
      continue;
    }

    if (currentChunk.length + part.length <= maxChunkLength) {
      currentChunk += part;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = part;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  const finalChunks = chunks.filter(chunk => chunk.length > 0);

  log('info', 'Text chunking completed', {
    originalLength: text.length,
    chunkCount: finalChunks.length,
    averageChunkSize: Math.round(finalChunks.reduce((sum, chunk) => sum + chunk.length, 0) / finalChunks.length)
  });

  return finalChunks;
}

/**
 * 强制分割过长的文本
 */
function forceChunkLongText(text, maxLength) {
  const chunks = [];
  const words = text.split(/(\s+)/);
  let currentChunk = "";

  for (const word of words) {
    if (currentChunk.length + word.length <= maxLength) {
      currentChunk += word;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        for (let i = 0; i < word.length; i += maxLength) {
          chunks.push(word.substring(i, i + maxLength));
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * 文本清理函数
 */
function cleanText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return "";
  }

  const finalOptions = { ...DEFAULT_CLEANING_OPTIONS, ...options };
  let cleanedText = text;

  log('info', 'Starting text cleaning', {
    originalLength: text.length,
    options: finalOptions
  });

  try {
    if (finalOptions.remove_markdown) {
      cleanedText = removeMarkdown(cleanedText);
    }

    if (finalOptions.remove_emoji) {
      cleanedText = removeEmoji(cleanedText);
    }

    if (finalOptions.remove_urls) {
      cleanedText = removeUrls(cleanedText);
    }

    if (finalOptions.remove_citation_numbers) {
      cleanedText = removeCitationNumbers(cleanedText);
    }

    if (finalOptions.remove_line_breaks) {
      cleanedText = normalizeLineBreaks(cleanedText);
    }

    if (finalOptions.custom_keywords) {
      cleanedText = removeCustomKeywords(cleanedText, finalOptions.custom_keywords);
    }

    cleanedText = finalCleanup(cleanedText);

    log('info', 'Text cleaning completed', {
      originalLength: text.length,
      cleanedLength: cleanedText.length,
      reductionPercent: Math.round((1 - cleanedText.length / text.length) * 100)
    });

    return cleanedText;
  } catch (error) {
    log('error', 'Text cleaning failed', { error: error.message });
    return text;
  }
}

/**
 * 移除 Markdown 标记
 */
function removeMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/```[^`]*```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/^\*\*\*+$/gm, '');
}

/**
 * 移除 Emoji 表情符号
 */
function removeEmoji(text) {
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
}

/**
 * 移除 URL 链接
 */
function removeUrls(text) {
  return text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/www\.[^\s]+/g, '')
    .replace(/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/g, '');
}

/**
 * 移除引用数字和标注
 */
function removeCitationNumbers(text) {
  return text
    .replace(/\[\d+(?:[-,]\d+)*\]/g, '')
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, '')
    .replace(/\(\d+\)/g, '');
}

/**
 * 标准化换行符处理
 */
function normalizeLineBreaks(text) {
  return text
    .replace(/\n\s*\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

/**
 * 移除自定义关键词
 */
function removeCustomKeywords(text, keywords) {
  if (!keywords || typeof keywords !== 'string') {
    return text;
  }

  const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
  let result = text;

  for (const keyword of keywordList) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKeyword, 'gi');
    result = result.replace(regex, '');
  }

  return result;
}

/**
 * 最终清理
 */
function finalCleanup(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\t/g, ' ')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])\s+/g, '$1 ');
}

/**
 * 验证文本
 */
function validateText(text, options = {}) {
  const {
    maxLength = DEFAULT_CONFIG.MAX_TEXT_LENGTH,
    minLength = 1,
    allowEmpty = false
  } = options;

  if (!text && !allowEmpty) {
    throw new TTSError("文本内容不能为空", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  if (typeof text !== 'string') {
    throw new TTSError("文本必须是字符串类型", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  if (text.length < minLength) {
    throw new TTSError(`文本长度不能少于 ${minLength} 个字符`, ERROR_CODES.VALIDATION_ERROR, 400);
  }

  if (text.length > maxLength) {
    throw new TTSError(`文本长度不能超过 ${maxLength} 个字符，当前长度: ${text.length}`, ERROR_CODES.VALIDATION_ERROR, 400);
  }
}

/**
 * 检测文本主要语言
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') {
    return 'unknown';
  }

  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const totalContent = chineseChars + englishWords;

  if (totalContent === 0) {
    return 'unknown';
  }

  const chineseRatio = chineseChars / totalContent;
  const englishRatio = englishWords / totalContent;

  if (chineseRatio > 0.7) {
    return 'zh-CN';
  } else if (englishRatio > 0.7) {
    return 'en-US';
  } else if (chineseRatio > 0.1 && englishRatio > 0.1) {
    return 'mixed';
  } else {
    return 'unknown';
  }
}

/**
 * 预估音频时长
 */
function estimateAudioDuration(text, rate = 1.0) {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;

  const chineseDuration = chineseChars / (300 / 60);
  const englishDuration = englishWords / (150 / 60);

  const baseDuration = chineseDuration + englishDuration;
  return Math.max(1, baseDuration / rate);
}

// =================================================================================
// TTS 核心逻辑
// =================================================================================

/**
 * 获取语音音频块
 */
async function getAudioChunk(text, voiceName, rate, pitch, style, outputFormat, env = {}) {
  if (!text || !text.trim()) {
    throw new TTSError("文本内容不能为空", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  const endpoint = await getEndpoint(env);
  const url = `https://${endpoint.r}.${API_ENDPOINTS.TTS_BASE}`;
  const ssml = generateSSML(text, voiceName, rate, pitch, style);

  log('info', 'Generating audio chunk', {
    textLength: text.length,
    voice: voiceName,
    rate,
    pitch,
    style,
    format: outputFormat
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": endpoint.t,
        "Content-Type": "application/ssml+xml",
        "User-Agent": "okhttp/4.5.0",
        "X-Microsoft-OutputFormat": outputFormat
      },
      body: ssml,
      signal: AbortSignal.timeout(DEFAULT_CONFIG.REQUEST_TIMEOUT)
    });

    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
      } catch (textError) {
        errorText = `无法读取错误响应: ${textError.message}`;
      }
      throw new TTSError(
        `Edge TTS API 错误: ${response.status} ${response.statusText} - ${errorText}`,
        ERROR_CODES.TTS_GENERATION_ERROR,
        response.status
      );
    }

    let blob;
    try {
      blob = await response.blob();
    } catch (blobError) {
      throw new TTSError(
        `音频数据读取失败: ${blobError.message}`,
        ERROR_CODES.TTS_GENERATION_ERROR,
        500
      );
    }

    if (!blob || blob.size === 0) {
      throw new TTSError(
        "音频数据为空",
        ERROR_CODES.TTS_GENERATION_ERROR,
        500
      );
    }

    log('info', 'Audio chunk generated successfully', {
      blobSize: blob.size,
      contentType: blob.type
    });

    return blob;
  } catch (error) {
    if (error instanceof TTSError) {
      throw error;
    }
    throw new TTSError(
      `音频生成失败: ${error.message}`,
      ERROR_CODES.TTS_GENERATION_ERROR,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * 流式语音生成
 */
async function streamVoice(textChunks, concurrency, voiceName, rate, pitch, style, outputFormat, env = {}) {
  if (!textChunks || textChunks.length === 0) {
    throw new TTSError("文本块不能为空", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  log('info', 'Starting streaming voice generation', {
    chunkCount: textChunks.length,
    concurrency,
    voice: voiceName
  });

  const { readable, writable } = new TransformStream();

  try {
    pipeChunksToStream(
      writable.getWriter(),
      textChunks,
      concurrency,
      voiceName,
      rate,
      pitch,
      style,
      outputFormat,
      env
    ).catch(error => {
      log('error', 'Streaming pipeline failed', { error: error.message });
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "audio/mpeg",
        ...makeCORSHeaders()
      }
    });
  } catch (error) {
    throw new TTSError(
      `流式 TTS 失败: ${error.message}`,
      ERROR_CODES.TTS_GENERATION_ERROR,
      500
    );
  }
}

/**
 * 非流式语音生成
 */
async function getVoice(textChunks, concurrency, voiceName, rate, pitch, style, outputFormat, env = {}) {
  if (!textChunks || textChunks.length === 0) {
    throw new TTSError("文本块不能为空", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  log('info', 'Starting batch voice generation', {
    chunkCount: textChunks.length,
    concurrency,
    voice: voiceName
  });

  try {
    const audioBlobs = [];

    for (let i = 0; i < textChunks.length; i += concurrency) {
      const batch = textChunks.slice(i, i + concurrency);
      const audioPromises = batch.map(chunk =>
        getAudioChunk(chunk, voiceName, rate, pitch, style, outputFormat, env)
      );

      log('info', `Processing batch ${Math.floor(i / concurrency) + 1}`, {
        batchSize: batch.length,
        totalBatches: Math.ceil(textChunks.length / concurrency)
      });

      const batchBlobs = await Promise.all(audioPromises);
      audioBlobs.push(...batchBlobs);
    }

    const combinedBlob = new Blob(audioBlobs, { type: "audio/mpeg" });

    log('info', 'Voice generation completed', {
      totalBlobs: audioBlobs.length,
      finalSize: combinedBlob.size
    });

    return new Response(combinedBlob, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": combinedBlob.size.toString(),
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    if (error instanceof TTSError) {
      throw error;
    }
    throw new TTSError(
      `批量 TTS 失败: ${error.message}`,
      ERROR_CODES.TTS_GENERATION_ERROR,
      500
    );
  }
}

/**
 * 将文本块流式传输到响应流
 */
async function pipeChunksToStream(writer, chunks, concurrency, voiceName, rate, pitch, style, outputFormat, env) {
  try {
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, i + concurrency);
      const audioPromises = batch.map(chunk =>
        getAudioChunk(chunk, voiceName, rate, pitch, style, outputFormat, env)
      );

      const audioBlobs = await Promise.all(audioPromises);

      for (const blob of audioBlobs) {
        const arrayBuffer = await blob.arrayBuffer();
        await writer.write(new Uint8Array(arrayBuffer));
      }

      log('info', `Streamed batch ${Math.floor(i / concurrency) + 1}`, {
        batchSize: batch.length,
        blobSizes: audioBlobs.map(b => b.size)
      });
    }
  } catch (error) {
    log('error', 'Stream processing failed', { error: error.message });
    throw new TTSError(
      `流式处理失败: ${error.message}`,
      ERROR_CODES.TTS_GENERATION_ERROR,
      500
    );
  } finally {
    try {
      await writer.close();
      log('info', 'Stream writer closed successfully');
    } catch (e) {
      log('warn', 'Failed to close stream writer', { error: e.message });
    }
  }
}

/**
 * 生成 SSML 文档
 */
function generateSSML(text, voiceName, rate, pitch, style) {
  if (!text || !voiceName) {
    throw new TTSError("文本和语音名称不能为空", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  const breakTagRegex = /<break\s+time="[^"]*"\s*\/?>|<break\s*\/?>|<break\s+time='[^']*'\s*\/?>/gi;
  const breakTags = [];
  let processedText = text.replace(breakTagRegex, (match) => {
    const placeholder = `__BREAK_TAG_${breakTags.length}__`;
    breakTags.push(match);
    return placeholder;
  });

  const sanitizedText = processedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  let finalText = sanitizedText;
  breakTags.forEach((tag, index) => {
    finalText = finalText.replace(`__BREAK_TAG_${index}__`, tag);
  });

  const safeRate = validatePercentage(rate, "rate");
  const safePitch = validatePercentage(pitch, "pitch");
  const safeStyle = style || "general";

  return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="en-US">
    <voice name="${voiceName}">
      <mstts:express-as style="${safeStyle}">
        <prosody rate="${safeRate}%" pitch="${safePitch}%">${finalText}</prosody>
      </mstts:express-as>
    </voice>
  </speak>`;
}

/**
 * 验证百分比值
 */
function validatePercentage(value, paramName) {
  const numValue = Number(value);
  if (isNaN(numValue)) {
    log('warn', `Invalid ${paramName} value, using 0`, { value });
    return "0";
  }

  const clampedValue = Math.max(-100, Math.min(100, numValue));
  if (clampedValue !== numValue) {
    log('warn', `${paramName} value clamped`, { original: numValue, clamped: clampedValue });
  }

  return clampedValue.toFixed(0);
}

// =================================================================================
// 主要请求处理逻辑
// =================================================================================

/**
 * 解析最终使用的语音
 */
function resolveVoice(model, voice, detectedLanguage) {
  if (voice) {
    if (MICROSOFT_VOICES[voice]) {
      return voice;
    }
    log('warn', 'Specified voice not found, falling back to model mapping', { voice });
  }

  const modelVoice = OPENAI_VOICE_MAP[model.replace('tts-1-', '')];
  if (modelVoice) {
    return modelVoice;
  }

  if (detectedLanguage === 'en-US') {
    return 'en-US-JennyNeural';
  } else {
    return 'zh-CN-XiaoxiaoNeural';
  }
}

/**
 * 处理语音合成请求
 */
async function handleSpeechRequest(request, env) {
  if (request.method !== "POST") {
    return errorResponse("不允许的方法", 405, ERROR_CODES.INVALID_REQUEST);
  }

  let requestBody;
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return errorResponse(`Content-Type 错误: 期望 application/json，实际 ${contentType || 'undefined'}`, 400, ERROR_CODES.INVALID_REQUEST);
    }

    const text = await request.text();
    if (!text || text.trim() === '') {
      return errorResponse("请求体为空", 400, ERROR_CODES.INVALID_REQUEST);
    }

    try {
      requestBody = JSON.parse(text);
    } catch (parseError) {
      return errorResponse(`JSON 解析错误: ${parseError.message}. 请求内容前100字符: ${text.substring(0, 100)}`, 400, ERROR_CODES.INVALID_REQUEST);
    }
  } catch (err) {
    return errorResponse(`请求处理错误: ${err.message}`, 400, ERROR_CODES.INVALID_REQUEST);
  }

  // 参数验证
  validateParams(requestBody, {
    input: { required: true, type: 'string', minLength: 1, maxLength: DEFAULT_CONFIG.MAX_TEXT_LENGTH },
    model: { type: 'string' },
    voice: { type: 'string' },
    speed: { type: 'number', min: 0.25, max: 2.0 },
    pitch: { type: 'number', min: 0.5, max: 1.5 },
    style: { type: 'string' },
    stream: { type: 'boolean' },
    concurrency: { type: 'number', min: 1, max: DEFAULT_CONFIG.MAX_CONCURRENT_REQUESTS },
    chunk_size: { type: 'number', min: 50, max: 1000 }
  });

  const {
    model = "tts-1",
    input,
    voice,
    speed = 1.0,
    pitch = 1.0,
    style = "general",
    stream = false,
    concurrency = DEFAULT_CONFIG.CONCURRENCY,
    chunk_size = DEFAULT_CONFIG.CHUNK_SIZE,
    cleaning_options = {},
    response_format = DEFAULT_CONFIG.OUTPUT_FORMAT
  } = requestBody;

  // 验证和清理输入文本
  validateText(input);
  const cleanedInput = cleanText(input, cleaning_options);

  // 检测语言并记录
  const detectedLanguage = detectLanguage(cleanedInput);
  log('info', 'Processing TTS request', {
    textLength: input.length,
    cleanedLength: cleanedInput.length,
    detectedLanguage,
    model,
    voice: voice || 'auto',
    stream,
    estimatedDuration: estimateAudioDuration(cleanedInput, speed)
  });

  // 语音映射处理
  const finalVoice = resolveVoice(model, voice, detectedLanguage);

  // 参数转换为 Microsoft TTS 格式
  const rate = ((speed - 1) * 100).toFixed(0);
  const finalPitch = ((pitch - 1) * 100).toFixed(0);
  const outputFormat = response_format || DEFAULT_CONFIG.OUTPUT_FORMAT;

  // 智能文本分块
  const textChunks = smartChunkText(cleanedInput, chunk_size);

  log('info', 'Text chunking completed', {
    originalLength: cleanedInput.length,
    chunkCount: textChunks.length,
    averageChunkSize: Math.round(textChunks.reduce((sum, chunk) => sum + chunk.length, 0) / textChunks.length)
  });

  // 根据是否流式选择处理方式
  if (stream) {
    return await streamVoice(textChunks, concurrency, finalVoice, rate, finalPitch, style, outputFormat, env);
  } else {
    return await getVoice(textChunks, concurrency, finalVoice, rate, finalPitch, style, outputFormat, env);
  }
}

/**
 * 异步错误处理包装器
 */
function asyncErrorHandler(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      log('error', 'Request failed', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        ...(error.details && { details: error.details })
      });

      return errorResponse(error);
    }
  };
}

// =================================================================================
// 主入口点
// =================================================================================

/**
 * 处理 /api/v1/audio/speech 请求
 */
export default asyncErrorHandler(async function onRequest(context) {
  const { request, env } = context;

  // 处理 CORS 预检请求
  if (request.method === "OPTIONS") {
    return handleOptions();
  }

  // API 密钥验证
  if (env.API_KEY) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== env.API_KEY) {
      return errorResponse("无效的 API 密钥", 401, ERROR_CODES.INVALID_API_KEY);
    }
  }

  return await handleSpeechRequest(request, env);
});