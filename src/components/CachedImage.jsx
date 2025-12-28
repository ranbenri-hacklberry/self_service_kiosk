import { useState, useEffect } from 'react';
import { getCachedImage } from '../services/imageCache';

/**
 * CachedImage - Image component that uses cached images for offline support
 * Falls back to original URL if cache unavailable
 */
const CachedImage = ({
    src,
    alt,
    className = '',
    fallbackSrc = 'https://images.unsplash.com/photo-1551024506-0bccd828d307',
    ...props
}) => {
    const [imageSrc, setImageSrc] = useState(src);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let mounted = true;

        const loadCachedImage = async () => {
            if (!src) {
                setImageSrc(fallbackSrc);
                return;
            }

            try {
                const cachedSrc = await getCachedImage(src);
                if (mounted) {
                    setImageSrc(cachedSrc || src);
                }
            } catch (e) {
                if (mounted) {
                    setImageSrc(src);
                }
            }
        };

        // Only try cache if offline
        if (!navigator.onLine) {
            loadCachedImage();
        } else {
            setImageSrc(src);
        }

        return () => {
            mounted = false;
        };
    }, [src, fallbackSrc]);

    const handleError = () => {
        if (!hasError) {
            setHasError(true);
            setImageSrc(fallbackSrc);
        }
    };

    return (
        <img
            src={imageSrc}
            alt={alt}
            className={className}
            onError={handleError}
            loading="lazy"
            {...props}
        />
    );
};

export default CachedImage;
