/**
 * 文本处理工具模块
 * 提供智能文本分块、清理和验证功能
 */

import { DEFAULT_CONFIG, DEFAULT_CLEANING_OPTIONS } from './config.js';
import { ValidationError, log } from './errors.js';

/**
 * 智能文本分块 - 按句子边界分割文本
 * @param {string} text - 输入文本
 * @param {number} maxChunkLength - 最大分块长度
 * @returns {string[]} 文本块数组
 */
export function smartChunkText(text, maxChunkLength = DEFAULT_CONFIG.CHUNK_SIZE) {
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

  // 定义句子分隔符（支持中英文标点）
  const sentenceBoundaries = /([.?!,;:\n。？！，；：\r]+)/g;

  // 分割文本，保留分隔符
  const parts = text.split(sentenceBoundaries).filter(part => part.length > 0);

  for (const part of parts) {
    // 如果单个部分就超过了最大长度，需要强制分割
    if (part.length > maxChunkLength) {
      // 先保存当前块
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      // 强制分割长文本
      const forcedChunks = forceChunkLongText(part, maxChunkLength);
      chunks.push(...forcedChunks);
      continue;
    }

    // 检查加入当前部分后是否超长
    if (currentChunk.length + part.length <= maxChunkLength) {
      currentChunk += part;
    } else {
      // 保存当前块并开始新块
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = part;
    }
  }

  // 添加最后一个块
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // 过滤空块
  const finalChunks = chunks.filter(chunk => chunk.length > 0);

  log('info', 'Text chunking completed', {
    originalLength: text.length,
    chunkCount: finalChunks.length,
    averageChunkSize: Math.round(finalChunks.reduce((sum, chunk) => sum + chunk.length, 0) / finalChunks.length),
    chunkSizes: finalChunks.map(chunk => chunk.length)
  });

  return finalChunks;
}

/**
 * 强制分割过长的文本
 * @param {string} text - 长文本
 * @param {number} maxLength - 最大长度
 * @returns {string[]} 分割后的文本块
 */
function forceChunkLongText(text, maxLength) {
  const chunks = [];

  // 尝试按词汇边界分割
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
        // 如果单个词都太长，按字符强制分割
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
 * 多阶段文本清理函数
 * @param {string} text - 输入文本
 * @param {Object} options - 清理选项
 * @returns {string} 清理后的文本
 */
export function cleanText(text, options = {}) {
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
    // 1. 移除 Markdown 标记
    if (finalOptions.remove_markdown) {
      cleanedText = removeMarkdown(cleanedText);
    }

    // 2. 移除 Emoji
    if (finalOptions.remove_emoji) {
      cleanedText = removeEmoji(cleanedText);
    }

    // 3. 移除 URL
    if (finalOptions.remove_urls) {
      cleanedText = removeUrls(cleanedText);
    }

    // 4. 移除引用数字
    if (finalOptions.remove_citation_numbers) {
      cleanedText = removeCitationNumbers(cleanedText);
    }

    // 5. 处理换行符
    if (finalOptions.remove_line_breaks) {
      cleanedText = normalizeLineBreaks(cleanedText);
    }

    // 6. 移除自定义关键词
    if (finalOptions.custom_keywords) {
      cleanedText = removeCustomKeywords(cleanedText, finalOptions.custom_keywords);
    }

    // 7. 最终清理：多余空格和特殊字符
    cleanedText = finalCleanup(cleanedText);

    log('info', 'Text cleaning completed', {
      originalLength: text.length,
      cleanedLength: cleanedText.length,
      reductionPercent: Math.round((1 - cleanedText.length / text.length) * 100)
    });

    return cleanedText;
  } catch (error) {
    log('error', 'Text cleaning failed', { error: error.message });
    // 如果清理失败，返回原文本
    return text;
  }
}

/**
 * 移除 Markdown 标记
 * @param {string} text - 输入文本
 * @returns {string} 清理后的文本
 */
function removeMarkdown(text) {
  return text
    // 移除标题
    .replace(/^#{1,6}\s+/gm, '')
    // 移除粗体和斜体
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 移除链接
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 移除图片
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 移除代码块
    .replace(/```[^`]*```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // 移除引用
    .replace(/^>\s+/gm, '')
    // 移除列表标记
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // 移除分隔线
    .replace(/^---+$/gm, '')
    .replace(/^\*\*\*+$/gm, '');
}

/**
 * 移除 Emoji 表情符号
 * @param {string} text - 输入文本
 * @returns {string} 清理后的文本
 */
function removeEmoji(text) {
  // Unicode 范围覆盖大部分 emoji
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
}

/**
 * 移除 URL 链接
 * @param {string} text - 输入文本
 * @returns {string} 清理后的文本
 */
function removeUrls(text) {
  // 匹配 http/https 和常见的网址格式
  return text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/www\.[^\s]+/g, '')
    .replace(/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/g, '');
}

/**
 * 移除引用数字和标注
 * @param {string} text - 输入文本
 * @returns {string} 清理后的文本
 */
function removeCitationNumbers(text) {
  return text
    // 移除方括号引用 [1], [2-5], [1,2,3]
    .replace(/\[\d+(?:[-,]\d+)*\]/g, '')
    // 移除上标引用 ¹ ² ³
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, '')
    // 移除脚注标记 (1) (2)
    .replace(/\(\d+\)/g, '');
}

/**
 * 标准化换行符处理
 * @param {string} text - 输入文本
 * @returns {string} 处理后的文本
 */
function normalizeLineBreaks(text) {
  return text
    // 将多个连续换行符替换为单个空格
    .replace(/\n\s*\n/g, ' ')
    // 将单个换行符替换为空格
    .replace(/\n/g, ' ')
    // 移除回车符
    .replace(/\r/g, '');
}

/**
 * 移除自定义关键词
 * @param {string} text - 输入文本
 * @param {string} keywords - 关键词（逗号分隔）
 * @returns {string} 清理后的文本
 */
function removeCustomKeywords(text, keywords) {
  if (!keywords || typeof keywords !== 'string') {
    return text;
  }

  const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
  let result = text;

  for (const keyword of keywordList) {
    // 转义特殊正则字符
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKeyword, 'gi');
    result = result.replace(regex, '');
  }

  return result;
}

/**
 * 最终清理：处理多余空格和特殊字符
 * @param {string} text - 输入文本
 * @returns {string} 清理后的文本
 */
function finalCleanup(text) {
  return text
    // 移除多余的空格
    .replace(/\s+/g, ' ')
    // 移除制表符
    .replace(/\t/g, ' ')
    // 移除行首行尾空格
    .trim()
    // 移除特殊的不可见字符
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // 标准化标点符号周围的空格
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])\s+/g, '$1 ');
}

/**
 * 验证文本长度和内容
 * @param {string} text - 输入文本
 * @param {Object} options - 验证选项
 * @throws {ValidationError} 验证失败时抛出
 */
export function validateText(text, options = {}) {
  const {
    maxLength = DEFAULT_CONFIG.MAX_TEXT_LENGTH,
    minLength = 1,
    allowEmpty = false
  } = options;

  if (!text && !allowEmpty) {
    throw new ValidationError("文本内容不能为空");
  }

  if (typeof text !== 'string') {
    throw new ValidationError("文本必须是字符串类型");
  }

  if (text.length < minLength) {
    throw new ValidationError(`文本长度不能少于 ${minLength} 个字符`);
  }

  if (text.length > maxLength) {
    throw new ValidationError(`文本长度不能超过 ${maxLength} 个字符，当前长度: ${text.length}`);
  }

  // 检查是否包含过多的重复字符（可能是垃圾数据）
  if (hasExcessiveRepetition(text)) {
    log('warn', 'Text contains excessive repetition', { textLength: text.length });
  }
}

/**
 * 检查文本是否包含过多重复字符
 * @param {string} text - 输入文本
 * @returns {boolean} 是否包含过多重复
 */
function hasExcessiveRepetition(text) {
  if (text.length < 10) return false;

  // 检查连续重复字符
  const repeatedCharPattern = /(.)\1{10,}/;
  if (repeatedCharPattern.test(text)) {
    return true;
  }

  // 检查重复短语
  const repeatedPhrasePattern = /(.{2,10})\1{5,}/;
  if (repeatedPhrasePattern.test(text)) {
    return true;
  }

  return false;
}

/**
 * 获取文本统计信息
 * @param {string} text - 输入文本
 * @returns {Object} 统计信息
 */
export function getTextStats(text) {
  if (!text || typeof text !== 'string') {
    return {
      length: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      chineseCharacters: 0,
      englishWords: 0
    };
  }

  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const sentences = (text.match(/[.!?。！？]+/g) || []).length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;

  return {
    length: text.length,
    words,
    sentences: Math.max(1, sentences), // 至少1句
    paragraphs: Math.max(1, paragraphs), // 至少1段
    chineseCharacters: chineseChars,
    englishWords
  };
}

/**
 * 检测文本主要语言
 * @param {string} text - 输入文本
 * @returns {string} 语言代码 ('zh-CN', 'en-US', 'mixed', 'unknown')
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') {
    return 'unknown';
  }

  const stats = getTextStats(text);
  const totalContent = stats.chineseCharacters + stats.englishWords;

  if (totalContent === 0) {
    return 'unknown';
  }

  const chineseRatio = stats.chineseCharacters / totalContent;
  const englishRatio = stats.englishWords / totalContent;

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
 * 生成文本摘要（用于日志记录）
 * @param {string} text - 输入文本
 * @param {number} maxLength - 最大摘要长度
 * @returns {string} 文本摘要
 */
export function generateTextSummary(text, maxLength = 100) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + '...';
}