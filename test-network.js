import fetch from 'node-fetch';
import os from 'os';

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Get local network IPs
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  
  return ips;
}

async function testNetworkAccess() {
  console.log('🌐 Testing CarrierHub Backend Network Access\n');
  
  const localIPs = getLocalIPs();
  const testUrls = [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    `http://0.0.0.0:${PORT}`,
    ...localIPs.map(ip => `http://${ip}:${PORT}`)
  ];
  
  console.log('📡 Available Network Interfaces:');
  console.log(`   Host: ${HOST}`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Local IPs: ${localIPs.join(', ')}`);
  console.log('');
  
  console.log('🧪 Testing URLs:');
  
  for (const url of testUrls) {
    try {
      const response = await fetch(`${url}/health`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ ${url} - Server is running`);
        console.log(`   Client IP: ${data.clientIP}`);
      } else {
        console.log(`❌ ${url} - Server responded but with error`);
      }
    } catch (error) {
      console.log(`❌ ${url} - Connection failed: ${error.message}`);
    }
  }
  
  console.log('\n🎯 Access Instructions:');
  console.log('1. From same machine: http://localhost:5000');
  console.log('2. From same network: http://[YOUR_IP]:5000');
  console.log('3. From external network: http://[PUBLIC_IP]:5000');
  console.log('\n📝 Make sure to:');
  console.log('- Open port 5000 in your firewall');
  console.log('- Configure router port forwarding if needed');
  console.log('- Use HTTPS in production');
}

testNetworkAccess().catch(console.error);
