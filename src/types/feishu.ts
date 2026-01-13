/**
 * Feishu Message Types for CloudClaude
 */

// Feishu webhook event types
export type FeishuEventType =
    | 'url_verification'
    | 'im.message.receive_v1'
    | 'im.message.message_read_v1';

// URL verification request
export interface FeishuUrlVerification {
    type: 'url_verification';
    challenge: string;
    token: string;
}

// Message event header
export interface FeishuEventHeader {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
}

// Message sender info
export interface FeishuSender {
    sender_id: {
        union_id?: string;
        user_id?: string;
        open_id: string;
    };
    sender_type: string;
    tenant_key?: string;
}

// Message content
export interface FeishuMessageContent {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    create_time: string;
    chat_id: string;
    chat_type: 'p2p' | 'group';
    message_type: 'text' | 'image' | 'file' | 'audio' | 'media' | 'sticker' | 'interactive';
    content: string;  // JSON string
    mentions?: Array<{
        key: string;
        id: {
            union_id?: string;
            user_id?: string;
            open_id: string;
        };
        name: string;
    }>;
}

// Message receive event
export interface FeishuMessageEvent {
    schema: string;
    header: FeishuEventHeader;
    event: {
        sender: FeishuSender;
        message: FeishuMessageContent;
    };
}

// Text message content (parsed from content JSON)
export interface FeishuTextContent {
    text: string;
}

// Parsed message for internal use
export interface ParsedFeishuMessage {
    messageId: string;
    chatId: string;
    chatType: 'p2p' | 'group';
    senderId: string;
    text: string;
    timestamp: string;
    mentions?: string[];
}

// Card message structure
export interface FeishuCardMessage {
    msg_type: 'interactive';
    card: {
        config?: {
            wide_screen_mode?: boolean;
        };
        header?: {
            title: {
                tag: 'plain_text';
                content: string;
            };
            template?: string;
        };
        elements: Array<{
            tag: string;
            [key: string]: any;
        }>;
    };
}
