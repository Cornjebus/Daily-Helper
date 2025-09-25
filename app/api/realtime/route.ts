import { NextRequest } from 'next/server';

// Store active connections
const connections = new Map<string, ReadableStreamDefaultController>();
let connectionCounter = 0;

export interface SSEEvent {
  type: 'email_processing_started' | 'email_processing_completed' | 'email_updated' | 'sync_status' | 'error';
  data: any;
  id?: string;
  retry?: number;
}

// Global event broadcaster
export class SSEEventManager {
  private static instance: SSEEventManager;

  static getInstance(): SSEEventManager {
    if (!SSEEventManager.instance) {
      SSEEventManager.instance = new SSEEventManager();
    }
    return SSEEventManager.instance;
  }

  broadcast(event: SSEEvent) {
    const message = this.formatSSEMessage(event);

    connections.forEach((controller, connectionId) => {
      try {
        controller.enqueue(new TextEncoder().encode(message));
      } catch (error) {
        console.error(`Failed to send SSE message to connection ${connectionId}:`, error);
        connections.delete(connectionId);
      }
    });
  }

  private formatSSEMessage(event: SSEEvent): string {
    let message = '';

    if (event.id) {
      message += `id: ${event.id}\n`;
    }

    message += `event: ${event.type}\n`;
    message += `data: ${JSON.stringify(event.data)}\n`;

    if (event.retry) {
      message += `retry: ${event.retry}\n`;
    }

    message += '\n';
    return message;
  }

  getConnectionCount(): number {
    return connections.size;
  }
}

export async function GET(request: NextRequest) {
  // Check if client accepts text/event-stream
  const acceptHeader = request.headers.get('accept');
  if (!acceptHeader?.includes('text/event-stream')) {
    return new Response('This endpoint requires Server-Sent Events support', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  const connectionId = `conn_${++connectionCounter}_${Date.now()}`;

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Store connection for broadcasting
      connections.set(connectionId, controller);

      // Send initial connection event
      const initialEvent: SSEEvent = {
        type: 'sync_status',
        data: {
          message: 'Connected to real-time updates',
          connectionId,
          timestamp: new Date().toISOString()
        },
        id: `init_${connectionId}`
      };

      const initialMessage = SSEEventManager.getInstance()['formatSSEMessage'](initialEvent);
      controller.enqueue(new TextEncoder().encode(initialMessage));

      console.log(`SSE connection established: ${connectionId}`);
    },

    cancel() {
      connections.delete(connectionId);
      console.log(`SSE connection closed: ${connectionId}`);
    }
  });

  // Set up keep-alive ping every 30 seconds
  const keepAliveInterval = setInterval(() => {
    const controller = connections.get(connectionId);
    if (controller) {
      try {
        const pingEvent: SSEEvent = {
          type: 'sync_status',
          data: { ping: true, timestamp: new Date().toISOString() }
        };
        const pingMessage = SSEEventManager.getInstance()['formatSSEMessage'](pingEvent);
        controller.enqueue(new TextEncoder().encode(pingMessage));
      } catch (error) {
        console.error(`Keep-alive failed for connection ${connectionId}:`, error);
        connections.delete(connectionId);
        clearInterval(keepAliveInterval);
      }
    } else {
      clearInterval(keepAliveInterval);
    }
  }, 30000);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}

// Export the event manager for use in other API routes
export const sseEventManager = SSEEventManager.getInstance();