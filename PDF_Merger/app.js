// State Management
let filesList = [];
let dragSourceIndex = null;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileListSection = document.getElementById('fileListSection');
const fileList = document.getElementById('fileList');
const configSection = document.getElementById('configSection');
const filenameInput = document.getElementById('filenameInput');
const mergeBtn = document.getElementById('mergeBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const progressBar = document.getElementById('progressBar');
const toast = document.getElementById('toast');
const toastText = document.getElementById('toastText');

// Toast Helper
function showToast(message, type = 'warning') {
    toastText.textContent = message;
    
    // Change icon based on type if needed, default is warning
    const icon = toast.querySelector('i');
    if (type === 'danger') {
        icon.setAttribute('data-lucide', 'alert-octagon');
        toast.style.border = '1px solid rgba(239, 68, 68, 0.2)';
        toast.style.color = '#fca5a5';
    } else {
        icon.setAttribute('data-lucide', 'alert-triangle');
        toast.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        toast.style.color = '#fbbf24';
    }
    
    lucide.createIcons();
    
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Format File Size Helper
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Drag & Drop Handlers for Upload
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
});

// Convert Image to PDF ArrayBuffer client-side using pdf-lib
async function imageToPdfBuffer(imageBytes, mimeType) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    let img;
    
    try {
        if (mimeType === 'image/png') {
            img = await pdfDoc.embedPng(imageBytes);
        } else {
            // default to JPG/JPEG
            img = await pdfDoc.embedJpg(imageBytes);
        }
    } catch (e) {
        console.error("Embedding image failed, trying fallback embedJpg", e);
        try {
            img = await pdfDoc.embedPng(imageBytes);
        } catch (err2) {
            img = await pdfDoc.embedJpg(imageBytes);
        }
    }
    
    const { width, height } = img;
    // Create page with same size as image
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(img, {
        x: 0,
        y: 0,
        width: width,
        height: height
    });
    
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

// File processing and loading metadata
async function handleFiles(files) {
    loadingOverlay.style.display = 'flex';
    loadingText.textContent = '正在讀取檔案資訊...';
    progressBar.style.width = '0%';
    
    const allowedFiles = Array.from(files).filter(file => {
        const nameLower = file.name.toLowerCase();
        return file.type === 'application/pdf' || 
               nameLower.endsWith('.pdf') ||
               file.type.startsWith('image/png') ||
               file.type.startsWith('image/jpeg') ||
               file.type.startsWith('image/jpg') ||
               nameLower.endsWith('.png') ||
               nameLower.endsWith('.jpg') ||
               nameLower.endsWith('.jpeg');
    });
    
    if (allowedFiles.length === 0) {
        showToast('請上傳有效的 PDF 或圖片檔案 (PNG, JPG)！', 'danger');
        loadingOverlay.style.display = 'none';
        return;
    }
    
    for (let i = 0; i < allowedFiles.length; i++) {
        const file = allowedFiles[i];
        
        // Progress updates
        const percent = Math.round(((i + 1) / allowedFiles.length) * 100);
        progressBar.style.width = `${percent}%`;
        
        const fileId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        
        try {
            const isImage = file.type.startsWith('image/') || 
                            file.name.toLowerCase().endsWith('.png') || 
                            file.name.toLowerCase().endsWith('.jpg') || 
                            file.name.toLowerCase().endsWith('.jpeg');
            
            let arrayBuffer;
            let pageCount = 1;
            let isEncrypted = false;
            let originalType = isImage ? 'image' : 'pdf';
            
            if (isImage) {
                loadingText.textContent = `正在將圖片轉換為 PDF: ${file.name}...`;
                const imgBuffer = await readFileAsArrayBuffer(file);
                let mimeType = file.type;
                if (!mimeType) {
                    mimeType = file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
                }
                arrayBuffer = await imageToPdfBuffer(imgBuffer, mimeType);
                pageCount = 1;
            } else {
                arrayBuffer = await readFileAsArrayBuffer(file);
                try {
                    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                    pageCount = pdfDoc.getPageCount();
                } catch (err) {
                    const errStr = err.toString().toLowerCase();
                    if (errStr.includes('encrypt') || errStr.includes('decrypt') || errStr.includes('password')) {
                        isEncrypted = true;
                    } else {
                        console.error("PDF Load Error:", err);
                        throw err;
                    }
                }
            }
            
            filesList.push({
                id: fileId,
                file: file,
                arrayBuffer: arrayBuffer,
                name: file.name,
                size: file.size,
                pageCount: pageCount,
                isEncrypted: isEncrypted,
                originalType: originalType,
                pageRange: ''
            });
            
        } catch (e) {
            console.error(e);
            showToast(`無法讀取檔案: ${file.name}，可能已損壞。`, 'danger');
        }
    }
    
    fileInput.value = '';
    loadingOverlay.style.display = 'none';
    renderFileList();
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

// Render File Cards List
function renderFileList() {
    fileList.innerHTML = '';
    
    if (filesList.length === 0) {
        fileListSection.style.display = 'none';
        configSection.style.display = 'none';
        return;
    }
    
    fileListSection.style.display = 'flex';
    configSection.style.display = 'block';
    
    filesList.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.setAttribute('draggable', 'true');
        li.dataset.index = index;
        
        // Setup Drag & Drop sorting listeners
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);
        li.addEventListener('dragend', handleDragEnd);
        
        // Metadata badges
        let badgeHTML = '';
        if (item.isEncrypted) {
            badgeHTML = `<span class="badge badge-warning"><i data-lucide="lock" style="width:12px;height:12px;display:inline-block;margin-right:2px;vertical-align:middle;"></i>已加密/受保護</span>`;
        } else if (item.originalType === 'image') {
            badgeHTML = `<span class="badge badge-success"><i data-lucide="image" style="width:12px;height:12px;display:inline-block;margin-right:2px;vertical-align:middle;"></i>圖片頁面</span>`;
        } else {
            badgeHTML = `<span class="badge badge-info">${item.pageCount} 頁</span>`;
        }
        
        // Page Range Input element
        let pageRangeHTML = '';
        if (!item.isEncrypted) {
            pageRangeHTML = `
                <div class="page-range-wrapper">
                    <span class="page-range-label">選取頁面:</span>
                    <input type="text" class="page-range-input" 
                           placeholder="例如: 1-2, 5" 
                           value="${item.pageRange}"
                           data-id="${item.id}"
                           onchange="updatePageRange('${item.id}', this.value)">
                </div>
            `;
        } else {
            pageRangeHTML = `
                <div style="font-size: 0.8rem; color: var(--warning); display:flex; align-items:center; gap:0.25rem;">
                    <i data-lucide="info" style="width:14px;height:14px;"></i>
                    <span>不支援加密檔案，請先移除密碼保護。</span>
                </div>
            `;
        }
        
        const iconName = item.originalType === 'image' ? 'image' : 'file-text';
        const iconColor = item.originalType === 'image' ? 'var(--success)' : 'var(--primary)';
        
        li.innerHTML = `
            <div class="drag-handle" title="拖曳以排序">
                <i data-lucide="grip-vertical"></i>
            </div>
            
            <div class="reorder-controls">
                <button class="reorder-btn" title="上移" onclick="moveUp(${index})" ${index === 0 ? 'disabled' : ''}>
                    <i data-lucide="chevron-up"></i>
                </button>
                <button class="reorder-btn" title="下移" onclick="moveDown(${index})" ${index === filesList.length - 1 ? 'disabled' : ''}>
                    <i data-lucide="chevron-down"></i>
                </button>
            </div>
            
            <div style="display:flex; align-items:center; gap:0.75rem;">
                <div class="file-info-icon" style="color: ${iconColor}">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="file-details">
                    <div class="file-name" title="${item.name}">${item.name}</div>
                    <div class="file-meta">
                        <span>${formatBytes(item.size)}</span>
                        ${badgeHTML}
                    </div>
                </div>
            </div>
            
            <div class="file-actions">
                ${pageRangeHTML}
                <button class="delete-btn" onclick="deleteFile('${item.id}')" title="刪除檔案">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
        
        fileList.appendChild(li);
    });
    
    lucide.createIcons();
}

// Update Page Range Value
window.updatePageRange = function(id, value) {
    const fileItem = filesList.find(item => item.id === id);
    if (fileItem) {
        fileItem.pageRange = value;
    }
};

// Reorder Logic (Manual Buttons)
window.moveUp = function(index) {
    if (index > 0) {
        const temp = filesList[index];
        filesList[index] = filesList[index - 1];
        filesList[index - 1] = temp;
        renderFileList();
    }
};

window.moveDown = function(index) {
    if (index < filesList.length - 1) {
        const temp = filesList[index];
        filesList[index] = filesList[index + 1];
        filesList[index + 1] = temp;
        renderFileList();
    }
};

// Reorder Logic (Drag and Drop HTML5)
function handleDragStart(e) {
    dragSourceIndex = this.dataset.index;
    this.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.stopPropagation();
    const targetIndex = this.dataset.index;
    
    if (dragSourceIndex !== null && dragSourceIndex !== targetIndex) {
        // Swap or splice placement
        const draggedItem = filesList[dragSourceIndex];
        filesList.splice(dragSourceIndex, 1);
        filesList.splice(targetIndex, 0, draggedItem);
        renderFileList();
    }
}

function handleDragEnd() {
    this.style.opacity = '1';
    dragSourceIndex = null;
}

// Delete File Item
window.deleteFile = function(id) {
    filesList = filesList.filter(item => item.id !== id);
    renderFileList();
};

// Parse Page Range String
// e.g. "1-2, 5" with maxPages = 6 returns [0, 1, 4] (0-indexed)
function parsePageRange(rangeStr, maxPages) {
    if (!rangeStr || rangeStr.trim() === '') {
        // Default: include all pages
        return Array.from({ length: maxPages }, (_, i) => i);
    }
    
    const indices = [];
    const parts = rangeStr.split(',');
    
    for (let part of parts) {
        part = part.trim();
        
        // Single digit: "5"
        if (/^\d+$/.test(part)) {
            const pageNum = parseInt(part, 10);
            if (pageNum >= 1 && pageNum <= maxPages) {
                indices.push(pageNum - 1);
            }
        } 
        // Range: "1-3" or "3-1"
        else if (/^\d+\s*-\s*\d+$/.test(part)) {
            const bounds = part.split('-');
            const start = parseInt(bounds[0].trim(), 10);
            const end = parseInt(bounds[1].trim(), 10);
            
            if (start <= end) {
                for (let p = start; p <= end; p++) {
                    if (p >= 1 && p <= maxPages) {
                        indices.push(p - 1);
                    }
                }
            } else {
                for (let p = start; p >= end; p--) {
                    if (p >= 1 && p <= maxPages) {
                        indices.push(p - 1);
                    }
                }
            }
        }
    }
    
    return indices;
}

// Merge Action Handler
mergeBtn.addEventListener('click', async () => {
    if (filesList.length === 0) return;
    
    // Check for encrypted files
    const encryptedFiles = filesList.filter(item => item.isEncrypted);
    if (encryptedFiles.length > 0) {
        showToast(`無法合併！檔案「${encryptedFiles[0].name}」為加密檔案，請先移除密碼保護後再進行合併。`, 'danger');
        return;
    }
    
    loadingOverlay.style.display = 'flex';
    loadingText.textContent = '正在整合 PDF 檔案中...';
    progressBar.style.width = '0%';
    
    try {
        const mergedPdf = await PDFLib.PDFDocument.create();
        
        for (let i = 0; i < filesList.length; i++) {
            const item = filesList[i];
            
            // Update UI Progress text and bar
            loadingText.textContent = `正在處理: ${item.name}...`;
            const progressPercent = Math.round((i / filesList.length) * 100);
            progressBar.style.width = `${progressPercent}%`;
            
            // Load source document
            const sourcePdf = await PDFLib.PDFDocument.load(item.arrayBuffer);
            
            // Resolve custom page range indices
            const pageIndices = parsePageRange(item.pageRange, item.pageCount);
            
            if (pageIndices.length > 0) {
                const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
        }
        
        loadingText.textContent = '正在生成最終 PDF 檔案...';
        progressBar.style.width = '95%';
        
        const mergedPdfBytes = await mergedPdf.save();
        
        // Trigger download
        let outName = filenameInput.value.trim();
        if (!outName) outName = '合併文件';
        if (!outName.toLowerCase().endsWith('.pdf')) outName += '.pdf';
        
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = outName;
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        progressBar.style.width = '100%';
        loadingOverlay.style.display = 'none';
        
    } catch (error) {
        console.error("Merge error:", error);
        loadingOverlay.style.display = 'none';
        showToast('合併 PDF 時發生錯誤，請確認檔案未損壞且無密碼保護。', 'danger');
    }
});
