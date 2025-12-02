import React, { useState, useEffect } from 'react';
import { SparklesIcon } from '@/components/icons/IconComponents';
import { fetchAiAnalysis } from '@/services/apiService';

const AIStatusSummary: React.FC = () => {
    const [analysis, setAnalysis] = useState<string>("Initializing AI Analysis...");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadAnalysis = async () => {
            try {
                // Don't set loading to true on background refreshes to avoid flickering
                if (!analysis || analysis === "Initializing AI Analysis...") {
                    setLoading(true);
                }
                
                const data = await fetchAiAnalysis();
                
                if (isMounted) {
                    setAnalysis(data.analysis);
                }
            } catch (error) {
                console.error("AI Analysis Error:", error);
                if (isMounted) {
                    setAnalysis("System is operating. AI connection currently unavailable.");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        // 1. Load immediately on mount
        loadAnalysis();

        // 2. Refresh every 60 seconds to keep analysis current
        const interval = setInterval(loadAnalysis, 60000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="bg-brand-surface p-6 rounded-lg shadow border border-brand-border flex items-start gap-4 transition-colors duration-300">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-full flex-shrink-0">
                {/* Animated Sparkles to show AI is 'alive' */}
                <SparklesIcon className={`w-6 h-6 text-brand-primary ${loading ? 'animate-pulse' : ''}`} />
            </div>
            <div>
                <h3 className="text-lg font-bold text-brand-text mb-1 flex items-center gap-2">
                    AI System Analysis
                    {loading && <span className="text-xs font-normal text-brand-muted animate-pulse">(Updating...)</span>}
                </h3>
                <p className="text-sm text-brand-muted leading-relaxed">
                    {loading && analysis === "Initializing AI Analysis..." ? (
                        <span className="animate-pulse">Analyzing real-time telemetry stream...</span>
                    ) : (
                        analysis
                    )}
                </p>
            </div>
        </div>
    );
};

export default AIStatusSummary;