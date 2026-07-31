import { useState } from 'react';
import type { Company } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Pause, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CompanyGridProps {
  companies: Company[];
  onCompanyClick: (slug: string) => void;
  selectedCompany: string | null;
  isLoading?: boolean;
}

export function CompanyGrid({ companies, onCompanyClick, selectedCompany, isLoading }: CompanyGridProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2">
        {Array.from({ length: 21 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  const toggleError = (slug: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(slug)) {
      newExpanded.delete(slug);
    } else {
      newExpanded.add(slug);
    }
    setExpandedErrors(newExpanded);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2">
      {companies.map((company, index) => {
        const isSelected = selectedCompany === company.slug;
        const isPaused = company.programStatus === 'paused';
        const isUnavailable = company.error === 'unavailable';
        const hasRealError = !!company.error && !isUnavailable;
        const isExpanded = expandedErrors.has(company.slug);

        return (
          <button
            key={company.slug}
            onClick={() => onCompanyClick(company.slug)}
            className={`
              relative p-3 rounded-md border transition-all duration-200 text-left
              animate-slide-in-up hover:shadow-sm group
              ${
                isSelected
                  ? 'bg-primary/5 border-primary/60 shadow-sm'
                  : 'bg-card border-card-border hover:border-primary/30'
              }
              ${isPaused || isUnavailable ? 'opacity-60' : ''}
            `}
            style={{ animationDelay: `${index * 20}ms` }}
            data-testid={`company-${company.slug}`}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm leading-tight truncate flex-1">
                  {company.name}
                </h3>
                {isPaused ? (
                  <Pause className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : isUnavailable ? (
                  <WifiOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                ) : hasRealError ? (
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                ) : company.jobCount > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={company.jobCount > 0 ? 'default' : 'secondary'}
                  className="font-mono text-xs h-5 px-1.5"
                >
                  {company.jobCount}
                </Badge>
                <span className="text-xs text-muted-foreground truncate">
                  {isPaused ? 'Paused' : isUnavailable ? 'No feed' : company.programName}
                </span>
              </div>

              {!isUnavailable && company.lastCheckedAt && (
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(company.lastCheckedAt), { addSuffix: true })}
                </div>
              )}

              {hasRealError && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleError(company.slug);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleError(company.slug);
                    }
                  }}
                  className="inline-block text-xs text-destructive underline"
                >
                  {isExpanded ? 'Hide error' : 'Show error'}
                </span>
              )}
            </div>

            {hasRealError && isExpanded && (
              <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-destructive/10 border border-destructive/20 rounded-md z-10 text-xs text-foreground">
                {company.error}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
