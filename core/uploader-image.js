// ============================================================================
// UPLOADER-IMAGE.JS — Image processing utilities
// compressImage, getRotatedImage, dataURLtoFile, createPdfFromImages
// ============================================================================

async function compressImage(dataUrl, targetSizeKB = 200, maxDimension = 2048) {
    const targetSizeBytes = targetSizeKB * 1024;
    const img = await new Promise(resolve => {
const image = new Image();
image.onload = () => resolve(image);
image.src = dataUrl;
    });

    let { width, height } = img;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Resize based on maxDimension
    if (width > maxDimension || height > maxDimension) {
if (width > height) {
    height = Math.round(height * (maxDimension / width));
    width = maxDimension;
} else {
    width = Math.round(width * (maxDimension / height));
    height = maxDimension;
}
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.9; // Start with 90% JPEG quality
    let compressedDataUrl;
    let sizeInBytes;

    do {
compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
sizeInBytes = atob(compressedDataUrl.split(',')[1]).length;

if (sizeInBytes > targetSizeBytes && quality > 0.1) {
    quality -= 0.1; // Reduce quality by 10%
}

    } while (sizeInBytes > targetSizeBytes && quality > 0.1);
    
    console.log(`Image compressed to ${(sizeInBytes / 1024).toFixed(2)} KB.`);
    return compressedDataUrl;
}

/**
 * Applies rotation to an image source.
 * @param {string} src - The image data URL.
 * @param {number} rotation - The rotation angle (0, 90, 180, 270).
 * @returns {Promise<string>} - The rotated image data URL (png).
 */
function getRotatedImage(src, rotation) {
    return new Promise((resolve) => {
const img = new Image();
img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const angle = rotation * Math.PI / 180;

    if (rotation % 180 !== 0) { // 90 or 270
canvas.width = img.height;
canvas.height = img.width;
    } else { // 0 or 180
canvas.width = img.width;
canvas.height = img.height;
    }
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    
    resolve(canvas.toDataURL('image/png')); // Return PNG to avoid quality loss before compression
};
img.src = src;
    });
}

// --- === END OF IMAGE FUNCTIONS === ---

async function dataURLtoFile(dataUrl, fileName) {
    const res = await fetch(dataUrl); 
    const blob = await res.blob();
    return new File([blob], fileName, { type: 'image/jpeg' });
}


async function createPdfFromImages(images) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    const a4Width = 210;
    const a4Height = 297;
    const margin = 10;
    const imgWidth = a4Width - (margin * 2);
    
    for (let i = 0; i < images.length; i++) {
const imgData = images[i];
if (i > 0) {
    doc.addPage();
}

// Get image dimensions to calculate aspect ratio
const img = await new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = imgData;
});

const aspectRatio = img.height / img.width;
const imgHeight = imgWidth * aspectRatio;

// Check if it fits, if not, scale to fit height
let finalWidth = imgWidth;
let finalHeight = imgHeight;
if (finalHeight > (a4Height - (margin * 2))) {
    finalHeight = a4Height - (margin * 2);
    finalWidth = finalHeight / aspectRatio;
}

doc.addImage(imgData, 'JPEG', margin, margin, finalWidth, finalHeight);
    }
    
    // Return base64 string
    return doc.output('datauristring');
}


