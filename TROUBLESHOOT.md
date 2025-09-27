# 🔧 EdgeTTS 问题诊断指南

## 本地测试方法

### 方法 1: 语法检查
```bash
# 检查 JavaScript 语法错误
node -c edge-functions/api/v1/audio/speech.js
node -c edge-functions/api/v1/models.js
```

### 方法 2: 使用调试版本
1. 将 `debug-speech.js` 重命名为 `speech.js`
2. 部署到 EdgeOne Pages
3. 查看详细的调试日志

### 方法 3: 模拟测试
```bash
# 运行本地模拟测试
node test-local.js
```

## 常见错误和解决方案

### 1. "Error return from script"
**原因**: JavaScript 运行时错误
**解决方案**:
- 使用调试版本获取详细错误信息
- 检查是否使用了不支持的 API (如 AbortSignal.timeout)

### 2. "Unexpected token 'E', Error retu..."
**原因**: JSON 解析错误
**解决方案**:
- 检查请求 Content-Type 是否为 application/json
- 确认请求体是有效的 JSON 格式
- 查看响应是否包含错误信息而非 JSON

### 3. "无效的 API 密钥"
**原因**: 认证失败
**解决方案**:
- 确认环境变量 API_KEY 已正确设置
- 检查 Authorization 头格式: `Bearer YOUR_API_KEY`

### 4. "获取端点失败"
**原因**: 微软服务认证失败
**解决方案**:
- 检查网络连接
- 验证签名算法是否正确
- 考虑设置 MS_SIGNING_KEY 环境变量

## 调试步骤

### 第一步: 基础连通性测试
```bash
curl -X OPTIONS 'https://your-domain/api/v1/audio/speech' -v
```
应该返回 204 和 CORS 头。

### 第二步: 简单请求测试
```bash
curl -X POST 'https://your-domain/api/v1/audio/speech' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"input":"test"}'
```

### 第三步: 完整功能测试
```bash
curl -X POST 'https://your-domain/api/v1/audio/speech' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"input":"测试文本","voice":"zh-CN-YunxiNeural","stream":false}' \
  --output test.mp3
```

## 环境变量配置

确保在 EdgeOne Pages 控制台设置了以下环境变量:

```bash
# 必需
API_KEY=your_secure_api_key

# 可选 (推荐)
MS_SIGNING_KEY=your_microsoft_signing_key
```

## 部署检查清单

- [ ] JavaScript 语法检查通过
- [ ] 环境变量已设置
- [ ] 文件结构正确
- [ ] 没有使用不支持的 Web API
- [ ] CORS 头配置正确

## 获取帮助

如果问题持续存在:
1. 使用调试版本获取详细错误信息
2. 检查 EdgeOne Pages 控制台日志
3. 确认请求格式是否正确
4. 验证环境变量配置

## 已知限制

- EdgeOne Pages 不支持 ES 模块导入
- 不支持某些新的 Web API (如 AbortSignal.timeout)
- 执行时间限制为 200ms CPU 时间
- 内存使用限制