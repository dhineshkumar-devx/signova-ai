import { MediaPipeLandmarkFrame, PredictionResponse } from '../types/isl';

export class SignWebSocketClient {
  private url: string;
  private socket: WebSocket | null = null;
  private onPredictionCallback: ((data: PredictionResponse) => void) | null = null;
  private onStatusCallback: ((connected: boolean) => void) | null = null;
  private isConnected: boolean = false;
  private reconnectTimer: any = null;

  constructor(url?: string) {
    const rawEnvUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    // Clean base URL removing trailing /ws or slashes
    const cleanBaseUrl = rawEnvUrl.replace(/\/ws\/?$/, '').replace(/\/$/, '');
    this.url = url || `${cleanBaseUrl}/api/v1/ws/predict`;
  }

  public connect(
    onPrediction: (data: PredictionResponse) => void,
    onStatusChange?: (connected: boolean) => void
  ): void {
    this.onPredictionCallback = onPrediction;
    if (onStatusChange) {
      this.onStatusCallback = onStatusChange;
    }

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log(`[ISL WebSocket] Connected to: ${this.url}`);
        this.isConnected = true;
        if (this.onStatusCallback) {
          this.onStatusCallback(true);
        }
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const data: PredictionResponse = JSON.parse(event.data);
          if (this.onPredictionCallback) {
            this.onPredictionCallback(data);
          }
        } catch (err) {
          console.error('[ISL WebSocket] Error parsing frame message:', err);
        }
      };

      this.socket.onclose = () => {
        console.log('[ISL WebSocket] Connection closed. Retrying in 3s...');
        this.isConnected = false;
        if (this.onStatusCallback) {
          this.onStatusCallback(false);
        }
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        console.warn('[ISL WebSocket] Connection error. (Is the backend running at port 8000?)');
        this.isConnected = false;
        if (this.onStatusCallback) {
          this.onStatusCallback(false);
        }
      };
    } catch (e) {
      console.error('[ISL WebSocket] Instantiation error:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected && this.onPredictionCallback) {
        this.connect(this.onPredictionCallback, this.onStatusCallback || undefined);
      }
    }, 3000);
  }

  public sendFrame(frame: MediaPipeLandmarkFrame): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(frame));
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
      if (this.onStatusCallback) {
        this.onStatusCallback(false);
      }
    }
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}

