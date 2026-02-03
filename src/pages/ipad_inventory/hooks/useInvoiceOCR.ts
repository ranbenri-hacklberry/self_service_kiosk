import { useState } from 'react';
import { compressAndToBase64, fileToBase64 } from '@/utils/imageUtils';
import { processInvoiceOCR } from '@/services/ocrService';

export const useInvoiceOCR = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ocrResult, setOcrResult] = useState<any>(null);

    const scanInvoice = async (file: File) => {
        if (!file) return;
        setIsProcessing(true);
        setError(null);
        setOcrResult(null);

        try {
            let base64Image: string;
            if (file.type === 'application/pdf') {
                base64Image = await fileToBase64(file);
            } else {
                base64Image = await compressAndToBase64(file);
            }

            const result = await processInvoiceOCR(base64Image);
            setOcrResult(result);
            return result;
        } catch (err: any) {
            console.error('OCR Error:', err);
            setError(err.message || 'שגיאה בעיבוד החשבונית');
        } finally {
            setIsProcessing(false);
        }
    };

    return { scanInvoice, isProcessing, error, ocrResult, resetOCR: () => setOcrResult(null) };
};
