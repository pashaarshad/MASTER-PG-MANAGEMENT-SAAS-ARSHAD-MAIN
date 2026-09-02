/**
 * Helpers for ABC DEF PG Management System
 */

// Format Indian Rupee currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Calculate stay duration between moveInDate and now
export const calculateStayDuration = (moveInDate: string): string => {
  if (!moveInDate) return '0 days';
  const start = new Date(moveInDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
  }

  const months = Math.floor(diffDays / 30);
  const remainingDays = diffDays % 30;

  if (remainingDays === 0) {
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }

  return `${months}m ${remainingDays}d (${diffDays} days)`;
};

// Format dates nicely
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Mask Aadhaar number to XXXX-XXXX-1234
export const maskAadharNumber = (rawNumber: string): string => {
  const digits = (rawNumber || '').replace(/\D/g, '');
  if (!digits) return 'XXXX-XXXX-XXXX';
  const lastFour = digits.slice(-4) || 'XXXX';
  return `XXXX-XXXX-${lastFour}`;
};

// Clean only numeric digits up to 12 digits
export const cleanAadharDigits = (val: string): string => {
  return (val || '').replace(/\D/g, '').slice(0, 12);
};

// Format Aadhaar display as 1234 5678 9012
export const formatAadharDisplay = (val: string): string => {
  const digits = (val || '').replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
};

// Clean phone digits up to 10
export const cleanPhoneDigits = (val: string): string => {
  return (val || '').replace(/\D/g, '').slice(0, 10);
};

export const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format file size nicely in KB or MB
export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1000) {
    return `${Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
};

// Client-side image compressor: compresses image file or base64 to target size strictly <= 480 KB (under 500 KB limit)
export const compressImageFile = async (
  file: File,
  maxSizeBytes = 480000 // 480 KB max (strictly under 500 KB)
): Promise<{ compressedFile: File; dataUrl: string; sizeBytes: number; sizeKb: number; sizeMb: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down if dimensions exceed 1280px (optimal for documents & profile photos)
        const maxDimension = 1280;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Iteratively optimize quality until size <= maxSizeBytes (under 500 KB)
        let quality = 0.82;
        const tryCompression = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'));
                return;
              }

              if (blob.size > maxSizeBytes && quality > 0.25) {
                quality -= 0.12;
                tryCompression();
              } else {
                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const sizeKb = Math.round(blob.size / 1024);
                const sizeMb = Number((blob.size / (1024 * 1024)).toFixed(2));
                resolve({
                  compressedFile,
                  dataUrl,
                  sizeBytes: blob.size,
                  sizeKb,
                  sizeMb,
                });
              }
            },
            'image/jpeg',
            quality
          );
        };

        tryCompression();
      };
      img.onerror = () => reject(new Error('Invalid image format'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
  });
};

// Generate pre-filled WhatsApp message for resident allocation
export const generateWhatsAppAllocationMessage = (details: {
  tenantName: string;
  pgName: string;
  building: string;
  floor: string;
  room: string;
  bed: string;
  sharing: string;
  monthlyRent: number;
  securityDeposit: number;
  moveInDate: string;
  residentId: string;
}): string => {
  const text = `Hello ${details.tenantName},

Welcome to ${details.pgName}! 🎉

Your room allocation details:

🏢 PG: ${details.pgName}
🆔 Resident ID: ${details.residentId}
🏛️ Building: ${details.building}
🪜 Floor: ${details.floor}
🚪 Room: ${details.room}
🛏️ Bed: ${details.bed} (${details.sharing})

💰 Monthly Rent: ₹${details.monthlyRent.toLocaleString('en-IN')}
🔒 Security Deposit: ₹${details.securityDeposit.toLocaleString('en-IN')}
📅 Move-in Date: ${formatDate(details.moveInDate)}

Thank you,
${details.pgName} Management`;

  return text;
};

// Build WhatsApp Web link
export const getWhatsAppShareUrl = (phone: string, text: string): string => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
};

// Export records to CSV
export const exportToCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join(
      '\n'
    );

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
