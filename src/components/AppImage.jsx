import { useState, useEffect } from 'react';
import { getCachedImage } from '../services/imageCache';

function Image({
  src,
  alt = "Image Name",
  className = "",
  loading = "lazy",
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);

  // Set image source - use cache only when offline
  useEffect(() => {
    let mounted = true;

    const loadSource = async () => {
      if (!src) {
        if (mounted) setImageSrc('/assets/images/no_image.png');
        return;
      }

      // Online: use original src directly
      if (navigator.onLine) {
        if (mounted) setImageSrc(src);
        return;
      }

      // Offline: try cache first
      try {
        const cached = await getCachedImage(src);
        if (mounted) {
          setImageSrc(cached || src);
        }
      } catch (e) {
        if (mounted) setImageSrc(src);
      }
    };

    loadSource();

    return () => { mounted = false; };
  }, [src]);

  // Reset loading state when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  // Don't render until we have a source
  if (!imageSrc) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}

      <img
        src={hasError ? "/assets/images/no_image.png" : imageSrc}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading={loading}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setHasError(true);
          setIsLoaded(true);
        }}
        {...props}
      />
    </div>
  );
}

export default Image;
