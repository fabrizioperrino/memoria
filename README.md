# memorIA

An AI-powered study assistant that transforms documents into structured learning material. Upload a PDF, paste text, or import a URL — memorIA extracts the content and generates summaries, flashcards, exam questions, and key concepts automatically.

**Live demo:** [memoria-iaapp.vercel.app](https://memoria-iaapp.vercel.app)

---

## Features

- **Document ingestion** — PDF (text-based and scanned), images (JPG, PNG, WEBP), plain text, and URL import
- **AI-generated study material** — summary, flashcards, exam questions, and key concepts extracted from each document
- **RAG-powered chat** — ask questions about any document using retrieval-augmented generation (pgvector similarity search)
- **Spaced repetition** — flashcard review system based on the SM-2 algorithm (same as Anki)
- **Quiz and exam modes** — timed practice with immediate feedback
- **Study plans** — auto-generated multi-day plans based on document content
- **Document sharing** — shareable public links per document, no login required to view
- **User profiles** — streak tracking, faculty, and session statistics

---

## Architecture

```
memoria/
├── backend/          # FastAPI REST API (Python)
└── frontend/         # Next.js web application (TypeScript)
```

### Backend

| Layer | Technology |
|---|---|
| API framework | FastAPI 0.115 |
| PDF extraction | PyMuPDF |
| Vision (scanned PDFs / images) | Groq Vision (llama-3.3-70b-versatile) |
| LLM (structured generation) | Groq API |
| Embeddings (RAG) | OpenAI text-embedding-3-small |
| Database + auth | Supabase (PostgreSQL + pgvector) |
| HTTP client | httpx |
| HTML parsing (URL import) | BeautifulSoup4 |

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Auth | Supabase Auth |
| Deployment | Vercel |

---

## How it works

1. **Ingestion** — The user uploads a file or pastes a URL. The backend responds immediately and processes the document in a background task.
2. **Text extraction** — PyMuPDF extracts text from text-based PDFs. If the PDF is scanned (no selectable text), the pages are rendered as images and processed via Groq Vision.
3. **Structured generation** — The extracted text is split into chunks with overlap and sent to the LLM, which returns a structured JSON object containing the summary, flashcards, exam questions, and key concepts.
4. **Embedding and storage** — If OpenAI is configured, the text is chunked further and stored as vector embeddings in Supabase using pgvector, enabling semantic search for the chat feature.
5. **Display** — The frontend polls for document status and renders the generated material once processing is complete.

---

## Local setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project with pgvector enabled
- A [Groq](https://console.groq.com) API key
- (Optional) An [OpenAI](https://platform.openai.com) API key for RAG chat

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
cp env.example .env           # fill in your keys
python run_api.py
```

The API will be available at `http://localhost:8000`. Interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # fill in your keys
npm run dev
```

The app will be available at `http://localhost:3000`.

### Environment variables

**Backend** (`backend/.env`):

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | Model name (e.g. `llama-3.3-70b-versatile`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase dashboard |
| `OPENAI_API_KEY` | (Optional) Enables RAG chat |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |

**Frontend** (`frontend/.env.local`):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |

---

## API overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/documents/upload` | Upload a PDF or image |
| POST | `/documents/upload-text` | Submit plain text |
| POST | `/documents/import-url` | Import content from a URL |
| GET | `/documents/` | List user documents |
| GET | `/documents/{id}` | Get a single document |
| DELETE | `/documents/{id}` | Delete a document |
| POST | `/documents/{id}/share` | Generate a shareable link |
| POST | `/chat/{id}` | Chat with a document (RAG) |
| POST | `/quiz/{id}/answer` | Submit a quiz answer |
| POST | `/review/{id}` | Submit a flashcard review (SM-2) |
| GET | `/study-plan/{id}` | Get the study plan for a document |
| GET | `/stats` | Get user statistics |

Full interactive documentation available at `/docs` when running locally.

---

## License

MIT
