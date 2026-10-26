import { useEffect, useRef, useState, useCallback } from 'react';
import { SignWebSocketClient } from '../services/websocket';
import { PredictionResponse, MediaPipeLandmarkFrame } from '../types/isl';

export const useWebSocket = () => {
  const wsClientRef = useRef<SignWebSocketClient | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const client = new SignWebSocketClient();
    wsClientRef.current = client;

    client.connect(
      (data: PredictionResponse) => {
        setPrediction(data);
      },
      (connected: boolean) => {
        setIsConnected(connected);
      }
    );

    return () => {
      client.disconnect();
    };
  }, []);

  const sendLandmarkFrame = useCallback((frame: MediaPipeLandmarkFrame) => {
    if (wsClientRef.current) {
      wsClientRef.current.sendFrame(frame);
    }
  }, []);

  return { prediction, isConnected, sendLandmarkFrame };
};

