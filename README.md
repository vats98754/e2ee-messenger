# End-to-End Encryption Messenger

I got curious about how messaging apps like WhatsApp and Signal actually implement end-to-end encryption. Instead of just reading about it, I decided to build my own encrypted messenger to understand the real implementation details.

## What I Built

A browser-based encrypted messenger that runs entirely client-side using the WebCrypto API. No servers, no databases, just localStorage and browser APIs.

## Key Learnings

**RSA Size Limitations**: RSA-2048 can only encrypt 190 bytes at a time. This is why real messaging apps use hybrid encryption.

**Hybrid Encryption Pattern**: Small messages use pure RSA. Large messages generate an AES-256 key, encrypt the message with AES, then encrypt the AES key with RSA. This is exactly what Signal and WhatsApp do.

**Browser Crypto is Production Ready**: The WebCrypto API provides robust implementations of RSA-OAEP and AES-GCM that are suitable for real applications.

**Key Exchange is the Hard Part**: Generating and using encryption keys is straightforward. Securely sharing public keys between users is where most security failures happen.

**No Server Can Be More Secure**: By using localStorage + BroadcastChannel for message transport, there's literally no server to compromise. Messages exist only in encrypted form in browser storage.

## Architecture

- `crypto.js` - RSA + AES hybrid encryption implementation  
- `simple-relay.js` - localStorage + BroadcastChannel message transport  
- `app.js` - UI coordination and key management  
- `index.html` - Interface for key exchange and messaging  

## How It Works

1. Each user generates a 2048-bit RSA key pair in their browser  
2. Public keys are shared via QR codes or copy/paste  
3. Messages are encrypted using hybrid RSA+AES encryption  
4. Encrypted messages are stored in localStorage and synced via BroadcastChannel API  
5. Recipients decrypt messages with their private keys  

## Running Locally

```bash
python -m http.server 8000
# Open http://localhost:8000 in two browser tabs
```

## Security Properties

- End-to-end encryption using WebCrypto API  
- Private keys never leave the browser  
- Messages stored only in encrypted form  
- No network dependencies (can run offline)  

## Limitations

- Trust on first use (no identity verification)  
- No perfect forward secrecy  
- localStorage persistence (messages don't auto-delete)  
- Single device per user  

## Next Steps

For production use, I'd add key fingerprint verification, the Signal Double Ratchet protocol for perfect forward secrecy, and a proper server-based message relay. But for understanding the core concepts of end-to-end encryption, this implementation covers all the essential pieces.