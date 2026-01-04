/**
 * Compresses an image and converts it to Base64.
 * Optimized for slower internet by reducing dimensions and quality.
 * @param {File} file - The image file to compress.
 * @param {Object} options - Compression options.
 * @returns {Promise<string>} - The Base64 string of the compressed image.
 */
export const compressAndToBase64 = (file, options = { maxWidth: 1024, maxHeight: 1024, quality: 0.6 }) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate dimensions
                if (width > height) {
                    if (width > options.maxWidth) {
                        height *= options.maxWidth / width;
                        width = options.maxWidth;
                    }
                } else {
                    if (height > options.maxHeight) {
                        width *= options.maxHeight / height;
                        height = options.maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64 with quality reduction
                const dataUrl = canvas.toDataURL('image/jpeg', options.quality);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
/**
 * Converts any file to Base64 without compression.
 * Useful for PDFs or when image quality must be 100%.
 * @param {File} file - The file to convert.
 * @returns {Promise<string>} - The Base64 string.
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};
