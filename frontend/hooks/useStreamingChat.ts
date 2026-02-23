import { useState, useCallback, useRef } from 'react';
import { ChatMessage } from '@/types/chat';

interface StreamingChatHook {
  thinkingContent: string;
  isStreaming: boolean;
  sendStreamingMessage: (
    message: string,
    history: ChatMessage[],
    model: string,
    onComplete: (response: string, thinkingProcess: string) => void,
    onError: (error: Error) => void
  ) => Promise<void>;
  cancelStream: () => void;
}

interface SSEMessage {
  type: 'thinking' | 'done' | 'error';
  content: string;
  timestamp: number;
  functionCallsExecuted?: number;
  thinkingProcess?: string;
}

export function useStreamingChat(): StreamingChatHook {
  const [thinkingContent, setThinkingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setThinkingContent('');
  }, []);

  const sendStreamingMessage = useCallback(
    async (
      message: string,
      history: ChatMessage[],
      model: string,
      onComplete: (response: string, thinkingProcess: string) => void,
      onError: (error: Error) => void
    ) => {
      // Cancel any existing stream
      cancelStream();

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsStreaming(true);
      setThinkingContent('');

      try {
        const backendUrl =
          typeof window !== 'undefined'
            ? (process.env.NEXT_PUBLIC_BACKEND_URL || window.location.protocol + '//' + window.location.hostname + ':3002')
            : 'http://backend:3002';

        console.log('🌊 Starting streaming chat request...');
        console.log('   Backend URL:', backendUrl);
        console.log('   Model:', model);
        console.log('   Message length:', message.length);
        console.log('   History length:', history.length);

        const response = await fetch(`${backendUrl}/api/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            history,
            model,
          }),
          signal: abortController.signal,
        });

        console.log('📡 Response received:');
        console.log('   Status:', response.status);
        console.log('   Status Text:', response.statusText);
        console.log('   Headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Streaming request failed:');
          console.error('   Status:', response.status);
          console.error('   Error:', errorText);
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        console.log('✅ Streaming connection established');

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedThinking = '';
        let chunkCount = 0;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('✅ Stream completed');
            console.log(`   Total chunks: ${chunkCount}`);
            console.log(`   Total thinking length: ${accumulatedThinking.length}`);
            break;
          }

          // Decode the chunk
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: SSEMessage = JSON.parse(line.substring(6));
                chunkCount++;

                if (data.type === 'thinking') {
                  // Accumulate thinking content
                  accumulatedThinking += data.content;
                  setThinkingContent((prev) => prev + data.content);
                } else if (data.type === 'done') {
                  // Stream completed successfully
                  console.log('✅ Received final response');
                  setIsStreaming(false);
                  setThinkingContent('');
                  onComplete(data.content, data.thinkingProcess || accumulatedThinking);
                  return;
                } else if (data.type === 'error') {
                  // Stream error
                  console.error('❌ Stream error:', data.content);
                  throw new Error(data.content);
                }
              } catch (parseError) {
                console.error('Failed to parse SSE message:', line, parseError);
              }
            } else if (line.startsWith(': ')) {
              // SSE comment (connection confirmation)
              console.log('💬 SSE comment:', line.substring(2));
            }
          }
        }

        // If we get here without a 'done' message, something went wrong
        throw new Error('Stream ended without completion message');
      } catch (error) {
        console.error('❌ Streaming error:', error);
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        setIsStreaming(false);
        setThinkingContent('');

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.log('🛑 Stream cancelled by user');
            return;
          }
          onError(error);
        } else {
          onError(new Error('Unknown streaming error'));
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [cancelStream]
  );

  return {
    thinkingContent,
    isStreaming,
    sendStreamingMessage,
    cancelStream,
  };
}
