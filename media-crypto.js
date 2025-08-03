/**
 * Media Encryption Manager
 * Handles encryption/decryption of multimedia content (images, videos, location data)
 * Uses chunked encryption for large files and streaming capabilities
 */
class MediaEncryptionManager {
    constructor(baseEncryption) {
        this.baseEncryption = baseEncryption;
        this.chunkSize = 64 * 1024; // 64KB chunks for streaming
        this.compressionLevel = 0.8; // Default image compression
    }

    /**
     * Encrypt binary data (images, videos) with chunked encryption for streaming
     */
    async encryptBinaryData(arrayBuffer, metadata = {}) {
        if (!this.baseEncryption.contactPublicKey) {
            throw new Error('Contact public key not set');
        }

        try {
            // Generate symmetric key for this file
            const symmetricKey = await this.baseEncryption.generateSymmetricKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            // Encrypt metadata
            const metadataStr = JSON.stringify(metadata);
            const encryptedMetadata = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                symmetricKey,
                new TextEncoder().encode(metadataStr)
            );

            // Encrypt data in chunks for better memory management
            const chunks = [];
            const totalChunks = Math.ceil(arrayBuffer.byteLength / this.chunkSize);
            
            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.chunkSize;
                const end = Math.min(start + this.chunkSize, arrayBuffer.byteLength);
                const chunk = arrayBuffer.slice(start, end);
                
                const chunkIv = window.crypto.getRandomValues(new Uint8Array(12));
                const encryptedChunk = await window.crypto.subtle.encrypt(
                    {
                        name: "AES-GCM",
                        iv: chunkIv
                    },
                    symmetricKey,
                    chunk
                );
                
                chunks.push({
                    data: this.baseEncryption.arrayBufferToBase64(encryptedChunk),
                    iv: this.baseEncryption.arrayBufferToBase64(chunkIv),
                    index: i
                });
            }

            // Export and encrypt the symmetric key with RSA
            const exportedKey = await window.crypto.subtle.exportKey("raw", symmetricKey);
            const encryptedKey = await window.crypto.subtle.encrypt(
                {
                    name: "RSA-OAEP"
                },
                this.baseEncryption.contactPublicKey,
                exportedKey
            );

            return {
                type: 'encrypted_binary',
                encryptedKey: this.baseEncryption.arrayBufferToBase64(encryptedKey),
                metadata: this.baseEncryption.arrayBufferToBase64(encryptedMetadata),
                metadataIv: this.baseEncryption.arrayBufferToBase64(iv),
                chunks: chunks,
                totalSize: arrayBuffer.byteLength,
                totalChunks: totalChunks
            };
        } catch (error) {
            console.error('Binary data encryption failed:', error);
            throw error;
        }
    }

    /**
     * Decrypt binary data with progressive loading support
     */
    async decryptBinaryData(encryptedData, progressCallback = null) {
        if (!this.baseEncryption.keyPair) {
            throw new Error('Key pair not generated');
        }

        try {
            // Decrypt the symmetric key
            const encryptedKeyData = this.baseEncryption.base64ToArrayBuffer(encryptedData.encryptedKey);
            const symmetricKeyData = await window.crypto.subtle.decrypt(
                {
                    name: "RSA-OAEP"
                },
                this.baseEncryption.keyPair.privateKey,
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

            // Decrypt metadata
            const metadataIv = this.baseEncryption.base64ToArrayBuffer(encryptedData.metadataIv);
            const encryptedMetadata = this.baseEncryption.base64ToArrayBuffer(encryptedData.metadata);
            const decryptedMetadata = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: metadataIv
                },
                symmetricKey,
                encryptedMetadata
            );
            const metadata = JSON.parse(new TextDecoder().decode(decryptedMetadata));

            // Decrypt chunks
            const decryptedChunks = new Array(encryptedData.totalChunks);
            
            for (let i = 0; i < encryptedData.chunks.length; i++) {
                const chunk = encryptedData.chunks[i];
                const chunkData = this.baseEncryption.base64ToArrayBuffer(chunk.data);
                const chunkIv = this.baseEncryption.base64ToArrayBuffer(chunk.iv);
                
                const decryptedChunk = await window.crypto.subtle.decrypt(
                    {
                        name: "AES-GCM",
                        iv: chunkIv
                    },
                    symmetricKey,
                    chunkData
                );
                
                decryptedChunks[chunk.index] = decryptedChunk;
                
                // Report progress
                if (progressCallback) {
                    progressCallback((i + 1) / encryptedData.chunks.length * 100);
                }
            }

            // Combine chunks
            const totalSize = encryptedData.totalSize;
            const result = new Uint8Array(totalSize);
            let offset = 0;
            
            for (const chunk of decryptedChunks) {
                const chunkArray = new Uint8Array(chunk);
                result.set(chunkArray, offset);
                offset += chunkArray.length;
            }

            return {
                data: result.buffer,
                metadata: metadata
            };
        } catch (error) {
            console.error('Binary data decryption failed:', error);
            throw error;
        }
    }

    /**
     * Compress and encrypt image
     */
    async encryptImage(imageFile, quality = this.compressionLevel) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = async () => {
                try {
                    // Set canvas size
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    
                    // Draw and compress
                    ctx.drawImage(img, 0, 0);
                    
                    canvas.toBlob(async (blob) => {
                        try {
                            const arrayBuffer = await blob.arrayBuffer();
                            const metadata = {
                                type: 'image',
                                originalName: imageFile.name,
                                mimeType: blob.type,
                                width: canvas.width,
                                height: canvas.height,
                                size: arrayBuffer.byteLength,
                                timestamp: new Date().toISOString()
                            };
                            
                            const encrypted = await this.encryptBinaryData(arrayBuffer, metadata);
                            resolve(encrypted);
                        } catch (error) {
                            reject(error);
                        }
                    }, 'image/webp', quality);
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(imageFile);
        });
    }

    /**
     * Encrypt video with basic compression
     */
    async encryptVideo(videoFile) {
        try {
            const arrayBuffer = await videoFile.arrayBuffer();
            const metadata = {
                type: 'video',
                originalName: videoFile.name,
                mimeType: videoFile.type,
                size: arrayBuffer.byteLength,
                timestamp: new Date().toISOString()
            };
            
            return await this.encryptBinaryData(arrayBuffer, metadata);
        } catch (error) {
            console.error('Video encryption failed:', error);
            throw error;
        }
    }

    /**
     * Encrypt location data
     */
    async encryptLocation(locationData) {
        try {
            const locationStr = JSON.stringify(locationData);
            return await this.baseEncryption.smartEncrypt(locationStr);
        } catch (error) {
            console.error('Location encryption failed:', error);
            throw error;
        }
    }

    /**
     * Decrypt location data
     */
    async decryptLocation(encryptedLocation) {
        try {
            const locationStr = await this.baseEncryption.smartDecrypt(encryptedLocation);
            return JSON.parse(locationStr);
        } catch (error) {
            console.error('Location decryption failed:', error);
            throw error;
        }
    }
}
