import crypto from 'crypto';
import axios from 'axios';
import { loadCredentials } from '../utils/config-loader';
import type { FeishuMessage, FeishuWebhookBody } from '../types/feishu';
import type { Credentials } from '../types/config';

export class FeishuAdapter {
  private credentials: Credentials['feishu'];
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.credentials = loadCredentials().feishu;
  }

  async getAccessToken(): Promise<string> {
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

  verifyWebhook(timestamp: string, nonce: string, encryptKey: string, signature: string): boolean {
    const str = timestamp + nonce + encryptKey;
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    return hash === signature;
  }

  verifyToken(webhookBody: FeishuWebhookBody): boolean {
    const token = webhookBody.event?.header?.token || webhookBody.token;
    if (!this.credentials.verificationToken) {
      return true;
    }
    return token === this.credentials.verificationToken;
  }

  async receiveMessage(webhookBody: FeishuWebhookBody): Promise<FeishuMessage | null> {
    const event = webhookBody.event;

    if (!event || event.message.message_type !== 'text') {
      return null;
    }

    let contentText = '';
    try {
      contentText = JSON.parse(event.message.content).text || '';
    } catch {
      contentText = event.message.content;
    }

    return {
      userId: event.sender.sender_id.open_id,
      userName: event.sender.sender_id.user_id,
      message: contentText,
      messageId: event.message.message_id,
      chatId: event.message.chat_id
    };
  }

  async sendMessage(message: string, chatId: string): Promise<void> {
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

  async sendCard(card: Record<string, unknown>, chatId: string): Promise<void> {
    const token = await this.getAccessToken();

    await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages',
      {
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(card)
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
