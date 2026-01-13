/**
 * Feishu Adapter for CloudClaude
 * Handles message sending/receiving with Feishu API
 */

import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { Logger } from '../utils/logger';
import {
    FeishuCredentials
} from '../types/config';
import {
    FeishuMessageEvent,
    FeishuUrlVerification,
    ParsedFeishuMessage,
    FeishuTextContent
} from '../types/feishu';

const logger = new Logger('FeishuAdapter');

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

export class FeishuAdapter {
    private credentials: FeishuCredentials;
    private client: AxiosInstance;
    private accessToken: string = '';
    private tokenExpiry: number = 0;
    private defaultChatId?: string;

    constructor(credentials: FeishuCredentials, defaultChatId?: string) {
        this.credentials = credentials;
        this.defaultChatId = defaultChatId;
        this.client = axios.create({
            baseURL: FEISHU_API_BASE,
            timeout: 30000
        });
    }

    /**
     * Get access token (with caching)
     */
    async getAccessToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const response = await this.client.post('/auth/v3/tenant_access_token/internal', {
                app_id: this.credentials.appId,
                app_secret: this.credentials.appSecret
            });

            this.accessToken = response.data.tenant_access_token as string;
            // Token expires in 2 hours, refresh 5 minutes early
            this.tokenExpiry = Date.now() + (response.data.expire - 300) * 1000;

            logger.debug('Access token refreshed');
            return this.accessToken;
        } catch (error: any) {
            logger.error('Failed to get access token', error);
            throw new Error(`Failed to get Feishu access token: ${error.message}`);
        }
    }

    /**
     * Verify webhook signature
     */
    verifyWebhook(timestamp: string, nonce: string, body: string, signature: string): boolean {
        if (!this.credentials.encryptKey) {
            return true; // No encryption configured
        }

        const signatureContent = `${timestamp}\n${nonce}\n${this.credentials.encryptKey}\n${body}`;
        const hash = crypto.createHash('sha256').update(signatureContent).digest('hex');

        return hash === signature;
    }

    /**
     * Handle URL verification challenge
     */
    handleUrlVerification(body: FeishuUrlVerification): { challenge: string } {
        return { challenge: body.challenge };
    }

    /**
     * Parse incoming message event
     */
    parseMessage(event: FeishuMessageEvent): ParsedFeishuMessage | null {
        try {
            const { message, sender } = event.event;

            if (message.message_type !== 'text') {
                logger.debug(`Ignoring non-text message type: ${message.message_type}`);
                return null;
            }

            const content: FeishuTextContent = JSON.parse(message.content);

            // Remove @mentions from text
            let text = content.text;
            if (message.mentions) {
                for (const mention of message.mentions) {
                    text = text.replace(mention.key, '').trim();
                }
            }

            return {
                messageId: message.message_id,
                chatId: message.chat_id,
                chatType: message.chat_type,
                senderId: sender.sender_id.open_id,
                text,
                timestamp: message.create_time,
                mentions: message.mentions?.map(m => m.name)
            };
        } catch (error: any) {
            logger.error('Failed to parse message', error);
            return null;
        }
    }

    /**
     * Send text message
     */
    async sendMessage(text: string, chatId?: string): Promise<void> {
        const targetChatId = chatId || this.defaultChatId;
        if (!targetChatId) {
            logger.warn('No chat ID provided and no default set');
            return;
        }

        try {
            const token = await this.getAccessToken();

            await this.client.post(
                '/im/v1/messages',
                {
                    receive_id: targetChatId,
                    msg_type: 'text',
                    content: JSON.stringify({ text })
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { receive_id_type: 'chat_id' }
                }
            );

            logger.debug(`Message sent to ${targetChatId}`);
        } catch (error: any) {
            logger.error('Failed to send message', error);
            throw error;
        }
    }

    /**
     * Reply to a message
     */
    async replyMessage(messageId: string, text: string): Promise<void> {
        try {
            const token = await this.getAccessToken();

            await this.client.post(
                `/im/v1/messages/${messageId}/reply`,
                {
                    msg_type: 'text',
                    content: JSON.stringify({ text })
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            logger.debug(`Replied to message ${messageId}`);
        } catch (error: any) {
            logger.error('Failed to reply message', error);
            throw error;
        }
    }

    /**
     * Send card message
     */
    async sendCard(card: object, chatId?: string): Promise<void> {
        const targetChatId = chatId || this.defaultChatId;
        if (!targetChatId) {
            logger.warn('No chat ID provided and no default set');
            return;
        }

        try {
            const token = await this.getAccessToken();

            await this.client.post(
                '/im/v1/messages',
                {
                    receive_id: targetChatId,
                    msg_type: 'interactive',
                    content: JSON.stringify(card)
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { receive_id_type: 'chat_id' }
                }
            );

            logger.debug(`Card sent to ${targetChatId}`);
        } catch (error: any) {
            logger.error('Failed to send card', error);
            throw error;
        }
    }

    /**
     * Set default chat ID
     */
    setDefaultChatId(chatId: string): void {
        this.defaultChatId = chatId;
    }

    /**
     * Get default chat ID
     */
    getDefaultChatId(): string | undefined {
        return this.defaultChatId;
    }
}
