export interface FeishuMessage {
  userId: string;
  userName?: string;
  message: string;
  messageId: string;
  chatId: string;
}

export interface FeishuWebhookBody {
  type: string;
  challenge?: string;
  event?: {
    sender: {
      sender_id: {
        open_id: string;
        user_id: string;
      };
    };
    message: {
      message_type: string;
      content: string;
      message_id: string;
      chat_id: string;
    };
    header?: {
      event_id?: string;
      event_type?: string;
      create_time?: string;
      token?: string;
    };
  };
}
