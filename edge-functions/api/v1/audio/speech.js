/**
 * EdgeOne Pages Edge Function - Microsoft Edge TTS 服务代理
 *
 * @version 3.0.0 (重构版)
 * @description 完全重构的 TTS 服务，采用模块化架构，提升代码质量和可维护性
 *
 * @features
 * - 模块化架构，更好的代码组织
 * - 增强的错误处理和日志记录
 * - 统一的配置管理
 * - 更好的安全性和性能
 * - 兼容 OpenAI TTS API 格式
 * - 支持更多语音模型
 */

import { OPENAI_VOICE_MAP, DEFAULT_CONFIG, MICROSOFT_VOICES } from '../../shared/config.js';
import {
  errorResponse,
  handleOptions,
  validateParams,
  asyncErrorHandler,
  log
} from '../../shared/errors.js';
import { smartChunkText, cleanText, validateText, detectLanguage } from '../../shared/text-utils.js';
import { streamVoice, getVoice, estimateAudioDuration } from '../../shared/tts.js';

/**
 * 处理 /api/v1/audio/speech 请求
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
      return errorResponse("无效的 API 密钥", 401, "invalid_api_key");
    }
  }

  return await handleSpeechRequest(request, env);
});

/**
 * 处理语音合成请求
 * @param {Request} request - HTTP 请求对象
 * @param {Object} env - 环境变量
 * @returns {Promise<Response>} 语音数据响应
 */
async function handleSpeechRequest(request, env) {
  if (request.method !== "POST") {
    return errorResponse("不允许的方法", 405, "method_not_allowed");
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (err) {
    return errorResponse(`JSON 解析错误: ${err.message}`, 400, "invalid_request_error");
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

  // 解析请求参数并设置默认值
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
 * 解析最终使用的语音
 * @param {string} model - 模型名称
 * @param {string} voice - 指定的语音
 * @param {string} detectedLanguage - 检测到的语言
 * @returns {string} 最终语音名称
 */
function resolveVoice(model, voice, detectedLanguage) {
  // 优先使用直接指定的语音
  if (voice) {
    if (MICROSOFT_VOICES[voice]) {
      return voice;
    }
    log('warn', 'Specified voice not found, falling back to model mapping', { voice });
  }

  // 从模型名称解析语音
  const modelVoice = OPENAI_VOICE_MAP[model.replace('tts-1-', '')];
  if (modelVoice) {
    return modelVoice;
  }

  // 根据检测到的语言选择默认语音
  if (detectedLanguage === 'en-US') {
    return 'en-US-JennyNeural';
  } else {
    return 'zh-CN-XiaoxiaoNeural'; // 默认中文语音
  }
}