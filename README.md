# End-to-End Encryption Messenger

I got curious about how messaging apps like WhatsApp and Signal actually implement end-to-end encryption. Instead of just reading about it, I decided to build my own encrypted messenger to understand the real implementation details.

## What I Built

A browser-based encrypted messenger that runs entirely client-side using the WebCrypto API. No servers, no databases, just localStorage and browser APIs. Now with full multimedia support including encrypted image/video sharing and live location tracking.

## Key Features

**🔒 End-to-End Encryption**: All messages, media, and location data encrypted client-side
**📸 Image Sharing**: Encrypted image sharing with automatic compression  
**🎥 Video Sharing**: Encrypted video sharing with chunked streaming  
**📍 Location Sharing**: Current location and live location tracking  
**💬 Text Messages**: Traditional encrypted text messaging  
**🔄 Real-time Sync**: BroadcastChannel API for instant message delivery  
**📱 Responsive Design**: Works on desktop and mobile browsers  

## Key Learnings

**RSA Size Limitations**: RSA-2048 can only encrypt 190 bytes at a time. This is why real messaging apps use hybrid encryption.

**Hybrid Encryption Pattern**: Small messages use pure RSA. Large messages generate an AES-256 key, encrypt the message with AES, then encrypt the AES key with RSA. This is exactly what Signal and WhatsApp do.

**Chunked Media Encryption**: Large media files are encrypted in 64KB chunks for better memory management and streaming capabilities.

**Browser Crypto is Production Ready**: The WebCrypto API provides robust implementations of RSA-OAEP and AES-GCM that are suitable for real applications.

**Key Exchange is the Hard Part**: Generating and using encryption keys is straightforward. Securely sharing public keys between users is where most security failures happen.

**No Server Can Be More Secure**: By using localStorage + BroadcastChannel for message transport, there's literally no server to compromise. Messages exist only in encrypted form in browser storage.

## Architecture

- `crypto.js` - RSA + AES hybrid encryption implementation  
- `media-crypto.js` - Multimedia encryption with chunked streaming  
- `advanced-codecs.js` - Custom image/video codecs with optimized compression
- `location-manager.js` - Location services with live tracking  
- `media-ui.js` - UI components for multimedia features  
- `simple-relay.js` - localStorage + BroadcastChannel message transport  
- `app.js` - Main application coordination and key management  
- `index.html` - Interface for key exchange and messaging  

## How It Works

1. Each user generates a 2048-bit RSA key pair in their browser  
2. Public keys are shared via QR codes or copy/paste  
3. Messages are encrypted using hybrid RSA+AES encryption  
4. Media files are compressed, chunked, and encrypted with AES-256  
5. Location data is encrypted and can be shared live with automatic updates  
6. Encrypted messages are stored in localStorage and synced via BroadcastChannel API  
7. Recipients decrypt messages with their private keys  

## Media Features

### 📸 Image Sharing
- **Advanced WebP Compression**: Custom codec with intelligent quality optimization
- **Smart Size Management**: Automatic compression to meet 2MB target while preserving quality
- **Security Watermarking**: Subtle encrypted timestamps for authenticity
- **Progressive Quality**: Content-aware compression based on image complexity
- **Client-side Encryption**: End-to-end encrypted before transmission
- **Support for all common image formats**: JPEG, PNG, WebP, GIF, BMP

### 🎥 Video Sharing  
- **Chunked Streaming**: Large videos encrypted in 64KB chunks for efficient streaming
- **Metadata Preservation**: Duration, resolution, and bitrate information retained
- **Fallback Encoding**: Robust processing with multiple codec attempts
- **Progressive Decryption**: Streaming playback with real-time decryption
- **File Size Optimization**: Smart compression balancing quality and size
- **Support for major video formats**: MP4, WebM, AVI, MOV

### 📍 Location Sharing
- **One-time Location**: Share current GPS coordinates with accuracy information
- **Live Location Tracking**: Continuous location updates with smart movement detection
- **Interactive Maps**: Embedded OpenStreetMap display with zoom controls
- **Privacy Controls**: Easy start/stop for live tracking with clear indicators
- **Encrypted Coordinates**: All location data encrypted before storage/transmission
- **Battery Optimization**: Intelligent update algorithm (only when significantly moved)

## Running Locally

```bash
python -m http.server 8000
# Open http://localhost:8000 in two browser tabs
```

## Security Properties

- End-to-end encryption using WebCrypto API  
- Private keys never leave the browser  
- Messages and media stored only in encrypted form  
- Location data encrypted before storage/transmission  
- No network dependencies (can run offline)  
- Chunked encryption prevents memory-based attacks on large files  

## File Size Limits

- Images: 10MB (automatically compressed)  
- Videos: 50MB (chunked encryption)  
- Text Messages: 500 characters  

## Browser Compatibility

- Chrome/Edge: Full support  
- Firefox: Full support  
- Safari: Full support (iOS 14+)  
- Mobile browsers: Responsive design with touch support  

## Limitations

- Trust on first use (no identity verification)  
- No perfect forward secrecy  
- localStorage persistence (messages don't auto-delete)  
- Single device per user  
- File size limits due to browser memory constraints  
- Live location requires continuous permission  

## Next Steps

For production use, I'd add key fingerprint verification, the Signal Double Ratchet protocol for perfect forward secrecy, and a proper server-based message relay. But for understanding the core concepts of end-to-end encryption with multimedia support, this implementation covers all the essential pieces.