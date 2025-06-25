import { NextResponse } from 'next/server';

const GEMINI_API_KEY=process.env.GEMINI_API_KEY
//const DEEPSEEK_API_URL='https://api.deepseek.com/chat/completions';

if (!GEMINI_API_KEY) {
  throw new Error('GEMMA_API_KEY is not set in environment variables');
}

// Set response timeout to 30 seconds
export const maxDuration = 30;

// Configure the runtime to use edge for better streaming support
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions",{
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        
      },
      //deepseek/deepseek-r1:free
      body: JSON.stringify({
        model: "deepseek/deepseek-r1:free",
        messages: messages,
        stream: true,
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text(); // Get the raw response text
      console.error('OpenRouter API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      throw new Error(`Failed to get response from OpenRouter: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body available');
    }

    const reader = response.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Try to parse any remaining buffer
              if (buffer.trim() !== '') {
                try {
                  const parsed = JSON.parse(buffer);
                  controller.enqueue(encoder.encode(JSON.stringify(parsed) + '\n'));
                } catch (e) {
                  // Ignore incomplete JSON at the end
                }
              }
              controller.close();
              break;
            }

            const text = decoder.decode(value);
            buffer += text;

            // Split by newlines, but keep the last (possibly incomplete) line in the buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;

              let data = line;
              if (line.startsWith('data: ')) {
                data = line.slice(6);
              }

              // Only try to parse if it looks like JSON
              if (data.trim().startsWith('{') && data.trim().endsWith('}')) {
                try {
                  const parsed = JSON.parse(data);
                  controller.enqueue(encoder.encode(JSON.stringify(parsed) + '\n'));
                } catch (e) {
                  // If JSON.parse fails, put it back in the buffer for the next chunk
                  buffer = data + '\n' + buffer;
                  break;
                }
              }
            }
          }
        } catch (e) {
          controller.error(e);
        }
      },

      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
} 