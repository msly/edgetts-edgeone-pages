/**
 * 统一错误处理模块
 * 提供标准化的错误处理和响应格式
 */

import { ERROR_CODES } from './config.js';

/**
 * 自定义错误类
 */
export class TTSError extends Error {
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
 * 验证错误类
 */
export class ValidationError extends TTSError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * 认证错误类
 */
export class AuthenticationError extends TTSError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.INVALID_API_KEY, 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * 限流错误类
 */
export class RateLimitError extends TTSError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.RATE_LIMIT_EXCEEDED, 429, details);
    this.name = 'RateLimitError';
  }
}

/**
 * 生成 CORS 头
 * @param {string} allowedHeaders - 允许的请求头
 * @returns {Object} CORS 头对象
 */
export function makeCORSHeaders(allowedHeaders = "Content-Type, Authorization") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * 处理 CORS 预检请求
 * @param {string} allowedHeaders - 允许的请求头
 * @returns {Response} CORS 响应
 */
export function handleOptions(allowedHeaders = "Content-Type, Authorization") {
  return new Response(null, {
    status: 204,
    headers: makeCORSHeaders(allowedHeaders)
  });
}

/**
 * 生成标准化错误响应
 * @param {string|Error} error - 错误信息或错误对象
 * @param {number} status - HTTP 状态码
 * @param {string} type - 错误类型
 * @param {Object} details - 额外错误详情
 * @returns {Response} 错误响应
 */
export function errorResponse(error, status = 500, type = ERROR_CODES.INTERNAL_SERVER_ERROR, details = null) {
  let message, code, errorDetails;

  // 处理不同类型的错误输入
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
 * 成功响应辅助函数
 * @param {any} data - 响应数据
 * @param {number} status - HTTP 状态码
 * @param {Object} headers - 额外的响应头
 * @returns {Response} 成功响应
 */
export function successResponse(data, status = 200, headers = {}) {
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
 * 流式响应辅助函数
 * @param {ReadableStream} stream - 流数据
 * @param {string} contentType - 内容类型
 * @param {Object} headers - 额外的响应头
 * @returns {Response} 流式响应
 */
export function streamResponse(stream, contentType = "audio/mpeg", headers = {}) {
  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      ...makeCORSHeaders(),
      ...headers
    }
  });
}

/**
 * 参数验证辅助函数
 * @param {Object} params - 参数对象
 * @param {Object} rules - 验证规则
 * @throws {ValidationError} 验证失败时抛出
 */
export function validateParams(params, rules) {
  const errors = [];

  for (const [key, rule] of Object.entries(rules)) {
    const value = params[key];

    // 检查必需参数
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(`参数 '${key}' 是必需的`);
      continue;
    }

    // 如果参数不存在且不是必需的，跳过验证
    if (value === undefined || value === null) {
      continue;
    }

    // 类型验证
    if (rule.type && typeof value !== rule.type) {
      errors.push(`参数 '${key}' 类型错误，期望 ${rule.type}，实际 ${typeof value}`);
      continue;
    }

    // 长度验证
    if (rule.maxLength && String(value).length > rule.maxLength) {
      errors.push(`参数 '${key}' 长度超过限制 ${rule.maxLength}`);
    }

    if (rule.minLength && String(value).length < rule.minLength) {
      errors.push(`参数 '${key}' 长度不足 ${rule.minLength}`);
    }

    // 数值范围验证
    if (rule.min !== undefined && Number(value) < rule.min) {
      errors.push(`参数 '${key}' 值过小，最小值为 ${rule.min}`);
    }

    if (rule.max !== undefined && Number(value) > rule.max) {
      errors.push(`参数 '${key}' 值过大，最大值为 ${rule.max}`);
    }

    // 枚举值验证
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`参数 '${key}' 值无效，允许的值: ${rule.enum.join(', ')}`);
    }

    // 自定义验证函数
    if (rule.validate && typeof rule.validate === 'function') {
      const customError = rule.validate(value);
      if (customError) {
        errors.push(`参数 '${key}' 验证失败: ${customError}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError("参数验证失败", { validationErrors: errors });
  }
}

/**
 * 异步错误处理包装器
 * @param {Function} handler - 异步处理函数
 * @returns {Function} 包装后的处理函数
 */
export function asyncErrorHandler(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('[TTS Error]:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        ...(error.details && { details: error.details })
      });

      // 返回错误响应
      return errorResponse(error);
    }
  };
}

/**
 * 日志记录辅助函数
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {Object} meta - 元数据
 */
export function log(level, message, meta = {}) {
  const logEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };

  // 在生产环境中，这里可以集成到外部日志服务
  console[level === 'error' ? 'error' : 'log'](`[TTS ${level.toUpperCase()}]:`, logEntry);
}