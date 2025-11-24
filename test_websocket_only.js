// Test WebSocket functionality without database dependency
const WebSocket = require('ws');
const http = require('http');

console.log('Testing WebSocket functionality...');

// Create a simple HTTP server
const server = http.createServer();

// Test WebSocket server creation
try {
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws/test'
  });
  
  console.log('✓ WebSocket server created successfully');
  
  wss.on('connection', (ws) => {
    console.log('✓ WebSocket connection established');
    ws.send(JSON.stringify({ type: 'test', message: 'WebSocket is working!' }));
  });
  
  // Start the test server
  server.listen(3001, () => {
    console.log('✓ Test server running on port 3001');
    console.log('✓ WebSocket functionality test passed!');
    
    // Test client connection
    const client = new WebSocket('ws://localhost:3001/ws/test');
    
    client.on('open', () => {
      console.log('✓ WebSocket client connected');
    });
    
    client.on('message', (data) => {
      console.log('✓ Received message:', data.toString());
      client.close();
      server.close();
      console.log('✓ WebSocket test completed successfully!');
      process.exit(0);
    });
    
    client.on('error', (error) => {
      console.error('✗ WebSocket client error:', error);
      server.close();
      process.exit(1);
    });
  });
  
} catch (error) {
  console.error('✗ WebSocket server creation failed:', error);
  process.exit(1);
}