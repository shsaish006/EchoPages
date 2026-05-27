# EchoPages: Intelligent AI Book Companion

EchoPages is a state-of-the-art interactive AI reading and conversational suite built on the Next.js App Router, MongoDB, Vapi, ElevenLabs, and Google Gemini. The platform converts uploaded PDF documents into structured digital databases, enabling users to engage in either low-latency, back-and-forth verbal conversations or precision text-based discussions with their books. 

Every AI interaction is fully grounded in the book's indexed contents using Retrieval-Augmented Generation (RAG), complete with interactive source citations referencing exact page numbers from the original text.

---

## System Architecture and Theory of Operation

### 1. Document Ingestion and Chunking Strategy
Upon uploading a PDF document, the platform performs client-side extraction to offload heavy processing from serverless functions. 
- **Text Extraction**: The application leverages `pdfjs-dist` to parse individual page layout objects and aggregate raw character text chronologically.
- **Overlapping Semantic Segmentation**: The raw text is tokenized into overlapping segments of approximately 500 words, with a 50-word sliding window overlap. This sliding overlap is crucial for maintaining semantic context across boundary regions.
- **Vector-less Search Indexing**: The parsed segments are saved to MongoDB as independent `BookSegment` documents, featuring compound indexes on `bookId` and `segmentIndex`, alongside a MongoDB full-text index on the `content` field.

### 2. Retrieval-Augmented Generation (RAG) Flow
When a user submits a textual or voice query:
- **Retrieval Phase**: A full-text database query matching search terms is executed with a regex-matching fallback. The top 5 most relevant segments are selected.
- **Context Synthesis**: The content of the retrieved segments is injected into a strict system prompt containing the title, author, and retrieved segments mapped to their respective page numbers.
- **Generation Phase**: The context-heavy prompt is processed by the Google Gemini 1.5 Flash API. The model is constrained to generate answers exclusively from the retrieved context, returning precise markdown output containing page citations (e.g., `[Page 4]`).
- **Interactive Highlighting**: The frontend parses the citations out of the AI response and displays clickable references that load the exact underlying text segment into a dedicated viewport.

### 3. Real-Time Voice Synthesis and Conversation Lifecycle
For auditory sessions:
- The `@vapi-ai/web` SDK establishes a WebRTC connection with a low-latency voice model gateway.
- Vapi acts as the conversational orchestrator, receiving speech from the user, generating live transcript notifications, and hitting EchoPages' server routes `/api/vapi/search-book` dynamically as an AI Tool Call (function calling) to retrieve book facts.
- High-fidelity natural voice output is generated on the fly via ElevenLabs, utilizing custom voice personas.

---

## Technical Specifications and Schemas

### Database Schemas (Mongoose)

#### 1. Book Schema (`Book`)
Stores the master metadata for uploaded books.
```typescript
{
  clerkId: { type: String, required: true },
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  author: { type: String, required: true },
  persona: { type: String },
  fileURL: { type: String, required: true },
  fileBlobKey: { type: String, required: true },
  coverURL: { type: String },
  coverBlobKey: { type: String },
  fileSize: { type: Number, required: true },
  totalSegments: { type: Number, default: 0 },
  summary: {
    type: {
      executiveSummary: { type: String, required: true },
      coreConcepts: [{ type: String }],
      targetAudience: { type: String },
      suggestedQuestions: [{ type: String }],
    },
    default: null
  }
}
```

#### 2. Book Segment Schema (`BookSegment`)
Stores the chunked contents of the parsed PDF.
```typescript
{
  clerkId: { type: String, required: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  content: { type: String, required: true },
  segmentIndex: { type: Number, required: true, index: true },
  pageNumber: { type: Number, index: true },
  wordCount: { type: Number, required: true }
}
```
*Note: Includes a compound index on `{ bookId: 1, segmentIndex: 1 }` and a full-text search index on `{ content: 'text' }`.*

#### 3. Voice Session Schema (`VoiceSession`)
Tracks the user's active auditory study sessions to enforce pricing limit parameters and populate historical learning charts.
```typescript
{
  clerkId: { type: String, required: true, index: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  startedAt: { type: Date, required: true, default: Date.now },
  endedAt: { type: Date },
  durationSeconds: { type: Number, default: 0, required: true },
  billingPeriodStart: { type: Date, required: true, index: true }
}
```

---

## API Documentation

### 1. Vapi Tool Integration `/api/vapi/search-book`
- **Method**: `POST`
- **Description**: Handles dynamic tool execution requests from the Vapi Voice Engine during conversations. It processes search parameters, runs database-level lookups, and returns combined plain-text segments back to the voice model to construct answers.
- **Request Format (Vapi Hook)**:
```json
{
  "message": {
    "toolCalls": [
      {
        "id": "call_12345",
        "function": {
          "name": "searchBook",
          "arguments": {
            "bookId": "64ef89...",
            "query": "What does the author say about asset management?"
          }
        }
      }
    ]
  }
}
```
- **Response Format**:
```json
{
  "results": [
    {
      "toolCallId": "call_12345",
      "result": "Aggregated matching text content representing book segments for grounding speech generation."
    }
  ]
}
```

---

## Environment Variables and Configuration

To configure the application for local development, create a `.env` file in the root directory:

```env
# Application Environment
NODE_ENV='development'
NEXT_PUBLIC_BASE_URL='http://localhost:3000'

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='your_clerk_publishable_key'
CLERK_SECRET_KEY='your_clerk_secret_key'
NEXT_PUBLIC_CLERK_SIGN_IN_URL='/sign-in'
NEXT_PUBLIC_CLERK_SIGN_UP_URL='/sign-up'
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL='/'
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL='/'

# Blob Storage (Vercel Blob)
BLOB_READ_WRITE_TOKEN='your_vercel_blob_read_write_token'

# Database Configuration (MongoDB)
MONGODB_URI='your_mongodb_connection_uri'

# Voice AI Engine (Vapi)
NEXT_PUBLIC_VAPI_API_KEY='your_vapi_api_key'
VAPI_SERVER_SECRET='your_vapi_server_secret'

# LLM Grounding (Google Gemini API)
GOOGLE_GEMINI_API_KEY='your_gemini_api_key'

# Voice Synthesis (ElevenLabs)
ELEVENLABS_API_KEY='your_elevenlabs_api_key'
```

---

## Getting Started

### Installation Workflow
1. Clone the repository:
   ```bash
   git clone https://github.com/shsaish006/EchoPages.git
   cd EchoPages/jsm_bookified
   ```

2. Install runtime and development dependencies:
   ```bash
   npm install
   ```

3. Initialize local database indexes and run the Next.js development server:
   ```bash
   npm run dev
   ```

4. Compile and validate the production bundle for correctness:
   ```bash
   npm run build
   ```
