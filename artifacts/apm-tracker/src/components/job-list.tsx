import { ExternalLink } from 'lucide-react';
import type { Job } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';

interface JobListProps {
  jobs: Job[];
  isLoading?: boolean;
}

export function JobList({ jobs, isLoading }: JobListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-muted rounded-md animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-2 border-muted-foreground/20 rounded-full" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No positions found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          These programs open seasonally. Try adjusting your filters or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job, index) => (
        <a
          key={job.id}
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group block p-4 bg-card border border-card-border rounded-md hover:border-primary/40 transition-all duration-200 hover:shadow-sm animate-slide-in-up"
          style={{ animationDelay: `${index * 30}ms` }}
          data-testid={`job-listing-${job.id}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  {job.title}
                </h3>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">{job.company}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{job.location}</span>
                {job.postedOn && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground text-xs">{job.postedOn}</span>
                  </>
                )}
              </div>
            </div>
            <Badge variant="outline" className="flex-shrink-0 font-mono text-xs">
              {job.source}
            </Badge>
          </div>
        </a>
      ))}
    </div>
  );
}
