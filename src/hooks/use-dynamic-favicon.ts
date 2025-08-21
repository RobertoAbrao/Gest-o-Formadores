
'use client';

import { useEffect, useCallback } from 'react';

const useDynamicFavicon = () => {

  const getFaviconElement = (): HTMLLinkElement | null => {
    return document.querySelector("link[rel*='icon']");
  }

  const setNotificationFavicon = useCallback(() => {
    const favicon = getFaviconElement();
    if (!favicon) return;
    
    const originalHref = favicon.href;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = originalHref;

    img.onload = () => {
        // Draw original favicon
        context.drawImage(img, 0, 0, 32, 32);

        // Draw notification dot
        context.beginPath();
        context.arc(canvas.width - 6, 6, 6, 0, 2 * Math.PI);
        context.fillStyle = '#ef4444'; // red-500
        context.fill();

        // Replace favicon
        favicon.href = canvas.toDataURL('image/png');
    };
    
    img.onerror = () => {
        // Fallback for when image loading fails (e.g. CORS issues in dev)
        context.beginPath();
        context.arc(canvas.width - 5, 5, 5, 0, 2 * Math.PI);
        context.fillStyle = '#ef4444'; // red-500
        context.fill();
        favicon.href = canvas.toDataURL('image/png');
    }
  }, []);

  const clearNotificationFavicon = useCallback(() => {
     const favicon = getFaviconElement();
     if (favicon) {
        // This is a simplified approach. In a real app, you might store the original href.
        // For now, we assume reloading the page will restore it, or we can force it.
        const originalFaviconUrl = '/favicon.ico'; // Or a more specific path if you have one
        if (favicon.href !== originalFaviconUrl) {
            // By changing the href, we force a reload of the original icon.
             const next_meta = document.querySelector("meta[name='next-head-count']");
             if(next_meta){
                favicon.href = ""
                favicon.href = "/icon.png"
             }
        }
     }
  }, []);

  return { setNotificationFavicon, clearNotificationFavicon };
};

export default useDynamicFavicon;
