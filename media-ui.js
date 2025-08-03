/**
 * Media UI Manager
 * Handles UI components for multimedia sharing
 */
class MediaUIManager {
    constructor(mediaEncryption, messageRelay, locationManager) {
        this.mediaEncryption = mediaEncryption;
        this.messageRelay = messageRelay;
        this.locationManager = locationManager;
        this.initializeUI();
        this.bindEvents();
    }

    initializeUI() {
        this.createMediaControls();
        this.createProgressModal();
        this.createLocationModal();
        this.createMediaViewer();
    }

    createMediaControls() {
        const messageInput = document.querySelector('.message-input');
        if (!messageInput) return;

        const mediaControls = document.createElement('div');
        mediaControls.className = 'media-controls';
        mediaControls.innerHTML = `
            <button class="media-btn" id="imageBtn" title="Share Image">📸</button>
            <button class="media-btn" id="videoBtn" title="Share Video">🎥</button>
            <button class="media-btn" id="locationBtn" title="Share Location">📍</button>
            <div class="live-location-indicator" id="liveLocationIndicator" style="display: none;">
                <span class="live-dot">🔴</span>
                <span class="live-text">Live</span>
            </div>
            <input type="file" id="imageInput" accept="image/*" style="display: none;">
            <input type="file" id="videoInput" accept="video/*" style="display: none;">
        `;
        
        messageInput.insertBefore(mediaControls, messageInput.firstChild);
    }

    createProgressModal() {
        const modal = document.createElement('div');
        modal.id = 'progressModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 id="progressTitle">Processing...</h3>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">0%</div>
                </div>
                <p id="progressDescription">Please wait...</p>
                <button id="cancelProgress" class="btn-secondary">Cancel</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    createLocationModal() {
        const modal = document.createElement('div');
        modal.id = 'locationModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📍 Share Location</h3>
                    <button class="close-btn" id="closeLocationModal">&times;</button>
                </div>
                <div class="location-options">
                    <button class="location-option" id="shareCurrentLocation">
                        <div class="option-icon">📍</div>
                        <div class="option-text">
                            <strong>Current Location</strong>
                            <p>Share your current position once</p>
                        </div>
                    </button>
                    <button class="location-option" id="shareLiveLocation">
                        <div class="option-icon">🔴</div>
                        <div class="option-text">
                            <strong>Live Location</strong>
                            <p>Share your location continuously</p>
                        </div>
                    </button>
                    <div class="live-location-controls" id="liveLocationControls" style="display: none;">
                        <p class="live-status">🔴 Live location is active</p>
                        <button id="stopLiveLocation" class="btn-danger">Stop Sharing</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    createMediaViewer() {
        const viewer = document.createElement('div');
        viewer.id = 'mediaViewer';
        viewer.className = 'media-viewer';
        viewer.innerHTML = `
            <div class="viewer-overlay" id="viewerOverlay">
                <div class="viewer-content">
                    <div class="viewer-header">
                        <h3 id="viewerTitle">Media</h3>
                        <button class="close-btn" id="closeViewer">&times;</button>
                    </div>
                    <div class="viewer-body" id="viewerBody">
                        <!-- Content will be inserted here -->
                    </div>
                    <div class="viewer-actions">
                        <button id="downloadMedia" class="btn-secondary">Download</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(viewer);
    }

    bindEvents() {
        // Image sharing
        document.getElementById('imageBtn')?.addEventListener('click', () => {
            document.getElementById('imageInput').click();
        });
        
        document.getElementById('imageInput')?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleImageShare(e.target.files[0]);
            }
        });

        // Video sharing
        document.getElementById('videoBtn')?.addEventListener('click', () => {
            document.getElementById('videoInput').click();
        });
        
        document.getElementById('videoInput')?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleVideoShare(e.target.files[0]);
            }
        });

        // Location sharing
        document.getElementById('locationBtn')?.addEventListener('click', () => {
            this.showLocationModal();
        });

        // Location modal events
        document.getElementById('closeLocationModal')?.addEventListener('click', () => {
            this.hideLocationModal();
        });

        document.getElementById('shareCurrentLocation')?.addEventListener('click', () => {
            this.handleCurrentLocationShare();
        });

        document.getElementById('shareLiveLocation')?.addEventListener('click', () => {
            this.handleLiveLocationShare();
        });

        document.getElementById('stopLiveLocation')?.addEventListener('click', () => {
            this.handleStopLiveLocation();
        });

        // Media viewer events
        document.getElementById('closeViewer')?.addEventListener('click', () => {
            this.hideMediaViewer();
        });

        document.getElementById('viewerOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'viewerOverlay') {
                this.hideMediaViewer();
            }
        });

        // Progress modal events
        document.getElementById('cancelProgress')?.addEventListener('click', () => {
            this.hideProgressModal();
        });

        // Update live location status
        this.locationManager.addLocationCallback(() => {
            this.updateLiveLocationStatus();
        });
    }

    async handleImageShare(file) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showNotification('❌ Image too large (max 10MB)', 'error');
            return;
        }

        try {
            this.showProgressModal('Encrypting Image', 'Compressing and encrypting your image...');
            
            const encrypted = await this.mediaEncryption.encryptImage(file, 0.8);
            this.updateProgress(100);
            
            const message = {
                type: 'media',
                subtype: 'image',
                content: encrypted,
                preview: `📸 ${file.name} (${this.formatFileSize(file.size)})`,
                timestamp: new Date().toISOString()
            };

            await this.messageRelay.sendMessage(JSON.stringify(message));
            this.hideProgressModal();
            this.showNotification('✅ Image sent successfully!', 'success');
            
        } catch (error) {
            this.hideProgressModal();
            this.showNotification('❌ Failed to send image', 'error');
            console.error('Image share failed:', error);
        }
    }

    async handleVideoShare(file) {
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            this.showNotification('❌ Video too large (max 50MB)', 'error');
            return;
        }

        try {
            this.showProgressModal('Encrypting Video', 'Encrypting your video file...');
            
            const encrypted = await this.mediaEncryption.encryptVideo(file);
            this.updateProgress(100);
            
            const message = {
                type: 'media',
                subtype: 'video',
                content: encrypted,
                preview: `🎥 ${file.name} (${this.formatFileSize(file.size)})`,
                timestamp: new Date().toISOString()
            };

            await this.messageRelay.sendMessage(JSON.stringify(message));
            this.hideProgressModal();
            this.showNotification('✅ Video sent successfully!', 'success');
            
        } catch (error) {
            this.hideProgressModal();
            this.showNotification('❌ Failed to send video', 'error');
            console.error('Video share failed:', error);
        }
    }

    async handleCurrentLocationShare() {
        try {
            this.hideLocationModal();
            this.showProgressModal('Getting Location', 'Getting your current location...');
            
            await this.locationManager.shareCurrentLocation();
            this.hideProgressModal();
            this.showNotification('✅ Location shared!', 'success');
            
        } catch (error) {
            this.hideProgressModal();
            this.showNotification('❌ Failed to get location', 'error');
            console.error('Location share failed:', error);
        }
    }

    async handleLiveLocationShare() {
        try {
            this.hideLocationModal();
            this.showProgressModal('Starting Live Location', 'Setting up live location sharing...');
            
            await this.locationManager.startLiveLocationSharing();
            this.hideProgressModal();
            this.showNotification('🔴 Live location sharing started', 'success');
            this.updateLiveLocationStatus();
            
        } catch (error) {
            this.hideProgressModal();
            this.showNotification('❌ Failed to start live location', 'error');
            console.error('Live location failed:', error);
        }
    }

    handleStopLiveLocation() {
        this.locationManager.stopLiveLocationSharing();
        this.hideLocationModal();
        this.updateLiveLocationStatus();
        this.showNotification('📍 Live location sharing stopped', 'info');
    }

    updateLiveLocationStatus() {
        const controls = document.getElementById('liveLocationControls');
        const shareBtn = document.getElementById('shareLiveLocation');
        const indicator = document.getElementById('liveLocationIndicator');
        
        if (this.locationManager.isLiveTrackingActive()) {
            controls.style.display = 'block';
            shareBtn.style.display = 'none';
            indicator.style.display = 'flex';
        } else {
            controls.style.display = 'none';
            shareBtn.style.display = 'block';
            indicator.style.display = 'none';
        }
    }

    // Media message rendering
    renderMediaMessage(messageData, container) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${messageData.sender === 'self' ? 'sent' : 'received'}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble media-message';
        
        if (messageData.type === 'media') {
            this.renderMediaContent(messageData, bubble);
        } else if (messageData.type === 'location') {
            this.renderLocationContent(messageData, bubble);
        }
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date(messageData.timestamp).toLocaleTimeString();
        bubble.appendChild(time);
        
        messageDiv.appendChild(bubble);
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }

    renderMediaContent(messageData, container) {
        const preview = document.createElement('div');
        preview.className = 'media-preview';
        preview.textContent = messageData.preview;
        container.appendChild(preview);
        
        if (messageData.subtype === 'image') {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'view-media-btn';
            viewBtn.textContent = '👁️ View Image';
            viewBtn.onclick = () => this.viewEncryptedImage(messageData.content);
            container.appendChild(viewBtn);
        } else if (messageData.subtype === 'video') {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'view-media-btn';
            viewBtn.textContent = '▶️ Play Video';
            viewBtn.onclick = () => this.viewEncryptedVideo(messageData.content);
            container.appendChild(viewBtn);
        }
    }

    renderLocationContent(messageData, container) {
        const preview = document.createElement('div');
        preview.className = 'location-preview';
        preview.textContent = messageData.preview;
        container.appendChild(preview);
        
        if (messageData.subtype !== 'live_stop') {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'view-location-btn';
            viewBtn.textContent = '🗺️ View on Map';
            viewBtn.onclick = () => this.viewEncryptedLocation(messageData.content);
            container.appendChild(viewBtn);
        }
    }

    async viewEncryptedImage(encryptedData) {
        try {
            this.showProgressModal('Decrypting Image', 'Decrypting image...');
            
            const decrypted = await this.mediaEncryption.decryptBinaryData(
                encryptedData, 
                (progress) => this.updateProgress(progress)
            );
            
            const blob = new Blob([decrypted.data], { type: decrypted.metadata.mimeType });
            const url = URL.createObjectURL(blob);
            
            this.showMediaViewer('Image', `
                <img src="${url}" alt="Shared Image" style="max-width: 100%; max-height: 70vh;">
            `, () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = decrypted.metadata.originalName;
                a.click();
            });
            
            this.hideProgressModal();
        } catch (error) {
            this.hideProgressModal();
            this.showNotification('❌ Failed to decrypt image', 'error');
            console.error('Image decryption failed:', error);
        }
    }

    async viewEncryptedVideo(encryptedData) {
        try {
            this.showProgressModal('Decrypting Video', 'Decrypting video...');
            
            const decrypted = await this.mediaEncryption.decryptBinaryData(
                encryptedData, 
                (progress) => this.updateProgress(progress)
            );
            
            const blob = new Blob([decrypted.data], { type: decrypted.metadata.mimeType });
            const url = URL.createObjectURL(blob);
            
            this.showMediaViewer('Video', `
                <video controls style="max-width: 100%; max-height: 70vh;">
                    <source src="${url}" type="${decrypted.metadata.mimeType}">
                    Your browser does not support the video tag.
                </video>
            `, () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = decrypted.metadata.originalName;
                a.click();
            });
            
            this.hideProgressModal();
        } catch (error) {
            this.hideProgressModal();
            this.showNotification('❌ Failed to decrypt video', 'error');
            console.error('Video decryption failed:', error);
        }
    }

    async viewEncryptedLocation(encryptedData) {
        try {
            const location = await this.locationManager.mediaEncryption.decryptLocation(encryptedData);
            const mapUrl = this.locationManager.generateMapUrl(location);
            
            this.showMediaViewer('Location', `
                <div class="location-display">
                    <h4>📍 Shared Location</h4>
                    <p><strong>Coordinates:</strong> ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</p>
                    <p><strong>Accuracy:</strong> ±${Math.round(location.accuracy)} meters</p>
                    <p><strong>Time:</strong> ${new Date(location.timestamp).toLocaleString()}</p>
                    <iframe 
                        src="https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude-0.01},${location.latitude-0.01},${location.longitude+0.01},${location.latitude+0.01}&layer=mapnik&marker=${location.latitude},${location.longitude}"
                        width="100%" 
                        height="300" 
                        style="border: 1px solid #ccc; border-radius: 8px; margin: 1rem 0;"
                    ></iframe>
                    <a href="${mapUrl}" target="_blank" class="external-map-link">🗺️ Open in OpenStreetMap</a>
                </div>
            `);
        } catch (error) {
            this.showNotification('❌ Failed to decrypt location', 'error');
            console.error('Location decryption failed:', error);
        }
    }

    // UI Helper Methods
    showProgressModal(title, description) {
        const modal = document.getElementById('progressModal');
        document.getElementById('progressTitle').textContent = title;
        document.getElementById('progressDescription').textContent = description;
        this.updateProgress(0);
        modal.style.display = 'flex';
    }

    hideProgressModal() {
        document.getElementById('progressModal').style.display = 'none';
    }

    updateProgress(percent) {
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressText').textContent = `${Math.round(percent)}%`;
    }

    showLocationModal() {
        this.updateLiveLocationStatus();
        document.getElementById('locationModal').style.display = 'flex';
    }

    hideLocationModal() {
        document.getElementById('locationModal').style.display = 'none';
    }

    showMediaViewer(title, content, downloadAction = null) {
        document.getElementById('viewerTitle').textContent = title;
        document.getElementById('viewerBody').innerHTML = content;
        
        const downloadBtn = document.getElementById('downloadMedia');
        if (downloadAction) {
            downloadBtn.style.display = 'block';
            downloadBtn.onclick = downloadAction;
        } else {
            downloadBtn.style.display = 'none';
        }
        
        document.getElementById('mediaViewer').style.display = 'flex';
    }

    hideMediaViewer() {
        document.getElementById('mediaViewer').style.display = 'none';
        // Clean up any object URLs
        const viewerBody = document.getElementById('viewerBody');
        const media = viewerBody.querySelectorAll('img, video');
        media.forEach(element => {
            if (element.src && element.src.startsWith('blob:')) {
                URL.revokeObjectURL(element.src);
            }
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Hide and remove notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
