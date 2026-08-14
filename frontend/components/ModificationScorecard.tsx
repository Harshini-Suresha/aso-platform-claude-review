"use client";

interface ModScore {
  score: number;
  rationale: string;
}

interface ModificationScores {
  modality: string;
  scores: Record<string, ModScore>;
  overallScore: number;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-400";
  return "bg-red-400";
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default function ModificationScorecard({ scores }: { scores: ModificationScores }) {
  const entries = Object.entries(scores.scores);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">Modification Scoring</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Overall</span>
          <span className={`text-[15px] font-bold ${scoreColor(scores.overallScore)}`}>
            {scores.overallScore}/100
          </span>
        </div>
      </div>

      {/* Overall score ring */}
      <div className="flex items-center justify-center mb-4">
        <svg viewBox="0 0 80 80" className="w-20 h-20">
          <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke={scores.overallScore >= 75 ? "#10b981" : scores.overallScore >= 50 ? "#f59e0b" : "#ef4444"}
            strokeWidth="6"
            strokeDasharray={`${(scores.overallScore / 100) * 213.6} 213.6`}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
          <text x="40" y="38" textAnchor="middle" className="fill-slate-700" fontSize="16" fontWeight="700">
            {scores.overallScore}
          </text>
          <text x="40" y="50" textAnchor="middle" className="fill-slate-400" fontSize="7">
            / 100
          </text>
        </svg>
      </div>

      {/* Individual scores */}
      <div className="space-y-2.5">
        {entries.map(([key, score]) => (
          <div key={key}>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="font-medium text-slate-600">{formatKey(key)}</span>
              <span className={`font-mono font-semibold ${scoreColor(score.score)}`}>
                {score.score}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${scoreBg(score.score)} transition-all`}
                style={{ width: `${score.score}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{score.rationale}</p>
          </div>
        ))}
      </div>
    </>
  );
}
