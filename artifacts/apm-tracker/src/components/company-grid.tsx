import { useState } from 'react';
import type { Company } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ExternalLink,
  Pause,
  WifiOff,
  CheckCheck,
  CircleDashed,
} from 'lucide-react';
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

  const noFeedCompanies = companies.filter((c) => c.error === 'unavailable');
  // Applied-but-currently-closed companies would otherwise look identical
  // to companies that simply never posted (both show jobCount: 0) — keep
  // them in a visibly separate group so the applied history isn't lost.
  const appliedNoOpeningsCompanies = companies.filter(
    (c) => c.error !== 'unavailable' && c.jobCount === 0 && c.hasApplied,
  );
  // A zero count is only a confirmed closure when the latest fetch succeeded.
  // Fetch errors stay in the main grid rather than being mislabeled closed.
  const previouslyPostedClosedCompanies = companies.filter(
    (c) =>
      c.error === null &&
      c.jobCount === 0 &&
      !c.hasApplied &&
      c.hasEverPosted,
  );
  const neverPostedCompanies = companies.filter(
    (c) =>
      c.error === null &&
      c.jobCount === 0 &&
      !c.hasApplied &&
      !c.hasEverPosted,
  );
  const separatedCompanySlugs = new Set([
    ...appliedNoOpeningsCompanies.map((c) => c.slug),
    ...previouslyPostedClosedCompanies.map((c) => c.slug),
    ...neverPostedCompanies.map((c) => c.slug),
  ]);
  const trackedCompanies = companies.filter(
    (c) =>
      c.error !== 'unavailable' &&
      !separatedCompanySlugs.has(c.slug),
  );

  return (
    <div className="space-y-6">
      <CompanyCardGrid
        companies={trackedCompanies}
        onCompanyClick={onCompanyClick}
        selectedCompany={selectedCompany}
        expandedErrors={expandedErrors}
        toggleError={toggleError}
      />

      {previouslyPostedClosedCompanies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Archive className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">
              Previously posted — now closed ({previouslyPostedClosedCompanies.length})
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            These companies have posted a tracked role before, but their feed has no open roles right now.
          </p>
          <CompanyCardGrid
            companies={previouslyPostedClosedCompanies}
            onCompanyClick={onCompanyClick}
            selectedCompany={selectedCompany}
            expandedErrors={expandedErrors}
            toggleError={toggleError}
          />
        </div>
      )}

      {neverPostedCompanies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CircleDashed className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">
              Never posted ({neverPostedCompanies.length})
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            These companies have not returned a tracked role yet. They may still post one later.
          </p>
          <CompanyCardGrid
            companies={neverPostedCompanies}
            onCompanyClick={onCompanyClick}
            selectedCompany={selectedCompany}
            expandedErrors={expandedErrors}
            toggleError={toggleError}
          />
        </div>
      )}

      {appliedNoOpeningsCompanies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCheck className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-muted-foreground">
              Applied — no open postings right now ({appliedNoOpeningsCompanies.length})
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            You've applied here before. These currently have no open roles, but that's different
            from never having applied — check "Show Applied" to see what you sent in.
          </p>
          <CompanyCardGrid
            companies={appliedNoOpeningsCompanies}
            onCompanyClick={onCompanyClick}
            selectedCompany={selectedCompany}
            expandedErrors={expandedErrors}
            toggleError={toggleError}
          />
        </div>
      )}

      {noFeedCompanies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <WifiOff className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">
              No feed — track manually ({noFeedCompanies.length})
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            These companies don't expose a fetchable job feed. Check their career pages directly.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2">
            {noFeedCompanies.map((company, index) => (
              <a
                key={company.slug}
                href={company.careersUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  relative p-3 rounded-md border border-dashed border-card-border bg-muted/30
                  transition-all duration-200 animate-slide-in-up group
                  ${company.careersUrl ? 'hover:border-primary/40 hover:shadow-sm cursor-pointer' : 'opacity-60 pointer-events-none'}
                `}
                style={{ animationDelay: `${index * 20}ms` }}
                data-testid={`company-nofeed-${company.slug}`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight truncate flex-1">
                      {company.name}
                    </h3>
                    {company.careersUrl ? (
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {company.careersUrl ? 'View careers page' : 'No feed'}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface CompanyCardGridProps {
  companies: Company[];
  onCompanyClick: (slug: string) => void;
  selectedCompany: string | null;
  expandedErrors: Set<string>;
  toggleError: (slug: string) => void;
}

function CompanyCardGrid({
  companies,
  onCompanyClick,
  selectedCompany,
  expandedErrors,
  toggleError,
}: CompanyCardGridProps) {
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
                ) : company.hasApplied ? (
                  <CheckCheck
                    className="w-4 h-4 text-primary flex-shrink-0"
                    data-testid={`icon-applied-${company.slug}`}
                  />
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
                  {isPaused
                    ? 'Paused'
                    : isUnavailable
                      ? 'No feed'
                      : company.jobCount === 0 && company.hasApplied
                        ? 'Applied · none open now'
                        : company.jobCount === 0 && company.hasEverPosted
                          ? 'Previously posted · closed'
                          : company.jobCount === 0
                            ? 'Never posted'
                            : company.programName}
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
