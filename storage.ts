export type Question = {
    id: string;
    text: string;
    options: string[];
    correctAnswer: number; // index of the correct option
};

export type TestItem = {
    id: string;
    title: string;
    duration: number; // in minutes
    questions: Question[];
    createdAt: number;
};

export type Result = {
    id: string;
    testId: string;
    studentName: string;
    score: number;
    totalQuestions: number;
    answers: { questionId: string; answerIndex: number }[]; // answerIndex can be -1 if skipped
    date: number;
};

const TESTS_KEY = 'coaching_app_tests';
const RESULTS_KEY = 'coaching_app_results';

// Helper to safely access localStorage (client-side only)
const getStorage = (key: string) => {
    if (typeof window === 'undefined') return [];
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setStorage = (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
};

export const storage = {
    getTests: (): TestItem[] => getStorage(TESTS_KEY),

    saveTest: (test: TestItem) => {
        const tests = getStorage(TESTS_KEY);
        tests.push(test);
        setStorage(TESTS_KEY, tests);
    },

    updateTest: (updatedTest: TestItem) => {
        const tests = getStorage(TESTS_KEY);
        const index = tests.findIndex((t: TestItem) => t.id === updatedTest.id);
        if (index !== -1) {
            tests[index] = updatedTest;
            setStorage(TESTS_KEY, tests);
        }
    },

    deleteTest: (testId: string) => {
        const tests = getStorage(TESTS_KEY);
        const newTests = tests.filter((t: TestItem) => t.id !== testId);
        setStorage(TESTS_KEY, newTests);
    },

    getResults: (): Result[] => getStorage(RESULTS_KEY),

    saveResult: (result: Result) => {
        const results = getStorage(RESULTS_KEY);
        results.push(result);
        setStorage(RESULTS_KEY, results);
    },

    // For cleanup/debug
    clearAll: () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(TESTS_KEY);
        localStorage.removeItem(RESULTS_KEY);
    }
};
