import { useState } from 'react';
import { compressAndToBase64, fileToBase64 } from '@/utils/imageUtils';
import { processInvoiceWithGemini } from '@/services/geminiService';
import { uploadInvoiceToDrive } from '@/services/driveUploadService';

/**
 * Hook to handle Invoice OCR flow.
 * Handles image compression, PDF processing, API call, Drive backup, and result state.
 */
export const useInvoiceOCR = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [ocrResult, setOcrResult] = useState(null);
    const [driveBackup, setDriveBackup] = useState(null);

    /**
     * Triggers the OCR process for a given file (Image or PDF).
     * @param {File} file - The image or PDF file.
     * @param {string} businessId - Optional business ID for organization
     */
    const scanInvoice = async (file, businessId = null) => {
        if (!file) return;

        setIsProcessing(true);
        setError(null);
        setOcrResult(null);
        setDriveBackup(null);

        try {
            // 1. Convert to Base64 (Compress if image, direct if PDF)
            let base64String;
            if (file.type === 'application/pdf') {
                base64String = await fileToBase64(file);
            } else {
                base64String = await compressAndToBase64(file);
            }

            // 2. Call Gemini Service for OCR
            const result = await processInvoiceWithGemini(base64String);

            // 3. Update state with result
            setOcrResult(result);

            // 4. 🆕 Backup to Google Drive (async, non-blocking)
            try {
                console.log('💾 Backing up invoice to Google Drive...');
                const driveResult = await uploadInvoiceToDrive(file, result, businessId);
                setDriveBackup(driveResult);
                console.log('✅ Drive backup complete:', driveResult.fileName);
            } catch (driveError) {
                console.warn('⚠️ Drive backup failed (OCR still succeeded):', driveError.message);
                // Don't throw - OCR succeeded, backup failure is non-critical
                setDriveBackup({ success: false, error: driveError.message });
            }

            return result;
        } catch (err) {
            console.error('OCR Scanning failed:', err);
            setError(err.message || 'Failed to process invoice. Please try again.');
            throw err;
        } finally {
            setIsProcessing(false);
        }
    };

    const resetOCR = () => {
        setOcrResult(null);
        setError(null);
        setDriveBackup(null);
        setIsProcessing(false);
    };

    return {
        scanInvoice,
        isProcessing,
        error,
        ocrResult,
        driveBackup,
        resetOCR
    };
};
