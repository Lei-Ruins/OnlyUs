
export enum ConnectionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  timestamp: number;
  type: 'text' | 'file';
  fileData?: {
    name: string;
    type: string;
    size: number;
    content: string; // Base64 or ObjectURL string for simplicity in P2P transfer
  };
}
