class EncryptionManager {
    constructor() {
        this.keyPair = null;
        this.contactPublicKey = null;
    }

    // Generate a new key pair
    async generateKeyPair() {
        try {
            this.keyPair = await window.crypto.subtle.generateKey(
                {
                    name: "RSA-OAEP",
                    modulusLength: 2048,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash: "SHA-256",
                },
                true,
                ["encrypt", "decrypt"]
            );
            return true;
        } catch (error) {
            console.error('Key generation failed:', error);
            return false;
        }
    }

    // Export public key to base64 string
    async exportPublicKey() {
        if (!this.keyPair) return null;
        
        try {
            const exported = await window.crypto.subtle.exportKey(
                "spki",
                this.keyPair.publicKey
            );
            return this.arrayBufferToBase64(exported);
        } catch (error) {
            console.error('Public key export failed:', error);
            return null;
        }
    }

    // Import contact's public key from base64 string
    async importContactPublicKey(base64Key) {
        try {
            const keyData = this.base64ToArrayBuffer(base64Key);
            this.contactPublicKey = await window.crypto.subtle.importKey(
                "spki",
                keyData,
                {
                    name: "RSA-OAEP",
                    hash: "SHA-256",
                },
                false,
                ["encrypt"]
            );
            return true;
        } catch (error) {
            console.error('Contact public key import failed:', error);
            return false;
        }
    }

    // Encrypt message for contact
    async encryptMessage(message) {
        if (!this.contactPublicKey) {
            throw new Error('Contact public key not set');
        }

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            
            const encrypted = await window.crypto.subtle.encrypt(
                {
                    name: "RSA-OAEP"
                },
                this.contactPublicKey,
                data
            );
            
            return this.arrayBufferToBase64(encrypted);
        } catch (error) {
            console.error('Encryption failed:', error);
            throw error;
        }
    }

    // Decrypt received message
    async decryptMessage(encryptedBase64) {
        if (!this.keyPair) {
            throw new Error('Key pair not generated');
        }

        try {
            const encryptedData = this.base64ToArrayBuffer(encryptedBase64);
            
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: "RSA-OAEP"
                },
                this.keyPair.privateKey,
                encryptedData
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw error;
        }
    }

    // Generate a symmetric key for hybrid encryption (for larger messages)
    async generateSymmetricKey() {
        return await window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    // Encrypt large message using hybrid encryption (AES + RSA)
    async encryptLargeMessage(message) {
        if (!this.contactPublicKey) {
            throw new Error('Contact public key not set');
        }

        try {
            // Generate symmetric key
            const symmetricKey = await this.generateSymmetricKey();
            
            // Encrypt message with AES
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                symmetricKey,
                data
            );
            
            // Export and encrypt the symmetric key with RSA
            const exportedKey = await window.crypto.subtle.exportKey("raw", symmetricKey);
            const encryptedKey = await window.crypto.subtle.encrypt(
                {
                    name: "RSA-OAEP"
                },
                this.contactPublicKey,
                exportedKey
            );
            
            // Combine everything
            const result = {
                encryptedKey: this.arrayBufferToBase64(encryptedKey),
                encryptedData: this.arrayBufferToBase64(encryptedData),
                iv: this.arrayBufferToBase64(iv)
            };
            
            return JSON.stringify(result);
        } catch (error) {
            console.error('Large message encryption failed:', error);
            throw error;
        }
    }

    // Decrypt large message using hybrid encryption
    async decryptLargeMessage(encryptedMessage) {
        if (!this.keyPair) {
            throw new Error('Key pair not generated');
        }

        try {
            const data = JSON.parse(encryptedMessage);
            
            // Decrypt the symmetric key
            const encryptedKeyData = this.base64ToArrayBuffer(data.encryptedKey);
            const symmetricKeyData = await window.crypto.subtle.decrypt(
                {
                    name: "RSA-OAEP"
                },
                this.keyPair.privateKey,
                encryptedKeyData
            );
            
            // Import the symmetric key
            const symmetricKey = await window.crypto.subtle.importKey(
                "raw",
                symmetricKeyData,
                {
                    name: "AES-GCM",
                },
                false,
                ["decrypt"]
            );
            
            // Decrypt the message
            const encryptedData = this.base64ToArrayBuffer(data.encryptedData);
            const iv = this.base64ToArrayBuffer(data.iv);
            
            const decryptedData = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                symmetricKey,
                encryptedData
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decryptedData);
        } catch (error) {
            console.error('Large message decryption failed:', error);
            throw error;
        }
    }

    // Smart encrypt - uses RSA for small messages, hybrid for large ones
    async smartEncrypt(message) {
        const encoder = new TextEncoder();
        const messageSize = encoder.encode(message).length;
        
        // RSA-OAEP can encrypt up to (key_size/8) - 2*hash_size - 2 bytes
        // For 2048-bit key with SHA-256: 2048/8 - 2*32 - 2 = 190 bytes
        const maxDirectSize = 190;
        
        if (messageSize <= maxDirectSize) {
            return await this.encryptMessage(message);
        } else {
            return await this.encryptLargeMessage(message);
        }
    }

    // Smart decrypt - detects format and uses appropriate method
    async smartDecrypt(encryptedMessage) {
        try {
            // Try to parse as JSON (hybrid encryption)
            JSON.parse(encryptedMessage);
            return await this.decryptLargeMessage(encryptedMessage);
        } catch (e) {
            // Not JSON, try direct RSA decryption
            return await this.decryptMessage(encryptedMessage);
        }
    }

    // Utility functions
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}
