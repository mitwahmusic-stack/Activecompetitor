'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/components/AuthProvider';
import Loader from '@/app/components/Loader';

type Question = {
    id: string;
    text: string;
    options: string[]; // jsonb comes as array
    correct_answer: number;
};

type TestData = {
    id: string;
    title: string;
    duration: number;
    questions: Question[];
};

function TakeTestContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const testId = searchParams.get('id');
    const { user } = useAuth();

    const [test, setTest] = useState<TestData | null>(null);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [answers, setAnswers] = useState<{ [key: string]: number }>({}); // questionId -> answerIndex
    const [timeLeft, setTimeLeft] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    const timerRef = useRef<NodeJS.Timeout>(null);

    const [isOfflineMode, setIsOfflineMode] = useState(false);

    useEffect(() => {
        const loadTest = async () => {
            // Dynamically import OfflineManager
            const OfflineManager = (await import('@/lib/OfflineManager')).default;

            if (!testId) return;

            // 1. Try Local Storage First
            const localTest = OfflineManager.getTest(testId);

            if (localTest) {
                console.log('Loaded test from local cache');
                setTest(localTest);
                setIsOfflineMode(true);

                // Restore Progress
                const savedProgress = OfflineManager.getProgress(testId);
                if (savedProgress) {
                    setAnswers(savedProgress);
                }

                // TODO: restore timer logic (future improvement)
                // For now, reset timer based on duration
                setTimeLeft(localTest.duration * 60);
                setLoading(false);
                return;
            }

            // 2. If not local, try fetching (Fallback)
            // This presumably shouldn't happen often if we Auto-Cache, but good as backup
            try {
                const { data: testData, error: testError } = await supabase
                    .from('tests')
                    .select('*')
                    .eq('id', testId)
                    .single();

                if (testError) throw testError;

                const { data: qData, error: qError } = await supabase
                    .from('questions')
                    .select('*')
                    .eq('test_id', testId);

                if (qError) throw qError;

                if (testData) {
                    const fullTest = { ...testData, questions: qData || [] };
                    setTest(fullTest);
                    setTimeLeft(testData.duration * 60);

                    // Cache it now just in case
                    OfflineManager.saveTest({
                        id: fullTest.id,
                        title: fullTest.title,
                        duration: fullTest.duration,
                        questions: fullTest.questions,
                        cachedAt: Date.now()
                    });
                }
            } catch (err) {
                console.error(err);
                alert('Could not load test. Check internet or cache.');
                router.push('/student');
            } finally {
                setLoading(false);
            }
        };

        loadTest();
    }, [testId, router]);

    // Timer Logic (Preserved)
    useEffect(() => {
        if (timeLeft > 0 && !isSubmitting && test) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        handleSubmit(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current as NodeJS.Timeout);
    }, [timeLeft, isSubmitting, test]);

    const handleAnswer = async (optionIndex: number) => {
        if (!test) return;
        const qId = test.questions[currentQIndex].id;

        const newAnswers = { ...answers, [qId]: optionIndex };
        setAnswers(newAnswers);

        // Save Progress
        const OfflineManager = (await import('@/lib/OfflineManager')).default;
        OfflineManager.saveProgress(test.id, newAnswers);
    };

    const handleSubmit = async (auto = false) => {
        if (!test || isSubmitting || !user) return;

        // Stop Timer
        clearInterval(timerRef.current as NodeJS.Timeout);

        if (!auto && !confirm('Are you sure you want to submit?')) {
            return;
        }

        setIsSubmitting(true);

        // Calculate Score
        let score = 0;
        const answerDetails = test.questions.map(q => {
            const selected = answers[q.id];
            if (selected === q.correct_answer) score++;
            return { question_id: q.id, answer_index: selected ?? -1 };
        });

        try {
            const resultData = {
                test_id: test.id,
                student_id: user.id,
                score,
                total_questions: test.questions.length,
                answers: answerDetails,
                submitted_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('results')
                .insert(resultData)
                .select()
                .single();

            if (error) throw error;

            // Success - clear local cache
            const OfflineManager = (await import('@/lib/OfflineManager')).default;
            OfflineManager.clearTest(test.id);

            router.replace(`/student/result?id=${data.id}&testId=${test.id}`);
        } catch (err) {
            // Offline Submission Fallback
            console.log('Submission failed, saving locally:', err);

            const OfflineManager = (await import('@/lib/OfflineManager')).default;
            OfflineManager.savePendingResult({
                test_id: test.id,
                student_id: user.id,
                score,
                total_questions: test.questions.length,
                answers: answerDetails,
                submitted_at: new Date().toISOString()
            });

            alert('You are offline. Result saved locally and will sync when online.');
            router.replace('/student'); // Go back to dashboard, sync will happen there
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || !test) return <Loader />;

    const currentQ = test.questions[currentQIndex];
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div style={{ padding: '2rem', paddingBottom: '5rem' }}>
            {/* Sticky Header with Timer */}
            <header style={{
                position: 'fixed',
                top: 0, left: 0, right: 0,
                padding: '1rem',
                background: 'var(--bg-secondary)',
                zIndex: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div style={{ width: '100%', maxWidth: 'var(--max-width)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>Q {currentQIndex + 1} / {test.questions.length}</span>
                    <span style={{
                        color: timeLeft < 60 ? 'var(--danger)' : 'var(--accent-primary)',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        fontVariantNumeric: 'tabular-nums'
                    }}>
                        {formatTime(timeLeft)}
                    </span>
                </div>
            </header>

            <div style={{ marginTop: '4rem' }}>
                <div className="card animate-fade-in" key={currentQ.id}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>{currentQ.text}</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {currentQ.options.map((opt, idx) => {
                            const isSelected = answers[currentQ.id] === idx;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(idx)}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                        background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-primary)',
                                        color: 'white',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{
                                        display: 'inline-block',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        border: '1px solid var(--text-secondary)',
                                        marginRight: '10px',
                                        textAlign: 'center',
                                        lineHeight: '22px',
                                        background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                        borderColor: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'
                                    }}>
                                        {String.fromCharCode(65 + idx)}
                                    </span>
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderTop: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div style={{ width: '100%', maxWidth: 'var(--max-width)', display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn btn-secondary"
                        disabled={currentQIndex === 0}
                        onClick={() => setCurrentQIndex(prev => prev - 1)}
                        style={{ flex: 1, opacity: currentQIndex === 0 ? 0.3 : 1 }}
                    >
                        Prev
                    </button>

                    {currentQIndex === test.questions.length - 1 ? (
                        <button
                            className="btn btn-primary"
                            style={{ flex: 1, background: 'var(--success)' }}
                            onClick={() => handleSubmit(false)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Test'}
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            style={{ flex: 1 }}
                            onClick={() => setCurrentQIndex(prev => prev + 1)}
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function TakeTest() {
    return (
        <Suspense fallback={<Loader />}>
            <TakeTestContent />
        </Suspense>
    );
}
