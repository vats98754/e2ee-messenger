class EncryptedMessenger {
    constructor() {
        this.encryption = new EncryptionManager();
        this.messageRelay = new SimpleMessageRelay();
        this.username = '';
        this.contactName = '';
        this.isConnected = false;
        this.chatId = '';
        
        // Initialize media features
        this.mediaEncryption = null;
        this.locationManager = null;
        this.mediaUI = null;
        
        this.initializeUI();
        this.bindEvents();
        this.showStatus('Ready to setup secure chat');
    }

    initializeUI() {
        this.elements = {
            // Setup screen elements
            setupScreen: document.getElementById('setupScreen'),
            chatScreen: document.getElementById('chatScreen'),
            
            // Step 1: Identity
            usernameInput: document.getElementById('usernameInput'),
            generateKeysBtn: document.getElementById('generateKeysBtn'),
            keyGenStatus: document.getElementById('keyGenStatus'),
            
            // Step 2: Keys
            keySection: document.getElementById('keySection'),
            myPublicKey: document.getElementById('myPublicKey'),
            copyPublicKeyBtn: document.getElementById('copyPublicKeyBtn'),
            showQRBtn: document.getElementById('showQRBtn'),
            qrCode: document.getElementById('qrCode'),
            
            // Step 3: Contact
            contactSection: document.getElementById('contactSection'),
            contactPublicKey: document.getElementById('contactPublicKey'),
            verifyContactBtn: document.getElementById('verifyContactBtn'),
            contactVerifyStatus: document.getElementById('contactVerifyStatus'),
            
            // Step 4: Chat Options
            chatOptionsSection: document.getElementById('chatOptionsSection'),
            createChatBtn: document.getElementById('createChatBtn'),
            joinChatInput: document.getElementById('joinChatInput'),
            joinChatBtn: document.getElementById('joinChatBtn'),
            
            // Chat ID Display
            chatIdSection: document.getElementById('chatIdSection'),
            chatIdDisplay: document.getElementById('chatIdDisplay'),
            copyChatIdBtn: document.getElementById('copyChatIdBtn'),
            enterChatBtn: document.getElementById('enterChatBtn'),
            
            // Chat screen elements
            contactName: document.getElementById('contactName'),
            activeChatId: document.getElementById('activeChatId'),
            connectionStatus: document.getElementById('connectionStatus'),
            messagesContainer: document.getElementById('messagesContainer'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            
            // Header elements
            userStatus: document.getElementById('userStatus'),
            disconnectBtn: document.getElementById('disconnectBtn')
        };
    }

    bindEvents() {
        // Step 1: Generate Keys
        this.elements.generateKeysBtn.addEventListener('click', () => this.generateKeys());
        
        // Step 2: Key Management
        this.elements.copyPublicKeyBtn.addEventListener('click', () => this.copyPublicKey());
        this.elements.showQRBtn.addEventListener('click', () => this.showQRCode());
        
        // Step 3: Contact Verification
        this.elements.verifyContactBtn.addEventListener('click', () => this.verifyContactKey());
        
        // Step 4: Chat Options
        this.elements.createChatBtn.addEventListener('click', () => this.createNewChat());
        this.elements.joinChatBtn.addEventListener('click', () => this.joinExistingChat());
        
        // Chat ID Actions
        this.elements.copyChatIdBtn.addEventListener('click', () => this.copyChatId());
        this.elements.enterChatBtn.addEventListener('click', () => this.enterChatRoom());
        
        // Chat screen events
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Header events
        this.elements.disconnectBtn.addEventListener('click', () => this.startNewChat());
        
        // Message relay callbacks
        this.messageRelay.onMessageReceived = (message) => this.handleReceivedMessage(message);
        this.messageRelay.onConnectionStatusChanged = (status, message) => this.updateConnectionStatus(status, message);
    }

    // Step 1: Generate encryption keys
    async generateKeys() {
        const username = this.elements.usernameInput.value.trim();
        if (!username) {
            this.showStatusMessage('keyGenStatus', 'Please enter a username', 'error');
            return;
        }
        if (username.length < 2) {
            this.showStatusMessage('keyGenStatus', 'Username must be at least 2 characters', 'error');
            return;
        }

        this.username = username;
        this.elements.generateKeysBtn.disabled = true;
        this.elements.generateKeysBtn.textContent = '🔄 Generating Keys...';
        this.showStatusMessage('keyGenStatus', 'Generating cryptographic keys...', 'info');

        try {
            const success = await this.encryption.generateKeyPair();
            if (success) {
                const publicKey = await this.encryption.exportPublicKey();
                this.elements.myPublicKey.value = publicKey;
                
                // Show next step
                this.elements.keySection.style.display = 'block';
                this.elements.contactSection.style.display = 'block';
                
                this.elements.generateKeysBtn.textContent = '✅ Keys Generated';
                this.showStatusMessage('keyGenStatus', 'Encryption keys generated successfully!', 'success');
                this.showStatus(`${username} - Keys Ready`);
                
                // Scroll to next section
                this.elements.keySection.scrollIntoView({ behavior: 'smooth' });
            } else {
                throw new Error('Key generation failed');
            }
        } catch (error) {
            console.error('Key generation error:', error);
            this.showStatusMessage('keyGenStatus', 'Failed to generate keys. Please try again.', 'error');
            this.elements.generateKeysBtn.disabled = false;
            this.elements.generateKeysBtn.textContent = 'Generate Encryption Keys';
        }
    }

    // Step 2: Copy public key
    copyPublicKey() {
        if (!this.elements.myPublicKey.value) {
            this.showNotification('No public key to copy', 'error');
            return;
        }
        
        navigator.clipboard.writeText(this.elements.myPublicKey.value)
            .then(() => this.showNotification('✅ Public key copied to clipboard!', 'success'))
            .catch(() => this.showNotification('❌ Failed to copy public key', 'error'));
    }

    // Step 2: Show QR code
    async showQRCode() {
        if (!this.elements.myPublicKey.value) {
            this.showNotification('No public key to generate QR code', 'error');
            return;
        }
        
        try {
            const qrData = JSON.stringify({
                username: this.username,
                publicKey: this.elements.myPublicKey.value,
                type: 'encrypted_messenger_key'
            });
            
            this.elements.qrCode.innerHTML = '';
            await QRCode.toCanvas(this.elements.qrCode, qrData, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#075e54',
                    light: '#ffffff'
                }
            });
            this.elements.qrCode.style.display = 'block';
            this.showNotification('📱 QR code generated! Your contact can scan this.', 'success');
        } catch (error) {
            console.error('QR generation error:', error);
            this.showNotification('❌ Failed to generate QR code', 'error');
        }
    }

    // Step 3: Verify contact's public key
    async verifyContactKey() {
        const contactPublicKey = this.elements.contactPublicKey.value.trim();
        if (!contactPublicKey) {
            this.showStatusMessage('contactVerifyStatus', 'Please paste your contact\'s public key', 'error');
            return;
        }

        this.elements.verifyContactBtn.disabled = true;
        this.elements.verifyContactBtn.textContent = '🔄 Verifying...';
        this.showStatusMessage('contactVerifyStatus', 'Verifying contact\'s public key...', 'info');

        try {
            // Try to parse as QR code data first
            let publicKey = contactPublicKey;
            let contactUsername = 'Contact';
            
            try {
                const qrData = JSON.parse(contactPublicKey);
                if (qrData.publicKey && qrData.username && qrData.type === 'encrypted_messenger_key') {
                    publicKey = qrData.publicKey;
                    contactUsername = qrData.username;
                    this.showStatusMessage('contactVerifyStatus', `QR data detected for user: ${contactUsername}`, 'info');
                }
            } catch (e) {
                // Not QR data, treat as direct public key
            }

            const success = await this.encryption.importContactPublicKey(publicKey);
            if (success) {
                this.contactName = contactUsername;
                this.elements.chatOptionsSection.style.display = 'block';
                this.elements.verifyContactBtn.textContent = '✅ Key Verified';
                this.showStatusMessage('contactVerifyStatus', 
                    `Contact key verified! Ready to chat with ${contactUsername}`, 'success');
                
                // Scroll to next section
                this.elements.chatOptionsSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                throw new Error('Invalid key format');
            }
        } catch (error) {
            console.error('Contact key verification error:', error);
            this.showStatusMessage('contactVerifyStatus', 
                'Invalid public key format. Please check and try again.', 'error');
            this.elements.verifyContactBtn.disabled = false;
            this.elements.verifyContactBtn.textContent = 'Verify Contact Key';
        }
    }

    // Step 4a: Create new chat
    async createNewChat() {
        if (!this.encryption.contactPublicKey) {
            this.showNotification('Please verify contact\'s key first', 'error');
            return;
        }

        this.elements.createChatBtn.disabled = true;
        this.elements.createChatBtn.textContent = '🔄 Creating...';

        try {
            this.chatId = await this.messageRelay.createChat(this.username);
            
            // Show chat ID for sharing
            this.elements.chatIdDisplay.value = this.chatId;
            this.elements.chatIdSection.style.display = 'block';
            this.elements.createChatBtn.textContent = '✅ Chat Created';
            
            this.showNotification('🎉 Chat room created! Share the Chat ID with your contact.', 'success');
            
            // Scroll to chat ID section
            this.elements.chatIdSection.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Chat creation error:', error);
            this.showNotification('❌ Failed to create chat room', 'error');
            this.elements.createChatBtn.disabled = false;
            this.elements.createChatBtn.textContent = '📝 Create New Chat';
        }
    }

    // Step 4b: Join existing chat
    async joinExistingChat() {
        const chatId = this.elements.joinChatInput.value.trim();
        if (!chatId) {
            this.showNotification('Please enter a Chat ID', 'error');
            return;
        }
        
        if (!this.encryption.contactPublicKey) {
            this.showNotification('Please verify contact\'s key first', 'error');
            return;
        }

        this.elements.joinChatBtn.disabled = true;
        this.elements.joinChatBtn.textContent = '🔄 Joining...';

        try {
            await this.messageRelay.joinChat(chatId, this.username);
            this.chatId = chatId;
            
            this.showNotification('✅ Successfully joined chat room!', 'success');
            this.enterChatRoom();
            
        } catch (error) {
            console.error('Join chat error:', error);
            this.showNotification('❌ Failed to join chat. Please check the Chat ID.', 'error');
            this.elements.joinChatBtn.disabled = false;
            this.elements.joinChatBtn.textContent = '🔗 Join Chat';
        }
    }

    // Copy chat ID
    copyChatId() {
        if (!this.elements.chatIdDisplay.value) {
            this.showNotification('No Chat ID to copy', 'error');
            return;
        }
        
        navigator.clipboard.writeText(this.elements.chatIdDisplay.value)
            .then(() => this.showNotification('📋 Chat ID copied to clipboard!', 'success'))
            .catch(() => this.showNotification('❌ Failed to copy Chat ID', 'error'));
    }

        // Enter chat room
    enterChatRoom() {
        if (!this.chatId) {
            this.showNotification('❌ No chat room selected', 'error');
            return;
        }
        
        // Initialize media features
        this.initializeMediaFeatures();
        
        this.elements.setupScreen.style.display = 'none';
        this.elements.chatScreen.style.display = 'flex';
        this.elements.contactName.textContent = `🔐 ${this.contactName}`;
        this.elements.activeChatId.textContent = this.chatId;
        this.elements.messageInput.focus();
        this.isConnected = true;
        this.showStatus(`Chatting with ${this.contactName}`);
        this.elements.disconnectBtn.style.display = 'block';
        
        // Clear welcome message after a few seconds
        setTimeout(() => {
            const welcomeMessage = document.querySelector('.welcome-message');
            if (welcomeMessage && welcomeMessage.parentNode.children.length === 1) {
                welcomeMessage.style.opacity = '0.5';
            }
        }, 3000);
    }

    // Initialize media features after successful connection
    initializeMediaFeatures() {
        this.mediaEncryption = new MediaEncryptionManager(this.encryption);
        this.locationManager = new LocationManager(this.mediaEncryption, this.messageRelay);
        this.mediaUI = new MediaUIManager(this.mediaEncryption, this.messageRelay, this.locationManager);
    }

    // Send encrypted message
    async sendMessage() {
        const messageText = this.elements.messageInput.value.trim();
        if (!messageText) return;
        
        if (messageText.length > 500) {
            this.showNotification('Message too long (max 500 characters)', 'error');
            return;
        }

        try {
            this.elements.sendBtn.disabled = true;
            this.elements.sendBtn.textContent = '🔄';
            
            // Encrypt the message
            const encryptedContent = await this.encryption.smartEncrypt(messageText);
            
            // Send via message relay
            await this.messageRelay.sendMessage(encryptedContent);
            
            // Display in UI
            this.displayMessage(messageText, 'sent', this.username);
            this.elements.messageInput.value = '';
            
            this.elements.sendBtn.disabled = false;
            this.elements.sendBtn.textContent = '🚀 Send';
            
        } catch (error) {
            console.error('Send message error:', error);
            this.showNotification('❌ Failed to send message', 'error');
            this.elements.sendBtn.disabled = false;
            this.elements.sendBtn.textContent = '🚀 Send';
        }
    }

    // Handle received encrypted message
    async handleReceivedMessage(message) {
        try {
            // First try to decrypt as a regular text message
            try {
                const decryptedContent = await this.encryption.smartDecrypt(message.content);
                this.displayMessage(decryptedContent, 'received', message.sender);
                return;
            } catch (textDecryptError) {
                // If that fails, try to parse as multimedia message
                try {
                    const messageData = JSON.parse(message.content);
                    
                    // Handle different message types
                    if (messageData.type === 'media' || messageData.type === 'location') {
                        // Use media UI to render multimedia messages
                        if (this.mediaUI) {
                            this.mediaUI.renderMediaMessage({
                                ...messageData,
                                sender: 'contact'
                            }, this.elements.messagesContainer);
                        }
                    } else {
                        // Handle other structured messages
                        const decryptedContent = await this.encryption.smartDecrypt(messageData.content);
                        this.displayMessage(decryptedContent, 'received', message.sender);
                    }
                } catch (jsonError) {
                    // If both fail, show the original error
                    throw textDecryptError;
                }
            }
        } catch (error) {
            console.error('Failed to handle received message:', error);
            this.displayMessage('❌ Failed to decrypt message', 'received', message.sender, true);
        }
    }

    // Display message in chat
    displayMessage(content, type, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        if (isError) {
            messageBubble.style.backgroundColor = '#ffebee';
            messageBubble.style.color = '#d32f2f';
        }
        
        // Add sender name for received messages
        if (type === 'received') {
            const senderDiv = document.createElement('div');
            senderDiv.className = 'message-sender';
            senderDiv.textContent = sender;
            messageBubble.appendChild(senderDiv);
        }
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date().toLocaleTimeString([], {
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        messageBubble.appendChild(messageContent);
        messageBubble.appendChild(messageTime);
        messageDiv.appendChild(messageBubble);
        
        this.elements.messagesContainer.appendChild(messageDiv);
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }

    // Update connection status
    updateConnectionStatus(status, message) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = message;
            this.elements.connectionStatus.className = `connection-status ${status}`;
        }
    }

    // Start new chat (reset everything)
    startNewChat() {
        // Stop any live location sharing
        if (this.locationManager && this.locationManager.isLiveTrackingActive()) {
            this.locationManager.stopLiveLocationSharing();
        }
        
        this.messageRelay.disconnect();
        this.isConnected = false;
        this.chatId = '';
        this.contactName = '';
        
        // Reset media features
        this.mediaEncryption = null;
        this.locationManager = null;
        this.mediaUI = null;
        
        // Reset UI
        this.elements.setupScreen.style.display = 'block';
        this.elements.chatScreen.style.display = 'none';
        this.elements.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">🔒</div>
                <h3>Secure Chat Established</h3>
                <p>Messages are encrypted end-to-end. Only you and your contact can read them.</p>
            </div>
        `;
        this.elements.disconnectBtn.style.display = 'none';
        
        // Reset forms
        this.resetSetupForm();
        this.showStatus('Setup Required');
    }

    // Reset setup form
    resetSetupForm() {
        // Hide all sections except the first
        this.elements.keySection.style.display = 'none';
        this.elements.contactSection.style.display = 'none';
        this.elements.chatOptionsSection.style.display = 'none';
        this.elements.chatIdSection.style.display = 'none';
        this.elements.qrCode.style.display = 'none';
        
        // Reset form values
        this.elements.usernameInput.value = '';
        this.elements.myPublicKey.value = '';
        this.elements.contactPublicKey.value = '';
        this.elements.joinChatInput.value = '';
        this.elements.chatIdDisplay.value = '';
        this.elements.messageInput.value = '';
        
        // Reset button states
        this.elements.generateKeysBtn.disabled = false;
        this.elements.generateKeysBtn.textContent = 'Generate Encryption Keys';
        this.elements.verifyContactBtn.disabled = false;
        this.elements.verifyContactBtn.textContent = 'Verify Contact Key';
        this.elements.createChatBtn.disabled = false;
        this.elements.createChatBtn.textContent = '📝 Create New Chat';
        this.elements.joinChatBtn.disabled = false;
        this.elements.joinChatBtn.textContent = '🔗 Join Chat';
        
        // Clear status messages
        this.clearStatusMessage('keyGenStatus');
        this.clearStatusMessage('contactVerifyStatus');
    }

    // Utility functions
    showStatus(status) {
        this.elements.userStatus.textContent = status;
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = `notification status-message ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Position notification
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '1000';
        notification.style.maxWidth = '300px';
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    showStatusMessage(elementId, message, type) {
        const element = this.elements[elementId];
        if (element) {
            element.textContent = message;
            element.className = `status-message ${type}`;
            element.style.display = 'block';
        }
    }

    clearStatusMessage(elementId) {
        const element = this.elements[elementId];
        if (element) {
            element.style.display = 'none';
            element.textContent = '';
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new EncryptedMessenger();
    
    // Demonstrate location sharing functionality
    console.log('🚀 Encrypted Messenger with Location Sharing Loaded!');
    console.log('📍 Type LocationSharingDemo.demonstrateLocationSharing() in console to see demo');
});
