/**
 * Location Services Manager
 * Handles location sharing including live location tracking
 */
class LocationManager {
    constructor(mediaEncryption, messageRelay) {
        this.mediaEncryption = mediaEncryption;
        this.messageRelay = messageRelay;
        this.watchId = null;
        this.isLiveTracking = false;
        this.locationUpdateInterval = 30000; // 30 seconds
        this.lastKnownPosition = null;
        this.locationCallbacks = new Set();
    }

    /**
     * Get current location
     */
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            // Check for location permission
            if (navigator.permissions) {
                navigator.permissions.query({name: 'geolocation'}).then((result) => {
                    if (result.state === 'denied') {
                        reject(new Error('Location access denied. Please enable location permissions.'));
                        return;
                    }
                });
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: new Date().toISOString(),
                        type: 'current_location'
                    };
                    this.lastKnownPosition = locationData;
                    resolve(locationData);
                },
                (error) => {
                    let errorMessage = 'Failed to get location';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location access denied by user';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information unavailable';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out';
                            break;
                    }
                    reject(new Error(errorMessage));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    /**
     * Share current location
     */
    async shareCurrentLocation() {
        try {
            const location = await this.getCurrentLocation();
            const encryptedLocation = await this.mediaEncryption.encryptLocation(location);
            
            const message = {
                type: 'location',
                subtype: 'current',
                content: encryptedLocation,
                preview: `📍 Current Location (±${Math.round(location.accuracy)}m)`,
                timestamp: new Date().toISOString()
            };

            await this.messageRelay.sendMessage(JSON.stringify(message));
            return location;
        } catch (error) {
            console.error('Failed to share current location:', error);
            throw error;
        }
    }

    /**
     * Start live location sharing
     */
    async startLiveLocationSharing() {
        if (this.isLiveTracking) {
            throw new Error('Live location tracking is already active');
        }

        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by this browser');
        }

        this.isLiveTracking = true;
        
        // Send initial location
        await this.shareCurrentLocation();
        
        // Start watching position
        this.watchId = navigator.geolocation.watchPosition(
            async (position) => {
                try {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: new Date().toISOString(),
                        type: 'live_location'
                    };

                    // Only send if location changed significantly
                    if (this.hasLocationChangedSignificantly(locationData)) {
                        this.lastKnownPosition = locationData;
                        const encryptedLocation = await this.mediaEncryption.encryptLocation(locationData);
                        
                        const message = {
                            type: 'location',
                            subtype: 'live',
                            content: encryptedLocation,
                            preview: `📍 Live Location (±${Math.round(locationData.accuracy)}m)`,
                            timestamp: new Date().toISOString()
                        };

                        await this.messageRelay.sendMessage(JSON.stringify(message));
                        
                        // Notify callbacks
                        this.locationCallbacks.forEach(callback => callback(locationData));
                    }
                } catch (error) {
                    console.error('Failed to send live location update:', error);
                }
            },
            (error) => {
                console.error('Live location error:', error);
                this.stopLiveLocationSharing();
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );

        return true;
    }

    /**
     * Stop live location sharing
     */
    stopLiveLocationSharing() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isLiveTracking = false;
        
        // Send stop message
        this.sendLiveLocationStop();
    }

    /**
     * Send live location stop message
     */
    async sendLiveLocationStop() {
        try {
            const message = {
                type: 'location',
                subtype: 'live_stop',
                content: null,
                preview: '📍 Live location sharing stopped',
                timestamp: new Date().toISOString()
            };

            await this.messageRelay.sendMessage(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send live location stop:', error);
        }
    }

    /**
     * Check if location changed significantly
     */
    hasLocationChangedSignificantly(newLocation) {
        if (!this.lastKnownPosition) return true;

        const distance = this.calculateDistance(
            this.lastKnownPosition.latitude,
            this.lastKnownPosition.longitude,
            newLocation.latitude,
            newLocation.longitude
        );

        // Consider significant if moved more than 10 meters or accuracy improved significantly
        return distance > 10 || 
               (newLocation.accuracy < this.lastKnownPosition.accuracy * 0.8);
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    /**
     * Generate map URL for location
     */
    generateMapUrl(location, zoom = 15) {
        return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}&zoom=${zoom}`;
    }

    /**
     * Add location update callback
     */
    addLocationCallback(callback) {
        this.locationCallbacks.add(callback);
    }

    /**
     * Remove location update callback
     */
    removeLocationCallback(callback) {
        this.locationCallbacks.delete(callback);
    }

    /**
     * Get live tracking status
     */
    isLiveTrackingActive() {
        return this.isLiveTracking;
    }
}
