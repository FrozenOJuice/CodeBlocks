// API configuration
const API_BASE_URL = 'http://localhost:8000';

// Global state
let codeBlocks = [];
let currentBlockId = null;
let isEditMode = false;
let currentExplanationPopup = null;

// DOM Elements
const blocksList = document.getElementById('blocks-list');
const codeViewer = document.getElementById('code-viewer');
const searchInput = document.getElementById('search');
const categoryFilter = document.getElementById('category-filter');
const addBlockBtn = document.getElementById('add-block-btn');
const saveJsonBtn = document.getElementById('save-json-btn');
const modal = document.getElementById('code-block-modal');
const closeModal = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');
const codeBlockForm = document.getElementById('code-block-form');
const fullscreenViewer = document.getElementById('fullscreen-viewer');
const closeFullscreen = document.getElementById('close-fullscreen');

// API Functions
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

async function loadCodeBlocks() {
    try {
        codeBlocks = await apiRequest('/codeblocks');
        renderBlocksList();
        updateCategoryFilter();
    } catch (error) {
        console.error('Failed to load code blocks:', error);
        alert('Failed to load code blocks. Make sure the backend server is running.');
    }
}

async function createCodeBlock(blockData) {
    const newBlock = await apiRequest('/codeblocks', {
        method: 'POST',
        body: JSON.stringify(blockData),
    });
    return newBlock;
}

async function updateCodeBlock(blockId, blockData) {
    const updatedBlock = await apiRequest(`/codeblocks/${blockId}`, {
        method: 'PUT',
        body: JSON.stringify(blockData),
    });
    return updatedBlock;
}

async function deleteCodeBlock(blockId) {
    await apiRequest(`/codeblocks/${blockId}`, {
        method: 'DELETE',
    });
}

// Initialize the application
async function init() {
    await loadCodeBlocks();
    setupEventListeners();
}

// Set up event listeners
function setupEventListeners() {
    searchInput.addEventListener('input', renderBlocksList);
    categoryFilter.addEventListener('change', renderBlocksList);
    addBlockBtn.addEventListener('click', () => openModal());
    saveJsonBtn.addEventListener('click', saveToJson);
    closeModal.addEventListener('click', closeModalWindow);
    cancelBtn.addEventListener('click', closeModalWindow);
    codeBlockForm.addEventListener('submit', saveCodeBlock);
    closeFullscreen.addEventListener('click', closeFullscreenViewer);
    
    // Close explanation popup when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (currentExplanationPopup && !e.target.closest('.code-line') && !e.target.closest('.line-explanation-popup')) {
            closeExplanationPopup();
        }
    });
}

// Render the list of code blocks
function renderBlocksList() {
    const searchTerm = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    
    const filteredBlocks = codeBlocks.filter(block => {
        const matchesSearch = block.title.toLowerCase().includes(searchTerm) || 
                             block.category.toLowerCase().includes(searchTerm);
        const matchesCategory = !category || block.category === category;
        return matchesSearch && matchesCategory;
    });
    
    blocksList.innerHTML = '';
    
    if (filteredBlocks.length === 0) {
        blocksList.innerHTML = '<p class="no-blocks">No code blocks found</p>';
        return;
    }
    
    filteredBlocks.forEach(block => {
        const blockElement = document.createElement('div');
        blockElement.className = `block-item ${currentBlockId === block.id ? 'active' : ''}`;
        blockElement.innerHTML = `
            <div class="block-title">${block.title}</div>
            <div class="block-meta">${block.category}</div>
        `;
        blockElement.addEventListener('click', () => displayCodeBlock(block.id));
        blocksList.appendChild(blockElement);
    });
}

// Update the category filter dropdown
function updateCategoryFilter() {
    const categories = [...new Set(codeBlocks.map(block => block.category))];
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// Display a code block in the main viewer
function displayCodeBlock(id) {
    currentBlockId = id;
    const block = codeBlocks.find(b => b.id === id);
    
    if (!block) return;
    
    // Update active state in sidebar
    document.querySelectorAll('.block-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.block-item').forEach(item => {
        if (item.querySelector('.block-title').textContent === block.title) {
            item.classList.add('active');
        }
    });
    
    if (isEditMode) {
        renderEditView(block);
    } else {
        renderReadView(block);
    }
}

// Render the code block in read-only view
function renderReadView(block) {
    // Format code with line numbers and explanations
    const codeLines = block.code.split('\n');
    const codeLinesHTML = codeLines.map((line, index) => {
        const lineNumber = index + 1;
        const hasExplanation = block.lineExplanations && block.lineExplanations[lineNumber];
        const clickableClass = hasExplanation ? 'clickable' : '';
        
        return `
            <div class="code-line ${clickableClass}" data-line-number="${lineNumber}">
                <div class="code-line-number"></div>
                <div class="code-line-text">${escapeHtml(line)}</div>
            </div>
        `;
    }).join('');
    
    codeViewer.innerHTML = `
        <div class="code-block">
            <div class="code-header">
                <h3>${block.title}</h3>
                <div class="code-actions">
                    <button class="edit-btn" data-id="${block.id}">Edit</button>
                    <button class="delete-btn" data-id="${block.id}">Delete</button>
                    <button class="fullscreen-btn" data-id="${block.id}">Fullscreen</button>
                </div>
            </div>
            <div class="code-content">
                <div class="code-lines">
                    ${codeLinesHTML}
                </div>
                <div class="code-explanation">
                    <h4>Explanation</h4>
                    <p>${block.explanation}</p>
                </div>
            </div>
        </div>
    `;
    
    // Add event listeners for clickable lines
    document.querySelectorAll('.code-line.clickable').forEach(line => {
        line.addEventListener('click', handleLineClick);
    });
    
    // Add event listeners for buttons
    document.querySelector('.edit-btn').addEventListener('click', enableEditMode);
    document.querySelector('.delete-btn').addEventListener('click', handleDelete);
    document.querySelector('.fullscreen-btn').addEventListener('click', openFullscreenViewer);
}

// Handle delete button click
async function handleDelete(e) {
    const blockId = parseInt(e.target.dataset.id);
    if (confirm('Are you sure you want to delete this code block?')) {
        try {
            await deleteCodeBlock(blockId);
            await loadCodeBlocks(); // Reload the list
            codeViewer.innerHTML = `
                <div class="no-selection">
                    <p>Select a code block from the sidebar to view it</p>
                </div>
            `;
            currentBlockId = null;
        } catch (error) {
            alert('Failed to delete code block');
        }
    }
}

// Handle click on code line
function handleLineClick(e) {
    const lineElement = e.currentTarget;
    const lineNumber = parseInt(lineElement.dataset.lineNumber);
    const block = codeBlocks.find(b => b.id === currentBlockId);
    
    if (!block || !block.lineExplanations || !block.lineExplanations[lineNumber]) {
        return;
    }
    
    // Close any existing popup
    closeExplanationPopup();
    
    // Remove highlight from all lines
    document.querySelectorAll('.code-line').forEach(line => {
        line.classList.remove('highlighted');
    });
    
    // Highlight the clicked line
    lineElement.classList.add('highlighted');
    
    // Create and show explanation popup
    const explanation = block.lineExplanations[lineNumber];
    showExplanationPopup(lineElement, explanation, lineNumber);
}

// Show explanation popup
function showExplanationPopup(lineElement, explanation, lineNumber) {
    // Remove any existing popup
    closeExplanationPopup();
    
    // Create new popup
    const popup = document.createElement('div');
    popup.className = 'line-explanation-popup';
    popup.innerHTML = `
        <div class="popup-header">
            <strong>Line ${lineNumber}</strong>
        </div>
        <div class="popup-content">${explanation}</div>
    `;
    
    document.body.appendChild(popup);
    currentExplanationPopup = popup;
    
    // Position the popup
    const lineRect = lineElement.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    
    let top = lineRect.bottom + window.scrollY + 5;
    let left = lineRect.left + window.scrollX;
    
    // Adjust if popup would go off screen
    if (left + popupRect.width > window.innerWidth) {
        left = window.innerWidth - popupRect.width - 10;
    }
    
    if (top + popupRect.height > window.innerHeight + window.scrollY) {
        top = lineRect.top + window.scrollY - popupRect.height - 5;
    }
    
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
}

// Close explanation popup
function closeExplanationPopup() {
    if (currentExplanationPopup) {
        currentExplanationPopup.remove();
        currentExplanationPopup = null;
    }
    
    // Remove highlight from all lines
    document.querySelectorAll('.code-line').forEach(line => {
        line.classList.remove('highlighted');
    });
}

// Render the code block in edit view
function renderEditView(block) {
    codeViewer.innerHTML = `
        <div class="code-block">
            <div class="code-header">
                <h3>Editing: ${block.title}</h3>
                <div class="code-actions">
                    <button class="save-edit-btn" data-id="${block.id}">Save</button>
                    <button class="cancel-edit-btn" data-id="${block.id}">Cancel</button>
                </div>
            </div>
            <div class="code-content">
                <div class="form-group">
                    <label for="edit-code">Code</label>
                    <textarea id="edit-code" class="edit-textarea">${escapeHtml(block.code)}</textarea>
                </div>
                <div class="form-group">
                    <label for="edit-explanation">General Explanation</label>
                    <textarea id="edit-explanation" class="explanation-edit">${escapeHtml(block.explanation)}</textarea>
                </div>
                <div class="form-group">
                    <label for="edit-line-explanations">Line Explanations (one per line, format: lineNumber:explanation)</label>
                    <textarea id="edit-line-explanations" class="explanation-edit" placeholder="1:This line imports the required module&#10;2:This function initializes the application">${formatLineExplanationsForEdit(block.lineExplanations)}</textarea>
                </div>
            </div>
        </div>
    `;
    
    // Add event listeners
    document.querySelector('.save-edit-btn').addEventListener('click', saveEdit);
    document.querySelector('.cancel-edit-btn').addEventListener('click', cancelEdit);
}

// Format line explanations for the edit textarea
function formatLineExplanationsForEdit(lineExplanations) {
    if (!lineExplanations) return '';
    return Object.entries(lineExplanations)
        .map(([line, explanation]) => `${line}:${explanation}`)
        .join('\n');
}

// Enable edit mode for current code block
function enableEditMode() {
    isEditMode = true;
    closeExplanationPopup();
    displayCodeBlock(currentBlockId);
}

// Cancel edit mode
function cancelEdit() {
    isEditMode = false;
    displayCodeBlock(currentBlockId);
}

// Save edits to code block
async function saveEdit() {
    const block = codeBlocks.find(b => b.id === currentBlockId);
    if (!block) return;
    
    const newCode = document.getElementById('edit-code').value;
    const newExplanation = document.getElementById('edit-explanation').value;
    const lineExplanationsText = document.getElementById('edit-line-explanations').value;
    
    // Parse line explanations
    const newLineExplanations = {};
    if (lineExplanationsText.trim()) {
        lineExplanationsText.split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const lineNumber = parseInt(parts[0].trim());
                if (!isNaN(lineNumber)) {
                    newLineExplanations[lineNumber] = parts.slice(1).join(':').trim();
                }
            }
        });
    }
    
    try {
        // Update the block via API
        await updateCodeBlock(currentBlockId, {
            code: newCode,
            explanation: newExplanation,
            lineExplanations: newLineExplanations
        });
        
        // Reload the data
        await loadCodeBlocks();
        isEditMode = false;
        displayCodeBlock(currentBlockId);
    } catch (error) {
        alert('Failed to save changes');
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Open the modal for adding/editing a code block
function openModal(block = null) {
    const isEdit = block !== null;
    document.getElementById('modal-title').textContent = isEdit ? 'Edit Code Block' : 'Add Code Block';
    
    if (isEdit) {
        document.getElementById('block-title').value = block.title;
        document.getElementById('block-category').value = block.category;
        document.getElementById('block-code').value = block.code;
        document.getElementById('block-explanation').value = block.explanation;
        
        // Format line explanations for textarea
        if (block.lineExplanations) {
            const lineExplanationsText = Object.entries(block.lineExplanations)
                .map(([line, explanation]) => `${line}:${explanation}`)
                .join('\n');
            document.getElementById('line-explanations').value = lineExplanationsText;
        } else {
            document.getElementById('line-explanations').value = '';
        }
        
        // Store the ID of the block being edited
        codeBlockForm.dataset.editingId = block.id;
    } else {
        codeBlockForm.reset();
        delete codeBlockForm.dataset.editingId;
    }
    
    modal.style.display = 'flex';
}

// Close the modal window
function closeModalWindow() {
    modal.style.display = 'none';
}

// Save a code block (add or edit)
async function saveCodeBlock(e) {
    e.preventDefault();
    
    const title = document.getElementById('block-title').value;
    const category = document.getElementById('block-category').value;
    const code = document.getElementById('block-code').value;
    const explanation = document.getElementById('block-explanation').value;
    
    // Parse line explanations
    const lineExplanationsText = document.getElementById('line-explanations').value;
    const lineExplanations = {};
    
    if (lineExplanationsText.trim()) {
        lineExplanationsText.split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const lineNumber = parseInt(parts[0].trim());
                if (!isNaN(lineNumber)) {
                    lineExplanations[lineNumber] = parts.slice(1).join(':').trim();
                }
            }
        });
    }
    
    const isEdit = codeBlockForm.dataset.editingId;
    
    try {
        if (isEdit) {
            // Update existing block
            const id = parseInt(codeBlockForm.dataset.editingId);
            await updateCodeBlock(id, {
                title,
                category,
                code,
                explanation,
                lineExplanations
            });
        } else {
            // Add new block
            await createCodeBlock({
                title,
                category,
                code,
                explanation,
                lineExplanations
            });
        }
        
        // Reload the data
        await loadCodeBlocks();
        closeModalWindow();
        
        // If we were editing the currently displayed block, update the display
        if (isEdit && currentBlockId === parseInt(codeBlockForm.dataset.editingId)) {
            isEditMode = false;
            displayCodeBlock(parseInt(codeBlockForm.dataset.editingId));
        }
    } catch (error) {
        alert('Failed to save code block');
    }
}

// Save all code blocks to JSON file (optional backup)
function saveToJson() {
    const dataStr = JSON.stringify(codeBlocks, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'codeblocks_backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Open fullscreen viewer for a code block
function openFullscreenViewer() {
    const block = codeBlocks.find(b => b.id === currentBlockId);
    
    if (!block) return;
    
    document.getElementById('fullscreen-title').textContent = block.title;
    document.getElementById('fullscreen-code').textContent = block.code;
    fullscreenViewer.style.display = 'flex';
}

// Close fullscreen viewer
function closeFullscreenViewer() {
    fullscreenViewer.style.display = 'none';
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);