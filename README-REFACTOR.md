# 🔄 EdgeTTS 重构说明文档

## 📋 重构概述

本次重构将原有的单文件架构重构为模块化架构，大幅提升了代码质量、可维护性和扩展性。

## 🗂️ 新的项目结构

```
edgetts-edgeone-pages/
├── edge-functions/
│   ├── shared/                    # 🆕 共享模块
│   │   ├── config.js             # 🆕 统一配置管理
│   │   ├── errors.js             # 🆕 错误处理和响应
│   │   ├── auth.js               # 🆕 认证和签名模块
│   │   ├── tts.js                # 🆕 TTS 核心逻辑
│   │   └── text-utils.js         # 🆕 文本处理工具
│   └── api/v1/
│       ├── models.js             # ✅ 重构的模型API
│       └── audio/speech.js       # ✅ 重构的语音API
├── .env.example                  # 🆕 环境变量配置示例
├── index.html                    # 📄 前端测试页面
└── readme.md                     # 📄 原项目文档
```

## 🎯 重构目标和成果

### ✅ 已完成的改进

1. **📦 模块化架构**
   - 将600+行的单文件拆分为功能清晰的模块
   - 每个模块职责单一，便于维护和测试

2. **🛡️ 安全性增强**
   - 移除硬编码的签名密钥，支持环境变量配置
   - 增强的参数验证和输入过滤
   - 统一的错误处理，避免信息泄露

3. **🎛️ 配置管理优化**
   - 统一的配置文件管理所有常量
   - 支持环境变量覆盖默认配置
   - 详细的配置说明和示例

4. **🔍 错误处理改进**
   - 统一的错误处理机制
   - 结构化的错误响应格式
   - 完善的日志记录系统

5. **⚡ 性能优化**
   - 改进的Token缓存机制
   - 智能的文本分块算法
   - 更好的并发控制

6. **📝 代码质量提升**
   - 完整的JSDoc文档
   - 统一的代码风格
   - 更好的错误处理

## 🔧 主要模块说明

### 1. 📋 config.js - 配置管理
- 集中管理所有配置常量
- 扩展的语音模型支持（25+种）
- 可配置的默认参数

### 2. 🛡️ errors.js - 错误处理
- 自定义错误类型
- 统一的CORS处理
- 参数验证辅助函数
- 结构化日志记录

### 3. 🔐 auth.js - 认证模块
- 改进的Token管理
- 重试机制和错误恢复
- 安全的签名生成
- 环境变量支持

### 4. 🎙️ tts.js - TTS核心
- 流式和批量处理优化
- 更好的错误处理
- 性能监控和统计
- SSML生成优化

### 5. 📝 text-utils.js - 文本工具
- 智能文本分块算法
- 增强的文本清理功能
- 语言检测和统计
- 输入验证和过滤

## 🔄 迁移指南

### 环境变量配置

1. 复制 `.env.example` 为 `.env`
2. 在 EdgeOne Pages 控制台配置环境变量：

```bash
# 必需配置
API_KEY=your_secure_api_key

# 可选配置（建议设置）
MS_SIGNING_KEY=your_microsoft_signing_key
MAX_CONCURRENCY=10
DEFAULT_CHUNK_SIZE=300
```

### API 兼容性

✅ **完全向后兼容** - 所有现有的API调用无需修改

```javascript
// 原有调用方式依然有效
fetch('/api/v1/audio/speech', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'tts-1-alloy',
    input: '你好，世界！',
    stream: false
  })
});
```

### 新增功能

1. **🎵 更多语音模型**
   ```javascript
   // 现在支持直接使用微软语音名称
   {
     "voice": "zh-CN-XiaoyiNeural",
     "input": "测试语音"
   }
   ```

2. **🎛️ 增强的参数验证**
   - 自动参数范围检查
   - 更详细的错误信息
   - 安全的输入过滤

3. **📊 请求统计和监控**
   - 自动性能统计
   - 请求时长监控
   - 错误率统计

## 🚀 性能改进

- **Token管理**: 智能缓存和重试机制，减少认证失败
- **并发控制**: 更精确的批处理控制，避免EdgeOne限制
- **内存优化**: 流式处理优化，减少大文本内存占用
- **错误恢复**: 自动重试和优雅降级机制

## 🔍 监控和调试

### 日志记录
```javascript
// 新增的结构化日志
log('info', 'Processing TTS request', {
  textLength: 1000,
  detectedLanguage: 'zh-CN',
  estimatedDuration: 30
});
```

### 错误跟踪
```javascript
// 详细的错误信息
{
  "error": {
    "message": "文本长度超过限制",
    "type": "validation_error",
    "details": {
      "maxLength": 120000,
      "actualLength": 150000
    }
  }
}
```

## 🛠️ 开发指南

### 添加新语音
在 `config.js` 中添加：
```javascript
export const MICROSOFT_VOICES = {
  // 添加新的语音配置
  "zh-CN-YourNewVoice": { name: "新语音", gender: "female", region: "zh-CN" }
};
```

### 扩展功能
1. 在相应模块中添加功能
2. 更新配置文件
3. 添加相应的错误处理
4. 更新文档

## 🔮 未来规划

- [ ] **缓存系统**: 实现音频结果缓存
- [ ] **限流机制**: 添加请求频率限制
- [ ] **统计面板**: 使用量和性能统计
- [ ] **多语言支持**: 更多语言的语音模型
- [ ] **WebSocket**: 实时流式传输优化

## ⚡ 快速开始

1. **更新环境变量**：按照 `.env.example` 配置
2. **重新部署**：上传新代码到 EdgeOne Pages
3. **测试验证**：使用现有的 `index.html` 测试功能

重构后的系统具有更好的稳定性、可维护性和扩展性，同时保持完全的向后兼容性。