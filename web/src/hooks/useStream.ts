'use client';
import { useEffect, useRef, useCallback } from 'react';

type Handler = (data: unknown) => void;

export function useStream(handlers: Record<string, Handler>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource('/api/stream');

      Object.keys(handlersRef.current).forEach(event => {
        es.addEventListener(event, (e: MessageEvent) => {
          try {
            handlersRef.current[event]?.(JSON.parse(e.data));
          } catch { /* ignore parse errors */ }
        });
      });

      es.onerror = () => {
        es.close();
        // Reconnect after 2s on error
        retryTimeout = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      es?.close();
      clearTimeout(retryTimeout);
    };
  }, []); // only mount once
}
