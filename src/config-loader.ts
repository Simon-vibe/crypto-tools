/**
 * 配置加载工具
 */

import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from './config';
import { NETWORK_CONFIG } from './constants';

/**
 * 加载配置文件
 * 
 * @param configPath - 配置文件路径（相对于项目根目录）
 * @returns 配置对象
 * @throws 如果配置文件不存在或格式错误
 */
export function loadConfig(configPath: string = 'config.json'): AppConfig {
    const fullPath = path.resolve(process.cwd(), configPath);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
        throw new Error(
            `配置文件不存在: ${fullPath}\n` +
            `请复制 config.example.json 为 config.json 并填入您的配置信息。`
        );
    }

    // 读取并解析配置文件
    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const config: AppConfig = JSON.parse(content);

        // 验证必需字段
        if (!config.privateKey || config.privateKey === 'your_base64_private_key_here') {
            throw new Error('请在 config.json 中设置有效的 privateKey');
        }

        if (!config.network) {
            throw new Error('请在 config.json 中设置 network 字段');
        }

        // 如果没有提供 rpcUrl，使用默认值
        if (!config.rpcUrl) {
            config.rpcUrl = NETWORK_CONFIG[config.network.toUpperCase() as keyof typeof NETWORK_CONFIG].url;
        }

        return config;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`配置文件格式错误: ${fullPath}\n请确保是有效的 JSON 格式。`);
        }
        throw error;
    }
}

/**
 * 检查配置文件是否存在
 * 
 * @param configPath - 配置文件路径
 * @returns 是否存在
 */
export function configExists(configPath: string = 'config.json'): boolean {
    const fullPath = path.resolve(process.cwd(), configPath);
    return fs.existsSync(fullPath);
}
