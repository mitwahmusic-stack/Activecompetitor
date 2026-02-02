

export type OfflineTest = {
    id: string;
    title: string;
    duration: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    questions: any[];
    cachedAt: number;
};

export type PendingResult = {
    test_id: string;
    student_id: string;
    score: number;
    total_questions: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    answers: any;
    submitted_at: string;
};

class OfflineManager {
    static TEST_PREFIX = 'offline_exam_';
    static PROGRESS_PREFIX = 'exam_progress_';
    static PENDING_RESULTS_KEY = 'pending_results';

    // Save a full test for offline use
    static saveTest(test: OfflineTest) {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(`${this.TEST_PREFIX}${test.id}`, JSON.stringify(test));
            console.log(`Test ${test.id} cached offline.`);
        } catch (e) {
            console.error('Failed to save test offline:', e);
            alert('Storage full! Please clear some space to take the test offline.');
        }
    }

    // Retrieve a locally cached test
    static getTest(testId: string): OfflineTest | null {
        if (typeof window === 'undefined') return null;
        const data = localStorage.getItem(`${this.TEST_PREFIX}${testId}`);
        return data ? JSON.parse(data) : null;
    }

    // Save student answers during the test (Progress Saving)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static saveProgress(testId: string, answers: any) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(`${this.PROGRESS_PREFIX}${testId}`, JSON.stringify(answers));
    }

    // Get saved progress
    static getProgress(testId: string) {
        if (typeof window === 'undefined') return null;
        const data = localStorage.getItem(`${this.PROGRESS_PREFIX}${testId}`);
        return data ? JSON.parse(data) : null;
    }

    // Clear test data after submission (optional, maybe keep it?)
    static clearTest(testId: string) {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(`${this.TEST_PREFIX}${testId}`);
        localStorage.removeItem(`${this.PROGRESS_PREFIX}${testId}`);
    }

    // Queue a result for sync
    static savePendingResult(result: PendingResult) {
        if (typeof window === 'undefined') return;
        const pending = this.getPendingResults();
        pending.push(result);
        localStorage.setItem(this.PENDING_RESULTS_KEY, JSON.stringify(pending));
    }

    // Get all pending results
    static getPendingResults(): PendingResult[] {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(this.PENDING_RESULTS_KEY);
        return data ? JSON.parse(data) : [];
    }

    // Remove specific pending results (after sync)
    static removePendingResults(submittedAtTimestamps: string[]) {
        if (typeof window === 'undefined') return;
        let pending = this.getPendingResults();
        pending = pending.filter(r => !submittedAtTimestamps.includes(r.submitted_at));
        localStorage.setItem(this.PENDING_RESULTS_KEY, JSON.stringify(pending));
    }
}

export default OfflineManager;
