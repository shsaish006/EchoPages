'use server';

import { connectToDatabase } from '@/database/mongoose';
import Book from '@/database/models/book.model';
import BookSegment from '@/database/models/book-segment.model';
import { searchBookSegments } from '@/lib/actions/book.actions';
import { serializeData } from '@/lib/utils';
import { IBookSummary } from '@/types';

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

// Helper to query Google Gemini 1.5 Flash REST API
async function callGemini(contents: unknown, systemInstruction?: string) {
    if (!GEMINI_API_KEY) {
        throw new Error('GOOGLE_GEMINI_API_KEY is not configured in the environment.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const body: Record<string, unknown> = {
        contents,
        generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        }
    };

    if (systemInstruction) {
        body.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API returned error code ${response.status}: ${errText}`);
    }

    const result = await response.json();
    return result;
}

/**
 * Text-based interactive RAG Chat Companion for a book
 */
export const chatWithBookAction = async (
    bookId: string,
    query: string,
    history: Array<{ role: string; content: string }>
) => {
    try {
        await connectToDatabase();

        // 1. Fetch Book Details
        const book = await Book.findById(bookId).lean();
        if (!book) {
            return { success: false, error: 'Book not found' };
        }

        // 2. Fetch Relevant Segments (RAG)
        const searchResult = await searchBookSegments(bookId, query, 5);
        const segments = searchResult.success ? searchResult.data ?? [] : [];

        // 3. Construct Retrievable Context
        let retrievedText = '';
        if (segments.length > 0) {
            retrievedText = segments
                .map((seg) => `--- [Page ${seg.pageNumber || 'Unknown'}] ---\n${seg.content}`)
                .join('\n\n');
        } else {
            retrievedText = 'No specific segments were retrieved for this query. Use general knowledge about the book.';
        }

        // 4. Map History to Gemini Structure
        const contents = [];
        for (const h of history) {
            contents.push({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }],
            });
        }

        // Prepend context to the user's latest message
        const userPrompt = `You are EchoPages, a highly advanced, intelligent AI reading companion for the book "${book.title}" by ${book.author}.
Your task is to answer the user's questions about this book using the retrieved sections from our library database.
ALWAYS cite the specific page numbers (e.g., [Page X]) from the sources in your response where applicable so the user knows exactly where to read further! 
Do not use generic "AI emojis" or hype words. Keep the tone academic, helpful, and highly professional.

Here are the retrieved sections from the book:
${retrievedText}

User's Question: ${query}`;

        contents.push({
            role: 'user',
            parts: [{ text: userPrompt }],
        });

        // 5. Call Gemini
        const systemInstruction = `You are a helpful, professional, emoji-free literary companion. Answer based on the retrieved context, citing specific pages in the text.`;
        const geminiResponse = await callGemini(contents, systemInstruction);
        const reply = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract cited pages for interactive frontend highlighting
        const citedPages: number[] = [];
        const pageMatches = [...reply.matchAll(/\[Page\s*(\d+)\]/gi)];
        pageMatches.forEach((match) => {
            const pageNum = parseInt(match[1], 10);
            if (!isNaN(pageNum) && !citedPages.includes(pageNum)) {
                citedPages.push(pageNum);
            }
        });

        return {
            success: true,
            reply,
            citedPages,
            sources: serializeData(segments.slice(0, 3)),
        };
    } catch (e) {
        console.error('Error in chatWithBookAction:', e);
        return {
            success: false,
            error: e instanceof Error ? e.message : 'An error occurred during chat processing.',
        };
    }
};

/**
 * Automates creating high-quality book summaries, persistent inside Book record
 */
export const generateBookSummaryAction = async (bookId: string) => {
    try {
        await connectToDatabase();

        // 1. Check if Book already has summary
        const book = await Book.findById(bookId);
        if (!book) {
            return { success: false, error: 'Book not found' };
        }

        if (book.summary && book.summary.executiveSummary) {
            return { success: true, data: serializeData(book.summary) };
        }

        // 2. Fetch first 10 segments (contains Intro/Chapter 1)
        const segments = await BookSegment.find({ bookId })
            .sort({ segmentIndex: 1 })
            .limit(10)
            .lean();

        const introText = segments.map((s) => s.content).join('\n ');

        // 3. Construct prompt
        const prompt = [
            {
                role: 'user',
                parts: [{
                    text: `You are a professional literary analyst. We have extracted the introductory pages of the book "${book.title}" by ${book.author}.
Here is the text content from the first few pages of the book:
---
${introText}
---
Based on the above introduction (and your general literary knowledge of this work), generate a structured analysis.
You MUST return a JSON object with the following exact keys and structure:
{
  "executiveSummary": "A cohesive, detailed 3-4 sentence paragraph summarizing the core theme, thesis, and value proposition of the book.",
  "coreConcepts": ["An array of 4-6 key concepts, methodologies, or pillars introduced in the book."],
  "targetAudience": "A 1-2 sentence description of who would benefit most from reading this book.",
  "suggestedQuestions": ["An array of 4 thought-provoking questions that a reader could ask about this book."]
}

Return ONLY valid, raw JSON. Do not include markdown code block backticks (such as \`\`\`json), explanation text, or extra characters. Ensure it parses cleanly using JSON.parse().`
                }]
            }
        ];

        // 4. Call Gemini
        const geminiResponse = await callGemini(prompt);
        let rawText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Clean markdown backticks if any
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        let parsedSummary: IBookSummary;
        try {
            parsedSummary = JSON.parse(rawText);
        } catch (parseError) {
            console.error('Failed to parse Gemini JSON summary:', rawText);
            throw new Error('Failed to generate summary in a valid structured format. Please try again.');
        }

        // 5. Save Summary to MongoDB
        book.summary = parsedSummary;
        await book.save();

        return {
            success: true,
            data: serializeData(parsedSummary),
        };
    } catch (e) {
        console.error('Error in generateBookSummaryAction:', e);
        return {
            success: false,
            error: e instanceof Error ? e.message : 'An error occurred during summary generation.',
        };
    }
};
