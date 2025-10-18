/**
 * Script de test pour Google Maps avec l'API chat-genai
 *
 * Usage: node test-google-maps.js
 */

const BASE_URL = 'http://localhost:9627';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function testGoogleMaps() {
  const chatId = generateUUID();
  const messageId = generateUUID();

  const requestBody = {
    id: chatId,
    message: {
      id: messageId,
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'clos des diablotins 2 vers Cora Woluwe',
        },
      ],
    },
    selectedChatModel: 'chat-model-medium',
    selectedVisibilityType: 'private',
    groundingType: 'maps', // Change to 'search' pour tester Google Search
    isReasoningEnabled: false,
  };

  console.log('🚀 Testing Google Maps API...');
  console.log('📍 Query:', requestBody.message.parts[0].text);
  console.log('🔧 Grounding Type:', requestBody.groundingType);
  console.log('');

  try {
    const response = await fetch(`${BASE_URL}/api/chat-genai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('❌ Error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    console.log('✅ Connected! Streaming response...\n');
    console.log('--- Response ---');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (!data.trim()) continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'text-delta') {
              process.stdout.write(parsed.textDelta);
            } else if (parsed.type === 'finish') {
              console.log('\n\n✅ Stream finished!');
            } else if (parsed.type === 'error') {
              console.error('\n❌ Error:', parsed.error);
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Test Google Search
async function testGoogleSearch() {
  const chatId = generateUUID();
  const messageId = generateUUID();

  const requestBody = {
    id: chatId,
    message: {
      id: messageId,
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'Quelles sont les actualités de la semaine en Belgique ?',
        },
      ],
    },
    selectedChatModel: 'chat-model-medium',
    selectedVisibilityType: 'private',
    groundingType: 'search',
    isReasoningEnabled: false,
  };

  console.log('\n\n🔍 Testing Google Search API...');
  console.log('📰 Query:', requestBody.message.parts[0].text);
  console.log('🔧 Grounding Type:', requestBody.groundingType);
  console.log('');

  try {
    const response = await fetch(`${BASE_URL}/api/chat-genai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('❌ Error:', response.status, response.statusText);
      return;
    }

    console.log('✅ Connected! Streaming response...\n');
    console.log('--- Response ---');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (!data.trim()) continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'text-delta') {
              process.stdout.write(parsed.textDelta);
            } else if (parsed.type === 'finish') {
              console.log('\n\n✅ Stream finished!');
            } else if (parsed.type === 'error') {
              console.error('\n❌ Error:', parsed.error);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 Google GenAI API Tests');
  console.log('='.repeat(60));

  // Test 1: Google Maps
  await testGoogleMaps();

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 2: Google Search
  await testGoogleSearch();

  console.log('\n' + '='.repeat(60));
  console.log('✅ Tests completed!');
  console.log('='.repeat(60));
}

runTests();
