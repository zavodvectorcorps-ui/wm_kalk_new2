import React, { memo, useState, useCallback } from 'react';

// Image cache for preloaded images
const imageCache = new Map();

// Preload image utility
export const preloadImage = (src) => {
  if (!src || imageCache.has(src)) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, true);
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
};

// Preload multiple images
export const preloadImages = async (urls) => {
  const validUrls = urls.filter(url => url && !imageCache.has(url));
  await Promise.allSettled(validUrls.map(preloadImage));
};

// Lazy loaded image component with placeholder
export const LazyImage = memo(({ 
  src, 
  alt, 
  className = '', 
  placeholder = null,
  onLoad,
  onError 
}) => {
  const [loaded, setLoaded] = useState(imageCache.has(src));
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    imageCache.set(src, true);
    onLoad?.();
  }, [src, onLoad]);

  const handleError = useCallback(() => {
    setError(true);
    onError?.();
  }, [onError]);

  if (error) {
    return placeholder || (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-2xl">🖼️</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse rounded" />
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

// Hook for batch image preloading
export const useImagePreloader = () => {
  const preload = useCallback(async (images) => {
    if (!images?.length) return;
    
    // Extract image URLs from various object structures
    const urls = images.flatMap(item => {
      const result = [];
      if (item.imageUrl) result.push(item.imageUrl);
      if (item.heaterVariants) {
        item.heaterVariants.forEach(v => {
          if (v.imageUrl) result.push(v.imageUrl);
        });
      }
      if (item.options) {
        item.options.forEach(o => {
          if (o.imageUrl) result.push(o.imageUrl);
        });
      }
      return result;
    });

    await preloadImages(urls);
  }, []);

  return { preload, preloadImages, preloadImage };
};
