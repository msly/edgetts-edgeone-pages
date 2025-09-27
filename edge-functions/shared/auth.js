/**
 * 认证和签名模块
 * 处理微软服务的认证和Token管理
 */

import { DEFAULT_CONFIG, API_ENDPOINTS, FALLBACK_SIGNING_KEY } from './config.js';
import { TTSError, log } from './errors.js';

// Token 缓存
let tokenCache = {
  endpoint: null,
  token: null,
  expiredAt: null,
  retryCount: 0
};

/**
 * 获取微软 TTS 服务端点和 Token
 * @param {Object} env - 环境变量对象
 * @returns {Promise<Object>} 端点信息对象 {r: region, t: token}
 */
export async function getEndpoint(env = {}) {
  const now = Date.now() / 1000;

  // 检查 Token 是否仍然有效
  if (tokenCache.token && tokenCache.expiredAt &&
    now < tokenCache.expiredAt - DEFAULT_CONFIG.TOKEN_REFRESH_BEFORE_EXPIRY) {
    log('info', 'Using cached token', { expiredAt: tokenCache.expiredAt });
    return tokenCache.endpoint;
  }

  // 重置重试计数
  if (tokenCache.expiredAt && now >= tokenCache.expiredAt) {
    tokenCache.retryCount = 0;
  }

  // 检查重试次数
  if (tokenCache.retryCount >= DEFAULT_CONFIG.TOKEN_RETRY_ATTEMPTS) {
    throw new TTSError(
      `Token获取失败，已达到最大重试次数 ${DEFAULT_CONFIG.TOKEN_RETRY_ATTEMPTS}`,
      'token_acquisition_failed',
      503
    );
  }

  try {
    const endpoint = await fetchNewToken(env);
    tokenCache.retryCount = 0; // 成功后重置重试计数
    log('info', 'Successfully acquired new token', { region: endpoint.r });
    return endpoint;
  } catch (error) {
    tokenCache.retryCount++;
    log('error', 'Token acquisition failed', {
      attempt: tokenCache.retryCount,
      maxAttempts: DEFAULT_CONFIG.TOKEN_RETRY_ATTEMPTS,
      error: error.message
    });

    // 如果还有重试机会，等待一段时间后重试
    if (tokenCache.retryCount < DEFAULT_CONFIG.TOKEN_RETRY_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, DEFAULT_CONFIG.TOKEN_RETRY_DELAY));
      return getEndpoint(env);
    }

    throw error;
  }
}

/**
 * 获取新的Token
 * @param {Object} env - 环境变量对象
 * @returns {Promise<Object>} 端点信息对象
 */
async function fetchNewToken(env) {
  let clientId;
  try {
    clientId = crypto.randomUUID().replace(/-/g, "");
  } catch (e) {
    // 如果 crypto.randomUUID 不可用，使用备用方法
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
      const errorText = await response.text();
      throw new TTSError(
        `获取端点失败: ${response.status} ${response.statusText} - ${errorText}`,
        'token_acquisition_failed',
        response.status
      );
    }

    const data = await response.json();

    // 解析 JWT Token 获取过期时间
    const expiredAt = parseJWTExpiration(data.t);

    // 更新缓存
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
      'token_acquisition_failed',
      503,
      { originalError: error.message }
    );
  }
}

/**
 * 解析JWT Token的过期时间
 * @param {string} token - JWT Token
 * @returns {number} 过期时间戳
 */
function parseJWTExpiration(token) {
  try {
    const jwt = token.split(".")[1];
    let decoded;

    // 尝试多种 base64 解码方式
    if (typeof atob !== 'undefined') {
      decoded = atob(jwt);
    } else {
      decoded = base64Decode(jwt);
    }

    const decodedJwt = JSON.parse(decoded);
    return decodedJwt.exp || (Date.now() / 1000 + 3600); // 默认1小时后过期
  } catch (e) {
    log('warn', 'JWT parsing failed, using default expiration', { error: e.message });
    return Date.now() / 1000 + 3600; // 默认1小时后过期
  }
}

/**
 * 生成微软 Translator 签名
 * @param {string} urlStr - 要签名的 URL
 * @param {Object} env - 环境变量对象
 * @returns {Promise<string>} 签名字符串
 */
export async function sign(urlStr, env = {}) {
  const url = urlStr.split("://")[1];
  const encodedUrl = encodeURIComponent(url);

  let uuidStr;
  try {
    uuidStr = crypto.randomUUID().replace(/-/g, "");
  } catch (e) {
    uuidStr = generateRandomId();
  }

  const formattedDate = new Date().toUTCString().replace(/GMT/, "").trim() + " GMT";

  // 构建待签名字符串
  const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();

  // 获取签名密钥（优先使用环境变量）
  const signingKey = env.MS_SIGNING_KEY || FALLBACK_SIGNING_KEY;

  if (env.MS_SIGNING_KEY) {
    log('info', 'Using signing key from environment variable');
  } else {
    log('warn', 'Using fallback signing key, consider setting MS_SIGNING_KEY environment variable');
  }

  // 解码密钥并生成 HMAC 签名
  const keyBytes = await base64ToBytes(signingKey);
  const signData = await hmacSha256(keyBytes, bytesToSign);
  const signBase64 = await bytesToBase64(signData);

  return `MSTranslatorAndroidApp::${signBase64}::${formattedDate}::${uuidStr}`;
}

/**
 * HMAC-SHA256 签名
 * @param {Uint8Array} key - 密钥
 * @param {string} data - 待签名数据
 * @returns {Promise<Uint8Array>} 签名结果
 */
async function hmacSha256(key, data) {
  if (!crypto || !crypto.subtle) {
    throw new TTSError(
      "crypto.subtle API 不可用，EdgeOne Pages 环境可能不支持此功能",
      'internal_server_error',
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
      'internal_server_error',
      500,
      { stack: e.stack }
    );
  }
}

/**
 * Base64 字符串转字节数组
 * @param {string} base64 - Base64 字符串
 * @returns {Promise<Uint8Array>} 字节数组
 */
async function base64ToBytes(base64) {
  try {
    // 添加填充字符
    const padding = 4 - (base64.length % 4);
    const paddedBase64 = base64 + "=".repeat(padding % 4);

    if (typeof atob !== 'undefined') {
      const binary = atob(paddedBase64);
      return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)));
    } else {
      // 手动解码
      return new Uint8Array(base64Decode(paddedBase64).split('').map(char => char.charCodeAt(0)));
    }
  } catch (e) {
    throw new TTSError(
      `Base64 解码失败: ${e.message}`,
      'internal_server_error',
      500
    );
  }
}

/**
 * 字节数组转 Base64 字符串
 * @param {Uint8Array} bytes - 字节数组
 * @returns {Promise<string>} Base64 字符串
 */
async function bytesToBase64(bytes) {
  try {
    if (typeof btoa !== 'undefined') {
      const binary = String.fromCharCode(...bytes);
      return btoa(binary);
    } else {
      // 手动编码
      return base64Encode(String.fromCharCode(...bytes));
    }
  } catch (e) {
    throw new TTSError(
      `Base64 编码失败: ${e.message}`,
      'internal_server_error',
      500
    );
  }
}

/**
 * 生成随机ID（crypto.randomUUID的备用方案）
 * @returns {string} 随机ID
 */
function generateRandomId() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * 手动 Base64 解码
 * @param {string} base64 - Base64 字符串
 * @returns {string} 解码后的字符串
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
 * @param {string} str - 待编码字符串
 * @returns {string} Base64 字符串
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

  // 添加填充
  while (result.length % 4 !== 0) {
    result += '=';
  }

  return result;
}

/**
 * 清除Token缓存（用于测试或强制刷新）
 */
export function clearTokenCache() {
  tokenCache = {
    endpoint: null,
    token: null,
    expiredAt: null,
    retryCount: 0
  };
  log('info', 'Token cache cleared');
}

/**
 * 获取Token缓存状态
 * @returns {Object} 缓存状态信息
 */
export function getTokenCacheStatus() {
  const now = Date.now() / 1000;
  return {
    hasToken: !!tokenCache.token,
    isValid: tokenCache.expiredAt && now < tokenCache.expiredAt - DEFAULT_CONFIG.TOKEN_REFRESH_BEFORE_EXPIRY,
    expiredAt: tokenCache.expiredAt ? new Date(tokenCache.expiredAt * 1000).toISOString() : null,
    retryCount: tokenCache.retryCount
  };
}