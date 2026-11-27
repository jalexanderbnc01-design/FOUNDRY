# FOUNDRY — STAGE 3 KNOWN LIMITATIONS

## 1. Binary Document Text Extraction
- **Current Capability**: Text-based formats (`.txt`, `.md`, `.csv`, `.html`) are extracted with structured heading and paragraph segmentation.
- **Limitation**: Complex binary documents (`.pdf`, `.docx`, `.pptx`, `.xlsx`) decode raw text when text streams are available. Complex encrypted PDFs, scanned raster PDFs requiring OCR, or complex table hierarchies in `.xlsx` will require native Node binary parser packages (`pdf-parse`, `mammoth`) in a future update.

## 2. Google Workspace Live API Execution
- **Current Capability**: All 8 service adapters are fully implemented with real HTTP requests and endpoint parsing.
- **Limitation**: Google Workspace live API requests require an active user sign-in through Firebase Auth GoogleAuthProvider. Until the user signs in with a Google account, API calls truthfully report `AUTH_REQUIRED: Google account is not connected or authorization expired.`

## 3. Ollama Embedding Warm-up
- **Current Capability**: Local keyword retrieval is instantaneous.
- **Limitation**: If using cold local embedding models in Ollama (`nomic-embed-text`), the initial model load into memory may take 5–10 seconds. The RAG engine gracefully falls back to keyword BM25 retrieval without failing user requests.
