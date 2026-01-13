import axios from 'axios';
import logger from '../utils/logger';
import { Config } from '../config';

interface TenantAccessTokenResponse {
    code: number;
    msg: string;
    tenant_access_token: string;
    expire: number;
}

export class FeishuAdapter {
    private config: Config['feishu'];
    private token: string | null = null;
    private tokenExpire: number = 0;

    constructor(config: Config['feishu']) {
        this.config = config;
    }

    /**
     * Get Tenant Access Token (with caching)
     */
    private async getTenantAccessToken(): Promise<string> {
        const now = Math.floor(Date.now() / 1000);

        // Return cached token if valid (buffer 5 minutes)
        if (this.token && this.tokenExpire > now + 300) {
            return this.token;
        }

        try {
            const response = await axios.post<TenantAccessTokenResponse>(
                'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
                {
                    app_id: this.config.appId,
                    app_secret: this.config.appSecret,
                }
            );

            if (response.data.code !== 0) {
                throw new Error(`Failed to get tenant_access_token: ${response.data.msg}`);
            }

            this.token = response.data.tenant_access_token;
            this.tokenExpire = now + response.data.expire;

            logger.debug('Refreshed Feishu tenant_access_token');
            return this.token;
        } catch (error) {
            logger.error('Error getting Feishu token:', error);
            throw error;
        }
    }

    /**
     * Send text message to user
     */
    async sendMessage(receiveId: string, content: string, receiveIdType: 'open_id' | 'chat_id' = 'open_id'): Promise<void> {
        try {
            const token = await this.getTenantAccessToken();

            const response = await axios.post(
                `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
                {
                    receive_id: receiveId,
                    msg_type: 'text',
                    content: JSON.stringify({ text: content }),
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.data.code !== 0) {
                logger.error(`Feishu send message failed: ${response.data.msg}`);
            } else {
                logger.debug(`Sent message to ${receiveId}`);
            }
        } catch (error) {
            logger.error('Error sending Feishu message:', error);
        }
    }

    /**
     * Reply to a message (thread)
     */
    async replyMessage(messageId: string, content: string): Promise<void> {
        try {
            const token = await this.getTenantAccessToken();

            const response = await axios.post(
                `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`,
                {
                    msg_type: 'text',
                    content: JSON.stringify({ text: content }),
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.data.code !== 0) {
                logger.error(`Feishu reply message failed: ${response.data.msg}`);
            }
        } catch (error) {
            logger.error('Error replying Feishu message:', error);
        }
    }

    /**
     * Decrypt event content (simplified stub)
     * In real scenario, implement AES decryption using encryptKey
     */
    decryptEvent(encrypted: string): any {
        // Skipping full implementation of AES logic for brevity unless requested
        // Assuming configured to use plain text or verifying token separately
        throw new Error('Encryption not fully implemented in this stub.');
    }
}
