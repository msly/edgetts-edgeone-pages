/**
 * EdgeOne Pages Edge Function for /api/v1/models
 * 处理模型列表请求 - 重构优化版 (单文件)
 */

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

// 错误码定义
const ERROR_CODES = {
  INVALID_REQUEST: "invalid_request_error",
  INVALID_API_KEY: "invalid_api_key",
  INTERNAL_SERVER_ERROR: "internal_server_error",
};

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
  let message, code;

  if (error instanceof Error) {
    message = error.message;
    code = type;
  } else {
    message = String(error);
    code = type;
  }

  const errorBody = {
    error: {
      message,
      type: code,
      code: null,
      ...(details && { details: details })
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
 * 成功响应辅助函数
 */
function successResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...makeCORSHeaders(),
      ...headers
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
        timestamp: new Date().toISOString()
      });

      return errorResponse(error);
    }
  };
}

/**
 * 处理 /api/v1/models 请求
 * @param {Object} context - EdgeOne Pages 上下文对象
 * @returns {Promise<Response>} HTTP 响应
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

  log('info', 'Processing models request');

  // 构建模型列表
  const models = [
    {
      id: 'tts-1',
      object: 'model',
      created: 1677610602,
      owned_by: 'openai'
    },
    {
      id: 'tts-1-hd',
      object: 'model',
      created: 1677610602,
      owned_by: 'openai'
    },
    // OpenAI 兼容模型
    ...Object.keys(OPENAI_VOICE_MAP).map(voice => ({
      id: `tts-1-${voice}`,
      object: 'model',
      created: 1677610602,
      owned_by: 'openai'
    })),
    // 扩展的微软语音模型
    ...Object.keys(MICROSOFT_VOICES)
      .filter(voice => !Object.values(OPENAI_VOICE_MAP).includes(voice))
      .map(voice => ({
        id: voice,
        object: 'model',
        created: 1677610602,
        owned_by: 'microsoft',
        description: MICROSOFT_VOICES[voice]
      }))
  ];

  log('info', 'Models list generated', { modelCount: models.length });

  return successResponse({
    object: "list",
    data: models
  });
});