import { Building2, Briefcase, Activity, CheckCircle2 } from 'lucide-react';
import type { JobStats } from '@workspace/api-client-react';
import { formatDistanceToNow } from 'date-fns';

interface StatsBarProps {
  stats: JobStats | undefined;
  isLoading?: boolean;
}

export function StatsBar({ stats, isLoading }: StatsBarProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-card border border-card-border rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="p-4 bg-card border border-card-border rounded-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-foreground" data-testid="stat-total-jobs">
              {stats.totalJobs}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Open Positions</div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-card border border-card-border rounded-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-foreground" data-testid="stat-active-companies">
              {stats.companiesWithJobs}/{stats.totalCompanies}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Companies Hiring</div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-card border border-card-border rounded-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-foreground" data-testid="stat-applied-jobs">
              {stats.appliedJobs}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Applied Positions</div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-card border border-card-border rounded-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground" data-testid="stat-last-refresh">
              {stats.lastRefreshAt
                ? formatDistanceToNow(new Date(stats.lastRefreshAt), { addSuffix: true })
                : 'Never'}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Last Updated</div>
          </div>
        </div>
      </div>
    </div>
  );
}
