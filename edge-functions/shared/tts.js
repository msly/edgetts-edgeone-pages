/**
 * TTS 核心处理模块
 * 优化的文本转语音逻辑，支持流式和批量处理
 */

import { DEFAULT_CONFIG, API_ENDPOINTS } from './config.js';
import { TTSError, streamResponse, log } from './errors.js';
import { getEndpoint } from './auth.js';

/**
 * 获取语音音频块
 * @param {string} text - 文本内容
 * @param {string} voiceName - 语音名称
 * @param {string} rate - 语速百分比
 * @param {string} pitch - 音调百分比
 * @param {string} style - 语音风格
 * @param {string} outputFormat - 输出格式
 * @param {Object} env - 环境变量
 * @returns {Promise<Blob>} 音频 Blob
 */
export async function getAudioChunk(text, voiceName, rate, pitch, style, outputFormat, env = {}) {
  if (!text || !text.trim()) {
    throw new TTSError("文本内容不能为空", 'validation_error', 400);
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
      const errorText = await response.text();
      throw new TTSError(
        `Edge TTS API 错误: ${response.status} ${response.statusText} - ${errorText}`,
        'tts_generation_error',
        response.status
      );
    }

    const blob = await response.blob();
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
      'tts_generation_error',
      500,
      { originalError: error.message }
    );
  }
}

/**
 * 流式语音生成
 * @param {string[]} textChunks - 文本块数组
 * @param {number} concurrency - 并发数
 * @param {string} voiceName - 语音名称
 * @param {string} rate - 语速
 * @param {string} pitch - 音调
 * @param {string} style - 风格
 * @param {string} outputFormat - 输出格式
 * @param {Object} env - 环境变量
 * @returns {Promise<Response>} 流式音频响应
 */
export async function streamVoice(textChunks, concurrency, voiceName, rate, pitch, style, outputFormat, env = {}) {
  if (!textChunks || textChunks.length === 0) {
    throw new TTSError("文本块不能为空", 'validation_error', 400);
  }

  log('info', 'Starting streaming voice generation', {
    chunkCount: textChunks.length,
    concurrency,
    voice: voiceName
  });

  const { readable, writable } = new TransformStream();

  try {
    // 异步处理流式管道
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

    return streamResponse(readable, "audio/mpeg");
  } catch (error) {
    throw new TTSError(
      `流式 TTS 失败: ${error.message}`,
      'tts_generation_error',
      500
    );
  }
}

/**
 * 非流式语音生成
 * @param {string[]} textChunks - 文本块数组
 * @param {number} concurrency - 并发数
 * @param {string} voiceName - 语音名称
 * @param {string} rate - 语速
 * @param {string} pitch - 音调
 * @param {string} style - 风格
 * @param {string} outputFormat - 输出格式
 * @param {Object} env - 环境变量
 * @returns {Promise<Response>} 完整音频响应
 */
export async function getVoice(textChunks, concurrency, voiceName, rate, pitch, style, outputFormat, env = {}) {
  if (!textChunks || textChunks.length === 0) {
    throw new TTSError("文本块不能为空", 'validation_error', 400);
  }

  log('info', 'Starting batch voice generation', {
    chunkCount: textChunks.length,
    concurrency,
    voice: voiceName
  });

  try {
    const audioBlobs = [];

    // 分批处理文本块以避免超出 EdgeOne 子请求限制
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

    // 合并所有音频块
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
      'tts_generation_error',
      500
    );
  }
}

/**
 * 将文本块流式传输到响应流
 * @param {WritableStreamDefaultWriter} writer - 写入器
 * @param {string[]} chunks - 文本块
 * @param {number} concurrency - 并发数
 * @param {string} voiceName - 语音名称
 * @param {string} rate - 语速
 * @param {string} pitch - 音调
 * @param {string} style - 风格
 * @param {string} outputFormat - 输出格式
 * @param {Object} env - 环境变量
 */
async function pipeChunksToStream(writer, chunks, concurrency, voiceName, rate, pitch, style, outputFormat, env) {
  try {
    // 分批处理文本块以避免超出 EdgeOne 子请求限制
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, i + concurrency);
      const audioPromises = batch.map(chunk =>
        getAudioChunk(chunk, voiceName, rate, pitch, style, outputFormat, env)
      );

      // 等待当前批次完成
      const audioBlobs = await Promise.all(audioPromises);

      // 将音频数据写入流
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
      'tts_generation_error',
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
 * 生成 SSML (Speech Synthesis Markup Language) 文档
 * @param {string} text - 文本内容
 * @param {string} voiceName - 语音名称
 * @param {string} rate - 语速百分比
 * @param {string} pitch - 音调百分比
 * @param {string} style - 语音风格
 * @returns {string} SSML 文档
 */
export function generateSSML(text, voiceName, rate, pitch, style) {
  if (!text || !voiceName) {
    throw new TTSError("文本和语音名称不能为空", 'validation_error', 400);
  }

  // 保护 break 标签不被转义
  const breakTagRegex = /<break\s+time="[^"]*"\s*\/?>|<break\s*\/?>|<break\s+time='[^']*'\s*\/?>/gi;
  const breakTags = [];
  let processedText = text.replace(breakTagRegex, (match) => {
    const placeholder = `__BREAK_TAG_${breakTags.length}__`;
    breakTags.push(match);
    return placeholder;
  });

  // 转义其他 XML 特殊字符
  const sanitizedText = processedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 恢复 break 标签
  let finalText = sanitizedText;
  breakTags.forEach((tag, index) => {
    finalText = finalText.replace(`__BREAK_TAG_${index}__`, tag);
  });

  // 确保速率和音调值格式正确
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
 * @param {string|number} value - 百分比值
 * @param {string} paramName - 参数名称
 * @returns {string} 验证后的百分比值
 */
function validatePercentage(value, paramName) {
  const numValue = Number(value);
  if (isNaN(numValue)) {
    log('warn', `Invalid ${paramName} value, using 0`, { value });
    return "0";
  }

  // 限制范围，避免极端值
  const clampedValue = Math.max(-100, Math.min(100, numValue));
  if (clampedValue !== numValue) {
    log('warn', `${paramName} value clamped`, { original: numValue, clamped: clampedValue });
  }

  return clampedValue.toFixed(0);
}

/**
 * 预估音频时长（用于监控和优化）
 * @param {string} text - 文本内容
 * @param {number} rate - 语速倍率
 * @returns {number} 预估时长（秒）
 */
export function estimateAudioDuration(text, rate = 1.0) {
  // 基于经验值：中文大约每分钟300字，英文每分钟150词
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;

  const chineseDuration = chineseChars / (300 / 60); // 中文字符时长
  const englishDuration = englishWords / (150 / 60);  // 英文单词时长

  const baseDuration = chineseDuration + englishDuration;
  return Math.max(1, baseDuration / rate); // 最少1秒
}

/**
 * 获取音频生成统计信息
 * @param {string[]} textChunks - 文本块数组
 * @param {number} rate - 语速倍率
 * @returns {Object} 统计信息
 */
export function getGenerationStats(textChunks, rate = 1.0) {
  const totalChars = textChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const estimatedDuration = estimateAudioDuration(textChunks.join(''), rate);

  return {
    chunkCount: textChunks.length,
    totalCharacters: totalChars,
    estimatedDurationSeconds: estimatedDuration,
    estimatedFileSizeMB: estimatedDuration * 0.5 // 大约每秒0.5MB (48kbps MP3)
  };
}