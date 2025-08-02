class SimpleMessageRelay {
    constructor() {
        this.chatId = null;
        this.username = null;
        this.onMessageReceived = null;
        this.onConnectionStatusChanged = null;
        this.isPolling = false;
        this.pollInterval = null;
        this.broadcastChannel = null;
        this.lastMessageCount = 0;
        this.storageKey = 'encrypted_messenger_';
    }

    // Generate a unique chat ID
    generateChatId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `chat_${timestamp}_${random}`;
    }

    // Create a new chat room
    async createChat(username) {
        try {
            this.username = username;
            this.chatId = this.generateChatId();
            
            this.updateStatus('connecting', '🔧 Creating chat room...');
            
            // Initialize chat data
            const chatData = {
                chatId: this.chatId,
                created: new Date().toISOString(),
                creator: username,
                participants: [username],
                messages: []
            };
            
            // Save to localStorage
            localStorage.setItem(this.storageKey + this.chatId, JSON.stringify(chatData));
            
            // Set up communication
            this.setupBroadcastChannel();
            this.startPolling();
            
            this.updateStatus('connected', '✅ Chat room created');
            return this.chatId;
            
        } catch (error) {
            console.error('Failed to create chat:', error);
            this.updateStatus('error', '❌ Failed to create chat');
            throw error;
        }
    }

    // Join an existing chat room
    async joinChat(chatId, username) {
        try {
            this.username = username;
            this.chatId = chatId;
            
            this.updateStatus('connecting', '🔍 Looking for chat room...');
            
            // Check if chat exists
            const chatData = localStorage.getItem(this.storageKey + chatId);
            if (!chatData) {
                throw new Error('Chat room not found');
            }
            
            const chat = JSON.parse(chatData);
            
            // Add user to participants if not already there
            if (!chat.participants.includes(username)) {
                chat.participants.push(username);
                localStorage.setItem(this.storageKey + chatId, JSON.stringify(chat));
            }
            
            // Set up communication
            this.setupBroadcastChannel();
            this.lastMessageCount = chat.messages.length;
            
            // Load existing messages
            this.loadExistingMessages();
            this.startPolling();
            
            this.updateStatus('connected', '✅ Joined chat room');
            return true;
            
        } catch (error) {
            console.error('Failed to join chat:', error);
            this.updateStatus('error', '❌ Chat room not found');
            throw error;
        }
    }

    // Set up BroadcastChannel for real-time communication
    setupBroadcastChannel() {
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
        }
        
        this.broadcastChannel = new BroadcastChannel(`encrypted_chat_${this.chatId}`);
        this.broadcastChannel.onmessage = (event) => {
            if (event.data.type === 'new_message' && event.data.sender !== this.username) {
                // New message from another user
                this.checkForNewMessages();
            }
        };
    }

    // Send an encrypted message (now supports multimedia)
    async sendMessage(encryptedContent) {
        if (!this.chatId || !this.username) {
            throw new Error('Chat not initialized');
        }

        try {
            // Get current chat data
            const chatData = localStorage.getItem(this.storageKey + this.chatId);
            if (!chatData) {
                throw new Error('Chat room not found');
            }

            const chat = JSON.parse(chatData);
            
            // Parse message to determine type
            let messageType = 'text';
            let messageSize = encryptedContent.length;
            
            try {
                const parsed = JSON.parse(encryptedContent);
                if (parsed.type === 'media' || parsed.type === 'location') {
                    messageType = parsed.type;
                    messageSize = JSON.stringify(parsed.content).length;
                }
            } catch (e) {
                // Regular text message
            }
            
            // Create message object
            const message = {
                id: Date.now() + Math.random(), // Unique ID
                sender: this.username,
                content: encryptedContent,
                timestamp: new Date().toISOString(),
                encrypted: true,
                type: messageType,
                size: messageSize
            };
            
            // Add to chat
            chat.messages.push(message);
            
            // Save back to localStorage
            localStorage.setItem(this.storageKey + this.chatId, JSON.stringify(chat));
            
            // Notify other tabs/windows
            if (this.broadcastChannel) {
                this.broadcastChannel.postMessage({
                    type: 'new_message',
                    sender: this.username,
                    messageId: message.id,
                    messageType: messageType
                });
            }
            
            this.lastMessageCount = chat.messages.length;
            
            if (messageType === 'media') {
                this.updateStatus('connected', '📤 Media sent');
            } else if (messageType === 'location') {
                this.updateStatus('connected', '📍 Location shared');
            } else {
                this.updateStatus('connected', '📤 Message sent');
            }
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.updateStatus('error', '❌ Failed to send message');
            throw error;
        }
    }

    // Load existing messages when joining
    loadExistingMessages() {
        try {
            const chatData = localStorage.getItem(this.storageKey + this.chatId);
            if (!chatData) return;

            const chat = JSON.parse(chatData);
            
            // Load all messages from other users
            chat.messages.forEach(message => {
                if (message.sender !== this.username && this.onMessageReceived) {
                    this.onMessageReceived(message);
                }
            });
            
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    // Start polling for new messages
    startPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        this.updateStatus('polling', '👂 Listening for messages...');
        
        // Poll every 2 seconds
        this.pollInterval = setInterval(() => {
            this.checkForNewMessages();
        }, 2000);
    }

    // Check for new messages
    checkForNewMessages() {
        try {
            const chatData = localStorage.getItem(this.storageKey + this.chatId);
            if (!chatData) return;

            const chat = JSON.parse(chatData);
            const currentMessageCount = chat.messages.length;
            
            // If there are new messages
            if (currentMessageCount > this.lastMessageCount) {
                const newMessages = chat.messages.slice(this.lastMessageCount);
                
                newMessages.forEach(message => {
                    // Only process messages from other users
                    if (message.sender !== this.username && this.onMessageReceived) {
                        this.onMessageReceived(message);
                    }
                });
                
                this.lastMessageCount = currentMessageCount;
                this.updateStatus('connected', '📥 New message received');
            }
            
        } catch (error) {
            console.error('Error checking for messages:', error);
        }
    }

    // Get chat information
    getChatInfo() {
        if (!this.chatId) return null;
        
        try {
            const chatData = localStorage.getItem(this.storageKey + this.chatId);
            if (!chatData) return null;
            
            const chat = JSON.parse(chatData);
            return {
                chatId: this.chatId,
                participants: chat.participants,
                messageCount: chat.messages.length,
                created: chat.created
            };
        } catch (error) {
            console.error('Error getting chat info:', error);
            return null;
        }
    }

    // Stop polling and disconnect
    disconnect() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
            this.broadcastChannel = null;
        }
        
        this.isPolling = false;
        this.chatId = null;
        this.username = null;
        this.lastMessageCount = 0;
        
        this.updateStatus('disconnected', '🔌 Disconnected');
    }

    // Update connection status
    updateStatus(status, message) {
        if (this.onConnectionStatusChanged) {
            this.onConnectionStatusChanged(status, message);
        }
    }

    // Debug: List all available chats
    listAvailableChats() {
        const chats = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.storageKey)) {
                try {
                    const chatData = JSON.parse(localStorage.getItem(key));
                    chats.push({
                        chatId: chatData.chatId,
                        created: chatData.created,
                        creator: chatData.creator,
                        participants: chatData.participants,
                        messageCount: chatData.messages.length
                    });
                } catch (e) {
                    // Skip invalid data
                }
            }
        }
        return chats;
    }
}
