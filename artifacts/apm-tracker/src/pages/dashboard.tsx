import { useState, useMemo } from 'react';
import { Search, RefreshCw, Loader2, Mail } from 'lucide-react';
import {
  useListJobs,
  useListCompanies,
  useGetJobStats,
  useRefreshJobs,
  useSendDigest,
  useSetJobApplied,
  getListJobsQueryKey,
  getListCompaniesQueryKey,
  getGetJobStatsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { JobList } from '@/components/job-list';
import { StatsBar } from '@/components/stats-bar';
import { CompanyGrid } from '@/components/company-grid';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [showApplied, setShowApplied] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobs, isLoading: jobsLoading } = useListJobs({
    ...(selectedCompany ? { company: selectedCompany } : {}),
    ...(searchQuery ? { q: searchQuery } : {}),
    status: showApplied ? 'applied' : 'open',
  });

  const { data: companies, isLoading: companiesLoading } = useListCompanies();
  const { data: stats, isLoading: statsLoading } = useGetJobStats();

  const invalidateJobData = () => {
    queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetJobStatsQueryKey() });
  };

  const setAppliedMutation = useSetJobApplied({
    mutation: {
      onSuccess: (_result, variables) => {
        invalidateJobData();
        const applied = variables.data.applied;
        toast({
          title: applied ? 'Marked as applied' : 'Moved back to open',
          description: applied
            ? "It's tucked under \"Show Applied\" whenever you want to check back."
            : 'This posting is back in your open positions.',
        });
      },
      onError: () => {
        toast({
          title: 'Could not update that job',
          description: 'Please try again.',
          variant: 'destructive',
        });
      },
    },
  });

  const handleToggleApplied = (jobId: string, applied: boolean) => {
    setAppliedMutation.mutate({ data: { jobId, applied } });
  };

  const digestMutation = useSendDigest({
    mutation: {
      onSuccess: (result) => {
        const totalJobs = result.totalJobs ?? 0;
        toast({
          title: 'Digest sent!',
          description:
            totalJobs > 0
              ? `${totalJobs} role${totalJobs !== 1 ? 's' : ''} across ${result.companiesWithJobs ?? 0} companies sent to your inbox.`
              : 'No open roles today — sent a "nothing open" email so you know the tracker is alive.',
        });
      },
      onError: () => {
        toast({
          title: 'Failed to send digest',
          description: 'Check that RESEND_API_KEY and NOTIFY_EMAIL are set correctly.',
          variant: 'destructive',
        });
      },
    },
  });

  const refreshMutation = useRefreshJobs({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetJobStatsQueryKey() });

        if (result.errors.length > 0) {
          toast({
            title: 'Refresh completed with errors',
            description: `${result.totalJobs} jobs found from ${result.companiesChecked} companies. ${result.errors.length} companies failed.`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Data refreshed',
            description: `${result.totalJobs} jobs found from ${result.companiesChecked} companies.`,
          });
        }
      },
      onError: () => {
        toast({
          title: 'Refresh failed',
          description: 'Unable to refresh job listings. Please try again.',
          variant: 'destructive',
        });
      },
    },
  });

  const handleCompanyClick = (slug: string) => {
    setSelectedCompany((current) => (current === slug ? null : slug));
  };

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  const displayedJobs = useMemo(() => jobs || [], [jobs]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                APM <span className="text-primary">Radar</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Track {companies?.length || 21} APM/RPM programs in real-time
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => digestMutation.mutate()}
                disabled={digestMutation.isPending}
                size="sm"
                variant="outline"
                className="gap-2"
                data-testid="button-send-digest"
              >
                {digestMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {digestMutation.isPending ? 'Sending...' : 'Send Digest'}
              </Button>

              <Button
                onClick={handleRefresh}
                disabled={refreshMutation.isPending}
                size="sm"
                className="gap-2"
                data-testid="button-refresh-jobs"
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Bar */}
        <StatsBar stats={stats} isLoading={statsLoading} />

        {/* Company Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Companies</h2>
          <CompanyGrid
            companies={companies || []}
            onCompanyClick={handleCompanyClick}
            selectedCompany={selectedCompany}
            isLoading={companiesLoading}
          />
        </div>

        {/* Search & Job List */}
        <div>
          <div className="flex items-center gap-2 mb-4 border-b border-border">
            <button
              type="button"
              onClick={() => setShowApplied(false)}
              className={`px-1 pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                !showApplied
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-show-open"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setShowApplied(true)}
              className={`px-1 pb-2 ml-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                showApplied
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-show-applied"
            >
              Show Applied{stats?.appliedJobs ? ` (${stats.appliedJobs})` : ''}
            </button>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search job titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-jobs"
              />
            </div>
            {selectedCompany && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCompany(null)}
                data-testid="button-clear-company-filter"
              >
                Clear filter
              </Button>
            )}
          </div>

          <JobList
            jobs={displayedJobs}
            isLoading={jobsLoading}
            showApplied={showApplied}
            onToggleApplied={handleToggleApplied}
            isUpdatingJobId={
              setAppliedMutation.isPending ? setAppliedMutation.variables?.data.jobId : undefined
            }
          />
        </div>
      </main>
    </div>
  );
}
