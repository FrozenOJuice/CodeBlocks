from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import os

app = FastAPI(title="CodeBlocks API", version="1.0.0")

# CORS middleware to allow frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class CodeBlock(BaseModel):
    id: int
    title: str
    category: str
    code: str
    explanation: str
    lineExplanations: Optional[Dict[str, str]] = {}

class CodeBlockCreate(BaseModel):
    title: str
    category: str
    code: str
    explanation: str
    lineExplanations: Optional[Dict[str, str]] = {}

class CodeBlockUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    code: Optional[str] = None
    explanation: Optional[str] = None
    lineExplanations: Optional[Dict[str, str]] = None

# Data storage
DATA_FILE = "codeblocks.json"

def load_codeblocks() -> List[dict]:
    """Load code blocks from JSON file"""
    if not os.path.exists(DATA_FILE):
        # Return empty list if file doesn't exist
        return []
    
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
    return data

def save_codeblocks(codeblocks: List[dict]):
    """Save code blocks to JSON file"""
    with open(DATA_FILE, 'w') as f:
        json.dump(codeblocks, f, indent=2)

def get_next_id() -> int:
    """Get the next available ID"""
    codeblocks = load_codeblocks()
    if not codeblocks:
        return 1
    return max(block['id'] for block in codeblocks) + 1

# API Routes
@app.get("/")
async def root():
    return {"message": "CodeBlocks API is running"}

@app.get("/codeblocks", response_model=List[CodeBlock])
async def get_all_codeblocks():
    """Get all code blocks"""
    return load_codeblocks()

@app.get("/codeblocks/{block_id}")
async def get_codeblock(block_id: int):
    """Get a specific code block by ID"""
    codeblocks = load_codeblocks()
    for block in codeblocks:
        if block['id'] == block_id:
            return block
    raise HTTPException(status_code=404, detail="Code block not found")

@app.post("/codeblocks", response_model=CodeBlock)
async def create_codeblock(block: CodeBlockCreate):
    """Create a new code block"""
    codeblocks = load_codeblocks()
    new_block = {
        "id": get_next_id(),
        "title": block.title,
        "category": block.category,
        "code": block.code,
        "explanation": block.explanation,
        "lineExplanations": block.lineExplanations or {}
    }
    
    codeblocks.append(new_block)
    save_codeblocks(codeblocks)
    return new_block

@app.put("/codeblocks/{block_id}")
async def update_codeblock(block_id: int, block_update: CodeBlockUpdate):
    """Update a code block"""
    codeblocks = load_codeblocks()
    for i, block in enumerate(codeblocks):
        if block['id'] == block_id:
            # Update only provided fields
            update_data = block_update.dict(exclude_unset=True)
            for key, value in update_data.items():
                if value is not None:
                    codeblocks[i][key] = value
            save_codeblocks(codeblocks)
            return codeblocks[i]
    
    raise HTTPException(status_code=404, detail="Code block not found")

@app.delete("/codeblocks/{block_id}")
async def delete_codeblock(block_id: int):
    """Delete a code block"""
    codeblocks = load_codeblocks()
    for i, block in enumerate(codeblocks):
        if block['id'] == block_id:
            deleted_block = codeblocks.pop(i)
            save_codeblocks(codeblocks)
            return {"message": "Code block deleted", "block": deleted_block}
    
    raise HTTPException(status_code=404, detail="Code block not found")

@app.get("/categories")
async def get_categories():
    """Get all unique categories"""
    codeblocks = load_codeblocks()
    categories = list(set(block['category'] for block in codeblocks))
    return {"categories": categories}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)