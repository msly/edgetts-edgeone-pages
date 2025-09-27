/**
 * EdgeOne Pages Edge Function - Microsoft Edge TTS 服务代理
 *
 * 最简化版本 - 专注于核心功能，移除可能导致问题的复杂特性
 */

// OpenAI 语音映射到 Microsoft 语音
const OPENAI_VOICE_MAP = {
  "shimmer": "zh-CN-XiaoxiaoNeural",
  "alloy": "zh-CN-YunyangNeural",
  "fable": "zh-CN-YunjianNeural",
  "onyx": "zh-CN-XiaoyiNeural",
  "nova": "zh-CN-YunxiNeural",
  "echo": "zh-CN-liaoning-XiaobeiNeural"
};

// 基本配置
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_CHUNK_SIZE = 300;

// Token 缓存
let tokenInfo = { endpoint: null, token: null, expiredAt: null };

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
function handleOptions(request) {
  const headers = makeCORSHeaders(request.headers.get("Access-Control-Request-Headers"));
  return new Response(null, { status: 204, headers });
}

/**
 * 生成错误响应
 */
function errorResponse(message, status = 500, type = "internal_server_error") {
  return new Response(JSON.stringify({
    error: { message, type, code: null }
  }), {
    status,
    headers: { "Content-Type": "application/json", ...makeCORSHeaders() }
  });
}

/**
 * 获取微软端点和Token
 */
async function getEndpoint() {
  const now = Date.now() / 1000;

  // 检查Token是否有效
  if (tokenInfo.token && tokenInfo.expiredAt && now < tokenInfo.expiredAt - 300) {
    return tokenInfo.endpoint;
  }

  const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
  let clientId;

  try {
    clientId = crypto.randomUUID().replace(/-/g, "");
  } catch (e) {
    clientId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  const signature = await sign(endpointUrl);

  const response = await fetch(endpointUrl, {
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
    }
  });

  if (!response.ok) {
    throw new Error(`获取端点失败: ${response.status}`);
  }

  const data = await response.json();

  // 解析Token过期时间
  let expiredAt;
  try {
    const jwt = data.t.split(".")[1];
    const decoded = typeof atob !== 'undefined' ? atob(jwt) : base64Decode(jwt);
    const decodedJwt = JSON.parse(decoded);
    expiredAt = decodedJwt.exp || (Date.now() / 1000 + 3600);
  } catch (e) {
    expiredAt = Date.now() / 1000 + 3600;
  }

  tokenInfo = {
    endpoint: data,
    token: data.t,
    expiredAt
  };

  return data;
}

/**
 * 生成签名
 */
async function sign(urlStr) {
  const url = urlStr.split("://")[1];
  const encodedUrl = encodeURIComponent(url);

  let uuidStr;
  try {
    uuidStr = crypto.randomUUID().replace(/-/g, "");
  } catch (e) {
    uuidStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  const formattedDate = (new Date()).toUTCString().replace(/GMT/, "").trim() + " GMT";
  const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();

  const decode = await base64ToBytes("oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==");
  const signData = await hmacSha256(decode, bytesToSign);
  const signBase64 = await bytesToBase64(signData);

  return `MSTranslatorAndroidApp::${signBase64}::${formattedDate}::${uuidStr}`;
}

/**
 * HMAC-SHA256 签名
 */
async function hmacSha256(key, data) {
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
}

/**
 * Base64 字符串转字节数组
 */
async function base64ToBytes(base64) {
  const padding = 4 - (base64.length % 4);
  const paddedBase64 = base64 + "=".repeat(padding % 4);

  if (typeof atob !== 'undefined') {
    const binary = atob(paddedBase64);
    return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)));
  } else {
    return new Uint8Array(base64Decode(paddedBase64).split('').map(char => char.charCodeAt(0)));
  }
}

/**
 * 字节数组转 Base64 字符串
 */
async function bytesToBase64(bytes) {
  if (typeof btoa !== 'undefined') {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  } else {
    return base64Encode(String.fromCharCode(...bytes));
  }
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

/**
 * 智能文本分块
 */
function smartChunkText(text, maxChunkLength) {
  if (!text) return [];

  const chunks = [];
  let currentChunk = "";

  const sentences = text.split(/([.?!,;:\n。？！，；：\r]+)/g);

  for (const part of sentences) {
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

  if (chunks.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += maxChunkLength) {
      chunks.push(text.substring(i, i + maxChunkLength));
    }
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * 生成 SSML
 */
function getSsml(text, voiceName, rate, pitch, style) {
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
    .replace(/>/g, '&gt;');

  let finalText = sanitizedText;
  breakTags.forEach((tag, index) => {
    finalText = finalText.replace(`__BREAK_TAG_${index}__`, tag);
  });

  return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="en-US">
    <voice name="${voiceName}">
      <mstts:express-as style="${style}">
        <prosody rate="${rate}%" pitch="${pitch}%">${finalText}</prosody>
      </mstts:express-as>
    </voice>
  </speak>`;
}

/**
 * 获取音频块
 */
async function getAudioChunk(text, voiceName, rate, pitch, style, outputFormat) {
  const endpoint = await getEndpoint();
  const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = getSsml(text, voiceName, rate, pitch, style);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": endpoint.t,
      "Content-Type": "application/ssml+xml",
      "User-Agent": "okhttp/4.5.0",
      "X-Microsoft-OutputFormat": outputFormat
    },
    body: ssml
  });

  if (!response.ok) {
    throw new Error(`TTS API 错误: ${response.status}`);
  }

  return response.blob();
}

/**
 * 流式语音生成
 */
async function streamVoice(textChunks, concurrency, ...ttsArgs) {
  const { readable, writable } = new TransformStream();

  pipeChunksToStream(writable.getWriter(), textChunks, concurrency, ...ttsArgs)
    .catch(() => {});

  return new Response(readable, {
    headers: { "Content-Type": "audio/mpeg", ...makeCORSHeaders() }
  });
}

/**
 * 将文本块流式传输到响应流
 */
async function pipeChunksToStream(writer, chunks, concurrency, ...ttsArgs) {
  try {
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, i + concurrency);
      const audioPromises = batch.map(chunk => getAudioChunk(chunk, ...ttsArgs));
      const audioBlobs = await Promise.all(audioPromises);

      for (const blob of audioBlobs) {
        const arrayBuffer = await blob.arrayBuffer();
        await writer.write(new Uint8Array(arrayBuffer));
      }
    }
  } finally {
    try {
      await writer.close();
    } catch (e) {
      // 忽略关闭错误
    }
  }
}

/**
 * 非流式语音生成
 */
async function getVoice(textChunks, concurrency, ...ttsArgs) {
  const audioBlobs = [];

  for (let i = 0; i < textChunks.length; i += concurrency) {
    const batch = textChunks.slice(i, i + concurrency);
    const audioPromises = batch.map(chunk => getAudioChunk(chunk, ...ttsArgs));
    const batchBlobs = await Promise.all(audioPromises);
    audioBlobs.push(...batchBlobs);
  }

  const combinedBlob = new Blob(audioBlobs, { type: "audio/mpeg" });
  return new Response(combinedBlob, {
    headers: { "Content-Type": "audio/mpeg", ...makeCORSHeaders() }
  });
}

/**
 * 处理语音合成请求
 */
async function handleSpeechRequest(request) {
  if (request.method !== "POST") {
    return errorResponse("不允许的方法", 405, "method_not_allowed");
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (err) {
    return errorResponse(`JSON 解析错误: ${err.message}`, 400, "invalid_request_error");
  }

  if (!requestBody.input) {
    return errorResponse("'input' 是必需参数", 400, "invalid_request_error");
  }

  // 解析参数
  const {
    model = "tts-1",
    input,
    voice = "shimmer",
    speed = 1.0,
    pitch = 1.0,
    style = "general",
    stream = false,
    concurrency = DEFAULT_CONCURRENCY,
    chunk_size = DEFAULT_CHUNK_SIZE
  } = requestBody;

  // 语音映射
  const modelVoice = !voice ? OPENAI_VOICE_MAP[model.replace('tts-1-', '')] : null;
  const finalVoice = modelVoice || voice;

  if (!finalVoice) {
    return errorResponse(`无效的语音模型`, 400, "invalid_request_error");
  }

  // 参数转换
  const rate = ((speed - 1) * 100).toFixed(0);
  const finalPitch = ((pitch - 1) * 100).toFixed(0);
  const outputFormat = "audio-24khz-48kbitrate-mono-mp3";

  // 文本分块
  const textChunks = smartChunkText(input, chunk_size);
  const ttsArgs = [finalVoice, rate, finalPitch, style, outputFormat];

  // 选择处理方式
  if (stream) {
    return await streamVoice(textChunks, concurrency, ...ttsArgs);
  } else {
    return await getVoice(textChunks, concurrency, ...ttsArgs);
  }
}

/**
 * 主入口点
 */
export default async function onRequest(context) {
  const request = context.request;

  // 处理 CORS 预检请求
  if (request.method === "OPTIONS") return handleOptions(request);

  // API 密钥验证
  const API_KEY = context.env.API_KEY;
  if (API_KEY) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== API_KEY) {
      return errorResponse("无效的 API 密钥", 401, "invalid_api_key");
    }
  }

  try {
    return await handleSpeechRequest(request);
  } catch (err) {
    return errorResponse(`语音合成请求失败: ${err.message}`, 500, "internal_server_error");
  }
}