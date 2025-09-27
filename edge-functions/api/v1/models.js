/**
 * EdgeOne Pages Edge Function for /api/v1/models
 * 处理模型列表请求 - 重构版
 */

import { OPENAI_VOICE_MAP, MICROSOFT_VOICES } from '../../shared/config.js';
import {
  errorResponse,
  handleOptions,
  successResponse,
  asyncErrorHandler,
  log
} from '../../shared/errors.js';

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
      return errorResponse("无效的 API 密钥", 401, "invalid_api_key");
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