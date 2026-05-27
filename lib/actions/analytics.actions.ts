'use server';

import { connectToDatabase } from '@/database/mongoose';
import VoiceSession from '@/database/models/voice-session.model';
import { auth } from '@clerk/nextjs/server';
import { serializeData } from '@/lib/utils';

/**
 * Aggregates voice chat learning sessions history and analytics for a book and user
 */
export const getBookAnalyticsAction = async (bookId: string) => {
    try {
        await connectToDatabase();

        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        const sessions = await VoiceSession.find({
            clerkId: userId,
            bookId,
        })
            .sort({ startedAt: -1 })
            .lean();

        const totalSessions = sessions.length;
        const totalDurationSeconds = sessions.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);

        return {
            success: true,
            data: {
                totalSessions,
                totalDurationSeconds,
                sessions: serializeData(sessions),
            }
        };
    } catch (e) {
        console.error('Error fetching book analytics:', e);
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Failed to fetch book voice analytics.',
        };
    }
};
