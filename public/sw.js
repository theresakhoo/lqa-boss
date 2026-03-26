// sw.js - Service Worker for LQA Boss PWA
const CACHE_NAME = 'lqa-boss-v3';
const BASE_PATH = '/lqa-boss/';

// Core files to cache on install
const urlsToCache = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'manifest.webmanifest',
    BASE_PATH + 'icons/icon-512x512.png'
];

self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                return self.skipWaiting(); // Activate worker immediately
            })
    );
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate');
    // Remove old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Take control of open clients
        })
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }
    
    // For navigation requests, always try network first
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match(BASE_PATH + 'index.html');
            })
        );
        return;
    }
    
    // For JS, CSS, and other assets: cache-first strategy
    event.respondWith(
        caches.match(request).then(response => {
            if (response) {
                return response;
            }
            
            return fetch(request).then(response => {
                // Don't cache non-successful responses
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                
                // Clone the response
                const responseToCache = response.clone();
                
                // Cache JavaScript, CSS, and image files
                if (request.url.match(/\.(js|css|png|jpg|jpeg|svg|woff2?)$/)) {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseToCache);
                    });
                }
                
                return response;
            });
        })
    );
});