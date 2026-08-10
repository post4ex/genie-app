// ============================================================================
// UPLOADER-CAMERA.JS — Camera, cropper, OCR, enhancement, preview logic
// Depends on: uploader-image.js (compressImage, getRotatedImage, dataURLtoFile)
// All functions reference globals set by jawaS/uploader.js
// ============================================================================

function updateStatus(message, isError = false) {
    if (statusBar) {
statusBar.textContent = message;
statusBar.classList.toggle('error', isError);
    }
}

// --- V1 UI Control Functions ---
function setInterfaceState(state) {
    cameraBtn.style.display = 'inline-block';
    uploadBtn.style.display = 'inline-block';
    uploadTypeStrip.style.display = 'flex';
    rotateBtn.style.display = 'none';
    lockBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    cancelAllBtn.style.display = 'none';
    imageViewArea.classList.remove('selectable');
    cameraFeed.classList.remove('active-capture');

    // Hide buttons that are not relevant in the new UI
    lockBtn.style.display = 'none';
    cancelAllBtn.style.display = 'none';

    if (state === 'streaming') {
cameraBtn.textContent = 'Capture';
uploadBtn.style.display = 'none';
cancelBtn.style.display = 'inline-block';
previewCanvas.style.display = 'none';
imagePreview.style.display = 'none';
cameraFeed.style.display = 'block';
cameraFeed.classList.add('active-capture');
uploadTypeStrip.style.display = 'none';
    } else if (state === 'preview') {
cameraBtn.style.display = 'none';
uploadBtn.style.display = 'none';
rotateBtn.style.display = 'inline-block';
lockBtn.style.display = 'inline-block'; // Re-show lock btn
imageViewArea.classList.add('selectable');
uploadTypeStrip.style.display = 'none';

if (imageQueue.length > 1) { // Show scroller if more than 1 image
     scrollerContainer.style.display = 'block';
}

if (imageQueue.length > 0) {
    cancelBtn.style.display = 'inline-block';
    cancelAllBtn.style.display = 'inline-block'; // Re-show cancel all
} else {
    cancelBtn.style.display = 'inline-block';
}
    } else { // idle state
cameraBtn.textContent = 'Camera';
lockBtn.style.display = 'none';
cancelAllBtn.style.display = 'none';
    }
}

// --- NEW: Camera Logic from V1 ---
function stopCamera() { 
    if (stream) { 
stream.getTracks().forEach(track => track.stop()); 
stream = null; 
    }
    if (cameraFeed) {
cameraFeed.removeEventListener('click', handleVideoStreamClick);
cameraFeed.style.display = 'none';
    }
}

async function handleVideoStreamClick() {
    if (!stream) return;
    if (imageQueue.length >= MAX_FILES) {
updateStatus(`Maximum of ${MAX_FILES} images reached.`, true);
return;
    }
    const canvas = document.createElement('canvas');
    const vw = cameraFeed.videoWidth, vh = cameraFeed.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2, sy = (vh - size) / 2;
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d').drawImage(cameraFeed, sx, sy, size, size, 0, 0, size, size);
    
    // USE BLOB INSTEAD OF BASE64 FOR PERFORMANCE
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    const newFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
    
    imageQueue.push(newFile);
    scrollerContainer.style.display = 'block';
    renderScroller();
    updateStatus(`${imageQueue.length} image(s) captured.`);
    
    if (cancelBtn.textContent !== 'Done') {
cancelBtn.textContent = 'Done';
cancelBtn.style.backgroundColor = '#28a745';
cancelBtn.style.borderColor = '#28a745';
cancelBtn.style.color = 'white';
    }
}

// --- NEW: PDF Processing Logic from V1 ---
async function handlePdfFile(file) {
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
fileReader.onload = async (e) => {
    try {
const typedarray = new Uint8Array(e.target.result);
const pdf = await pdfjsLib.getDocument(typedarray).promise;
const imageFiles = [];
const scale = 2.0; // Render at 2x scale

for (let i = 1; i <= pdf.numPages; i++) {
    if (imageFiles.length >= MAX_FILES) {
updateStatus(`Max ${MAX_FILES} files reached. Stopping PDF processing.`, true);
break;
    }
    updateStatus(`Processing PDF page ${i} of ${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderContext = { canvasContext: context, viewport: viewport };
    await page.render(renderContext).promise;
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    const pageFile = new File([blob], `${file.name}-page-${i}.jpg`, { type: 'image/jpeg' });
    imageFiles.push(pageFile);
}
resolve(imageFiles);
    } catch (error) { 
console.error("PDF processing error:", error);
reject(error); 
    }
};
fileReader.onerror = reject;
fileReader.readAsArrayBuffer(file);
    });
}

// --- NEW: Scroller Logic from V1 ---
function renderScroller() {
    scroller.innerHTML = '';
    imageQueue.forEach((file, index) => {
const thumb = document.createElement('img');
try { 
    thumb.src = URL.createObjectURL(file); 
    thumb.onload = () => URL.revokeObjectURL(thumb.src); // Revoke to save memory
} catch(e) { 
    console.error("Could not create object URL for", file); 
}
thumb.className = 'scroller-img'; 
thumb.dataset.index = index;
thumb.onclick = () => displayImage(index);
scroller.appendChild(thumb);
    });
    updateActiveThumbnail();
}

function updateActiveThumbnail() {
    document.querySelectorAll('.scroller-img').forEach((img, index) => {
img.classList.toggle('active', index === currentImageIndex);
    });
}

function displayImage(index) {
    if (isProcessingImage) return; // Don't switch image while processing
    if (index < 0 || index >= imageQueue.length) { 
resetUploader(); 
return; 
    }
    currentImageIndex = index;
    const file = imageQueue[currentImageIndex];
    initCropper(URL.createObjectURL(file), file.name); // Always go to cropper using Object URL directly
}

// --- NEW: Cropper Logic from V1 ---
function initCropper(imageSrc, originalFileName) {
    originalCropperSrc = imageSrc; // Save original for enhancement reset
    currentEnhancements = { brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false };
    if (brightnessSlider) brightnessSlider.value = 0;
    if (contrastSlider) contrastSlider.value = 0;
    if (sharpenBtn) sharpenBtn.style.backgroundColor = '';
    if (greyscaleBtn) greyscaleBtn.style.backgroundColor = '';
    if (bwBtn) bwBtn.style.backgroundColor = '';
    if (enhancementControls) enhancementControls.style.display = 'none';

    inlineCropperWrapper.style.display = 'block'; // Show cropper
    imageViewArea.style.display = 'none';      // Hide preview area
    scrollerContainer.style.display = 'none';  // Hide scroller
    placeholder.style.display = 'none';
    
    cropperImage.src = imageSrc;
    if (cropper) cropper.destroy();
    
    cropper = new Cropper(cropperImage, {
viewMode: 1,
background: false,
autoCrop: true,
autoCropArea: 0.95, // Start with 95% crop area
zoomable: true,
movable: true,
scalable: true,
    });

    // Auto-enhance immediately upon loading image into canvas
    setTimeout(() => {
        if (typeof autoEnhanceBtn !== 'undefined' && autoEnhanceBtn) {
            autoEnhanceBtn.click();
            if (typeof enhancementControls !== 'undefined' && enhancementControls) {
                enhancementControls.style.display = 'block'; // Make controls visible
                
                // --- NEW: Inject OCR Button ---
                if (!document.getElementById('ocr-extract-btn')) {
                    const btnGroup = enhancementControls.querySelector('.button-group');
                    if (btnGroup) {
                        const ocrBtn = document.createElement('button');
                        ocrBtn.id = 'ocr-extract-btn';
                        ocrBtn.className = 'btn';
                        ocrBtn.style.cssText = 'background-color: #007bff; color: white; margin-left: 8px; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.875rem;';
                        ocrBtn.textContent = 'Extract Data (OCR)';
                        ocrBtn.addEventListener('click', runOcrExtraction);
                        btnGroup.appendChild(ocrBtn);
                    }
                }
            }
        }
    }, 200);
    
    // This handler is defined inside initCropper to capture the correct file name
    const confirmCropHandler = async () => {
// *** BUG FIX: Check if cropper still exists AND check lock ***
if (!cropper || isProcessingImage) {
    console.warn("Cropper instance destroyed or busy. Cancelling crop.");
    return;
}
isProcessingImage = true; // Set lock
updateStatus("Cropping...");

const croppedCanvas = cropper.getCroppedCanvas({
    minWidth: 256, minHeight: 256, maxWidth: 4096, maxHeight: 4096,
    fillColor: '#fff', imageSmoothingEnabled: true, imageSmoothingQuality: 'high',
});
if (!croppedCanvas) { 
    updateStatus("Crop failed.", true);
    isProcessingImage = false; // Release lock
    return; 
}

// --- NEW: Apply CSS Filters natively to the cropped canvas ---
const filteredCanvas = document.createElement('canvas');
filteredCanvas.width = croppedCanvas.width;
filteredCanvas.height = croppedCanvas.height;
const fCtx = filteredCanvas.getContext('2d');

let filterStr = '';
if (currentEnhancements.bw) filterStr = 'grayscale(100%) contrast(170%) brightness(105%)';
else if (currentEnhancements.greyscale) filterStr = 'grayscale(100%)';
else {
    let b = currentEnhancements.brightness || 0;
    let c = currentEnhancements.contrast || 0;
    let cssB = 100 + (b * 2);
    let cssC = 100 + (c * 2);
    filterStr = `brightness(${cssB}%) contrast(${cssC}%)`;
}
if(fCtx.filter !== undefined) fCtx.filter = filterStr;
fCtx.drawImage(croppedCanvas, 0, 0);

let croppedDataUrl = filteredCanvas.toDataURL('image/jpeg', 0.95); // High quality JPEG

inlineCropperWrapper.style.display = 'none'; // Hide cropper
imageViewArea.style.display = 'flex';      // Show preview

// *** BUG FIX (THE REAL ONE): Use requestAnimationFrame to prevent draw race condition ***
imagePreview.onload = () => {
    // Give the browser one frame to "settle" the image buffer
    // before we try to draw it to the canvas.
    requestAnimationFrame(() => {
if (previewCanvas.style.display === 'block') { // Check if we weren't cancelled
    drawPreview();
    scanBarcodeFromPreview(); 
}
    });
    imagePreview.onload = null;
};

imagePreview.src = croppedDataUrl; 
// *** BUG FIX (THE REAL ONE): DO NOT make the <img> visible. It's just a data source.
// imagePreview.style.display = 'block'; // <-- THIS WAS THE BUG

placeholder.style.display = 'none';
cameraFeed.style.display = 'none';
previewCanvas.style.display = 'block'; // The canvas is the only thing we see
currentRotation = 0;

// Update the file in the queue with the cropped version
if (currentImageIndex !== -1) {
    const newFile = await dataURLtoFile(croppedDataUrl, originalFileName.replace(/\.\w+$/, '.png'));
    imageQueue[currentImageIndex] = newFile;
    renderScroller(); // Re-render scroller with new thumbnail
}

setInterfaceState('preview');
updateActiveThumbnail();

if(cropper) cropper.destroy();
cropper = null;
isProcessingImage = false; // Release lock
    };
    
    cropConfirmBtn.onclick = confirmCropHandler;
}

// --- NEW: Preview Area Logic from V1 ---
function drawPreview() {
    if (!imagePreview.src || !imageViewArea || !previewCtx) return;
    const dpr = window.devicePixelRatio || 1;
    const containerW = imageViewArea.clientWidth;
    const containerH = imageViewArea.clientHeight;
    if (!containerW || !containerH) return;
    
    previewCanvas.width = containerW * dpr;
    previewCanvas.height = containerH * dpr;
    previewCanvas.style.width = `${containerW}px`;
    previewCanvas.style.height = `${containerH}px`;
    
    previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset and scale
    
    const naturalW = imagePreview.naturalWidth;
    const naturalH = imagePreview.naturalHeight;
    const imgAspect = naturalW / naturalH;
    const contAspect = containerW / containerH;
    let renderedW, renderedH;

    if (imgAspect > contAspect) {
renderedW = containerW; renderedH = containerW / imgAspect;
    } else {
renderedH = containerH; renderedW = containerH * imgAspect;
    }
    
    previewCtx.clearRect(0, 0, containerW, containerH);
    previewCtx.save();
    previewCtx.translate(containerW / 2, containerH / 2);
    previewCtx.rotate(currentRotation * Math.PI / 180);
    previewCtx.drawImage(imagePreview, -renderedW / 2, -renderedH / 2, renderedW, renderedH);
    previewCtx.restore();
}

// --- NEW: Barcode/OCR Logic from V1 ---
async function scanBarcodeFromPreview() {
    if (!barcodeDetector) {
updateStatus("Barcode detection not supported. Select area for OCR.", true);
return;
    }
    if (!imagePreview.src || !imagePreview.src.startsWith('data:')) return;

    try {
updateStatus("Attempting barcode scan...");
const barcodes = await barcodeDetector.detect(imagePreview);
if (barcodes.length > 0) {
    const barcodeValue = barcodes[0].rawValue.trim(); // Trim the value
    console.log("Scanned barcode:", barcodeValue);
    
    // --- *** NEW LOGIC: Check for selected row first *** ---
    if (selectedPickupRow) {
const input = selectedPickupRow.querySelector('input[type="text"]');
if (input) {
    input.value = barcodeValue;
    updateStatus(`Filled selected row with: ${barcodeValue}`);
    return; // Stop here
}
    }

    // --- *** Fallback: Find matching order *** ---
    const matchedOrder = ordersData[barcodeValue] || Object.values(ordersData).find(o => String(o.AWB_NUMBER) === String(barcodeValue));

    if (matchedOrder) {
// Found it!
selectedOrder = matchedOrder;
updateStatus(`Barcode matched: ${barcodeValue}. Loading tasks...`);
filterAndRenderOrders(); // Update right panel list
renderDynamicInputs();  // Update left panel pickup table

// Scroll the order list to the selected item
const selectedLi = orderList.querySelector(`li[data-order-ref="${selectedOrder.REFERENCE}"]`);
if (selectedLi) {
    selectedLi.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- *** NEW: Auto-hide list on mobile after selection *** ---
if (window.innerWidth < 1024) {
    const panel = mobilePlaceholder.querySelector('.right-panel');
    if (panel && !panel.classList.contains('collapsed')) {
panel.classList.add('collapsed');
if(toggleOrderListBtn) toggleOrderListBtn.classList.add('collapsed');
    }
    // Scroll to the tasks, not the list
    dynamicInputArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
    } else {
// No match found
updateStatus(`Barcode detected: ${barcodeValue} (No matching order found).`);
// *** MODIFIED: Update search input ***
if (searchMiniOrderInput) searchMiniOrderInput.value = barcodeValue;
filterAndRenderOrders();
    }
    
} else {
    updateStatus("No barcode found. Please select an area for OCR.");
}
    } catch (err) {
console.error("Barcode scan failed:", err);
updateStatus("Barcode scan failed. Select area for OCR.", true);
    }
}

function onSelectionStart(e) {
    if (previewCanvas.style.display !== 'block' || isSelecting || isProcessingOCR) return;
    e.preventDefault();
    
    const rect = imageViewArea.getBoundingClientRect();
    selectionCanvas.width = rect.width;
    selectionCanvas.height = rect.height;
    selectionCanvas.style.display = 'block';

    isSelecting = true;
    const point = e.touches ? e.touches[0] : e;
    selectionRect.startX = point.clientX - rect.left;
    selectionRect.startY = point.clientY - rect.top;

    window.addEventListener('mousemove', onSelectionMove, { passive: false });
    window.addEventListener('touchmove', onSelectionMove, { passive: false });
    window.addEventListener('mouseup', onSelectionUp, { once: true });
    window.addEventListener('touchend', onSelectionUp, { once: true });
}

function onSelectionMove(e) {
    if (!isSelecting) return;
    e.preventDefault();
    const rect = imageViewArea.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const currentX = point.clientX - rect.left;
    const currentY = point.clientY - rect.top;
    const width = currentX - selectionRect.startX;
    const height = currentY - selectionRect.startY;

    selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    selectionCtx.strokeStyle = 'red';
    selectionCtx.lineWidth = 2;
    selectionCtx.strokeRect(selectionRect.startX, selectionRect.startY, width, height);
}

async function onSelectionUp(e) {
    if (!isSelecting) return;
    isSelecting = false;
    window.removeEventListener('mousemove', onSelectionMove);
    window.removeEventListener('touchmove', onSelectionMove);
    
    selectionCanvas.style.display = 'none';
    selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    
    const rect = imageViewArea.getBoundingClientRect();
    const point = e.changedTouches ? e.changedTouches[0] : e;
    const selectionEndX = point.clientX - rect.left;
    const selectionEndY = point.clientY - rect.top;
    const selX1 = Math.min(selectionRect.startX, selectionEndX);
    const selY1 = Math.min(selectionRect.startY, selectionEndY);
    const selX2 = Math.max(selectionRect.startX, selectionEndX);
    const selY2 = Math.max(selectionRect.startY, selectionEndY);
    const selW = selX2 - selX1;
    const selH = selY2 - selY1;

    if (selW < 10 || selH < 10) return; // Selection too small
    const naturalW = imagePreview.naturalWidth, naturalH = imagePreview.naturalHeight;
    const containerW = imageViewArea.clientWidth, containerH = imageViewArea.clientHeight;
    if (!naturalW || !naturalH || !containerW || !containerH) {
updateStatus("OCR failed: Image dimensions are zero.", true); return;
    }
    const imgAspect = naturalW / naturalH, contAspect = containerW / containerH;
    let renderedW, renderedH;
    if (imgAspect > contAspect) {
renderedW = containerW; renderedH = containerW / imgAspect;
    } else {
renderedH = containerH; renderedW = containerH * imgAspect;
    }
    const offsetX = (containerW - renderedW) / 2, offsetY = (containerH - renderedH) / 2;
    const scaleFactor = naturalW / renderedW;
    const centerX = containerW / 2, centerY = containerH / 2;
    const angle = (-currentRotation * Math.PI / 180), cos = Math.cos(angle), sin = Math.sin(angle);

    const unrotatePoint = (x, y) => {
const tx = x - centerX, ty = y - centerY;
const rx = (tx * cos) - (ty * sin), ry = (tx * sin) + (ty * cos);
return { x: rx + centerX, y: ry + centerY };
    };
    
    const p1 = unrotatePoint(selX1, selY1), p2 = unrotatePoint(selX2, selY1);
    const p3 = unrotatePoint(selX1, selY2), p4 = unrotatePoint(selX2, selY2);
    const unrotatedSelX = Math.min(p1.x, p2.x, p3.x, p4.x);
    const unrotatedSelY = Math.min(p1.y, p2.y, p3.y, p4.y);
    const unrotatedSelW = Math.max(p1.x, p2.x, p3.x, p4.x) - unrotatedSelX;
    const unrotatedSelH = Math.max(p1.y, p2.y, p3.y, p4.y) - unrotatedSelY;
    const sourceX = (unrotatedSelX - offsetX) * scaleFactor;
    const sourceY = (unrotatedSelY - offsetY) * scaleFactor;
    const sourceWidth = unrotatedSelW * scaleFactor;
    const sourceHeight = unrotatedSelH * scaleFactor;

    if (sourceX < 0 || sourceY < 0 || (sourceX + sourceWidth) > naturalW || (sourceY + sourceHeight) > naturalH) {
updateStatus("Selection was outside the image area.", true); return;
    }

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sourceWidth; cropCanvas.height = sourceHeight;
    cropCanvas.getContext('2d').drawImage(imagePreview, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);

    isProcessingOCR = true;
    updateStatus("Running OCR on selected area...");
    try {
const { data: { text } } = await Tesseract.recognize(cropCanvas, 'eng');
const ocrText = text.trim().replace(/\s+/g, ''); // Clean OCR text

if (ocrText) {
    
    // --- *** NEW LOGIC: Check for selected row first *** ---
    if (selectedPickupRow) {
const input = selectedPickupRow.querySelector('input[type="text"]');
if (input) {
    input.value = ocrText;
    updateStatus(`Filled selected row with: ${ocrText}`);
    isProcessingOCR = false;
    return; // Stop here
}
    }
    
    // --- *** Fallback: Find matching order *** ---
    const matchedOrder = ordersData[ocrText] || Object.values(ordersData).find(o => String(o.AWB_NUMBER) === String(ocrText));

    if (matchedOrder) {
// Found it!
selectedOrder = matchedOrder;
updateStatus(`OCR matched: ${ocrText}. Loading tasks...`);
filterAndRenderOrders();
renderDynamicInputs();
const selectedLi = orderList.querySelector(`li[data-order-ref="${selectedOrder.REFERENCE}"]`);
if (selectedLi) {
    selectedLi.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- *** NEW: Auto-hide list on mobile after selection *** ---
if (window.innerWidth < 1024) {
    const panel = mobilePlaceholder.querySelector('.right-panel');
    if (panel && !panel.classList.contains('collapsed')) {
panel.classList.add('collapsed');
if(toggleOrderListBtn) toggleOrderListBtn.classList.add('collapsed');
    }
    // Scroll to the tasks, not the list
    dynamicInputArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
    } else {
// No match found - put in filter box
updateStatus(`OCR: ${ocrText} (No exact match. Filtering list...).`);
// *** MODIFIED: Update search input ***
if(searchMiniOrderInput) searchMiniOrderInput.value = ocrText;
filterAndRenderOrders(); // Trigger the filter
    }
    // --- *** END NEW LOGIC *** ---
    
} else {
    updateStatus("OCR could not find any text in the selected area.");
}
    } catch (err) {
updateStatus("OCR failed on selection.", true);
    } finally {
setTimeout(() => { isProcessingOCR = false; }, 300);
    }
}

// --- *** NEW: HARDWARE ACCELERATED CSS FILTERS (Replaces CamanJS) *** ---
let applyEnhancements = () => {
    if (!cropper) return;

    let filterStr = '';
    if (currentEnhancements.bw) {
        filterStr = 'grayscale(100%) contrast(170%) brightness(105%)';
    } else if (currentEnhancements.greyscale) {
        filterStr = 'grayscale(100%)';
    } else {
        let b = currentEnhancements.brightness || 0; 
        let c = currentEnhancements.contrast || 0; 
        let cssB = 100 + (b * 2);
        let cssC = 100 + (c * 2);
        filterStr = `brightness(${cssB}%) contrast(${cssC}%)`;
    }

    // Apply hardware-accelerated CSS filters to the cropper preview elements
    const canvasImg = document.querySelector('.cropper-canvas img');
    const viewboxImg = document.querySelector('.cropper-view-box img');
    if (canvasImg) canvasImg.style.filter = filterStr;
    if (viewboxImg) viewboxImg.style.filter = filterStr;
    
    updateStatus('Enhancements applied instantly.');
}

function resetEnhancements() {
    if (!cropper) return;
    updateStatus("Resetting enhancements...");
    currentEnhancements = { brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false };
    brightnessSlider.value = 0;
    contrastSlider.value = 0;
    sharpenBtn.style.backgroundColor = '';
    greyscaleBtn.style.backgroundColor = '';
    bwBtn.style.backgroundColor = '';
    applyEnhancements(); // Re-apply default (no) filters
    updateStatus("Enhancements reset.");
}
// --- *** END CSS FILTERS *** ---

// --- NEW: Data Extraction (OCR) Function ---
async function runOcrExtraction() {
    if (!cropper) return;
    updateStatus("Running OCR extraction... Please wait.");
    isProcessingImage = true;

    try {
        const extractCanvas = cropper.getCroppedCanvas({
            minWidth: 256, minHeight: 256, maxWidth: 2048, maxHeight: 2048,
            fillColor: '#fff', imageSmoothingEnabled: true
        });
        
        // Bake current filters to make text legible for Tesseract
        const fCtx = extractCanvas.getContext('2d');
        const canvasImg = document.querySelector('.cropper-canvas img');
        if (canvasImg && canvasImg.style.filter && fCtx.filter !== undefined) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = extractCanvas.width;
            tempCanvas.height = extractCanvas.height;
            tempCanvas.getContext('2d').drawImage(extractCanvas, 0, 0);
            
            fCtx.filter = canvasImg.style.filter;
            fCtx.drawImage(tempCanvas, 0, 0);
        }

        const { data: { text } } = await Tesseract.recognize(extractCanvas, 'eng');
        const cleanText = text.replace(/\s+/g, ' ');
        
        // Regex matching
        const mobiles = cleanText.match(/(?:\+91|91)?\s*[6-9]\d{9}/g) || [];
        const gsts = cleanText.match(/\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/gi) || [];
        const pins = cleanText.match(/\b\d{6}\b/g) || [];
        
        const dedupMobiles = [...new Set(mobiles)];
        const dedupGsts = [...new Set(gsts)];
        const dedupPins = [...new Set(pins)];
        
        // Show results
        alert(`Extraction Complete:\n\nMobiles: ${dedupMobiles.length ? dedupMobiles.join(', ') : 'None found'}\nGSTs: ${dedupGsts.length ? dedupGsts.join(', ') : 'None found'}\nPINs: ${dedupPins.length ? dedupPins.join(', ') : 'None found'}`);
        updateStatus("Extraction complete.");
    } catch (err) {
        console.error("OCR Extraction failed:", err);
        updateStatus("OCR Extraction failed.", true);
    } finally {
        isProcessingImage = false;
    }
}
// --- *** END CAMANJS BUG FIX *** ---

function resetUploader() {
    if (window.markClean) window.markClean(); // Guard: reset/cancel
    stopCamera(); // <-- Call stopCamera
    placeholder.textContent = 'Select Camera or Upload to begin';
    placeholder.style.display = 'block';
    previewCanvas.style.display = 'none';
    cameraFeed.style.display = 'none'; 
    imagePreview.src = '';
    imagePreview.style.display = 'none'; // <-- HIDE image element
    fileInput.value = ''; 
    currentRotation = 0;
    isImageLocked = false; 
    lockBtn.textContent = 'Lock';
    lockBtn.style.backgroundColor = '';
    imageQueue = []; 
    currentImageIndex = -1;
    scroller.innerHTML = ''; 
    scrollerContainer.style.display = 'none';
    inlineCropperWrapper.style.display = 'none';
    imageViewArea.style.display = 'flex';
    selectionCanvas.style.display = 'none';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.backgroundColor = ''; // Reset "Done" button style
    if(cropper) cropper.destroy(); // Destroy cropper instance
    cropper = null;
    isProcessingImage = false; // *** BUG FIX: Release lock on reset ***
    setInterfaceState('idle');
    updateStatus("Select an order or start capture");
}

