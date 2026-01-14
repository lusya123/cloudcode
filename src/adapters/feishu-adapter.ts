import crypto from 'crypto';
import axios from 'axios';
import type { Logger } from 'winston';
import type { FeishuMessage, FeishuWebhookBody } from '../types/feishu';
import type { Credentials } from '../types/config';
import { loadCredentials } from '../utils/config-loader';

export class FeishuAdapter {
  private credentials?: Credentials['feishu'];
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  async init(): Promise<void> {
    const credentials = await loadCredentials();
    this.credentials = credentials.feishu;
  }

  async getAccessToken(): Promise<string> {
    if (!this.credentials) {
      throw new Error('Feishu adapter not initialized');
    }

    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    const response = await axios.post<{
      tenant_access_token: string;
      expire: number;
    }>(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: this.credentials.appId,
        app_secret: this.credentials.appSecret
      }
    );

    this.accessToken = response.data.tenant_access_token;
    this.tokenExpiry = Date.now() + (response.data.expire - 60) * 1000;

    return this.accessToken;
  }

  verifyWebhook(timestamp: string, nonce: string, signature: string): boolean {
    if (!this.credentials?.encryptKey) {
      return true;
    }
    const str = timestamp + nonce + this.credentials.encryptKey;
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    return hash === signature;
  }

  async receiveMessage(webhookBody: FeishuWebhookBody): Promise<FeishuMessage | null> {
    const event = webhookBody.event;
    if (!event || event.message.message_type !== 'text') {
      return null;
    }

    let content = '';
    try {
      content = JSON.parse(event.message.content).text || '';
    } catch {
      content = event.message.content || '';
    }

    return {
      userId: event.sender.sender_id.open_id,
      userName: event.sender.sender_id.user_id,
      message: content,
      messageId: event.message.message_id,
      chatId: event.message.chat_id
    };
  }

  async sendMessage(message: string, chatId?: string): Promise<void> {
    if (!chatId) {
      this.logger?.warn('Skipping message send: missing chatId');
      return;
    }

    const token = await this.getAccessToken();

    await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages',
      {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text: message })
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          receive_id_type: 'chat_id'
        }
      }
    );
  }
}
