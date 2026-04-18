# Micro Frontend: File Extraction & PDF Generation

Build a system where users can upload files, extract meaningful data using AI, and export a summarized PDF.

## Proposed Architecture

- **Frontend**: React (Vite) + Tailwind CSS (per user request for premium UI).
- **Backend**: Node.js + Express.
- **Data Extraction**: AI agent (Gemini/OpenAI) via server-side API.
- **Persistent Storage**: AWS S3 (Bucket: `agent-logistics-uploads`)
- **Authentication**: JWT-based (Backend middleware + Frontend login view).
- **PDF Generation**: `pdfkit` (server-side).

## Proposed Changes

### [Backend]
Summary: Express server to handle uploads and LLM calls.

#### [MODIFY] [server/index.js](file:///d:/codemill/projects/agent-test/server/index.js) (Add Login & Auth Middleware)

### [Frontend]
Summary: React app for the UI.

#### [MODIFY] [client/src/App.jsx](file:///d:/codemill/projects/agent-test/client/src/App.jsx) (Add Login Screen & Auth State)
#### [NEW] [client/index.html](file:///d:/codemill/projects/agent-test/client/index.html)

## Verification Plan

### Automated Tests
- `npm run dev` for both client and server.
- Test file upload with a sample PDF/Image.

---
> [!IMPORTANT]
> I will use a mock LLM extraction unless a specific API key is provided.
