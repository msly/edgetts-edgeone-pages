/**
 * 调试版本 - 添加大量日志输出来诊断问题
 * 将此文件重命名为 speech.js 并部署来获得详细的调试信息
 */

// 开启详细日志模式
const DEBUG_MODE = true;

function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
}

// 配置常量 (简化版用于调试)
const OPENAI_VOICE_MAP = {
  "shimmer": "zh-CN-XiaoxiaoNeural",
  "alloy": "zh-CN-YunyangNeural",
  "fable": "zh-CN-YunjianNeural",
  "onyx": "zh-CN-XiaoyiNeural",
  "nova": "zh-CN-YunxiNeural",
  "echo": "zh-CN-liaoning-XiaobeiNeural"
};

const DEFAULT_CONFIG = {
  CONCURRENCY: 10,
  CHUNK_SIZE: 300,
  MAX_TEXT_LENGTH: 120000,
  OUTPUT_FORMAT: "audio-24khz-48kbitrate-mono-mp3",
  TOKEN_REFRESH_BEFORE_EXPIRY: 5 * 60,
  TOKEN_RETRY_ATTEMPTS: 3,
  TOKEN_RETRY_DELAY: 1000
};

const ERROR_CODES = {
  INVALID_REQUEST: "invalid_request_error",
  INVALID_API_KEY: "invalid_api_key",
  VALIDATION_ERROR: "validation_error",
  TTS_GENERATION_ERROR: "tts_generation_error",
  INTERNAL_SERVER_ERROR: "internal_server_error",
  TOKEN_ACQUISITION_FAILED: "token_acquisition_failed"
};

// 简化的错误处理
function makeCORSHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function handleOptions() {
  debugLog('处理 OPTIONS 请求');
  return new Response(null, {
    status: 204,
    headers: makeCORSHeaders()
  });
}

function errorResponse(message, status = 500, type = ERROR_CODES.INTERNAL_SERVER_ERROR) {
  debugLog('生成错误响应:', { message, status, type });
  return new Response(JSON.stringify({
    error: { message, type, code: null }
  }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...makeCORSHeaders()
    }
  });
}

// 简化的主函数 - 只做基础验证
export default async function onRequest(context) {
  debugLog('收到请求');

  try {
    const { request, env } = context;
    debugLog('请求方法:', request.method);

    // 处理 CORS 预检请求
    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    // API 密钥验证
    if (env.API_KEY) {
      const authHeader = request.headers.get("authorization");
      debugLog('Authorization 头:', authHeader ? '存在' : '不存在');

      if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== env.API_KEY) {
        return errorResponse("无效的 API 密钥", 401, ERROR_CODES.INVALID_API_KEY);
      }
    }

    // 检查请求方法
    if (request.method !== "POST") {
      return errorResponse("不允许的方法", 405, ERROR_CODES.INVALID_REQUEST);
    }

    // 检查 Content-Type
    const contentType = request.headers.get('content-type');
    debugLog('Content-Type:', contentType);

    if (!contentType || !contentType.includes('application/json')) {
      return errorResponse(`Content-Type 错误: 期望 application/json，实际 ${contentType || 'undefined'}`, 400, ERROR_CODES.INVALID_REQUEST);
    }

    // 读取请求体
    let text;
    try {
      text = await request.text();
      debugLog('请求体长度:', text.length);
      debugLog('请求体前100字符:', text.substring(0, 100));
    } catch (textError) {
      debugLog('读取请求体失败:', textError.message);
      return errorResponse(`请求体读取失败: ${textError.message}`, 400, ERROR_CODES.INVALID_REQUEST);
    }

    if (!text || text.trim() === '') {
      return errorResponse("请求体为空", 400, ERROR_CODES.INVALID_REQUEST);
    }

    // 解析 JSON
    let requestBody;
    try {
      requestBody = JSON.parse(text);
      debugLog('JSON 解析成功:', Object.keys(requestBody));
    } catch (parseError) {
      debugLog('JSON 解析失败:', parseError.message);
      return errorResponse(`JSON 解析错误: ${parseError.message}`, 400, ERROR_CODES.INVALID_REQUEST);
    }

    // 检查必需参数
    if (!requestBody.input) {
      return errorResponse("'input' 是必需参数", 400, ERROR_CODES.VALIDATION_ERROR);
    }

    debugLog('输入文本长度:', requestBody.input.length);
    debugLog('请求的语音:', requestBody.voice || '未指定');

    // 如果到这里都没问题，返回一个测试响应
    return new Response(JSON.stringify({
      status: "success",
      message: "调试模式：请求处理成功",
      receivedParams: {
        input: requestBody.input.substring(0, 50) + (requestBody.input.length > 50 ? '...' : ''),
        voice: requestBody.voice,
        stream: requestBody.stream,
        inputLength: requestBody.input.length
      }
    }), {
      headers: {
        "Content-Type": "application/json",
        ...makeCORSHeaders()
      }
    });

  } catch (error) {
    debugLog('未捕获的错误:', error.message, error.stack);
    return errorResponse(`服务器错误: ${error.message}`, 500, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
}